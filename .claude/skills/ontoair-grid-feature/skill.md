---
name: ontoair-grid-feature
description: "OntoAir에 generic GRID 보기 모드를 추가하는 스킬. node에 gridX/gridY (또는 alias col/row) 메타데이터가 있으면 N×M 격자 평면에 자동 배치. MAP/GLOBE와 동일 패턴 (geo 대신 grid). 체스, 좌석배치, 주기율표 등 generic 사용. parser-engineer + ui-engineer 협업 작업."
---

# OntoAir GRID Feature

Generic 2D 격자 좌표 시각화 모드를 OntoAir에 추가.

## 트리거 조건

ontology의 individual node에 다음 중 하나의 DatatypeProperty 쌍이 있으면 GRID view 활성화:
- `gridX` + `gridY` (권장 표준)
- `col` + `row` (alias)
- `column` + `row` (alias)

값은 xsd:integer 또는 xsd:string. 문자열인 경우 첫 영문자를 0-base 정수로 변환 ('a'=0, 'b'=1, ...).

## 구현 (parser-engineer 영역)

`resources/ontoair.js`의 parseTTL/parseXML 끝에서 geo/orbit과 같은 패턴으로 grid 정규화 추가:

```javascript
// Grid: aggregate gridX/gridY from dpv (alias: col/row, column/row)
const _grAcc={};
R.dpv.forEach(({s,p,v})=>{
  const k=String(p).toLowerCase();
  let num=parseFloat(String(v));
  if(isNaN(num)){
    // String column like 'a','b' → ASCII offset
    const m=String(v).trim().match(/^[a-zA-Z]/);
    if(m) num = m[0].toLowerCase().charCodeAt(0) - 97;
  }
  if(isNaN(num)) return;
  if(k==='gridx'||k==='col'||k==='column') (_grAcc[s]=_grAcc[s]||{}).gx=num;
  else if(k==='gridy'||k==='row') (_grAcc[s]=_grAcc[s]||{}).gy=num;
});
const _grNodes=[];
Object.entries(_grAcc).forEach(([id,v])=>{
  if(typeof v.gx==='number' && typeof v.gy==='number'){
    _grNodes.push({id, gx:v.gx, gy:v.gy});
  }
});
R.grid={nodes:_grNodes};
R.hasGrid=_grNodes.length>0;
```

parseXML도 동일한 shape으로.

## 구현 (ui-engineer 영역)

### 1. GRID 버튼 추가 (template.html + dev.html)

`#controls` 영역에 MAP/GLOBE 옆에:
```html
<button id='bgrid' class='ctrl-badge' title='Grid coordinates detected (col/row)' style='display:none'>GRID</button>
```

CSS는 기존 `.ctrl-badge` 재사용 (옅은 파랑).

### 2. 표시 조건

기존 `hasGeo || hasOrbit` 확장:
```javascript
if(window.O && (window.O.hasGeo || window.O.hasOrbit)){
  // show bgeomap, bgeoglobe
}
if(window.O && window.O.hasGrid){
  document.getElementById('bgrid').style.display='';
}
```

### 3. gridLayout() 함수 (ontoair.js)

mapLayout/globeLayout과 평행 구조:

