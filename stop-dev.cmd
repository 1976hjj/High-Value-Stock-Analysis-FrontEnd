@echo off
setlocal
set "PROJECT_DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$projectDir = [IO.Path]::GetFullPath('%PROJECT_DIR%');" ^
  "Get-CimInstance Win32_Process -Filter \"name = 'node.exe'\" | Where-Object { $_.CommandLine -and $_.CommandLine.Replace('/', '\').Contains($projectDir.TrimEnd('\')) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
