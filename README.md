# arXiv-Marker

> Convert arXiv papers and local PDFs to high-quality Markdown using [marker-pdf](https://github.com/VikParuchuri/marker).

A lightweight Chrome Extension paired with a local Python server that converts PDF documents into clean Markdown files. Features real-time conversion log streaming and one-click download as ZIP (with images included).

## Features

- **arXiv Page Integration** -- "Convert to MD" button injected directly into arXiv abstract pages
- **Local PDF Upload** -- Drag-and-drop or click-to-upload via the extension popup
- **Real-time Log Streaming** -- Watch `marker_single` conversion progress live in a terminal-style UI
- **ZIP Download** -- Markdown + extracted images bundled together
- **One-click Setup** -- `run.bat` / `run.sh` handles venv, dependencies, and model download

## Architecture

```
Extension (Chrome MV3)  <-->  Local Flask Server  <-->  marker_single CLI
       |                           |
  content.js (arXiv)         /stream_convert (GET)
  popup.html/js              /stream_convert_file (POST)
                             /download (GET)
                             /health (GET)
```

## Quick Start

### 1. Start the Server

**Windows:**
```batch
run.bat
```

**Mac / Linux:**
```bash
chmod +x run.sh
./run.sh
```

The script will:
1. Create a Python virtual environment
2. Install dependencies (`flask`, `flask-cors`, `requests`, `marker-pdf`)
3. Pre-download AI models (~1.35 GB, first run only)
4. Start the server at `http://localhost:5000`

> **Custom port:** set the `PORT` environment variable before running.
> ```bash
> PORT=8080 ./run.sh
> ```

### 2. Install the Extension

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder

### 3. Convert a Paper

**From arXiv:**
1. Visit any arXiv abstract page (e.g. `arxiv.org/abs/2301.12345`)
2. Click the purple **"Convert to MD (Marker)"** button in the Access Paper section
3. Watch the conversion log, then the ZIP downloads automatically

**From a local PDF:**
1. Click the arXiv-Marker extension icon in the toolbar
2. Drag & drop a PDF or click to browse
3. Click **"Convert to Markdown"**

## Project Structure

```
arxiv-toMarkdown-extension/
├── extension/                # Chrome Extension (Frontend)
│   ├── manifest.json         # Manifest V3
│   ├── content.js            # arXiv page button injection + streaming
│   ├── popup.html            # Dark-theme popup UI
│   ├── popup.js              # File upload + streaming
│   └── icons/                # Extension icons
├── server/                   # Flask Backend
│   ├── server.py             # API server
│   ├── download_models.py    # Model pre-download script
│   └── requirements.txt      # Python dependencies
├── run.bat                   # Windows setup & run
├── run.sh                    # Mac/Linux setup & run
└── LICENSE                   # GPL-3.0
```

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Server status check |
| `/stream_convert?id={arxiv_id}` | GET | Download arXiv PDF, convert, stream logs |
| `/stream_convert_file` | POST | Upload PDF, convert, stream logs |
| `/download?id={file_id}` | GET | Download converted ZIP, cleanup temp files |

## Requirements

- **Python** 3.9+
- **Chrome** (Chromium-based browsers)
- **GPU** recommended (marker-pdf uses PyTorch; CPU works but is slower)
- ~1.35 GB disk space for AI models (downloaded on first run)

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).

Powered by [marker-pdf](https://github.com/VikParuchuri/marker) by Vik Paruchuri.
