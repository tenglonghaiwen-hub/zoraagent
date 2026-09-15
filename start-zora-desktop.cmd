@echo off
setlocal
rem npm's Electron shim also needs Node on PATH, even when npm itself is bundled.
set "PATH=%~dp0runtime\node-v24.21.0-win-x64;%PATH%"
set "ELECTRON_RUN_AS_NODE="
cd /d "%~dp0apps\desktop"
call "%~dp0runtime\node-v24.21.0-win-x64\npm.cmd" start -- %*
set "ZORA_START_EXIT=%ERRORLEVEL%"
if not "%ZORA_START_EXIT%"=="0" (
  echo.
  echo Zora failed to start. See the error above. Exit code: %ZORA_START_EXIT%
  pause
)
exit /b %ZORA_START_EXIT%
