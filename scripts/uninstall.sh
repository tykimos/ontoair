#!/bin/bash
set -euo pipefail

INSTALL_DIR="$HOME/Library/QuickLook"

echo "=== OntoAir Uninstall ==="

rm -rf "$INSTALL_DIR/ontoair.qlgenerator"

qlmanage -r 2>/dev/null || true
qlmanage -r cache 2>/dev/null || true

echo "=== Uninstalled ontoair.qlgenerator ==="
