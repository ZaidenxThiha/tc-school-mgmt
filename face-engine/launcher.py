#!/usr/bin/env python3
"""Local launcher for the face-engine sidecar.

Browsers on the deployed site cannot spawn processes, but they can call this
tiny helper on 127.0.0.1:8765. POST /start launches uvicorn on port 8000 when
the engine is down. Run via run.command and leave it open (or install as a
login item) on each attendance laptop.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ENGINE_DIR = Path(__file__).resolve().parent
ENGINE_PORT = int(os.environ.get("FACE_ENGINE_PORT", "8000"))
LAUNCHER_PORT = int(os.environ.get("FACE_LAUNCHER_PORT", "8765"))
ENGINE_URL = f"http://127.0.0.1:{ENGINE_PORT}"
UVICORN = ENGINE_DIR / ".venv" / "bin" / "uvicorn"
LOG_PATH = ENGINE_DIR / "engine.log"

# Match face-engine defaults so browser CORS + Private Network Access work.
_default_origins = "https://tncengcenter.vercel.app,http://localhost:3000,http://127.0.0.1:3000"
ALLOW_ORIGINS = [o.strip() for o in os.environ.get("FACE_ALLOW_ORIGINS", _default_origins).split(",") if o.strip()]

_child: subprocess.Popen | None = None
_lock = threading.Lock()


def _engine_healthy() -> bool:
    try:
        with urllib.request.urlopen(f"{ENGINE_URL}/health", timeout=2) as res:
            data = json.loads(res.read().decode())
            return bool(data.get("ok"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return False


def _spawn_engine() -> None:
    global _child
    if not UVICORN.is_file():
        raise RuntimeError(f"venv not found at {UVICORN} — run run.command once to install")
    if _child is not None and _child.poll() is None:
        return
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    log = open(LOG_PATH, "a", encoding="utf-8")  # noqa: SIM115
    env = {**os.environ, "FACE_ENGINE_TOKEN": "", "FACE_CTX_ID": os.environ.get("FACE_CTX_ID", "-1")}
    _child = subprocess.Popen(
        [str(UVICORN), "main:app", "--host", "127.0.0.1", "--port", str(ENGINE_PORT)],
        cwd=ENGINE_DIR,
        env=env,
        stdout=log,
        stderr=log,
        start_new_session=True,
    )


def _ensure_engine(timeout_s: float = 120.0) -> bool:
    if _engine_healthy():
        return True
    with _lock:
        if _engine_healthy():
            return True
        _spawn_engine()
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        time.sleep(1.5)
        if _engine_healthy():
            return True
    return False


def _cors_origin(handler: BaseHTTPRequestHandler) -> str:
    origin = handler.headers.get("Origin", "")
    if "*" in ALLOW_ORIGINS:
        return "*"
    if origin in ALLOW_ORIGINS:
        return origin
    return ALLOW_ORIGINS[0] if ALLOW_ORIGINS else "*"


class LauncherHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        sys.stderr.write(f"[face-launcher] {self.address_string()} - {fmt % args}\n")

    def _send(self, code: int, body: dict) -> None:
        payload = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Access-Control-Allow-Origin", _cors_origin(self))
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        if self.headers.get("access-control-request-private-network") == "true":
            self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self) -> None:  # noqa: N802
        if self.headers.get("access-control-request-private-network") == "true":
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", _cors_origin(self))
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "*")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.end_headers()
            return
        self._send(204, {})

    def do_GET(self) -> None:  # noqa: N802
        if self.path.rstrip("/") in ("", "/health"):
            self._send(200, {"ok": True, "engine": _engine_healthy()})
            return
        if self.path.rstrip("/") == "/start":
            ok = _ensure_engine()
            self._send(200 if ok else 503, {"ok": ok, "engine": ok})
            return
        self._send(404, {"ok": False, "error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path.rstrip("/") == "/start":
            ok = _ensure_engine()
            self._send(200 if ok else 503, {"ok": ok, "engine": ok})
            return
        self._send(404, {"ok": False, "error": "not found"})


def main() -> None:
    print(f"Face-engine launcher on http://127.0.0.1:{LAUNCHER_PORT}  (engine → {ENGINE_URL})")
    print("Leave this window open while using face attendance on this laptop.")
    server = ThreadingHTTPServer(("127.0.0.1", LAUNCHER_PORT), LauncherHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping launcher.")
        server.shutdown()


if __name__ == "__main__":
    main()
