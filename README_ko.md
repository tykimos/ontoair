<div align="right"><a href="README.md">🇺🇸 English</a></div>

# OntoAir

macOS QuickLook 프리뷰 확장 및 스탠드얼론 뷰어. `.owl`, `.rdf`, `.ttl`, `.trig` 온톨로지 파일을 **3D 인터랙티브 그래프**로 렌더링합니다.

## 주요 기능

### 시각화
- **2D 빌보드 노드**: 항상 카메라를 향하는 원형 도형
  - 클래스: **점선** 외곽선
  - 개체(Individual): **실선** 외곽선
- **방향 화살표 엣지** (2D)
  - ObjectProperty (스키마): 점선 + 속 찬 삼각형
  - ObjectProperty (인스턴스): 실선 + 속 찬 삼각형
  - `subClassOf`: UML 일반화 (속 빈 삼각형)
  - `rdf:type`: 점선
- **DatatypeProperty**: 45° 사선 + 수평선 leader로 이어진 callout 박스 (`name : xsd:string`)
- **자기참조 OP** 지원: cubic bezier 루프로 렌더
- **클래스 상단 / 개체 하단** 계층 레이아웃 (Barycenter heuristic으로 선 교차 최소화)
- **Force-directed** 대체 레이아웃

### 인터랙션
- **드래그**로 노드 이동
- **클릭** 선택 → 선택된 노드는 **노랑 맥동**, 이웃은 **하늘색**
- **엣지 선택** 가능 (선 또는 중간 라벨 클릭)
- **Cmd + +/−/0**: 텍스트 스케일 조정 (화면 고정 크기)
- **바닥 그리드** (3D 공간 기준)

### 좌측 Source 사이드바
- 원본 텍스트 라인 표시
- **양방향 하이라이트**:
  - 노드 선택 → 언급 라인 **노랑**, 이웃 노드 언급 라인 **하늘색**
  - 엣지 선택 → 양 끝 모두 나오는 라인 **노랑**, 한쪽만 나오는 라인 **하늘색**
- 라인 클릭 → 해당 노드/엣지 선택
- 사이드바 **접기/펼치기** 버튼 (`‹`/`›`)
- 사이드바 **크기 조절** (오른쪽 gutter 드래그, 200~720px)
- 폭은 localStorage로 복원

### 검색 & 툴팁
- 우측 상단 검색창: 노드 이름 필터링
- 호버 시 툴팁: 노드 타입, URI, 연결된 관계, 소유 DP

## 설치

### macOS PKG (권장)
릴리즈 페이지에서 `ontoair.pkg` 다운로드 → 실행.

설치 후:
- Finder에서 `.owl`/`.rdf`/`.ttl` 파일에 **Space** → QuickLook 미리보기
- 파일 더블클릭 → OntoAir 앱으로 열기
- 앱 아이콘으로 드래그&드롭도 지원

### 소스에서 빌드
```bash
./scripts/build.sh    # OntoAir.app 빌드 → build/OntoAir.app
./scripts/install.sh  # /Applications에 설치 + QuickLook 캐시 리셋
```

요구: macOS 13+, Swift 컴파일러 (Xcode Command Line Tools).

## 개발 (Hot Reload)

`resources/ontoair.js`와 `resources/template.html`만 수정한 뒤 브라우저 새로고침만으로 확인하는 워크플로:

```bash
./scripts/dev.sh
```

- 로컬 Python HTTP 서버 시작 (포트 8765)
- `http://localhost:8765/resources/dev.html` 자동 오픈
- **DEV 바**에서 샘플 드롭다운 또는 파일 업로드로 온톨로지 로드
- JS/HTML 수정 후 `Cmd+R` 새로고침으로 즉시 반영
- DevTools 콘솔에서 에러·로그 확인 가능

최종 확정 후 `./scripts/build.sh && ./scripts/install.sh`로 앱 번들에 반영.

## 구조

```
src/
├── AppMain.swift          # NSApp + WKWebView 스탠드얼론 앱
├── PreviewExtension.swift # QLPreviewingController QuickLook 확장
└── OntoAirHTML.swift      # 템플릿 치환 (렌더링 번들 빌드)
resources/
├── template.html          # HTML 골격 + CSS + placeholder ({{RAW}} 등)
├── ontoair.js             # 전체 3D 렌더링 로직 (THREE.js 기반)
├── dev.html               # 브라우저 dev 하네스
├── three.min.js
└── OrbitControls.js
scripts/
├── build.sh               # swiftc 컴파일 + 번들 구성 + ad-hoc 서명
├── install.sh             # /Applications 설치 + QL 캐시 리셋
├── dev.sh                 # 로컬 dev 서버
├── create-pkg.sh          # 배포용 PKG
├── create-dmg.sh          # PKG → DMG
└── uninstall.sh
test/
├── sample.ttl, sample.owl, sample.rdf, sample.trig
AppInfo.plist              # 메인 앱 Info.plist
ExtInfo.plist              # QuickLook 확장 Info.plist
```

Swift 코드는 `template.html` + `ontoair.js` + `three.min.js` + `OrbitControls.js`를 번들 리소스에서 로드하여 placeholder 치환 후 `WKWebView.loadHTMLString(_:baseURL:nil)`로 렌더링합니다. `baseURL:nil` 컨텍스트에서 `localStorage` 접근은 try/catch로 보호됩니다.

## 지원 포맷

- **Turtle** (`.ttl`, `.trig`) — 전체 파싱 (namespace prefix, 트리플 블록, 문자열 리터럴)
- **RDF/XML** (`.rdf`, `.owl`) — DOMParser + rdf:about/resource 속성 기반

## 라이선스

자신의 사용 정책을 추가하세요.
