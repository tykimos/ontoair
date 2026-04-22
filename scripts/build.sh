#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/build"
APP="$BUILD_DIR/OntoAir.app"
APPEX="$APP/Contents/PlugIns/QLOntoPreview.appex"

echo "=== OntoAir Build ==="

# Clean previous build
rm -rf "$APP"

# Create app bundle structure
mkdir -p "$APP/Contents/MacOS"
mkdir -p "$APP/Contents/Resources"
mkdir -p "$APPEX/Contents/MacOS"
mkdir -p "$APPEX/Contents/Resources"

# Copy plists
cp "$PROJECT_ROOT/AppInfo.plist" "$APP/Contents/Info.plist"
cp "$PROJECT_ROOT/ExtInfo.plist" "$APPEX/Contents/Info.plist"

# Copy resources into both app and appex bundles
for dest in "$APP/Contents/Resources" "$APPEX/Contents/Resources"; do
    cp "$PROJECT_ROOT/resources/three.min.js"     "$dest/"
    cp "$PROJECT_ROOT/resources/OrbitControls.js" "$dest/"
    cp "$PROJECT_ROOT/resources/template.html"    "$dest/"
    cp "$PROJECT_ROOT/resources/ontoair.js"       "$dest/"
done

# Hand control + MediaPipe assets — main app only (QuickLook preview doesn't need camera)
cp "$PROJECT_ROOT/resources/hand-control.js" "$APP/Contents/Resources/"
cp -R "$PROJECT_ROOT/resources/mediapipe"    "$APP/Contents/Resources/"

# Write PkgInfo
echo -n "APPL????" > "$APP/Contents/PkgInfo"
echo -n "XPC!????" > "$APPEX/Contents/PkgInfo"

# Compile app main (includes OntoAirHTML.swift)
echo "  Compiling app..."
swiftc -o "$APP/Contents/MacOS/ontoair" \
    -target arm64-apple-macos13.0 \
    -sdk $(xcrun --show-sdk-path) \
    -framework Cocoa \
    -framework WebKit \
    -parse-as-library \
    "$PROJECT_ROOT/src/AppMain.swift" \
    "$PROJECT_ROOT/src/OntoAirHTML.swift"

# Compile QuickLook Preview Extension (includes OntoAirHTML.swift)
echo "  Compiling QLOntoPreview extension..."
swiftc -o "$APPEX/Contents/MacOS/QLOntoPreview" \
    -target arm64-apple-macos13.0 \
    -sdk $(xcrun --show-sdk-path) \
    -module-name QLOntoPreview \
    -framework Cocoa \
    -framework QuickLookUI \
    -framework WebKit \
    -framework Foundation \
    -application-extension \
    -Xlinker -e -Xlinker _NSExtensionMain \
    -Xlinker -rpath -Xlinker @executable_path/../Frameworks \
    "$PROJECT_ROOT/src/PreviewExtension.swift" \
    "$PROJECT_ROOT/src/OntoAirHTML.swift"

# Ad-hoc code sign (required for extensions)
echo "  Code signing..."
codesign --force --sign - --entitlements /dev/stdin "$APPEX" <<'ENTITLEMENTS'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-only</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
</dict>
</plist>
ENTITLEMENTS

codesign --force --sign - "$APP"

echo "=== Build complete: $APP ==="
echo ""
echo "To install:  ./scripts/install.sh"
