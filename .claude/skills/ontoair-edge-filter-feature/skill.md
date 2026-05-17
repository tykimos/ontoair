---
name: ontoair-edge-filter-feature
description: "OntoAir 사이드바에 predicate별 edge 표시/숨김 체크박스를 추가하는 generic 기능. attacks만, defends만, partOf만 등 보고 싶은 관계 타입을 선택. 체스(attacks/defends 분리), 소셜그래프(친구/팔로워), 학술그래프(인용/공저) 등에 활용. ui-engineer가 사용."
---

# OntoAir Edge Predicate Filter

특정 predicate의 edge만 보이도록 사이드바에서 toggle하는 generic 기능.

## 트리거 조건

ontology에 ObjectProperty가 2개 이상이면 필터 패널 활성화 (1개면 의미 없음).

## UI 위치

소스 사이드바(`#source`) 안, Legend 위 또는 아래에 새 섹션:
```html
<h4>Filter Edges</h4>
<div class='panel' id='edge-filter-panel'>
  <!-- 동적 생성: 각 predicate별 체크박스 -->
</div>
```

체크박스는 ontology 로드 후 `window.O.op` 목록에서 동적 생성:
```html
<label class='filter-row'>
  <input type='checkbox' data-pred='attacks' checked> attacks
  <span class='filter-count'>23</span>
</label>
```

`filter-count`는 해당 predicate의 엣지 수 (정보용).

## 동작 로직

체크박스 toggle 시:
1. 해당 predicate의 모든 edge mesh의 `.visible` 속성 변경
2. 해당 predicate가 라벨인 sprite도 `.visible` 변경
3. arrow head sprite도 함께 toggle

```javascript
// edgeObjs는 [{line, srcId, tgtId, predicate, ...}] 형태
function toggleEdgesByPredicate(pred, visible){
  edgeObjs.forEach(eo => {
    if(eo.userData.predicate === pred){
      eo.visible = visible;
      if(eo.userData.labelSprite) eo.userData.labelSprite.visible = visible;
    }
  });
  arrowObjs.forEach(a => {
    if(a.predicate === pred){
      if(a.line) a.line.visible = visible;
      if(a.head) a.head.visible = visible;
      if(a.labelSprite) a.labelSprite.visible = visible;
    }
  });
}
```

전제: edgeObjs의 userData에 `predicate` 필드 추가 필요. 현재 코드는 srcId/tgtId만 저장 — `predicate` 필드 추가는 makeArrow/addLine 호출 시 한 줄.

## 카운트 계산

```javascript
function predicateCounts(){
  const counts = {};
  O.rel.forEach(r => { counts[r.p] = (counts[r.p]||0) + 1; });
  O.sub.forEach(_ => { counts['subClassOf'] = (counts['subClassOf']||0) + 1; });
  O.typ.forEach(_ => { counts['type'] = (counts['type']||0) + 1; });
  // DP는 보통 callout이라 별도
  return counts;
}
```

## 시각적 디자인

- 체크박스 옆에 작은 색 칩(해당 predicate의 엣지 색)
- 호버 시 해당 엣지가 하이라이트 (selectedRoot 메커니즘 재사용)
- "All / None" 빠른 버튼 추가 가능

## Persistence

`localStorage`에 마지막 필터 상태 저장:
```javascript
localStorage.setItem('ontoair-edge-filter', JSON.stringify(state));
```
다음 로드 시 복원. baseURL=nil WKWebView 환경에서는 try/catch.

## 회피해야 할 것

- DP (DatatypeProperty) callout은 필터에 포함 안 함 — 노드 속성 표시이지 엣지 아님
- subClassOf는 ontology 구조의 근간이라 기본 ON 유지 (off 시 그래프가 disconnect)
- predicate 수가 100+ 면 UI 폭발 — 그땐 검색 입력으로 필터링

## 검증

- 체스 sample-chess.ttl 로드 → "attacks" 체크 해제 → 모든 attack 엣지 사라짐
- "defends" 단독 ON → 방어 관계만 표시
- 다른 도메인(GEO sample-geo.ttl)에서도 locatedIn / relatedTo 필터링 가능
- localStorage 상태가 새로고침 후 유지됨
