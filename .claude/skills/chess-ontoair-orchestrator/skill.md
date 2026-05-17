---
name: chess-ontoair-orchestrator
description: "체스를 OntoAir에 시각화하는 통합 워크플로우 오케스트레이터. chess-ontology-architect, chess-position-curator, ontoair-parser-engineer, ontoair-ui-engineer, ontoair-qa로 구성된 5인 팀을 TeamCreate로 띄워 (1)schema 설계 → (2)position TTL 작성 → (3)GRID/filter/focus 3개 generic 기능 추가 → (4)통합 검증을 phase로 진행. '체스 온톨로지 시각화', '체스 ontoair', 'chess RDF' 같은 요청 시 사용."
---

# Chess + OntoAir Orchestrator

체스를 OntoAir로 시각화하는 5인 팀 워크플로우.

## 실행 모드: 에이전트 팀 (TeamCreate)

5명 팀 — schema ↔ TTL instance ↔ visualization feature 의 cross-dep이 강함.

| 팀원 | 빌트인 타입 | 핵심 역할 |
|------|------------|---------|
| chess-ontology-architect | general-purpose | 체스 schema 설계 |
| chess-position-curator | general-purpose | position TTL 작성, 전술 인스턴스 |
| ontoair-parser-engineer | general-purpose | parser에 grid 메타데이터 정규화 추가 |
| ontoair-ui-engineer | general-purpose | GRID 버튼, predicate filter 패널, focus view 강화 |
| ontoair-qa | general-purpose | 통합 검증, 회귀 매트릭스 |

## 워크플로우

### Phase 0: 컨텍스트 동기화 (architect)
- 현재 working tree 확인
- 사용자 요구의 구체화: 어떤 position? 어떤 전술 패턴 강조?
- `_workspace/00_chess_plan.md` 작성

### Phase 1: Schema 설계 (chess-ontology-architect)
- Piece 계층, TacticalPattern, Move 클래스 정의
- 핵심 ObjectProperty 결정 (attacks, defends, pinnedBy, participantOf, ...)
- gridX/gridY DatatypeProperty 추가 (GRID view 호환)
- 산출물: schema 부분의 TTL stub

### Phase 2 (병렬): Position 작성 + 3개 feature 구현
Phase 1 완료 후 4개 작업 병렬:

#### 2A. Position TTL (chess-position-curator)
- 선정된 FEN을 piece 인스턴스로 변환
- attacks/defends 계산
- DoubleAttack/Pin/Fork 노드 추출
- `test/sample-chess.ttl` 생성
- `resources/dev.html` dropdown에 옵션 추가

#### 2B. GRID feature parser side (parser-engineer)
- `resources/ontoair.js`의 parseTTL/parseXML에 grid 정규화
- `R.hasGrid`, `R.grid.nodes` 산출
- 좌표 alias 처리 (gridX/col/column, gridY/row)
- skill: `ontoair-grid-feature`

#### 2C. GRID feature UI side (ui-engineer)
- bgrid 버튼 추가 (template.html + dev.html)
- `gridLayout()` 함수 구현 (체커보드 + pin + leader)
- exitMapView 확장
- skill: `ontoair-grid-feature`

#### 2D. Predicate filter UI (ui-engineer)
- 사이드바에 filter 패널 추가
- 동적 체크박스 생성, edge visibility toggle
- localStorage persistence
- skill: `ontoair-edge-filter-feature`

#### 2E. Focus view 강화 (ui-engineer)
- 기존 isolation 확장: gradient opacity, depth 조정
- ⌘+클릭 + depth dial 결합
- skill: `ontoair-focus-view-feature`

### Phase 3: 통합 검증 (qa)
회귀 매트릭스:

| 시나리오 | 기대 결과 |
|---------|---------|
| sample-chess.ttl 로드 | hasGrid=true, hasGeo=false, hasOrbit=false |
| GRID 클릭 | 8×8 체커보드 + 모든 piece 핀, TacticalPattern 노드는 보드 바깥 ring |
| WhiteKnight_g5 ⌘+클릭 (focus) | 공격 타깃(BlackPawn_f7 등)과 같은 색 friend 강조, 나머지 fade |
| Filter: "attacks"만 ON | 공격 엣지만 표시, defends/locatedAt 숨김 |
| sample-geo.ttl 로드 (회귀) | hasGeo=true, GRID 버튼 숨김. MAP/GLOBE만 표시 |
| sample.ttl 로드 (회귀) | 모든 spatial 버튼 숨김, 기존 graph view만 |

각 셀 실패 시 해당 에이전트에 SendMessage로 fix 요청 1회.

### Phase 4: 종합 보고 (architect)
- PR-ready 디프 요약
- 사용자 가이드 (dev 서버 명령, 체스 sample 사용법)
- `_workspace/99_qa_report.md` 통합

## 데이터 전달

- 파일 기반: working tree (코드 변경), `test/sample-chess.ttl` (TTL)
- `_workspace/`: plan, qa report
- TaskCreate로 phase 진행상황 트래킹
- SendMessage: schema shape 동기화, 버그 fix 알림

## 에러 핸들링

| 에러 | 전략 |
|------|------|
| schema-instance shape 불일치 | curator에게 SendMessage, schema 또는 instance 어느 쪽 수정할지 architect 판단 |
| GRID feature가 기존 sample(geo, orbit) 회귀 발생 | parser-engineer 또는 ui-engineer 즉시 fix (parser의 dpv 위에 추가만, 기존 로직 미변경 보장) |
| 빌드 실패 (Swift) | ontoair.js만 수정이면 build 영향 없음. Swift 변경 있으면 architect escalate |
| predicate 100개+ filter UI 폭발 | search-based filter로 fallback |

## 산출물 체크리스트

- [ ] `test/sample-chess.ttl` (schema + position + tactics + Moves)
- [ ] `resources/ontoair.js`: parseTTL/parseXML에 grid 정규화, gridLayout(), filter logic, focus 강화
- [ ] `resources/template.html`: bgrid 버튼, filter 패널, focus UI
- [ ] `resources/dev.html`: 동일 + dropdown 옵션
- [ ] 회귀 매트릭스 모두 통과
- [ ] `_workspace/00_chess_plan.md`, `_workspace/99_qa_report.md`

## 팀 크기 가이드

5명은 chess + 3개 feature라 적정. 만약 추가 feature(예: 시간축 애니메이션) 요청 시 별도 phase로 분리, 같은 팀 또는 ontoair-orbit-engineer 재활용.

## 테스트 시나리오

**정상 흐름:**
1. "체스 온톨로지 시각화" 요청
2. architect → plan, 4 task 분배
3. architect → schema 결정 (Piece/Square/TacticalPattern + 핵심 properties)
4. 병렬: curator → sample-chess.ttl, parser-engineer → grid 정규화, ui-engineer → 3 feature
5. qa → 회귀 매트릭스 + dev 서버 시각 확인
6. architect → 사용자에게 dev URL + 사용법 안내

**에러 흐름 (GRID 회귀):**
1. parser-engineer가 grid 정규화 추가했는데 dpv의 `lat` 키와 충돌
2. qa가 sample-geo.ttl 로드 시 `hasGrid=true` 잘못 산출 발견
3. SendMessage로 parser-engineer에 fix 요청
4. parser-engineer가 키 alias 매칭을 더 엄격하게 (gridX/col/column만, lat/long 제외)
5. qa 재검증
