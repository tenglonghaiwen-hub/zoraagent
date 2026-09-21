$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot -Parent
$destination=Join-Path $repo 'runtime\prerequisites\vc_redist.x64.exe'
$expected='CC0FF0EB1DC3F5188AE6300FAEF32BF5BEEBA4BDD6E8E445A9184072096B713B'
if(!(Test-Path -LiteralPath $destination)){
  New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
  Invoke-WebRequest -Uri 'https://aka.ms/vs/17/release/vc_redist.x64.exe' -OutFile $destination -TimeoutSec 120
}
if((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -ne $expected){throw '官方安装程序版本已变化或文件不匹配；请重新核验版本、签名后更新固定哈希，不自动采用新文件。'}
$signature=Get-AuthenticodeSignature -LiteralPath $destination
if($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Microsoft Corporation'){throw '微软签名校验失败'}
Write-Output 'Microsoft C++ installer verified. Download only; not installed.'
