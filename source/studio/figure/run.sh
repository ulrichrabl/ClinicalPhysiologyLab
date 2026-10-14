#!/usr/bin/env sh
# One command for the figure loop: build the bench from the real renderer, check the contract, take the pictures.
#   studio/figure/run.sh                 contact sheets (poses, states) + touch check   → studio/figure/out/*.png
#   studio/figure/run.sh motion|zoom …|all|app   (see shoot.py); add 'dark' for dark mode
set -e
cd "$(dirname "$0")/../.."
node studio/figure/build.mjs
node studio/figure/contract.test.mjs | grep -E '✗|passed' || true
if [ "$1" = "app" ] || [ "$1" = "all" ]; then node scripts/build-vp-demo.mjs > /dev/null; fi
python3 studio/figure/shoot.py "$@"
