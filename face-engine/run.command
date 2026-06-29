#!/bin/bash
# Double-click this on the laptop to start the local face-engine launcher. It
# listens on 127.0.0.1:8765 and starts the engine on 127.0.0.1:8000 when the
# site asks (Start scanning / Save face). Leave it running while you use face
# attendance — local or the deployed tncengcenter site.
cd "$(dirname "$0")" || exit 1

if [ ! -x ./.venv/bin/uvicorn ]; then
  echo "Setting up the face engine (first run, a few minutes)…"
  python3.12 -m venv .venv 2>/dev/null || python3 -m venv .venv
  ./.venv/bin/pip install --upgrade pip -q
  ./.venv/bin/pip install -r requirements.txt
fi

echo "Face-engine launcher starting…"
exec ./.venv/bin/python launcher.py
