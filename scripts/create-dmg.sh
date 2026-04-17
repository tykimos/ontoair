#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$PROJECT_ROOT/dist"
DMG_NAME="ontoair.dmg"

echo "=== OntoAir DMG Creation ==="

if [ ! -f "$DIST_DIR/ontoair.pkg" ]; then
    echo "Error: ontoair.pkg not found. Run create-pkg.sh first."
    exit 1
fi

rm -f "$DIST_DIR/$DMG_NAME"

TEMP_DIR=$(mktemp -d)
cp "$DIST_DIR/ontoair.pkg" "$TEMP_DIR/"

hdiutil create \
    -volname "OntoAir Installer" \
    -srcfolder "$TEMP_DIR" \
    -ov \
    -format UDZO \
    "$DIST_DIR/$DMG_NAME"

rm -rf "$TEMP_DIR"

echo "=== DMG created: $DIST_DIR/$DMG_NAME ==="
