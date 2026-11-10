@echo off
rem MyEvent sync server auto-start entry (invoked by scheduled task at logon)
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 set "PATH=%PATH%;C:\Program Files\nodejs;%APPDATA%\npm"
rem Guard: if port 3129 is already listening, another instance is running
netstat -ano | findstr ":3129" | findstr "LISTENING" >nul 2>nul
if not errorlevel 1 exit /b 0
start "MyEvent sync server" /min cmd /c "node server\src\index.js"
exit /b 0
