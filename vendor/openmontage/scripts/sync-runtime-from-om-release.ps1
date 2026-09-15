param(
  [Parameter(Mandatory = $true)]
  [string]$Source
)
# Source should be: ...\win-unpacked\resources\runtime
$ErrorActionPreference = 'Stop'
$Source = [System.IO.Path]::GetFullPath($Source)
$dest = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\runtime'))
if (-not (Test-Path $Source)) { throw "Source not found: $Source" }
foreach ($name in @('node','python','ffmpeg','hyperframes','codex')) {
  $from = Join-Path $Source $name
  if (-not (Test-Path $from)) { Write-Warning "skip missing $name"; continue }
  $to = Join-Path $dest $name
  New-Item -ItemType Directory -Force -Path (Split-Path $to) | Out-Null
  Write-Host "Copying $name ..."
  robocopy $from $to /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy failed for $name code=$LASTEXITCODE" }
}
Write-Host "Done. Run: node vendor/openmontage/scripts/probe-runtime.mjs"
