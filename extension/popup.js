/**
 * arXiv-Marker Popup Script
 *
 * PDF 파일 업로드, 서버와의 스트리밍 통신, ZIP 다운로드를 처리합니다.
 */
(function () {
  'use strict';

  /* ─── Configuration ─── */
  const SERVER_PORT = 5000;
  const SERVER_URL = `http://localhost:${SERVER_PORT}`;

  /* ─── DOM Elements ─── */
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-input');
  const fileNameDiv = document.getElementById('file-name');
  const convertBtn = document.getElementById('convert-btn');
  const terminalWrapper = document.getElementById('terminal-wrapper');
  const terminalLog = document.getElementById('terminal-log');
  const statusBar = document.getElementById('status-bar');
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');

  let selectedFile = null;
  let isConverting = false;

  /* ─── Helpers ─── */

  function setStatus(text, type = 'idle') {
    statusBar.classList.add('visible');
    statusText.textContent = text;
    statusIndicator.className = 'status-indicator';
    if (type === 'active') statusIndicator.classList.add('active');
    if (type === 'error') statusIndicator.classList.add('error');
    if (type === 'done') statusIndicator.classList.add('done');
  }

  function appendLog(text) {
    terminalLog.textContent += text;
    terminalLog.scrollTop = terminalLog.scrollHeight;
  }

  function resetUI() {
    isConverting = false;
    convertBtn.classList.remove('converting');
    convertBtn.disabled = false;
    convertBtn.innerHTML = '🚀 Convert to Markdown';
  }

  function showTerminal() {
    terminalWrapper.classList.add('visible');
    terminalLog.textContent = '';
  }

  /* ─── File Selection ─── */

  // 클릭으로 파일 선택
  uploadArea.addEventListener('click', () => {
    if (!isConverting) fileInput.click();
  });

  // 드래그 앤 드롭
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].name.toLowerCase().endsWith('.pdf')) {
      selectFile(files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      selectFile(fileInput.files[0]);
    }
  });

  function selectFile(file) {
    selectedFile = file;
    uploadArea.classList.add('has-file');

    // 파일 크기 포맷
    const sizeKB = (file.size / 1024).toFixed(1);
    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
    const sizeStr = file.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;

    fileNameDiv.textContent = `📎 ${file.name} (${sizeStr})`;
    fileNameDiv.classList.add('visible');

    convertBtn.disabled = false;
    setStatus('File selected. Click Convert to start.', 'idle');
  }

  /* ─── Conversion Logic ─── */

  convertBtn.addEventListener('click', async () => {
    if (isConverting || !selectedFile) return;

    isConverting = true;
    convertBtn.disabled = true;
    convertBtn.classList.add('converting');
    convertBtn.innerHTML = '<span class="spinner"></span> Converting...';

    showTerminal();
    setStatus('Uploading file to server...', 'active');
    appendLog(`$ Uploading ${selectedFile.name}...\n`);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(`${SERVER_URL}/stream_convert_file`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `Server error: ${response.status}`);
      }

      setStatus('Converting...', 'active');

      // 스트리밍 수신
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fileId = null;
      let hasError = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        appendLog(chunk);

        // [COMPLETED:file_id] 신호 감지
        const completedMatch = chunk.match(/\[COMPLETED:([^\]]+)\]/);
        if (completedMatch) {
          fileId = completedMatch[1];
          break;
        }
        if (chunk.includes('[ERROR]')) {
          hasError = true;
          break;
        }
      }

      if (fileId) {
        // 다운로드 시작
        setStatus('Conversion done! Downloading...', 'active');
        appendLog('\nDownloading...\n');
        convertBtn.innerHTML = '<span class="spinner"></span> Downloading...';

        const dlResponse = await fetch(
          `${SERVER_URL}/download?id=${encodeURIComponent(fileId)}`
        );

        if (!dlResponse.ok) {
          throw new Error(`Download failed: ${dlResponse.status}`);
        }

        const blob = await dlResponse.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${selectedFile.name.replace('.pdf', '')}.zip`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);

        appendLog('Done! File has been downloaded.\n');
        setStatus('Conversion & download complete!', 'done');
      } else if (hasError) {
        appendLog('\nConversion failed. Check the error log above.\n');
        setStatus('Conversion failed', 'error');
      } else {
        appendLog('\nStream ended without completion signal.\n');
        setStatus('Ended without signal', 'error');
      }
    } catch (err) {
      if (
        err.name === 'TypeError' ||
        err.message.includes('Failed to fetch') ||
        err.message.includes('NetworkError') ||
        err.message.includes('ERR_CONNECTION_REFUSED')
      ) {
        appendLog(
          '\n[ERROR] Cannot connect to local server.\n'
          + '  Please make sure server.py is running.\n'
          + `  Server address: ${SERVER_URL}\n`
        );
        setStatus('Server connection failed', 'error');
      } else {
        appendLog(`\n[ERROR] ${err.message}\n`);
        setStatus(err.message, 'error');
      }
    } finally {
      resetUI();
      if (selectedFile) {
        convertBtn.disabled = false;
      }
    }
  });
})();
