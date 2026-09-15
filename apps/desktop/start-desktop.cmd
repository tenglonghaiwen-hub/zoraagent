@echo off
set ROOT=%~dp0..\..
cd /d "%~dp0"
if not exist node_modules (
  echo Installing Electron deps...
  call "%ROOT%\runtime\node-v24.21.0-win-x64\npm.cmd" install
)
"%ROOT%\runtime\node-v24.21.0-win-x64\npx.cmd" electron .
