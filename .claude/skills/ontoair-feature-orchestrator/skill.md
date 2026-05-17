---
name: ontoair-feature-orchestrator
description: "OntoAir(macOS WKWebView ontology viewer)에 새 보기옵션·뱃지·메타데이터 표시 기능을 추가하는 오케스트레이터. parser 확장 → UI 뱃지 추가 → 샘플 생성 → 통합 검증을 팀(architect/parser/ui/sample/qa)으로 조율. 'ontoair에 X 표시 추가', '보기옵션 뱃지', 'geo 뱃지', 'ontology 메타데이터 시각화' 같은 요청 시 반드시 이 스킬을 사용."
---

# OntoAir Feature Orchestrator

OntoAir에 새 보기옵션/뱃지/메타데이터 표시 기능을 5인 팀으로 추가한다.

## 실행 모드: 에이전트 팀 (TeamCreate)

5명 팀 — 작업 간 의존이 강하고(파서 shape↔UI 표시↔샘플), 경계면 검증이 핵심이라 직접 통신이 필요하다.

| 팀원 | 빌트인 타입 | 핵심 역할 |
|------|------------|---------|
| ontoair-architect | general-purpose | phase 분해, 통합, 사용자 가이드 |
| ontoair-parser-engineer | general-purpose | parseTTL/parseXML에 메타데이터 필드 추가 |
| ontoair-ui-engineer | general-purpose | template.html + dev.html의 컨트롤 바 |
| ontoair-sample-curator | general-purpose | test/ 샘플 + dev.html dropdown |
| ontoair-qa | general-purpose | 경계면 비교, 회귀 매트릭스 |

## 워크플로우

### Phase 0: 컨텍스트 동기화 (architect 단독)
- working tree 상태 점검 (`git status`)
- 사용자 요구를 acceptance 기준으로 변환
- `_workspace/00_architect_plan.md` 작성: 트리거 조건 정의, 뱃지 라벨, 표시 조건
- TaskCreate로 Phase 1~4 등록 (의존성: 1→2,3 / 3→4 / 4 모두→5)

### Phase 1: 파서 확장 (parser-engineer)
- `resources/ontoair.js`의 parseTTL/parseXML 결과에 `R.hasGeo`, `R.geo.nodes` 추가
- normalizeGeo 헬퍼는 `R.dpv` 위에 얹는 형태 (parseTTL은 즉시 가능)
- parseXML에선 literal 자식 스캔을 별도로 추가 (parseTTL과 **동일 shape**)
- 산출 shape을 ui-engineer에 SendMessage

### Phase 2: UI 뱃지 (ui-engineer) — Phase 1과 부분 병렬
- `template.html`과 `dev.html` 둘 다의 `#controls`에 `<button id='bgeo'>GEO</button>` 추가
- 기본 `display:none`. 파서 로딩 후 `window.O.hasGeo` 체크해 토글
- dev.html은 `maybeShowTBoxBanner` 폴링 패턴 재사용
- template.html의 `<script>` 블록 안에 토글 로직 추가 (외부 .js 변경 없이)

### Phase 3: 샘플 (sample-curator) — Phase 1 완료 후
- `test/sample-geo.ttl` 생성 (현실적인 도메인, geo:lat/long 포함)
- `dev.html`의 sample dropdown에 옵션 추가
- 음성 샘플은 기존 `test/sample.ttl`로 충분 (회귀용)

### Phase 4: 통합 검증 (qa) — Phase 1~3 완료 후
- dev 서버 또는 Node 단독으로 파서 어설션 실행
- 회귀 매트릭스(양성/음성 샘플 모두) 통과 확인
- `./scripts/build.sh` 빌드 통과 확인
- `_workspace/99_qa_report.md` 작성, 버그 발견 시 해당 에이전트에 fix 요청 1회

### Phase 5: 종합 (architect)
- 최종 PR-ready diff 요약 생성
- 사용자에게: 빌드 명령(`./scripts/build.sh && ./scripts/install.sh`), dev 명령(`./scripts/dev.sh`), 검증 방법

## 데이터 전달 프로토콜

| 전략 | 위치 | 사용처 |
|------|------|-------|
| 파일 기반 | working tree (직접 수정) | 모든 코드/샘플 변경 |
| 파일 기반 | `_workspace/*.md` | plan, qa report만 |
| 메시지 기반 | SendMessage | shape 동기화, 버그 fix 요청 |
| 태스크 기반 | TaskCreate | phase 진행상황 |

`_workspace/`는 사후 감사용이므로 보존. 최종 산출물은 working tree.

## 에러 핸들링

| 에러 | 전략 |
|------|------|
| 파서 shape 변경으로 UI 깨짐 | parser-engineer가 즉시 ui-engineer에 SendMessage, ui 재조정 |
| 빌드 실패 (Swift 컴파일) | qa가 에러 첨부해 architect에 escalate, 가능한 한 ontoair.js 변경만으로 우회 |
| Playwright 환경 미비 | qa가 자동 fallback (Node 파서 단독 + 수동 가이드) |
| dev 서버 포트 충돌 | qa가 다른 포트로 재시도. 사용자 환경의 기존 프로세스는 함부로 죽이지 않음 |
| 비-geo 샘플에서 뱃지 노출 | ui-engineer 회귀 fix. 1회 fix 후에도 실패 시 architect escalate |

## 팀 크기 조정
- 단순 표시(뱃지만): 위 5인 그대로
- 지도 베이스 레이아웃까지(향후): map-engineer 추가하여 6인. 본 phase엔 자리만 마련.

## 테스트 시나리오

**정상 흐름:**
1. 사용자: "geo 좌표 있는 ttl을 열면 컨트롤 바에 GEO 뱃지가 보였으면 한다"
2. architect → plan 작성, 4개 task 분배
3. parser-engineer → ontoair.js 수정, hasGeo/geo.nodes 산출
4. ui-engineer → 두 HTML에 #bgeo 추가, 조건부 토글
5. sample-curator → test/sample-geo.ttl + dropdown 갱신
6. qa → dev 서버에서 sample-geo.ttl 로드 시 뱃지 visible, sample.ttl 로드 시 hidden 확인
7. architect → 사용자에게 빌드/실행 가이드

**에러 흐름 (parseXML 누락):**
1. parser-engineer가 parseTTL만 수정
2. qa가 sample.rdf(XML)에서 hasGeo가 항상 false인 것을 발견
3. SendMessage로 parser-engineer에 fix 요청
4. parser-engineer가 parseXML도 동일 shape으로 보강
5. qa 재검증, 매트릭스 통과

## 산출물 체크리스트
- [ ] `resources/ontoair.js` 수정 (parser 확장)
- [ ] `resources/template.html` 수정 (뱃지 + 토글)
- [ ] `resources/dev.html` 수정 (뱃지 + 토글 + dropdown 옵션)
- [ ] `test/sample-{topic}.ttl` 생성
- [ ] `_workspace/00_architect_plan.md`, `_workspace/99_qa_report.md`
- [ ] `./scripts/build.sh` 통과
- [ ] 회귀 매트릭스 통과
