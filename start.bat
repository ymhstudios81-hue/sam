@echo off
setlocal enabledelayedexpansion
title ShortsForge AI - Local Video Shorts Generator

echo ========================================================
echo          ShortsForge AI - Local Windows Launcher
echo ========================================================
echo.

:: 1. Check Python
echo [1/5] Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python 3.11+ is not found in your PATH!
    echo Please install Python from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)
python --version

:: 2. Check FFmpeg
echo.
echo [2/5] Checking FFmpeg and FFprobe installation...
ffmpeg -version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] FFmpeg is required.
    echo.
    echo Installation options:
    echo  1. Run with winget: winget install Gyan.FFmpeg
    echo  2. Or download from: https://www.gyan.dev/ffmpeg/builds/
    echo     Extract to C:\ffmpeg and add C:\ffmpeg\bin to your System PATH.
    echo.
    pause
    exit /b 1
)
ffprobe -version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] FFprobe is missing from your FFmpeg installation!
    echo Please ensure ffprobe.exe is in your PATH.
    pause
    exit /b 1
)
echo [OK] FFmpeg and FFprobe detected.

:: 3. Setup Virtual Environment
echo.
echo [3/5] Setting up Python Virtual Environment...
if not exist ".venv" (
    echo Creating virtual environment in .venv...
    python -m venv .venv
)
call .venv\Scripts\activate.bat

:: 4. Install Dependencies
echo.
echo [4/5] Checking and installing dependencies...
pip install -r requirements.txt --quiet

:: Copy .env if not exists
if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env
        echo Created .env from .env.example. Please add your ANTHROPIC_API_KEY if needed.
    )
)

:: 5. Launch Backend and UI
echo.
echo [5/5] Starting ShortsForge AI Server...
echo Address: http://127.0.0.1:8000
echo.
echo Press Ctrl+C in this window to stop the server.
echo ========================================================

:: Open browser after 2 seconds in background
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:8000"

:: Start Uvicorn FastAPI server
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload

pause
