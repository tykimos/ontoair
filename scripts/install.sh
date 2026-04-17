#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/build"
APP="$BUILD_DIR/OntoAir.app"
INSTALL_DIR="/Applications"

echo "=== OntoAir Install ==="

if [ ! -d "$APP" ]; then
    echo "Error: OntoAir.app not found. Run build.sh first."
    exit 1
fi

# Remove old versions
rm -rf "$INSTALL_DIR/OntoAir.app"
rm -rf "$HOME/Library/QuickLook/ontoair.qlgenerator"

# Copy app to /Applications
cp -R "$APP" "$INSTALL_DIR/"

# Register with Launch Services (makes macOS recognize UTIs)
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$INSTALL_DIR/OntoAir.app" 2>/dev/null || true

# Reset QuickLook
qlmanage -r 2>/dev/null || true
qlmanage -r cache 2>/dev/null || true

# Launch app briefly to complete registration
open -a "$INSTALL_DIR/OntoAir.app" 2>/dev/null || true
sleep 2

echo "=== Installed to $INSTALL_DIR/OntoAir.app ==="
echo ""
echo "Test with: qlmanage -p /path/to/file.owl"
echo "Or press Space on a .owl/.rdf/.ttl file in Finder."
