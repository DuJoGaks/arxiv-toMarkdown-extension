"""
arXiv-Marker Local Server
Flask 기반 로컬 서버. arXiv PDF 다운로드, marker_single CLI 변환,
실시간 로그 스트리밍, ZIP 다운로드 및 Cleanup을 처리합니다.
"""

import os
import sys
import time
import shutil
import zipfile
import subprocess
import threading
import requests as http_requests
from pathlib import Path
from flask import Flask, request, Response, send_file, jsonify, after_this_request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# --- Configuration ---
BASE_DIR = Path(__file__).parent.resolve()
TEMP_DIR = BASE_DIR / "temp"
TEMP_DIR.mkdir(exist_ok=True)

# 변환 결과를 추적하는 딕셔너리 { id: { output_dir, original_pdf } }
conversion_results = {}
results_lock = threading.Lock()


def find_marker_command():
    """marker_single 명령어의 존재 여부를 확인하고 경로를 반환합니다."""
    # marker_single을 우선 시도
    for cmd in ["marker_single", "marker"]:
        if shutil.which(cmd):
            return cmd
    return "marker_single"  # 기본값 (없으면 실행 시 에러 발생)


MARKER_CMD = find_marker_command()


def stream_marker_process(pdf_path, output_dir, file_id):
    """
    marker_single CLI를 실행하고 stdout/stderr를 실시간으로 yield합니다.
    변환 완료 시 [COMPLETED] 신호를 전송합니다.
    """
    cmd = [
        MARKER_CMD,
        str(pdf_path),
        "--output_dir", str(output_dir),
        "--output_format", "markdown",
    ]

    yield f"$ {' '.join(cmd)}\n"
    yield f"$ Output directory: {output_dir}\n"
    yield "-" * 50 + "\n"

    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            encoding="utf-8",
            errors="replace",
        )

        # stdout을 라인 단위로 읽어 yield
        for line in iter(process.stdout.readline, ""):
            yield line

        process.wait()

        if process.returncode == 0:
            # 변환 결과 저장
            with results_lock:
                conversion_results[file_id] = {
                    "output_dir": str(output_dir),
                    "original_pdf": str(pdf_path),
                }
            yield "\n" + "-" * 50 + "\n"
            yield "[COMPLETED]\n"
        else:
            yield f"\n[ERROR] marker exited with code {process.returncode}\n"

    except FileNotFoundError:
        yield (
            f"\n[ERROR] '{MARKER_CMD}' command not found.\n"
            "Please check if marker-pdf is installed:\n"
            "  pip install marker-pdf\n"
        )
    except Exception as e:
        yield f"\n[ERROR] Unexpected error: {str(e)}\n"


# --- Endpoints ---


@app.route("/health", methods=["GET"])
def health():
    """서버 상태 확인 엔드포인트."""
    return jsonify({
        "status": "ok",
        "marker_cmd": MARKER_CMD,
        "temp_dir": str(TEMP_DIR),
    })


