---
name: ontoair-sample-builder
description: "OntoAir 검증용 ontology 샘플(.ttl/.trig/.owl/.rdf)을 작성하는 스킬. 도메인 선정, TBox/ABox 균형, prefix 컨벤션, geo 좌표 포함 패턴, dev.html dropdown 등록까지. sample-curator가 사용."
---

# OntoAir Sample Builder — ontology 샘플 작성

OntoAir 기능 검증용 ontology 샘플 파일을 만든다.

## 컨벤션

### 파일 위치/이름
- `test/sample-{topic}.ttl` — 새 샘플은 항상 sample- 접두사
- 기존 sample.ttl, sample.owl, sample.rdf, sample.trig는 회귀용 음성 샘플로 보존

### Prefix 헤더
```turtle
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix geo: <http://www.w3.org/2003/01/geo/wgs84_pos#> .
@prefix ex: <http://example.org/{topic}#> .

ex:Ontology rdf:type owl:Ontology .
```

### 균형 가이드
- Class 2~5개
- ObjectProperty 1~3개 (domain/range 명시)
- DatatypeProperty 2~4개 (geo:lat, geo:long 포함 시)
- Individual 5~10개

너무 적으면 그래프가 빈약해 보이고, 너무 많으면 레이아웃이 어지럽다.

### 섹션 주석
```turtle
# Classes
ex:City rdf:type owl:Class .

# Object Properties
ex:locatedIn rdf:type owl:ObjectProperty ;
    rdfs:domain ex:City ;
    rdfs:range ex:Country .

# Datatype Properties
geo:lat rdf:type owl:DatatypeProperty ;
    rdfs:domain ex:Place ;
    rdfs:range xsd:decimal .

# Individuals
ex:Seoul rdf:type ex:City ;
    rdfs:label "Seoul" ;
    geo:lat 37.5665 ;
    geo:long 126.9780 ;
    ex:locatedIn ex:Korea .
```

## Geo 좌표 작성 규칙

- **숫자 그대로** (xsd:decimal로 추론): `geo:lat 37.5665 ;` ✅
- 문자열 + 데이터타입 명시: `geo:lat "37.5665"^^xsd:decimal ;` 도 허용
- 음수 위경도 허용: `geo:lat -33.8688 ;` (시드니 등)
- **lat과 long을 항상 짝으로** — 한쪽만 있으면 파서가 노드를 제외한다
- W3C WGS84 namespace prefix는 `geo:`가 관행

## rdfs:label 필수
OntoAir은 label이 있으면 노드에 표시한다. 없으면 URI fragment를 폴백으로 쓰지만 사람이 읽기 어렵다.
```turtle
ex:Seoul rdfs:label "Seoul" ;  # 영어 라벨
ex:Seoul rdfs:label "서울"@ko ; # 다국어 라벨도 허용
```

## dev.html dropdown 등록

`resources/dev.html`의 `<select id='sampleSel'>`에 추가:
```html
<option value='../test/sample-{topic}.ttl'>sample-{topic}.ttl</option>
```

기존 옵션 위치(다른 sample 옵션 아래)에 삽입.

## 도메인 선정 가이드 (양성/음성 균형)

| 목적 | 권장 도메인 | 비고 |
|------|------------|------|
| geo 검증 | 도시·국가, 관광지, 캠퍼스 | lat/long 짝이 자연스럽다 |
| 비-geo 회귀 | 기존 sample.ttl 그대로 | Person/Org/Project, 좌표 없음 |
| 혼합 | 도시 + 추상 개념 mix | 일부 노드만 geo (현실적) |

## 검증 절차
1. `scripts/dev.sh` 실행 → http://localhost:8765/resources/dev.html
2. dropdown에서 새 sample 선택
3. 콘솔에 파싱 에러 없는지
4. 노드/엣지가 그래프에 그려지는지
5. window.O.hasGeo, window.O.geo.nodes 콘솔에서 어설션
6. 비-geo 샘플로 다시 로드해 둘 다 false/empty인지

## 흔한 버그
- 따옴표 오용: `geo:lat "37.5665" ;`는 문자열 → 파서가 정규식으로 통과시키지만, `geo:lat 37,5665 ;` (콤마 → 유럽식)는 NaN
- prefix 빠짐: `geo:lat`는 쓰되 `@prefix geo: ...` 헤더 누락 → expanded URI가 None
- statement terminator 빠짐: 마지막 `.` 없으면 다음 statement와 합쳐져 파싱 실패
- `;`와 `.`을 혼동: 같은 subject 더 쓸 거면 `;`, 끝내려면 `.`
