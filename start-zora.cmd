@echo off
powershell.exe -NoProfile -Command "& ([scriptblock]::Create([IO.File]::ReadAllText('%~dp0scripts\start-agent-server.ps1')))"
pause
