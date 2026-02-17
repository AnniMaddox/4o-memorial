@echo off
cd /d "%~dp0"
echo Starting dev server at http://localhost:5173
start "" "http://localhost:5173"
call npm.cmd run dev -- --host
