#!/bin/bash
# Double-click on macOS. Serves this folder and opens the lab in your browser.
cd "$(dirname "$0")"
PORT=8000
while lsof -i :$PORT >/dev/null 2>&1; do PORT=$((PORT+1)); done
echo "Clinical Physiology Lab  →  http://localhost:$PORT"
echo "Close this window to stop the server."
(sleep 1 && open "http://localhost:$PORT") &
python3 -m http.server $PORT
