param([Parameter(Mandatory=$true)][string]$PipPython)
$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot -Parent
$pythonRoot=Join-Path $repo 'vendor\openmontage\runtime\python'
$destination=Join-Path $pythonRoot 'media-site'
if(Test-Path $destination){throw 'media-site 已存在。为保护现有运行库，本脚本不会覆盖或删除；请先检查当前版本。'}
& $PipPython -m pip install --only-binary=:all: --require-hashes --target $destination -r (Join-Path $repo 'vendor\openmontage\speech-requirements.lock')
if($LASTEXITCODE -ne 0){throw '语音依赖安装失败；保留下载和部分安装文件以便检查。'}
$pth=Join-Path $pythonRoot 'python312._pth'
$content=[IO.File]::ReadAllText($pth)
if($content -notmatch '(?m)^media-site\r?$'){$content=$content.Replace('python312.zip',"python312.zip`nmedia-site");[IO.File]::WriteAllText($pth,$content)}
& (Join-Path $pythonRoot 'python.exe') -c 'import faster_whisper, piper, onnxruntime, ctranslate2; print("Bundled speech runtime OK")'
if($LASTEXITCODE -ne 0){throw '包内语音运行库加载失败'}
