@echo off
setlocal
set "NODE_DIR=%~dp0.local-tools\node-v24.18.0-win-x64"
if not exist "%NODE_DIR%\npm.cmd" (
  echo Node was not found at "%NODE_DIR%".
  echo Please ask Codex to reinstall the local Node runtime.
  exit /b 1
)
set "PATH=%NODE_DIR%;%PATH%"
call "%NODE_DIR%\npm.cmd" run build
