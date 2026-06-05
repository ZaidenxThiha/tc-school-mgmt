#!/bin/bash
# Double-click this on the laptop to start the local face engine. It listens on
# 127.0.0.1:8000 (this machine only) token-less, so the website — local or the
# deployed tncengcenter site — can use it from the browser. Leave it running
# while you register faces / run Face Attendance.
cd "$(dirname "$0")" || exit 1

if [ ! -x ./.venv/bin/uvicorn ]; then
  echo "Setting up the face engine (first run, a few minutes)…"
  python3.12 -m venv .venv 2>/dev/null || python3 -m venv .venv
  ./.venv/bin/pip install --upgrade pip -q
  ./.venv/bin/pip install -r requirements.txt
fi

echo "Face engine running at http://127.0.0.1:8000  (keep this window open)"
exec ./.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
