@echo off
title Stop ShortsForge AI
echo Stopping all running ShortsForge AI and uvicorn processes...
taskkill /F /IM python.exe /FI "WINDOWTITLE eq ShortsForge AI*" 2>nul
taskkill /F /IM uvicorn.exe 2>nul
echo ShortsForge AI stopped.
timeout /t 2 >nul
