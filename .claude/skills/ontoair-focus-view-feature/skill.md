---
name: ontoair-focus-view-feature
description: "OntoAir에 node-centric focus(isolation) 뷰 강화 기능을 추가하는 스킬. 한 노드 선택 시 N-hop 이웃만 fully visible, 그 외 fade out. 기존 ⌘+클릭 isolation을 확장. hop depth 조정 UI 포함. 체스(piece의 영향권), 학술그래프(인용 cascade), 어떤 도메인이든 focus 분석에 generic 활용."
---

# OntoAir Node-Centric Focus View

특정 노드를 선택하면 그 이웃만 강조하고 나머지를 fade out하는 focus view.

## 현재 상태

OntoAir에는 이미 `⌘+클릭` 기반 isolation이 있음 (변수 `isolatedRoot`, 함수 `applyIsolation`). 이 기능을 확장.

## 새 기능

### 1. Hop depth 조정
현재는 N=1 고정. 사이드바 또는 컨트롤 바에 작은 슬라이더/dial 추가:
- depth 1: 직접 이웃만
- depth 2: 친구의 친구까지
- depth 3+: 더 멀리

기존 `#depth-dial`(BFS Depth) UI 컴포넌트 재사용 가능 — 현재 추론에 사용 중인데 isolation 깊이로도 쓰면 일관성.

### 2. 다단계 opacity gradient
- 선택 노드: 100% opacity, 노란 highlight
- 1-hop: 100% opacity, 파란 highlight
- 2-hop: 60% opacity
- 3-hop: 30% opacity
- 그 외: 10% opacity (fade out, 완전히 숨기지 않아 컨텍스트 유지)

```javascript
function applyFocusGradient(rootId, maxDepth){
  // BFS from rootId
  const depths = bfs(rootId, maxDepth);
  nodeMeshes.forEach(m => {
    const d = depths[m.userData.id];
    let opacity;
    if(m.userData.id === rootId) opacity = 1.0;
    else if(d === undefined) opacity = 0.1;
    else opacity = Math.max(0.1, 1 - d * 0.3);
    setNodeOpacity(m, opacity);
  });
  edgeObjs.forEach(e => {
    const ds = depths[e.userData.srcId], dt = depths[e.userData.tgtId];
    const visible = (ds !== undefined && dt !== undefined);
    // ...
  });
}
```

### 3. 활성/해제 UX
- `⌘+클릭` 노드 → focus 모드 진입
- `Esc` 또는 빈 공간 클릭 → focus 해제
- 같은 노드 다시 ⌘+클릭 → depth +1
- depth dial 드래그로 depth 직접 조정

## 구현 위치

`ontoair.js`의 isolation 관련 변수 + applyIsolation 함수 확장:
```javascript
let focusRoot = null, focusDepth = 1;

function applyFocus(){
  if(!focusRoot){
    // 전체 표시 복원
    nodeMeshes.forEach(m => setNodeOpacity(m, 1.0));
    edgeObjs.forEach(e => e.visible = true);
    return;
  }
  applyFocusGradient(focusRoot, focusDepth);
}
```

기존 `applyIsolation`을 `applyFocus`로 교체하거나 새 함수로 병존.

## 회피해야 할 것

- 노드 mesh material을 통째로 교체하지 말 것 — `material.opacity`만 변경
- isolation 활성 중에도 search는 작동해야 함 (검색 결과는 fade 무시)
- depth가 너무 깊으면(>4) 그냥 전부 보이게 → 깊이 캡 5
- 화살표 head sprite의 opacity도 함께 조절 (mesh와 별개로 sprite의 material에 opacity)

## 검증

- 체스 sample: WhiteKnight_g5 ⌘+클릭 → 공격하는 piece, 공격받는 piece만 강조됨
- 다른 도메인: 어떤 노드 선택해도 동일 패턴 동작
- depth 1→2→3 늘리면 점점 더 많은 노드가 fade-in
- Esc 누르면 전체 복원
