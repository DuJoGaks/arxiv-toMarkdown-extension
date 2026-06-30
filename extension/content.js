/**
 * arXiv-Marker Content Script
 * 
 * arXiv 논문 페이지(arxiv.org/abs/*)에서 "Convert to MD (Marker)" 버튼을
 * Access Paper 영역에 삽입하고, 로컬 서버와의 스트리밍 통신을 처리합니다.
 */
(function () {
  'use strict';

  /* ─── Configuration ─── */
  const SERVER_PORT = 5000;
  const SERVER_URL = `http://localhost:${SERVER_PORT}`;

  /* ─── Helpers ─── */

  /** 현재 URL에서 arXiv ID를 파싱합니다 (예: 2301.12345, 2301.12345v2) */
  function getArxivId() {
    const match = window.location.pathname.match(/\/abs\/([^\/?#]+)/);
    return match ? match[1] : null;
  }

  /** Log Container에 텍스트를 추가하고 스크롤을 하단으로 이동합니다 */
  function appendLog(container, text) {
    container.textContent += text;
    container.scrollTop = container.scrollHeight;
  }

  /** UI를 초기 상태로 복원합니다 */
  function resetUI(btn, logContainer) {
    btn.textContent = '📝 Convert to MD (Marker)';
    btn.style.pointerEvents = 'auto';
    btn.style.opacity = '1';
    btn.classList.remove('arxiv-marker-converting');
  }

  /* ─── DOM Injection ─── */

  // Access Paper 영역의 <ul> 찾기
  const fullTextUl = document.querySelector('.full-text ul');
  if (!fullTextUl) return; // arXiv abs 페이지가 아닌 경우 종료

  // 스타일 삽입
  const style = document.createElement('style');
  style.textContent = `
    .arxiv-marker-btn {
      cursor: pointer;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      color: #ffffff !important;
      border: none !important;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
      position: relative;
      overflow: hidden;
    }
    .arxiv-marker-btn:hover {
      opacity: 0.9;
      transform: translateY(-1px);
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    }
    .arxiv-marker-btn:active {
      transform: translateY(0);
      opacity: 0.8;
    }
    .arxiv-marker-btn.arxiv-marker-converting {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
      pointer-events: none;
      opacity: 0.85;
    }

    .arxiv-marker-log {
      display: none;
      margin-top: 10px;
      padding: 12px 14px;
      background: rgba(10, 10, 20, 0.92);
      border-radius: 8px;
      font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
      font-size: 11px;
      color: #4ade80;
      max-height: 220px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.5;
      border: 1px solid rgba(74, 222, 128, 0.15);
      box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3);
      scrollbar-width: thin;
      scrollbar-color: rgba(74, 222, 128, 0.3) transparent;
    }
    .arxiv-marker-log::-webkit-scrollbar {
      width: 5px;
    }
    .arxiv-marker-log::-webkit-scrollbar-track {
      background: transparent;
    }
    .arxiv-marker-log::-webkit-scrollbar-thumb {
      background: rgba(74, 222, 128, 0.3);
      border-radius: 3px;
    }

    .arxiv-marker-log.visible {
      display: block;
      animation: arxiv-marker-fadeIn 0.3s ease;
    }

    @keyframes arxiv-marker-fadeIn {
      from { opacity: 0; transform: translateY(-5px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes arxiv-marker-pulse {
      0%, 100% { opacity: 1; }
      50%      { opacity: 0.5; }
    }
    .arxiv-marker-status-pulse {
      animation: arxiv-marker-pulse 1.5s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);

  // 버튼 생성
  const li = document.createElement('li');
  const btn = document.createElement('a');
  btn.className = 'abs-button arxiv-marker-btn';
  btn.textContent = '📝 Convert to MD (Marker)';
  btn.setAttribute('role', 'button');
  btn.setAttribute('tabindex', '0');
  li.appendChild(btn);
  fullTextUl.appendChild(li);

  // Log Container 생성
  const logContainer = document.createElement('div');
  logContainer.className = 'arxiv-marker-log';
  logContainer.setAttribute('aria-label', 'Conversion log output');
  fullTextUl.parentElement.appendChild(logContainer);

  /* ─── Conversion Logic ─── */

  let isConverting = false;

  btn.addEventListener('click', async () => {
    if (isConverting) return;

    const arxivId = getArxivId();
    if (!arxivId) {
      alert('arXiv ID를 URL에서 파싱할 수 없습니다.');
      return;
    }

    // UI를 변환 중 상태로 전환
    isConverting = true;
    btn.textContent = '⏳ Converting...';
    btn.classList.add('arxiv-marker-converting');
    logContainer.textContent = '';
    logContainer.classList.add('visible');
    appendLog(logContainer, `$ Requesting conversion for ${arxivId}...\n`);

    try {
      const response = await fetch(
        `${SERVER_URL}/stream_convert?id=${encodeURIComponent(arxivId)}`
      );

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      // 스트리밍 수신
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let completed = false;
      let hasError = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        appendLog(logContainer, chunk);

        if (chunk.includes('[COMPLETED]')) {
          completed = true;
          break;
        }
        if (chunk.includes('[ERROR]')) {
          hasError = true;
          break;
        }
      }

      if (completed) {
        // 다운로드 시작
        appendLog(logContainer, '\nDownloading...\n');
        btn.textContent = 'Downloading...';

        const dlResponse = await fetch(
          `${SERVER_URL}/download?id=${encodeURIComponent(arxivId)}`
        );

        if (!dlResponse.ok) {
          throw new Error(`Download failed: ${dlResponse.status}`);
        }

        const blob = await dlResponse.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${arxivId}.zip`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);

        appendLog(logContainer, 'Done! File has been downloaded.\n');
      } else if (hasError) {
        appendLog(logContainer, '\nConversion failed. Check the error log above.\n');
      } else {
        appendLog(logContainer, '\nStream ended without completion signal.\n');
      }
    } catch (err) {
      if (
        err.name === 'TypeError' ||
        err.message.includes('Failed to fetch') ||
        err.message.includes('NetworkError') ||
        err.message.includes('ERR_CONNECTION_REFUSED')
      ) {
        appendLog(
          logContainer,
          '\n[ERROR] Cannot connect to local server.\n'
          + '  Please make sure server.py is running.\n'
          + `  Server address: ${SERVER_URL}\n`
        );
      } else {
        appendLog(logContainer, `\n[ERROR] ${err.message}\n`);
      }
    } finally {
      isConverting = false;
      resetUI(btn, logContainer);
    }
  });
})();
