@echo off
chcp 65001 >nul 2>&1

echo ======================================
echo    arXiv-Marker Server Setup
echo ======================================
echo.

cd /d "%~dp0"

REM Step 1: Create virtual environment if it doesn't exist
if not exist "venv" (
    echo [1/5] Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment.
        echo         Make sure Python is installed and accessible.
        pause
        exit /b 1
    )
    echo       Virtual environment created.
) else (
    echo [1/5] Virtual environment already exists.
)

REM Step 2: Activate virtual environment
echo [2/5] Activating virtual environment...
call venv\Scripts\activate.bat

REM Step 3: Install dependencies
echo [3/5] Installing dependencies...
pip install -r server\requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)
echo       Dependencies installed.

REM Step 4: Pre-download AI models (only needed on first run, ~1.35GB)
echo [4/5] Checking AI models...
python server\download_models.py

REM Step 5: Start server
echo.
echo [5/5] Starting arXiv-Marker server...
if defined PORT (
    echo       Server: http://localhost:%PORT%
) else (
    echo       Server: http://localhost:5000
)
echo       Press Ctrl+C to stop.
echo.
python server\server.py

pause
