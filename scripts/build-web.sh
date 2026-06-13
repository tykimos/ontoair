#!/bin/bash
# OntoAir web harness builder.
#
# Produces a self-contained static webroot at <repo>/web/ that nginx serves
# under https://poc.aifactory.space/ontoair  (TLS is terminated at the upstream
# load balancer; this box only serves HTTP behind it).
#
# Layout produced:
#   web/index.html         generated from resources/dev.html
#                            - ../test/  ->  test/   (samples become a sibling)
#                            - dev-only chrome hidden (DEV badge, raw-source viewer)
#   web/<asset>            symlinks to ../resources/<asset> so dev.html's
#                            same-directory script srcs resolve unchanged
#   web/test              symlink to ../test (sample ontologies; nginx autoindex
#                            powers the in-app sample browser)
#
# Re-run this after editing resources/dev.html or adding sample files.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/web"
RES="$ROOT/resources"

echo "=== OntoAir Web Build ==="
echo "    Repo:    $ROOT"
echo "    Webroot: $WEB"

rm -rf "$WEB"
mkdir -p "$WEB"

# Client assets dev.html loads by same-directory name (script src / new Worker /
# GIF workerScript / dynamic import). Symlinked at web root so no rewrite needed.
ASSETS=(three.min.js OrbitControls.js satellite.min.js gif.js gif.worker.js \
        ontoair.js parser-worker.js hand-control.js mediapipe chat.js)
for f in "${ASSETS[@]}"; do
  if [ ! -e "$RES/$f" ]; then echo "Error: missing $RES/$f" >&2; exit 1; fi
  ln -s "../resources/$f" "$WEB/$f"
done

# Sample ontologies (one level up from resources in dev; a sibling here).
ln -s "../test" "$WEB/test"

# Generate the production entry page from the dev page.
python3 - "$RES/dev.html" "$WEB/index.html" <<'PY'
import sys
src, dst = sys.argv[1], sys.argv[2]
html = open(src, encoding='utf-8').read()

# Samples sit one level up in dev (resources/../test); at the webroot they are a sibling.
html = html.replace('../test/', 'test/')

# Production title.
html = html.replace('<title>OntoAir Dev</title>',
                    '<title>OntoAir — Ontology Visualizer</title>')

# Favicon (inline SVG data URI) — without it browsers request /favicon.ico at
# the site root, which 404s and logs a console error on every page load.
favicon = ('<link rel="icon" href="data:image/svg+xml,'
           '%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E'
           '%3Ccircle cx=%2210%22 cy=%2210%22 r=%225%22 fill=%22none%22 stroke=%22%23333%22 stroke-width=%222%22 stroke-dasharray=%223 2%22/%3E'
           '%3Ccircle cx=%2223%22 cy=%2222%22 r=%225%22 fill=%22none%22 stroke=%22%23e0a020%22 stroke-width=%222%22/%3E'
           '%3Cline x1=%2213%22 y1=%2214%22 x2=%2220%22 y2=%2219%22 stroke=%22%23333%22 stroke-width=%222%22/%3E'
           '%3C/svg%3E">\n')
html = html.replace('</title>', '</title>\n' + favicon, 1)

# Production overrides: responsive/mobile layout, hide dev-only chrome.
# dev.html has no viewport meta and a desktop-only twin-sidebar layout; this
# block makes the web service usable on phones without touching the dev tool.
inject = """<meta name='viewport' content='width=device-width, initial-scale=1, viewport-fit=cover'>
<style id='oa-prod-style'>
/* OntoAir production overrides */
.fb-tag{display:none!important}

/* --- Mobile / touch layout (<=768px) --- */
@media (max-width:768px){
  :root{--src-w:min(86vw,320px);--fb-w:min(86vw,320px)}
  /* let the canvas own touch gestures (one-finger rotate, pinch zoom) */
  canvas{touch-action:none}
  /* side panels become overlay drawers floating above the canvas */
  #source,#filebrowser{width:min(86vw,320px);box-shadow:0 0 40px rgba(0,0,0,0.18);z-index:40}
  #src-resize,#fb-resize{display:none!important}
  /* larger, corner-pinned touch targets for the drawer toggles */
  #src-toggle{width:40px;height:40px;font-size:18px;top:10px;left:calc(var(--src-w) - 20px);z-index:45}
  body.src-collapsed #src-toggle{left:10px}
  #fb-toggle{width:40px;height:40px;font-size:18px;top:10px;right:calc(var(--fb-w) - 20px);z-index:45}
  body.fb-collapsed #fb-toggle{right:10px}
  /* desktop-only chrome */
  #reload-left,#reload-right,#kbd-hint{display:none!important}
  /* compact search bar centered between the corner toggles */
  #search{top:14px;left:60px;right:60px;width:auto}
  body:not(.fb-collapsed) #search{right:60px}
  /* bottom controls wrap instead of running off-screen */
  #controls{left:10px;right:10px;bottom:10px;justify-content:flex-end;flex-wrap:wrap;gap:5px}
  #controls button{padding:7px 11px;font-size:11px}
  /* drawers overlay the canvas — never shift bottom/side UI under them */
  body:not(.fb-collapsed) #controls,
  body:not(.fb-collapsed) #rec-status,
  body:not(.fb-collapsed) #map-attrib,
  body:not(.fb-collapsed) #hc-toggle,
  body:not(.fb-collapsed) #hc-panel{right:10px}
  #depth-dial{left:10px!important}
  #tooltip{max-width:90vw}
  /* loading modal must fit a phone screen */
  .oa-card{min-width:0;width:92vw;max-width:92vw;padding:18px}
  .oa-sub-stages{max-height:30vh}
}
</style>
<script id='oa-prod-js'>
window.addEventListener('DOMContentLoaded',function(){
  // The left sidebar's "Source" subsection (raw RDF line viewer) is dev-only.
  document.querySelectorAll('#source h4').forEach(function(h){
    if(h.textContent.trim()==='Source'){
      h.style.display='none';
      var n=h.nextElementSibling; if(n&&n.id==='src-body') n.style.display='none';
    }
  });
  // On phones, start with both side drawers closed so the graph is full-screen.
  // (Runs after dev.html's file-browser init, so it wins.)
  if(window.matchMedia&&window.matchMedia('(max-width:768px)').matches){
    document.body.classList.add('src-collapsed','fb-collapsed');
  }
});
</script>
<script src="chat.js" defer></script>
"""
html = html.replace('</head>', inject + '</head>', 1)

open(dst, 'w', encoding='utf-8').write(html)
print('    index:   generated (%d bytes)' % len(html))
PY

echo "=== Done ==="
ls -la "$WEB"