```javascript
function gridLayout(){
  const gridNodes = (O.grid && O.grid.nodes) || [];
  if(!gridNodes.length) return false;
  
  _disposeMapGroup();
  mapView.group = new THREE.Group();
  scene.add(mapView.group);
  mapView.active = true;
  mapView.mode = 'grid';
  floorGrid.visible = false;
  
  // Bbox of grid coordinates
  let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
  gridNodes.forEach(n => {
    minX = Math.min(minX, n.gx); maxX = Math.max(maxX, n.gx);
    minY = Math.min(minY, n.gy); maxY = Math.max(maxY, n.gy);
  });
  // Pad to integer grid bounds (e.g., chess: 0..7)
  minX = Math.floor(minX); maxX = Math.ceil(maxX);
  minY = Math.floor(minY); maxY = Math.ceil(maxY);
  const cols = maxX - minX + 1, rows = maxY - minY + 1;
  
  // World scale
  const CELL = 6; // world units per grid cell
  const planeW = cols * CELL, planeH = rows * CELL;
  
  mapView.ctx = {minX, maxX, minY, maxY, cols, rows, CELL, planeW, planeH};
  
  // Board base: checkered pattern (works for chess; harmless for other grids)
  const boardGroup = new THREE.Group();
  for(let cy=0; cy<rows; cy++){
    for(let cx=0; cx<cols; cx++){
      const isLight = (cx+cy)%2 === 0;
      const mat = new THREE.MeshBasicMaterial({
        color: isLight ? 0xf0e8d0 : 0xb88860,
        side: THREE.DoubleSide,
        transparent: true, opacity: 0.85
      });
      const cell = new THREE.Mesh(new THREE.PlaneGeometry(CELL, CELL), mat);
      cell.rotation.x = -Math.PI/2;
      cell.position.set((cx - (cols-1)/2)*CELL, -9, (cy - (rows-1)/2)*CELL);
      boardGroup.add(cell);
    }
  }
  mapView.group.add(boardGroup);
  
  // Grid axes labels (a-h, 1-8 for chess; numeric for others)
  // ... (canvas-textured sprites at edges)
  
  // Pin grid nodes
  const gridIds = new Set();
  const NODE_Y = 4;
  gridNodes.forEach(n => {
    gridIds.add(n.id);
    const wx = (n.gx - minX - (cols-1)/2) * CELL;
    const wz = (n.gy - minY - (rows-1)/2) * CELL;
    nodeMap[n.id] = {x: wx, y: NODE_Y, z: wz};
    
    // Pin (small dot on the board cell)
    const pinMat = new THREE.MeshBasicMaterial({color: 0x1c4f99, side: THREE.DoubleSide});
    const pin = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16), pinMat);
    pin.rotation.x = -Math.PI/2;
    pin.position.set(wx, -8.85, wz);
    mapView.group.add(pin);
    
    // Leader from pin to node
    const ldGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(wx, -8.83, wz),
      new THREE.Vector3(wx, NODE_Y-0.6, wz)
    ]);
    const ldMat = new THREE.LineDashedMaterial({color: 0x6a8cb6, dashSize:0.32, gapSize:0.22});
    const lead = new THREE.Line(ldGeo, ldMat);
    lead.computeLineDistances();
    mapView.group.add(lead);
    mapView.leaders[n.id] = lead;
    mapView.pins[n.id] = {x: wx, z: wz, mesh: pin};
  });
  
  // Non-grid nodes: place in ring around the board
  const allIds = [...O.cls.map(c=>c.id), ...O.ind.map(i=>i.id)].filter(id => nodeMap[id]);
  const movable = allIds.filter(id => !gridIds.has(id));
  movable.forEach((id, i) => {
    const a = i / Math.max(1, movable.length) * Math.PI * 2;
    const r = Math.max(planeW, planeH) * 0.7;
    nodeMap[id] = {x: Math.cos(a)*r, y: NODE_Y, z: Math.sin(a)*r};
  });
  
  applyPositions();
  camera.position.set(0, Math.max(planeW,planeH)*0.8, Math.max(planeW,planeH)*1.0);
  ctrl.target.set(0, 0, 0);
  return true;
}
```

### 4. 버튼 핸들러

```javascript
const _bgrid = document.getElementById('bgrid');
if(_bgrid) _bgrid.addEventListener('click', () => {
  if(mapView.active && mapView.mode === 'grid'){
    exitMapView();
    document.getElementById('bh').click();
  } else {
    exitMapView();
    setView2D(false);
    resetBends();
    _setLayoutActive('');
    if(gridLayout()) _bgrid.classList.add('active-map');
  }
});
```

### 5. exitMapView 확장

```javascript
['bgeomap','bgeoglobe','bgrid'].forEach(id => {
  const b = document.getElementById(id);
  if(b) b.classList.remove('active-map');
});
```

### 6. 다른 layout 버튼에서 exitMapView 호출 (기존과 동일)

bf/bh/b2/br 핸들러는 이미 `exitMapView()` 호출 중이라 자동으로 grid 모드 정리.

## 핵심 디자인 결정

1. **체커보드 기본 패턴** — chess에 자연스럽고, 다른 도메인(좌석배치, 주기율표)에서도 가독성 좋음. 단색 그리드 옵션을 추후 추가 가능.
2. **gridX/gridY = (col, row)** — col이 X(가로), row가 Y(세로). 행렬 컨벤션과 다르므로 주의 (행렬은 (row, col)).
3. **체스 컨벤션**: file 'a'~'h' → gridX 0~7 (left to right), rank 1~8 → gridY 0~7 (white side to black side).
4. **Pin/leader 구조 재사용** — geo와 동일하게 `mapView.pins`/`mapView.leaders` 구조. 드래그 시 leader 자동 따라옴.

## 회피해야 할 것

- 체스 전용 로직 추가 (예: King 이동 규칙 시각화) — generic 원칙 위반
- gridX/gridY 외의 chess-specific property(file/rank) 직접 인식 — file/rank는 사람-읽기 보조용으로만
- 격자 cell의 sprite text overlay는 옵션이지만 무거우면 toggle화

## 검증

- `R.hasGrid === true` after parsing sample-chess.ttl
- bgrid 버튼이 표시되고 클릭 시 격자 활성화
- 64개(체스) 또는 N×M cell이 정확한 위치에 렌더링
- 비-grid 노드(TacticalPattern, Move 등)는 보드 바깥 ring layout
- Hierarchy/Force/2D 클릭 시 grid 정리되어 원래 그래프 모드 복귀
