---
name: chess-position-authoring
description: "체스 position을 TTL로 작성하는 스킬. FEN 파싱, piece 위치 + 공격선 계산, 전술 패턴(Fork/Pin/Skewer/DoubleAttack) 자동 추출, gridX/gridY로 GRID view 호환 좌표 부여. test/sample-chess*.ttl 작성 시 사용."
---

# Chess Position Authoring

체스 position(FEN)을 의미 있는 TTL로 변환하는 절차.

## Step 1: Position 선정

풍부한 tactical content가 있는 position을 선택. 시각화 가치가 큰 후보:

| Position | FEN | 시각화 가치 |
|----------|-----|-----------|
| Italian Game 4.Ng5 | `r1bqkbnr/pppp1ppp/2n5/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 0 4` | 더블 어택, f7 약점 |
| Légal's Trap | `r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P1Q1/2N2N2/PPPP1PPP/R1B1K2R w KQkq - 0 5` (직전) | Queen sacrifice + mate |
| Greek Gift setup | `r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P4/2NBPN2/PP3PPP/R1BQK2R w KQ - 0 8` | Bxh7+ 희생 |
| Morphy Opera Game | `1n1Rkb1r/p4ppp/4q3/4p1B1/4P3/8/PPP2PPP/2K5 b k - 1 17` | Discovered Check + Mate |

기본 추천: **Italian Game 4.Ng5** — 가장 적은 piece로 가장 명확한 double attack 패턴.

## Step 2: FEN → piece 인스턴스

FEN 첫 필드(`r1bqkbnr/...`)를 파싱:
- 각 piece 문자를 (file, rank)로 변환
- 대문자=White, 소문자=Black
- 숫자=빈칸 (skip)

URI 규약: `ex:{Color}{PieceName}_{square}`. 예: `ex:WhiteKnight_g5`.

GRID view 좌표:
- gridX = file_char.charCodeAt(0) - 'a'.charCodeAt(0)  // 'a'=0..'h'=7
- gridY = rank - 1                                       // 1=0..8=7

## Step 3: 공격선 + 방어선 계산

각 piece의 가능한 공격 대상을 명시.

### 비-슬라이딩 piece (Knight, King, Pawn)
- **Knight**: 8개 L자 오프셋 검사. 보드 안에 적 piece 있으면 `attacks`. 같은 색이면 `defends`.
- **King**: 8개 인접 칸.
- **Pawn**: 대각선 두 칸 (자기 색 forward).

### 슬라이딩 piece (Bishop, Rook, Queen)
- 각 방향으로 첫 만나는 piece까지.
- Bishop: 4 대각선.
- Rook: 4 수직/수평.
- Queen: 모두 8방향.

OntoAir는 모든 piece 간 attacks 엣지를 그래프로 그리므로, **명시한 만큼만** 시각화됨. 모든 가능한 공격을 다 넣으면 엣지 폭발 — **의미 있는 공격(타깃이 있는 것)** 만 우선.

## Step 4: 전술 패턴 추출

### DoubleAttack
한 piece가 2개 이상 적 piece(또는 키 square) 공격:
```python
for attacker in white_pieces:
    targets = [p for p in black_pieces if attacker.attacks(p)]
    if len(targets) >= 2:
        emit_node(DoubleAttack, focusedOn=common_target_square, participants=[attacker, ...])
```

### Fork
DoubleAttack의 특수형 — 타깃 가치 합 > 공격자 가치:
```python
if sum(t.value for t in targets) > attacker.value:
    emit_node(Fork, ...)
```

### Pin
슬라이딩 piece A가 같은 라인의 적 B (이동하면 더 큰 가치 C가 노출):
```python
for slider in white_sliders:
    for direction in slider.directions:
        line = slider.ray(direction)
        first, second = first_two_pieces_on(line)
        if first.color == black and second.color == black and second.value > first.value:
            emit_node(Pin, pinnedBy=slider, focusedOn=first, pinnedTo=second)
```

### Skewer
Pin과 반대 — 고가치가 앞에, 저가치가 뒤에:
```python
if first.value > second.value:
    emit_node(Skewer, ...)
```

## Step 5: 후보 수(Move) 인스턴스

position이 흥미로운 분기점이라면 1-3개 candidate move를 인스턴스화:
```turtle
ex:Move_Nxf7 rdf:type ex:CaptureMove ;
    rdfs:label "Nxf7 — knight captures f7" ;
    ex:from ex:g5 ; ex:to ex:f7 ;
    ex:movedPiece ex:WhiteKnight_g5 ;
    ex:captures ex:BlackPawn_f7 ;
    ex:creates ex:Fork_after_Nxf7 .
```

## Step 6: dev.html dropdown 등록

`resources/dev.html`의 `<select id='sampleSel'>`:
```html
<option value='../test/sample-chess.ttl'>sample-chess.ttl</option>
```

## TTL 작성 컨벤션

```turtle
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <http://example.org/chess#> .

ex:Ontology rdf:type owl:Ontology ;
    rdfs:label "Italian Game after 4.Ng5 — double attack on f7" ;
    rdfs:comment "FEN: r1bqkbnr/pppp1ppp/2n5/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 0 4" .

# TBox (chess-ontology-design 스킬 참조)
ex:Piece rdf:type owl:Class .
ex:Knight rdf:type owl:Class ; rdfs:subClassOf ex:Piece .
# ... (full schema)

# ABox: White pieces
ex:WhiteKnight_g5 rdf:type ex:Knight ;
    rdfs:label "♘ g5" ;
    ex:color "White" ; ex:pieceValue 3 ;
    ex:file "g" ; ex:rank 5 ;
    ex:gridX 6 ; ex:gridY 4 ;
    ex:locatedAt ex:g5 ;
    ex:attacks ex:BlackPawn_f7, ex:BlackPawn_h7 .

# ... 모든 piece

# Tactical patterns
ex:DoubleAttack_on_f7 rdf:type ex:DoubleAttack ;
    rdfs:label "Double attack on f7 (Knight + Bishop)" ;
    ex:focusedOn ex:BlackPawn_f7 ;
    ex:participantOf ex:WhiteKnight_g5 ;
    ex:participantOf ex:WhiteBishop_c4 .
```

## 검증

- 모든 piece가 `gridX`, `gridY` 가짐 (GRID view 호환)
- `attacks` 관계는 양방향 명시하지 않음 (한 방향만)
- TacticalPattern 노드는 최소 2개 participant 보유
- OntoAir parser가 `R.hasGrid=true`로 인식해야 함 (전제: GRID feature 구현 완료)

## 흔한 함정

- file 'a' = gridX 0, 'h' = 7. 'a'=1로 잘못 시작하지 말 것.
- rank 1 (백의 첫 줄) = gridY 0. rank 8 (흑의 첫 줄) = gridY 7. board[0][0]은 a1 (백 좌측 코너).
- piece가 `rdfs:label`에 유니코드 기호(♔♕♖♗♘♙) 쓰면 시각적으로 풍부, 단 폰트 지원 확인.
- 모든 64 square를 인스턴스화 금지 — 키 square(공격 타깃, 약점, 분기점)만.
