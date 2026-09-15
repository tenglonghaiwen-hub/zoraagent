param(
  [Parameter(Mandatory = $true)]
  [string]$Source
)
$ErrorActionPreference = 'Stop'
$dest = Join-Path $PSScriptRoot '..\engine'
$dest = [System.IO.Path]::GetFullPath($dest)
$Source = [System.IO.Path]::GetFullPath($Source)
if (-not (Test-Path $Source)) { throw "Source not found: $Source" }
if (-not (Test-Path (Join-Path $Source 'services\studio_api'))) {
  throw "Not an OpenMontage root (missing services\studio_api): $Source"
}
if (Test-Path $dest) {
  $item = Get-Item $dest -Force
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
    cmd /c "rmdir `"$dest`""
  } else {
    $empty = -not (Get-ChildItem $dest -Force | Where-Object { $_.Name -notmatch '^\.gitkeep' })
    if (-not $empty) { throw "engine/ already has files. Move them aside first: $dest" }
    Remove-Item $dest -Recurse -Force
  }
}
cmd /c "mklink /J `"$dest`" `"$Source`""
Write-Host "Linked engine -> $Source"
