---
name: ontoair-ui-controls
description: "OntoAir의 보기옵션 컨트롤 바(`#controls`)에 토글/뱃지를 추가하고 template.html과 dev.html을 동기화하는 스킬. window.O 메타데이터에 따라 조건부 표시. ui-engineer가 사용."
---

# OntoAir UI Controls — 컨트롤 바 + 동기화

OntoAir의 `#controls` 영역(우하단 보기옵션 바)에 새 토글/뱃지를 추가한다.

## 두 HTML 파일을 반드시 함께 수정

| 파일 | 사용 시점 |
|------|---------|
| `resources/template.html` | 앱 번들 + QuickLook 미리보기 |
| `resources/dev.html` | `scripts/dev.sh` 브라우저 hot reload |

둘은 부분적으로 중복된 마크업이다. `#controls` 블록은 **라인 단위로 동일**하므로 한 쪽만 바꾸면 dev에서 본 결과와 실제 앱 결과가 어긋난다.

## 컨트롤 바 패턴

### 기존 컨트롤
```html
<div id='controls'>
  <button id='bh' class='active'>Hierarchy</button>
  <button id='bf'>Force</button>
  <button id='b2'>2D</button>
  <button id='bre'>Reason</button>
  <button id='brec'>Rec</button>
  <button id='br'>Reset</button>
</div>
```

CSS는 이미 `#controls button`이 잡혀 있다. 새 요소도 `<button>` 또는 `<span>`이면 자동으로 톤이 맞는다.

### 뱃지(읽기 전용) vs 토글(클릭 가능)

**읽기 전용 뱃지 (이번 phase 권장):**
```html
<button id='bgeo' class='ctrl-badge' title='Geo coordinates detected' style='display:none'>GEO</button>
```
+ CSS 한 줄 (기존 styleblock에 추가):
```css
#controls button.ctrl-badge{background:#eaf2ff;color:#1c4f99;border-color:#b9d3f3;cursor:default}
#controls button.ctrl-badge:hover{background:#eaf2ff}
```

**미래에 지도 토글로 승격할 자리.** 현재는 클릭 시 변화 없도록 둔다 (또는 짧은 console.info만).

## 표시 조건 로직

### template.html (앱 번들)
template.html의 마지막 `<script>` 블록(현재 TBox 배너 처리 IIFE) 안에 토글 한 줄 추가:

```javascript
// 같은 IIFE 안에 추가
if(window.O && window.O.hasGeo){
  const bgeo = document.getElementById('bgeo');
  if(bgeo) bgeo.style.display = '';
}
```

### dev.html (hot reload)
파서 로딩이 비동기이므로 dev.html의 기존 `maybeShowTBoxBanner` 폴링 패턴을 그대로 재사용:

```javascript
function maybeShowGeoBadge(){
  let tries=0;
  const t=setInterval(()=>{tries++;
    if(window.O){
      if(window.O.hasGeo){const b=document.getElementById('bgeo');if(b)b.style.display='';}
      clearInterval(t);
    } else if(tries>40) clearInterval(t);
  },100);
}
```
호출은 `maybeShowTBoxBanner();` 다음 줄에 `maybeShowGeoBadge();`.

## 색 팔레트 가이드

이 앱의 색 톤:
- 강조(녹화 진행) `#c62828`
- 경고(TBox 배너) `#e0b850` / 본문 `#866b00`
- 중립(컨트롤 버튼) `#fff` / 텍스트 `#555`

geo 같은 정보성 뱃지는 **파란 계열** 권장 (`#1c4f99` 텍스트, `#eaf2ff` 배경). 너무 강조해서 컨트롤 버튼들 사이에서 튀지 않게.

## 검증

- 셀렉터: `#bgeo` 존재
- 양성 케이스: `getComputedStyle(bgeo).display !== 'none'`
- 음성 케이스: `getComputedStyle(bgeo).display === 'none'`
- template.html과 dev.html의 `#controls` 블록이 라인 단위로 동기화됨 (단, dev.html에는 `<select id='sampleSel'>` 같은 dev 전용 요소는 별개)

## 회피해야 할 것
- 새 `<style>` 블록 생성 — 기존 블록에 한 줄 추가
- 외부 CSS 또는 .css 파일 분리 — 이 앱은 인라인이 컨벤션
- 비활성화된 뱃지에 `disabled` 속성 — `cursor:default`만 줘도 충분 (포커스 흐름 안 깨짐)
- `style.display=''`(보임) 대신 `style.display='block'`/`'inline-block'` — `#controls`는 flex라 빈 문자열이 맞다
