$ErrorActionPreference = 'Stop'
$credential = Read-Host '粘贴完整主 Agent Key，然后按回车（输入不会显示）' -AsSecureString
if ($credential.Length -eq 0) { throw '没有输入凭据' }
$plain = [Net.NetworkCredential]::new('', $credential).Password
if ($plain -match '[\x00-\x20\x7f]') { throw 'Key 含空白或控制字符，未保存；请重新复制完整 Key' }
$projectRoot = Split-Path $PSScriptRoot -Parent
$destination = Join-Path $projectRoot 'runtime\agent-key.dpapi'
$credential | ConvertFrom-SecureString | Set-Content -LiteralPath $destination -Encoding ASCII
$plain = $null
Write-Host '已加密保存主 Agent Key。请重启 Zora 后端使其生效。'
