---
name: geo-detection
description: "OntoAir의 RDF 파서(parseTTL/parseXML)에서 geo 좌표를 추출해 정규화된 필드로 노출하는 스킬. WGS84·schema.org namespace, lat/long/latitude/longitude 키 alias, 숫자/literal 둘 다 지원. parser-engineer가 사용."
---

# Geo Detection — RDF 좌표 추출

OntoAir의 ontology 파서가 산출하는 결과 객체에 geo 좌표 노드를 정규화해서 추가한다.

## 트리거 조건
- 파서 결과(`R`)에 `R.hasGeo: boolean`, `R.geo: {nodes: [{id, lat, lon}]}` 추가
- parseTTL과 parseXML **둘 다**에서 동일한 shape

## 인식 규칙

### Namespace 화이트리스트
- `http://www.w3.org/2003/01/geo/wgs84_pos#` (W3C WGS84) — `geo:lat`, `geo:long`
- `http://schema.org/` — `schema:latitude`, `schema:longitude`
- prefix 미사용 시 localName만으로도 매칭 (이 코드베이스는 항상 localName으로 키를 쓴다)

### Property localName alias
| 표시값 | 정규화 |
|-------|--------|
| `lat`, `latitude` | `lat` |
| `long`, `lng`, `longitude` | `lon` |

대소문자 무시.

### 값 파싱 견고성
허용 형태 (모두 통과해야 함):
```
geo:lat 37.5665 ;
geo:lat "37.5665" ;
geo:lat "37.5665"^^xsd:decimal ;
geo:lat "+37.5"^^xsd:double ;
geo:lat -33.8688 ;
```

추출 정규식: `String(v).match(/^[+-]?\d+(\.\d+)?/)?.[0]` 후 `parseFloat`. NaN이면 스킵.

### 좌표 검증
- `lat ∈ [-90, 90]` 아니면 제외
- `lon ∈ [-180, 180]` 아니면 제외
- lat / lon 한 쪽만 있으면 노드 미포함 (둘 다 있어야 함)

## 구현 패턴 (parseTTL)

parseTTL은 이미 `R.dpv = [{s,p,v}]`(literal 값)을 산출한다. 그 위에 정규화 레이어:

```javascript
function normalizeGeo(R){
  const acc = {};
  R.dpv.forEach(({s,p,v}) => {
    const key = String(p).toLowerCase();
    const m = String(v).match(/^[+-]?\d+(\.\d+)?/);
    if(!m) return;
    const num = parseFloat(m[0]);
    if(isNaN(num)) return;
    if(key==='lat' || key==='latitude'){ (acc[s]=acc[s]||{}).lat = num; }
    else if(key==='long' || key==='lng' || key==='longitude'){ (acc[s]=acc[s]||{}).lon = num; }
  });
  const nodes = [];
  Object.entries(acc).forEach(([id,v]) => {
    if(typeof v.lat==='number' && typeof v.lon==='number' &&
       v.lat>=-90 && v.lat<=90 && v.lon>=-180 && v.lon<=180){
      nodes.push({id, lat:v.lat, lon:v.lon});
    }
  });
  R.geo = {nodes};
  R.hasGeo = nodes.length > 0;
  return R;
}
```

호출 위치: `parseTTL` 함수 끝 `return R;` 직전.

## 구현 패턴 (parseXML)

parseXML은 `R.dpv`를 만들지 않으므로 자체 스캔이 필요하다. 가장 가벼운 방법:

```javascript
// parseXML 안, allAssert를 만든 직후 또는 return 직전
const acc = {};
doc.querySelectorAll('*').forEach(el => {
  const a = ga(el); if(!a) return;
  const subj = localName(a);
  for(const c of el.children){
    const pr = (c.localName || c.tagName || '').toLowerCase();
    if(pr==='lat'||pr==='latitude'||pr==='long'||pr==='lng'||pr==='longitude'){
      const txt = c.textContent || '';
      const m = txt.match(/^[+-]?\d+(\.\d+)?/);
      if(!m) continue;
      const num = parseFloat(m[0]);
      if(isNaN(num)) continue;
      if(pr==='lat'||pr==='latitude') (acc[subj]=acc[subj]||{}).lat=num;
      else (acc[subj]=acc[subj]||{}).lon=num;
    }
  }
});
const geoNodes = [];
Object.entries(acc).forEach(([id,v])=>{
  if(typeof v.lat==='number'&&typeof v.lon==='number'
     && v.lat>=-90&&v.lat<=90&&v.lon>=-180&&v.lon<=180){
    geoNodes.push({id, lat:v.lat, lon:v.lon});
  }
});
R.geo = {nodes: geoNodes};
R.hasGeo = geoNodes.length > 0;
```

## 검증 어설션
- `R.geo.nodes` 배열, 각 원소 `{id:string, lat:number, lon:number}`
- `R.hasGeo === (R.geo.nodes.length > 0)`
- 좌표 없는 파일에서 `R.hasGeo === false`이고 `R.geo.nodes.length === 0`

## 회피해야 할 것
- 추가 namespace 객체 import 또는 외부 라이브러리 — 이 코드베이스는 의존성 zero
- console.log 디버그 잔재
- 기존 `R.dpv`, `R.cls` 등의 shape 변경
- parseTTL과 parseXML에서 다른 shape으로 산출 (반드시 동일)
