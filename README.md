<div align="right"><a href="README_ko.md">🇰🇷 한국어</a></div>

# OntoAir

A macOS QuickLook preview extension and standalone viewer that renders `.owl`, `.rdf`, `.ttl`, `.trig` ontology files as an **interactive 3D graph**.

## Features

### Visualization
- **2D billboard nodes** always facing the camera
  - Classes: **dashed** outline
  - Individuals: **solid** outline
- **Directional 2D arrow edges**
  - ObjectProperty (schema): dashed line + filled triangle
  - ObjectProperty (instance): solid line + filled triangle
  - `subClassOf`: UML generalization (hollow triangle)
  - `rdf:type`: dashed line
- **DatatypeProperty**: 45° slope + horizontal leader to a callout box (`name : xsd:string`)
- **Self-referencing OPs** rendered as cubic Bezier loops
- **Classes on top / Individuals on bottom** hierarchical layout with a Barycenter heuristic to minimize edge crossings
- **Force-directed** alternative layout

### Interaction
- **Drag** nodes to reposition
- **Click** to select — selected node pulses **yellow**, neighbors pulse **light blue**
- **Edge/arrow selection** via the line or its midpoint label
- **Cmd + +/−/0** to scale text (screen-space fixed size)
- **Floor grid** for 3D spatial reference

### Left Source sidebar
- Line-numbered view of the raw file
- **Bi-directional highlighting**
  - Select a node → lines mentioning it turn **yellow**, lines mentioning its neighbors turn **light blue**
  - Select an edge → lines mentioning both endpoints turn yellow, lines mentioning one endpoint turn light blue
- Click a line to select the corresponding node or edge
- **Collapse/expand** toggle (`‹`/`›`)
- **Resizable** gutter on the right (drag, 200–720 px)
- Width is persisted in `localStorage`

### Search & tooltip
- Top-right search box to filter nodes by name
- Hover tooltip shows node type, URI, connected edges, and owned DPs

## Installation

### macOS PKG (recommended)
Download `OntoAir-<version>.pkg` from the Releases page and run it.

After install:
- Press **Space** on a `.owl`/`.rdf`/`.ttl` file in Finder for the QuickLook preview
- Double-click a file to open it in OntoAir
- Drag-and-drop onto the app icon also works

### Build from source
```bash
./scripts/build.sh    # builds build/OntoAir.app
./scripts/install.sh  # installs to /Applications and resets the QuickLook cache
```

Requirements: macOS 13+, Swift toolchain (Xcode Command Line Tools).

## Development (hot reload)

Iterate on `resources/ontoair.js` and `resources/template.html` with just a browser refresh:

```bash
./scripts/dev.sh
```

- Starts a local Python HTTP server on port 8765
- Opens `http://localhost:8765/resources/dev.html`
- Use the **DEV bar** to pick a sample or upload a file
- Edit JS/HTML and hit `Cmd+R` in the browser to reload
- Use DevTools for errors and console output

When you are happy with the result, run `./scripts/build.sh && ./scripts/install.sh` to bake the changes into the app bundle.

## Project layout

```
src/
├── AppMain.swift          # NSApp + WKWebView standalone app
├── PreviewExtension.swift # QLPreviewingController QuickLook extension
└── OntoAirHTML.swift      # Template substitution (builds the render bundle)
resources/
├── template.html          # HTML skeleton + CSS + placeholders ({{RAW}} etc.)
├── ontoair.js             # All 3D rendering logic (THREE.js based)
├── dev.html               # Browser dev harness
├── three.min.js
└── OrbitControls.js
scripts/
├── build.sh               # swiftc + bundle layout + ad-hoc signing
├── install.sh             # Install to /Applications + reset QL cache
├── dev.sh                 # Local dev server
├── create-pkg.sh          # Build distributable PKG
├── create-dmg.sh          # Wrap PKG into a DMG
└── uninstall.sh
test/
├── sample.ttl, sample.owl, sample.rdf, sample.trig
AppInfo.plist              # Main app Info.plist
ExtInfo.plist              # QuickLook extension Info.plist
```

At runtime the Swift code loads `template.html` + `ontoair.js` + `three.min.js` + `OrbitControls.js` from the bundle resources, substitutes placeholders, and renders via `WKWebView.loadHTMLString(_:baseURL:nil)`. In the `baseURL:nil` context `localStorage` access is wrapped in try/catch so it fails gracefully.

## Supported formats

- **Turtle** (`.ttl`, `.trig`) — full parsing (namespace prefixes, triple blocks, string literals)
- **RDF/XML** (`.rdf`, `.owl`) — DOMParser driven, `rdf:about`/`rdf:resource` attributes

## License

**Source-available — Individual Research Use Only.** This is **not** open source.

- ✅ **Free** for a single **individual** using it **alone** for their own
  personal research, study, or evaluation.
- 🤝 **Requires a prior agreement** for any **group, organizational, educational,
  or commercial** use — this includes **universities and research laboratories**
  (they are organizations, so they need an agreement), schools, companies,
  nonprofits, government, courses, training, and offering it as a service.

To arrange a license for any non-individual use, contact **tykim@aifactory.page**.

See [`LICENSE`](LICENSE) for the binding terms and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)
for bundled components (three.js, satellite.js, gif.js, MediaPipe, …), which keep
their own licenses.

Copyright © 2026 tykimos.
