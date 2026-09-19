$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class ZoraDesktopNative {
 public delegate bool EnumProc(IntPtr hwnd, IntPtr parameter);
 [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left,Top,Right,Bottom; }
 [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X,Y; public POINT(int x,int y){X=x;Y=y;} }
 [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx,dy; public uint mouseData,dwFlags,time; public UIntPtr dwExtraInfo; }
 [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk,wScan; public uint dwFlags,time; public UIntPtr dwExtraInfo; }
 [StructLayout(LayoutKind.Explicit)] public struct INPUTUNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
 [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public INPUTUNION U; }
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback,IntPtr parameter);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
 [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hwnd);
 [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hwnd,int command);
 [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hwnd);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hwnd,StringBuilder text,int max);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint processId);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd,out RECT rectangle);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT point);
 [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr hwnd,uint flags);
 [DllImport("user32.dll",SetLastError=true)] static extern uint SendInput(uint count,INPUT[] inputs,int size);
 public static IntPtr[] VisibleWindows(){var list=new List<IntPtr>();EnumWindows((h,p)=>{if(IsWindowVisible(h))list.Add(h);return true;},IntPtr.Zero);return list.ToArray();}
 public static string Title(IntPtr h){var b=new StringBuilder(1024);GetWindowText(h,b,b.Capacity);return b.ToString();}
 public static uint ProcessId(IntPtr h){uint id;GetWindowThreadProcessId(h,out id);return id;}
 static void Send(INPUT[] inputs){if(SendInput((uint)inputs.Length,inputs,Marshal.SizeOf(typeof(INPUT)))!=inputs.Length)throw new Exception("Windows rejected input delivery");}
 static INPUT Key(ushort vk,ushort scan,uint flags){var i=new INPUT();i.type=1;i.U.ki=new KEYBDINPUT{wVk=vk,wScan=scan,dwFlags=flags};return i;}
 public static void Text(string text){var list=new List<INPUT>();foreach(char c in text){list.Add(Key(0,c,4));list.Add(Key(0,c,6));}Send(list.ToArray());}
 public static void Keys(ushort vk,bool control){var list=new List<INPUT>();uint flags=(vk>=0x21&&vk<=0x28)||vk==0x2E?1u:0u;if(control)list.Add(Key(0x11,0,0));list.Add(Key(vk,0,flags));list.Add(Key(vk,0,flags|2));if(control)list.Add(Key(0x11,0,2));Send(list.ToArray());}
 public static void Click(){var down=new INPUT();down.type=0;down.U.mi.dwFlags=2;var up=new INPUT();up.type=0;up.U.mi.dwFlags=4;Send(new[]{down,up});}
}
'@
[void][ZoraDesktopNative]::SetProcessDPIAware()

