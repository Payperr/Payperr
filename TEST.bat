@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install it from https://nodejs.org/
  pause
  exit /b 1
)
node --test tests\units.test.mjs tests\engine.test.mjs tests\server.test.mjs tests\frontend.test.mjs tests\public.test.mjs tests\branding.test.mjs
echo.
if errorlevel 1 (echo   SOME TESTS FAILED - see above.) else (echo   All tests passed.)
pause
