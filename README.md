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

You can install and run this project either by downloading the pre-packaged Release files (recommended for general use) or by cloning the repository from source.

---

### Option A: Installation via GitHub Releases (Recommended)

1. Go to the **Releases** page of this repository and download the latest version of both zip files:
   - `arxiv-marker-extension-v*.zip` (Frontend Extension)
   - `arxiv-marker-server-v*.zip` (Backend Server)
2. **Setup the Server**:
   - Extract `arxiv-marker-server-v*.zip` to a folder.
   - **Windows**: Double-click `run.bat`.
   - **Mac / Linux**: Open a terminal in the extracted folder, run `chmod +x run.sh && ./run.sh`.
   - This automatically creates the virtual environment, installs dependencies, pre-downloads the AI models (~1.35 GB), and starts the server at `http://localhost:5000`.
3. **Setup the Chrome Extension**:
   - Extract `arxiv-marker-extension-v*.zip` to a folder.
   - Open Chrome and navigate to `chrome://extensions`.
   - Enable **Developer mode** (toggle in the top-right corner).
   - Click **Load unpacked** (top-left button).
   - Select the folder where you extracted the extension zip file.

---

### Option B: Run from Source Code (For Developers)

1. Clone this repository:
   ```bash
   git clone https://github.com/DuJoGaks/arxiv-toMarkdown-extension.git
   cd arxiv-toMarkdown-extension
   ```
2. **Start the Server**:
   - **Windows**: Run `run.bat` in the root directory.
   - **Mac / Linux**: Run `chmod +x run.sh && ./run.sh` in the root directory.
   - The script will initialize a local Python virtual environment, install requirements, download the AI models (~1.35 GB), and start the server at `http://localhost:5000`.
3. **Install the Extension**:
   - Open Chrome and go to `chrome://extensions`.
   - Enable **Developer mode**.
   - Click **Load unpacked**.
   - Select the `extension/` folder in your cloned repository directory.

---

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
