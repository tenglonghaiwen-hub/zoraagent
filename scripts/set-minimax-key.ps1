$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Security
[Windows.Forms.Application]::EnableVisualStyles()
$destination = [IO.Path]::GetFullPath([IO.Path]::Combine($PSScriptRoot, '..', 'runtime', 'minimax-key.dpapi'))
$form = New-Object Windows.Forms.Form
$form.Text = 'Zora - MiniMax 官方密钥'
$form.ClientSize = New-Object Drawing.Size(530, 195)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$label = New-Object Windows.Forms.Label
$label.Text = '粘贴 MiniMax 官方 API Key（支持 Ctrl+V 或右键粘贴）'
$label.SetBounds(20, 20, 490, 25)
$inputBox = New-Object Windows.Forms.TextBox
$inputBox.UseSystemPasswordChar = $true
$inputBox.ShortcutsEnabled = $true
$inputBox.MaxLength = 16384
$inputBox.SetBounds(20, 55, 490, 30)
$menu = New-Object Windows.Forms.ContextMenuStrip
$paste = $menu.Items.Add('粘贴')
$paste.Add_Click({ $inputBox.Paste() })
$inputBox.ContextMenuStrip = $menu
$status = New-Object Windows.Forms.Label
$status.Text = '密钥仅在本机加密保存，不发送到聊天。'
$status.SetBounds(20, 98, 490, 35)
$save = New-Object Windows.Forms.Button
$save.Text = '加密保存'
$save.SetBounds(295, 145, 105, 30)
$close = New-Object Windows.Forms.Button
$close.Text = '关闭'
$close.SetBounds(410, 145, 100, 30)
$close.Add_Click({ $form.Close() })
$save.Add_Click({
    $plain = $inputBox.Text
    $bytes = $null
    try {
        if ([string]::IsNullOrWhiteSpace($plain) -or $plain -match '[\x00-\x20\x7f]') {
            $status.Text = '未保存：密钥不能为空或包含空格、换行，请重新粘贴。'
            return
        }
        $bytes = [Text.Encoding]::Unicode.GetBytes($plain)
        $protected = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
        $hex = [BitConverter]::ToString($protected).Replace('-', '').ToLowerInvariant()
        [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination))
        [IO.File]::WriteAllText($destination, $hex, [Text.Encoding]::ASCII)
        $inputBox.Clear()
        $status.Text = '保存成功。请返回聊天，我会验证并重启后台。'
    } catch {
        $status.Text = '保存失败：请检查 runtime 目录写入权限。'
    } finally {
        if ($null -ne $bytes) { [Array]::Clear($bytes, 0, $bytes.Length) }
        $plain = $null
    }
})
$form.Controls.AddRange(@($label, $inputBox, $status, $save, $close))
$form.AcceptButton = $save
$form.Add_Shown({ $form.Activate(); $inputBox.Focus() })
try { [void]$form.ShowDialog() } finally { $inputBox.Clear(); $menu.Dispose(); $form.Dispose() }
