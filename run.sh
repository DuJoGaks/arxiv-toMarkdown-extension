#!/bin/bash
set -e

echo "======================================"
echo "   arXiv-Marker Server Setup"
echo "======================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Step 1: Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "[1/5] Creating virtual environment..."
    python3 -m venv venv
    echo "      Virtual environment created."
else
    echo "[1/5] Virtual environment already exists."
fi

# Step 2: Activate virtual environment
echo "[2/5] Activating virtual environment..."
source venv/bin/activate

# Step 3: Install dependencies
echo "[3/5] Installing dependencies..."
pip install -r server/requirements.txt
echo "      Dependencies installed."

# Step 4: Pre-download AI models (only needed on first run, ~1.35GB)
echo "[4/5] Checking AI models..."
python server/download_models.py

# Step 5: Start server
echo ""
echo "[5/5] Starting arXiv-Marker server..."
echo "      Server: http://localhost:${PORT:-5000}"
echo "      Press Ctrl+C to stop."
echo ""
python server/server.py
