---
name: ontoair-dev-test
description: "OntoAir 변경의 통합 정합성을 검증하는 스킬. dev 서버(scripts/dev.sh) 기반 webapp-testing, Node 단독 파서 어설션, scripts/build.sh swift 빌드 회귀 테스트, 양성/음성 샘플 매트릭스를 모두 다룬다. qa가 사용."
---

# OntoAir Dev Test — 통합 검증

OntoAir 변경 후 회귀를 차단하는 검증 절차.

## 1. 빌드 회귀 (Swift 컴파일)

```bash
./scripts/build.sh
```

성공 = `build/OntoAir.app` 생성. 실패 = swiftc 에러를 그대로 첨부해 architect에 escalate.

> ontoair.js / template.html / dev.html만 수정한 경우엔 보통 영향 없지만, OntoAirHTML.swift의 placeholder를 추가/제거했다면 반드시 빌드 검증.

## 2. 파서 단독 어설션 (Node, headless)

ontoair.js는 IIFE가 아니므로 직접 require가 어렵다. 두 가지 방법:

### 방법 A: 함수만 추출해 별도 어설션
임시 파일에 `parseTTL` / `parseXML` / `normalizeGeo`를 복붙해 Node로 실행. 유지보수가 번거로워 일회성 검증에만.

### 방법 B: jsdom + 실제 ontoair.js 로드 (권장)
```bash
npx --yes jsdom-cli@latest # 또는 vitest + happy-dom
```

또는 Node 18+ 내장 `fetch`/`DOMParser` 폴리필 부재 → puppeteer/playwright가 가장 안정적.

### 방법 C: dev 서버에 띄워 webapp-testing 스킬로 검증 (가장 권장)
```bash
./scripts/dev.sh &  # 백그라운드
# webapp-testing 스킬로 http://localhost:8765/resources/dev.html#../test/sample-geo.ttl 열기
```

webapp-testing이 가능한 환경이라면 이 경로가 압도적으로 안정적이다.

## 3. webapp-testing 시나리오

```
1. open http://localhost:8765/resources/dev.html#../test/sample-geo.ttl
2. wait for window.O to be defined (poll up to 5s)
3. assert window.O.hasGeo === true
4. assert window.O.geo.nodes.length >= 1
5. assert getComputedStyle(document.querySelector('#bgeo')).display !== 'none'
6. screenshot
7. open http://localhost:8765/resources/dev.html#../test/sample.ttl
8. wait, assert window.O.hasGeo === false
9. assert getComputedStyle(document.querySelector('#bgeo')).display === 'none'
10. screenshot
```

## 4. Fallback: 수동 가이드 출력

webapp-testing/Playwright 미사용 환경에서는 사용자에게 안내:

```
1. ./scripts/dev.sh 실행
2. 자동으로 열리는 브라우저에서 dropdown → sample-geo.ttl 선택
3. 우하단 컨트롤 바에 [GEO] 뱃지가 보이는지 확인
4. dropdown → sample.ttl 선택
5. [GEO] 뱃지가 사라지는지 확인
6. DevTools console: `window.O.hasGeo` / `window.O.geo.nodes` 확인
```

## 5. 회귀 매트릭스 (필수 통과)

| 샘플 | window.O.hasGeo | #bgeo display | 비고 |
|------|----------------|---------------|------|
| sample-geo.ttl | true | visible | 좌표 노드 ≥1 |
| sample.ttl | false | none | 회귀 |
| sample.owl | false | none | XML 파서 회귀 |
| sample.rdf | false | none | XML 파서 회귀 |
| sample.trig | false | none | TTL 파서 회귀 |

매트릭스 한 셀이라도 실패 → 해당 에이전트에 SendMessage로 fix 요청 1회. 두 번째 실패 시 architect escalate.

## 6. 산출물

`_workspace/99_qa_report.md` 작성:
- 매트릭스 결과
- 발견 버그(있다면)
- 수동 검증 가이드(사용자에게 전달용)
- 빌드 결과 (succeeded / failed + 로그 발췌)

## 7. 흔한 함정

- **dev.sh가 8765 점유**: 이미 떠 있으면 새로 띄우지 말고 기존을 사용. 사용자 환경의 프로세스를 함부로 죽이지 말 것.
- **CORS/file://**: dev 서버는 http://이지만, 앱 번들은 file://. CORS 차이로 dev에선 OK인데 앱에서 깨질 수 있음. **build → install → 실제 앱 실행** 단계까지 해야 진짜 검증.
- **WKWebView baseURL=nil 환경**: localStorage 접근이 try/catch로 감싸져 있다 (README 참조). 새 코드도 localStorage 직접 사용 시 try/catch 필수.
- **MediaPipe 미설치 빌드**: hand-control.js 누락 시 template.html이 hand-control 블록을 비우게 되어 있음 (OntoAirHTML.swift). 새 기능이 hand-control에 의존하지 않도록.
