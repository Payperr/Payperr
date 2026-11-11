#!/bin/sh
# macOS / Linux equivalent of START.bat
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || { echo "Node.js not found. Install the LTS from https://nodejs.org/"; exit 1; }
exec node server/server.mjs "$@"
