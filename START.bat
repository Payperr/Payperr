@echo off
setlocal
cd /d "%~dp0"
title Payper (PAYPER) - PAPER TRADING (virtual money only)
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js was not found on this computer.
  echo   Install the LTS version from https://nodejs.org/ and then double-click START.bat again.
  echo.
  pause
  exit /b 1
)
node server\server.mjs --open
echo.
echo   Payper has stopped. You can close this window.
pause
