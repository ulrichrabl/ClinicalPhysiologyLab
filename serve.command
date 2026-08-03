#!/bin/bash
# Double-click on macOS. Serves the built lab (with capture endpoint) and opens it.
cd "$(dirname "$0")/source"
if [[ ! -f dist/index.html ]]; then
  echo "Building dist/index.html…"
  node scripts/build.mjs || exit 1
fi
echo "Clinical Physiology Lab"
echo "Shift+C or ECG → Capture  saves into  ../captures/ecg/"
node scripts/serve.mjs
