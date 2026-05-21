@echo off
REM Usage: scripts\start.bat [path\to\.env]
cd /d "%~dp0\.."
set "ENV_FILE=%~1"
if "%ENV_FILE%"=="" set "ENV_FILE=%~dp0..\.env"
if not exist "%ENV_FILE%" (
  echo Missing env file. Copy env.example to .env >&2
  exit /b 1
)
for /f "usebackq eol=# tokens=1,* delims==" %%a in ("%ENV_FILE%") do set "%%a=%%b"
node build\index.js
