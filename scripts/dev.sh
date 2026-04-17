#!/bin/bash
# OntoAir dev server - edit resources/ontoair.js or dev.html, refresh browser.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8765}"
URL="http://localhost:${PORT}/resources/dev.html"

cd "$PROJECT_ROOT"
echo "=== OntoAir Dev Server ==="
echo "    Root: $PROJECT_ROOT (port $PORT)"
echo "    Open: $URL"
echo "    Edit: resources/ontoair.js, resources/dev.html, resources/template.html"
echo "    Ctrl+C to stop"
echo ""

( sleep 1 && open "$URL" ) &
exec python3 -m http.server "$PORT" --bind 127.0.0.1
