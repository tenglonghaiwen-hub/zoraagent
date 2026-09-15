param([switch]$EnableAgent)
$ErrorActionPreference='Stop'
$projectRoot=if($PSScriptRoot){Split-Path $PSScriptRoot -Parent}else{'D:\zora'}
if(!$projectRoot){$projectRoot='D:\zora'}
$runtime=Get-Content (Join-Path $projectRoot 'runtime\runtime-manifest.json') -Raw | ConvertFrom-Json
$node=Join-Path $projectRoot $runtime.nodeRelativePath
$codex=Join-Path $projectRoot $runtime.codexRelativePath
if(!(Test-Path $node)){throw '项目内置 Node 缺失'};if(!(Test-Path $codex)){throw '包内 Codex 运行时缺失'}
$env:ZORA_CODEX_BIN=$codex
$env:PATH=(Split-Path $node)+';'+$env:PATH
$env:ZORA_AGENT_ENABLED='true'
try{
 Set-Location $projectRoot
 & $node apps/server/server.mjs
}finally{Remove-Item Env:ZORA_AGENT_API_KEY -ErrorAction SilentlyContinue}
