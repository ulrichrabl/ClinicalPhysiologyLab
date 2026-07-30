#!/bin/bash
cd "$(dirname "$0")"
PORT=8000
while ss -ltn 2>/dev/null | grep -q ":$PORT "; do PORT=$((PORT+1)); done
echo "Clinical Physiology Lab  →  http://localhost:$PORT"
(sleep 1 && xdg-open "http://localhost:$PORT" >/dev/null 2>&1) &
python3 -m http.server $PORT
