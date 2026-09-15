$ErrorActionPreference='Stop'
$root='D:\zora'
$env:RUSTUP_HOME="$root\runtime\rustup"
$env:CARGO_HOME="$root\runtime\cargo"
$env:PATH="$env:CARGO_HOME\bin;"+$env:PATH
New-Item -ItemType Directory -Force D:\zora\runtime\build-temp | Out-Null
$env:TEMP='D:\zora\runtime\build-temp';$env:TMP=$env:TEMP
$devShell='D:\zora-buildtools\Common7\Tools\Launch-VsDevShell.ps1'
if(!(Test-Path $devShell)){throw '请先安装 D:\zora-buildtools 中的 Microsoft C++ Build Tools 和 Windows SDK'}
& $devShell -Arch amd64 -HostArch amd64
Set-Location "$root\vendor\codex-main\codex-rs"
& "$env:CARGO_HOME\bin\cargo.exe" build --locked --release --bin codex
if($LASTEXITCODE -ne 0){throw 'Codex 源码编译失败'}
& .\target\release\codex.exe --version