@app.route("/stream_convert", methods=["GET"])
def stream_convert():
    """
    arXiv PDF를 다운로드하고 marker_single로 변환합니다.
    변환 로그를 실시간으로 스트리밍합니다.
    """
    arxiv_id = request.args.get("id")
    if not arxiv_id:
        return Response("Error: 'id' parameter is required.\n", status=400)

    # arXiv ID 정리 (버전 정보 포함 가능)
    safe_id = arxiv_id.replace("/", "_").replace("\\", "_")
    pdf_path = TEMP_DIR / f"{safe_id}.pdf"
    output_dir = TEMP_DIR / f"{safe_id}_output"

    def generate():
        # Step 1: arXiv에서 PDF 다운로드
        pdf_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"
        yield f"[DOWNLOAD] Downloading PDF from {pdf_url}...\n"

        try:
            resp = http_requests.get(pdf_url, stream=True, timeout=120)
            resp.raise_for_status()

            total_size = int(resp.headers.get("content-length", 0))
            downloaded = 0

            with open(pdf_path, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_size > 0:
                        pct = (downloaded / total_size) * 100
                        yield f"\r   Downloaded: {downloaded:,} / {total_size:,} bytes ({pct:.1f}%)\n"

            yield f"[OK] PDF saved: {pdf_path.name} ({downloaded:,} bytes)\n\n"

        except http_requests.exceptions.RequestException as e:
            yield f"[FAIL] PDF download failed: {str(e)}\n"
            yield "[ERROR]\n"
            return

        # Step 2: marker_single 실행 및 로그 스트리밍
        yield f"[CONVERT] Starting conversion with {MARKER_CMD}...\n"
        output_dir.mkdir(parents=True, exist_ok=True)

        yield from stream_marker_process(pdf_path, output_dir, safe_id)

    return Response(
        generate(),
        mimetype="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.route("/stream_convert_file", methods=["POST"])
def stream_convert_file():
    """
    업로드된 PDF 파일을 marker_single로 변환합니다.
    변환 로그를 실시간으로 스트리밍합니다.
    """
    if "file" not in request.files:
        return Response("Error: No file uploaded.\n", status=400)

    file = request.files["file"]
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        return Response("Error: Only PDF files are accepted.\n", status=400)

    # 타임스탬프 기반 고유 ID 생성
    timestamp = str(int(time.time() * 1000))
    original_name = Path(file.filename).stem
    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in original_name)
    file_id = f"uploaded_{safe_name}_{timestamp}"

    pdf_path = TEMP_DIR / f"{file_id}.pdf"
    output_dir = TEMP_DIR / f"{file_id}_output"

    # 파일 저장
    file.save(str(pdf_path))

    def generate():
        yield f"[FILE] Received: {file.filename}\n"
        yield f"[SAVE] Saved as: {pdf_path.name}\n\n"
        yield f"[CONVERT] Starting conversion with {MARKER_CMD}...\n"

        output_dir.mkdir(parents=True, exist_ok=True)

        for chunk in stream_marker_process(pdf_path, output_dir, file_id):
            # [COMPLETED] 신호에 file_id를 포함시킴
            if "[COMPLETED]" in chunk:
                yield chunk.replace("[COMPLETED]", f"[COMPLETED:{file_id}]")
            else:
                yield chunk

    return Response(
        generate(),
        mimetype="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.route("/download", methods=["GET"])
def download():
    """
    변환된 파일을 ZIP으로 압축하여 다운로드합니다.
    다운로드 완료 후 임시 파일을 정리합니다.
    """
    file_id = request.args.get("id")
    if not file_id:
        return Response("Error: 'id' parameter is required.\n", status=400)

    with results_lock:
        result = conversion_results.get(file_id)

    if not result:
        return Response(
            f"Error: No conversion result found for '{file_id}'.\n",
            status=404,
        )

    output_dir = Path(result["output_dir"])
    original_pdf = Path(result["original_pdf"])

    if not output_dir.exists():
        return Response("Error: Output directory not found.\n", status=404)

    # ZIP 파일 생성
    zip_path = TEMP_DIR / f"{file_id}.zip"

    try:
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, files in os.walk(output_dir):
                for fname in files:
                    file_path = Path(root) / fname
                    arcname = file_path.relative_to(output_dir)
                    zf.write(file_path, arcname)

        # 다운로드 후 Cleanup 예약
        @after_this_request
        def cleanup(response):
            def _cleanup():
                time.sleep(1)  # 전송 완료 대기
                try:
                    # 원본 PDF 삭제
                    if original_pdf.exists():
                        original_pdf.unlink()
                    # Marker 출력 폴더 삭제
                    if output_dir.exists():
                        shutil.rmtree(output_dir)
                    # ZIP 파일 삭제
                    if zip_path.exists():
                        zip_path.unlink()
                    # 결과 딕셔너리에서 제거
                    with results_lock:
                        conversion_results.pop(file_id, None)
                except Exception as e:
                    print(f"[Cleanup Warning] {e}", file=sys.stderr)

            threading.Thread(target=_cleanup, daemon=True).start()
            return response

        return send_file(
            str(zip_path),
            as_attachment=True,
            download_name=f"{file_id}.zip",
            mimetype="application/zip",
        )

    except Exception as e:
        return Response(f"Error creating ZIP: {str(e)}\n", status=500)


# --- Entry Point ---

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))

    print("======================================")
    print("   arXiv-Marker Server")
    print("======================================")
    print(f"  Marker command : {MARKER_CMD}")
    print(f"  Temp directory : {TEMP_DIR}")
    print(f"  Server address : http://localhost:{port}")
    print()

    app.run(
        host="0.0.0.0",
        port=port,
        debug=False,
        threaded=True,
    )
