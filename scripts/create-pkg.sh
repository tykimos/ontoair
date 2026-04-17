#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/build"
DIST_DIR="$PROJECT_ROOT/dist"
APP="$BUILD_DIR/OntoAir.app"
PKG_ID="com.ontoair.app"
VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$PROJECT_ROOT/AppInfo.plist")"

echo "=== OntoAir PKG Installer Creation (v${VERSION}) ==="

if [ ! -d "$APP" ]; then
    echo "Error: $APP not found. Run ./scripts/build.sh first."
    exit 1
fi

mkdir -p "$DIST_DIR"

PAYLOAD_DIR=$(mktemp -d)
mkdir -p "$PAYLOAD_DIR/Applications"
cp -R "$APP" "$PAYLOAD_DIR/Applications/"

SCRIPTS_DIR=$(mktemp -d)
cat > "$SCRIPTS_DIR/postinstall" << 'POSTINSTALL'
#!/bin/bash
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "/Applications/OntoAir.app" 2>/dev/null || true
/usr/bin/qlmanage -r 2>/dev/null || true
/usr/bin/qlmanage -r cache 2>/dev/null || true
exit 0
POSTINSTALL
chmod +x "$SCRIPTS_DIR/postinstall"

pkgbuild \
    --root "$PAYLOAD_DIR" \
    --scripts "$SCRIPTS_DIR" \
    --identifier "$PKG_ID" \
    --version "$VERSION" \
    --install-location "/" \
    "$DIST_DIR/ontoair.pkg"

rm -rf "$PAYLOAD_DIR" "$SCRIPTS_DIR"

echo "=== PKG created: $DIST_DIR/ontoair.pkg ==="
