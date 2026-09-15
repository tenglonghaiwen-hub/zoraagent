Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null=[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
$null=[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
$null=[Windows.Graphics.Imaging.BitmapDecoder,Windows.Foundation,ContentType=WindowsRuntime]
function Await-Result($operation,$resultType){
 $method=[System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {$_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.IsGenericMethod} | Select-Object -First 1
 $task=$method.MakeGenericMethod($resultType).Invoke($null,@($operation));$task.Wait();return $task.Result
}
$file=Await-Result ([Windows.Storage.StorageFile]::GetFileFromPathAsync('C:\Users\强哥\AppData\Local\Temp\codex-clipboard-b9320731-0e7c-4cb0-b48d-1dfe51c3fa98.png')) ([Windows.Storage.StorageFile])
$stream=Await-Result ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder=Await-Result ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap=Await-Result ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$engine=[Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
$result=Await-Result ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
$match=[regex]::Match(($result.Text -replace '\s',''),'(?i)[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}')
if(!$match.Success){throw '未能可靠识别分组凭据，未保存任何密钥'}
$secure=ConvertTo-SecureString ($match.Value + '_a') -AsPlainText -Force
$secure | ConvertFrom-SecureString | Set-Content 'D:\zora\runtime\agent-key.dpapi' -Encoding ASCII
Write-Output '后台凭据已使用 Windows 当前用户加密保存；未输出密钥。'
$bitmap.Dispose();$stream.Dispose()