function Find-JianyingExecutable {
 $roots = @((Join-Path $env:LOCALAPPDATA 'JianyingPro/Apps'))
 foreach ($registryRoot in @('HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall','HKLM:/Software/Microsoft/Windows/CurrentVersion/Uninstall','HKLM:/Software/WOW6432Node/Microsoft/Windows/CurrentVersion/Uninstall')) {
  if (Test-Path $registryRoot) {
   foreach ($entry in (Get-ItemProperty ($registryRoot+'/*') -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match '^\u526a\u6620\u4e13\u4e1a\u7248$|^Jianying' })) {
    if ($entry.InstallLocation) { $roots += [string]$entry.InstallLocation }
    if ([string]$entry.DisplayIcon -match '^"?(.+?\.exe)') { $roots += [IO.Path]::GetDirectoryName($Matches[1]) }
   }
  }
 }
 foreach ($root in ($roots | Select-Object -Unique)) {
  if (-not (Test-Path -LiteralPath $root -PathType Container)) { continue }
  $installRoot = [IO.Path]::GetFullPath($root)
  $direct = Join-Path $installRoot 'JianyingPro.exe'
  if (Test-Path -LiteralPath $direct -PathType Leaf) { return $direct }
  $candidate = Get-ChildItem -LiteralPath $installRoot -Filter JianyingPro.exe -File -Recurse -Depth 3 -ErrorAction SilentlyContinue | Where-Object { $_.FullName.StartsWith($installRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($candidate) { return $candidate.FullName }
 }
 return $null
}

function Get-JianyingWindow([IntPtr]$WindowHandle) {
 if (-not [ZoraDesktopNative]::IsWindow($WindowHandle) -or -not [ZoraDesktopNative]::IsWindowVisible($WindowHandle)) { throw 'Target window does not exist or is not visible' }
 $targetProcess = Get-Process -Id ([ZoraDesktopNative]::ProcessId($WindowHandle)) -ErrorAction Stop
 if ($request.scope -ne 'desktop' -and $targetProcess.ProcessName -ne 'JianyingPro') { throw 'Only JianyingPro.exe windows are allowed in this tool' }
 $bounds = New-Object ZoraDesktopNative+RECT
 if (-not [ZoraDesktopNative]::GetWindowRect($WindowHandle,[ref]$bounds)) { throw 'Cannot read target window bounds' }
 return @{windowId=$WindowHandle.ToInt64().ToString();title=[ZoraDesktopNative]::Title($WindowHandle);pid=$targetProcess.Id;rect=@{x=$bounds.Left;y=$bounds.Top;width=($bounds.Right-$bounds.Left);height=($bounds.Bottom-$bounds.Top)}}
}
function Set-VerifiedForeground([IntPtr]$WindowHandle) {
 if ([ZoraDesktopNative]::IsIconic($WindowHandle)) { throw 'Target is minimized; restore it before requesting input' }
 [void][ZoraDesktopNative]::SetForegroundWindow($WindowHandle)
 Start-Sleep -Milliseconds 100
 if ([ZoraDesktopNative]::GetForegroundWindow() -ne $WindowHandle) { throw 'Target did not become foreground; no input sent' }
 [void](Get-JianyingWindow $WindowHandle)
}
try {
 $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
 $action = [string]$request.action
 if ($action -in @('openApp','listApps','launchApp')) {
  $apps = @(Get-StartApps | Sort-Object Name)
  if ($action -eq 'openApp') {
   $name = [string]$request.name
   if (-not $name.Trim()) { throw 'Application name is required' }
   $matches = @($apps | Where-Object { $_.Name -eq $name })
   if ($matches.Count -eq 0) { $matches = @($apps | Where-Object { $_.Name.IndexOf($name,[StringComparison]::OrdinalIgnoreCase) -ge 0 }) }
   if ($matches.Count -ne 1) { throw 'Application not found or ambiguous; specify a more exact name' }
   $request | Add-Member -NotePropertyName appId -NotePropertyValue $matches[0].AppID -Force
  }
  if ($action -eq 'listApps') {
   $query = [string]$request.query
   if ($query) { $apps = @($apps | Where-Object { $_.Name.IndexOf($query,[StringComparison]::OrdinalIgnoreCase) -ge 0 -or $_.AppID.IndexOf($query,[StringComparison]::OrdinalIgnoreCase) -ge 0 }) }
   $result = @{ok=$true;apps=@($apps | Select-Object -First 100 | ForEach-Object { @{name=$_.Name;appId=$_.AppID} });truncated=($apps.Count -gt 100)}
  } else {
   $app = @($apps | Where-Object { $_.AppID -ceq [string]$request.appId }) | Select-Object -First 1
   if (-not $app) { throw 'App ID is not in the installed application catalog; listApps first' }
   if ($app.AppID -match '["\r\n]') { throw 'Unsupported application identifier' }
   if ([IO.Path]::IsPathRooted($app.AppID)) {
    if ([IO.Path]::GetExtension($app.AppID) -ne '.exe' -or -not (Test-Path -LiteralPath $app.AppID -PathType Leaf)) { throw 'Installed executable is unavailable' }
    Start-Process -FilePath $app.AppID -WindowStyle Normal
   } else {
    Start-Process -FilePath (Join-Path $env:WINDIR 'explorer.exe') -ArgumentList ('"shell:AppsFolder\'+$app.AppID+'"') -WindowStyle Normal
   }
   $pattern = [regex]::Escape($app.Name)
   if ($app.Name -match 'WeChat|Weixin|微信') { $pattern = 'WeChat|Weixin|微信' }
   $windows = @()
   for ($attempt=0; $attempt -lt 12; $attempt++) {
    Start-Sleep -Milliseconds 300
    $windows = @(Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and ($_.ProcessName -match $pattern -or $_.MainWindowTitle -match $pattern) } | ForEach-Object { @{windowId=$_.MainWindowHandle.ToInt64().ToString();title=$_.MainWindowTitle;pid=$_.Id;process=$_.ProcessName} })
    if ($windows.Count -gt 0) { break }
   }
   $result = @{ok=$true;launchRequested=$true;app=@{name=$app.Name;appId=$app.AppID};windowVerified=($windows.Count -gt 0);windows=$windows}
  }
 } elseif ($action -eq 'listWindows') {
  $windows = @([ZoraDesktopNative]::VisibleWindows() | ForEach-Object { try { Get-JianyingWindow $_ } catch {} })
  $result = @{ok=$true;windows=$windows;installedPath=(Find-JianyingExecutable)}
 } elseif ($action -eq 'launchJianying') {
  $candidate = Find-JianyingExecutable
  if (-not $candidate) { throw 'JianyingPro.exe was not found in the fixed install directory' }
  # This is the explicitly requested interactive application, not a background helper.
  $launched = Start-Process -FilePath $candidate -WindowStyle Normal -PassThru
  $result = @{ok=$true;pid=$launched.Id;launched=$true}
 } elseif ($action -in @('focus','captureWindow','readWindow','click','type','keys')) {
  if ([string]$request.windowId -notmatch '^\d{1,20}$') { throw 'Invalid target window identifier' }
  $handle = [IntPtr]([Int64]::Parse([string]$request.windowId))
  $window = Get-JianyingWindow $handle
  if ($action -eq 'focus') {
   [void][ZoraDesktopNative]::ShowWindowAsync($handle,9)
   Set-VerifiedForeground $handle
   $result=@{ok=$true;window=$window;focused=$true}
  } elseif ($action -eq 'captureWindow') {
   if ([ZoraDesktopNative]::IsIconic($handle)) { throw 'Target is minimized; screenshot unavailable' }
   if ([ZoraDesktopNative]::GetForegroundWindow() -ne $handle) { throw 'Target must be foreground for an unobstructed screenshot' }
   Add-Type -AssemblyName System.Drawing
   $bitmap = New-Object System.Drawing.Bitmap($window.rect.width,$window.rect.height)
   $graphics = [Drawing.Graphics]::FromImage($bitmap)
   $stream = New-Object IO.MemoryStream
   try {
    $graphics.CopyFromScreen($window.rect.x,$window.rect.y,0,0,$bitmap.Size)
    $bitmap.Save($stream,[Drawing.Imaging.ImageFormat]::Png)
    $result = @{ok=$true;window=$window;imageUrl=('data:image/png;base64,'+[Convert]::ToBase64String($stream.ToArray()));coordinateSpace='window';width=$bitmap.Width;height=$bitmap.Height}
   } finally { $graphics.Dispose();$bitmap.Dispose();$stream.Dispose() }
  } elseif ($action -eq 'readWindow') {
   $element = [System.Windows.Automation.AutomationElement]::FromHandle($handle)
   if ($null -eq $element) { throw 'UI Automation could not access this window' }
   $nodes = $element.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
   $builder = New-Object System.Text.StringBuilder
   $elementRecords = New-Object 'System.Collections.Generic.List[object]'
   for ($i=0; $i -lt [Math]::Min($nodes.Count,1000) -and $builder.Length -lt 15000; $i++) {
    try {
     $current=$nodes.Item($i).Current
     if ($current.IsOffscreen) { continue }
     $bounds=$current.BoundingRectangle
     if ($bounds.IsEmpty -or $bounds.Width -le 0 -or $bounds.Height -le 0) { continue }
     $relativeX=$bounds.X-$window.rect.x;$relativeY=$bounds.Y-$window.rect.y
     if ($relativeX -lt 0 -or $relativeY -lt 0 -or $relativeX+$bounds.Width -gt $window.rect.width -or $relativeY+$bounds.Height -gt $window.rect.height) { continue }
     $label=$current.Name
     if ($label) { [void]$builder.AppendLine($label) }
     if ($elementRecords.Count -lt 100) {
      if ($label.Length -gt 500) { $label=$label.Substring(0,500) }
      $elementRecords.Add(@{name=$label;controlType=$current.ControlType.ProgrammaticName;rect=@{x=$relativeX;y=$relativeY;width=$bounds.Width;height=$bounds.Height}})
     }
    } catch {}
   }
   $text=$builder.ToString();if ($text.Length -gt 15000) { $text=$text.Substring(0,15000) }
   $result=@{ok=$true;window=$window;text=$text;elements=@($elementRecords.ToArray());truncated=($nodes.Count -gt 1000 -or $builder.Length -gt 15000 -or $elementRecords.Count -ge 100);source='UIAutomation'}
  } else {
   Set-VerifiedForeground $handle
   $window = Get-JianyingWindow $handle
   if ($action -eq 'click') {
    $x=[double]$request.x;$y=[double]$request.y
    if ($x -ne [Math]::Floor($x) -or $y -ne [Math]::Floor($y) -or $x -lt 0 -or $y -lt 0 -or $x -ge $window.rect.width -or $y -ge $window.rect.height) { throw 'Click coordinates are outside target window' }
    $screenX=[int]($window.rect.x+$x);$screenY=[int]($window.rect.y+$y)
    $hit=[ZoraDesktopNative]::WindowFromPoint((New-Object ZoraDesktopNative+POINT($screenX,$screenY)))
    if ([ZoraDesktopNative]::GetAncestor($hit,2) -ne $handle) { throw 'Click position is covered by another window; no input sent' }
    if ([ZoraDesktopNative]::GetForegroundWindow() -ne $handle) { throw 'Foreground changed; no input sent' }
    if (-not [ZoraDesktopNative]::SetCursorPos($screenX,$screenY)) { throw 'Cannot position pointer' }
    [ZoraDesktopNative]::Click()
   } elseif ($action -eq 'type') {
    $text=[string]$request.text;if (-not $text -or $text.Length -gt 8000 -or $text.Contains([char]0)) { throw 'Invalid input text' }
    [ZoraDesktopNative]::Text($text)
   } else {
    $mapping=@{Win=91;'Ctrl+Escape'=27;Enter=13;Escape=27;Tab=9;Backspace=8;Delete=46;Space=32;Up=38;Down=40;Left=37;Right=39;Home=36;End=35;PageUp=33;PageDown=34;'Ctrl+A'=65;'Ctrl+Z'=90;'Ctrl+Y'=89;'Ctrl+S'=83}
    $key=[string]$request.key;if (-not $mapping.ContainsKey($key)) { throw 'Unsupported key combination' }
    [ZoraDesktopNative]::Keys([UInt16]$mapping[$key],$key.StartsWith('Ctrl+'))
   }
   $result=@{ok=$true;action=$action;window=$window;inputSent=$true}
  }
 } else { throw 'Unsupported desktop action' }
} catch { $result=@{ok=$false;error=$_.Exception.Message} }
[Console]::Out.WriteLine(($result | ConvertTo-Json -Depth 8 -Compress))
