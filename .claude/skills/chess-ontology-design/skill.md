---
name: chess-ontology-design
description: "체스 도메인을 RDF/OWL로 표현하는 스키마 설계 패턴. Piece 계층, Square, TacticalPattern 노드 모델링, 핵심 ObjectProperty(attacks/defends/pinnedBy), 3원 관계의 reification(별도 노드화), GRID view용 datatype property 컨벤션. 체스 ontology 작성 시 사용."
---

# Chess Ontology Design

체스를 RDF로 표현할 때의 핵심 설계 패턴.

## 핵심 통찰

체스는 **두 layer**가 결합된 도메인:
1. **공간 layer** — 8×8 격자, Piece가 Square에 위치
2. **관계 layer** — Piece 간 attacks/defends, 전술 패턴

좋은 ontology는 이 두 layer를 명확히 분리하면서도 결합 가능하게 표현해야 함.

## 표준 클래스 계층

```turtle
ex:Piece rdf:type owl:Class .
ex:King rdf:type owl:Class ; rdfs:subClassOf ex:Piece .
ex:Queen rdf:type owl:Class ; rdfs:subClassOf ex:Piece .
ex:Rook rdf:type owl:Class ; rdfs:subClassOf ex:Piece .
ex:Bishop rdf:type owl:Class ; rdfs:subClassOf ex:Piece .
ex:Knight rdf:type owl:Class ; rdfs:subClassOf ex:Piece .
ex:Pawn rdf:type owl:Class ; rdfs:subClassOf ex:Piece .

ex:Square rdf:type owl:Class .

ex:TacticalPattern rdf:type owl:Class .
ex:Pin rdf:type owl:Class ; rdfs:subClassOf ex:TacticalPattern .
ex:Fork rdf:type owl:Class ; rdfs:subClassOf ex:TacticalPattern .
ex:Skewer rdf:type owl:Class ; rdfs:subClassOf ex:TacticalPattern .
ex:DoubleAttack rdf:type owl:Class ; rdfs:subClassOf ex:TacticalPattern .
ex:DiscoveredAttack rdf:type owl:Class ; rdfs:subClassOf ex:TacticalPattern .
ex:Battery rdf:type owl:Class ; rdfs:subClassOf ex:TacticalPattern .

ex:Move rdf:type owl:Class .
ex:CaptureMove rdf:type owl:Class ; rdfs:subClassOf ex:Move .
ex:CheckMove rdf:type owl:Class ; rdfs:subClassOf ex:Move .
```

색 구분은 `color` datatype property로 (subclass로 White/BlackPiece 만들지 말 것 — 조합 폭발).

## 핵심 ObjectProperty

```turtle
ex:locatedAt rdf:type owl:ObjectProperty ;
    rdfs:domain ex:Piece ; rdfs:range ex:Square .

ex:attacks rdf:type owl:ObjectProperty ;
    rdfs:label "attacks" ;
    rdfs:domain ex:Piece ; rdfs:range ex:Piece .

ex:defends rdf:type owl:ObjectProperty ;
    rdfs:domain ex:Piece ; rdfs:range ex:Piece .

ex:participantOf rdf:type owl:ObjectProperty ;
    rdfs:domain ex:Piece ; rdfs:range ex:TacticalPattern .

ex:focusedOn rdf:type owl:ObjectProperty ;
    rdfs:domain ex:TacticalPattern ; rdfs:range owl:Thing .  # Piece OR Square

ex:pinnedBy rdf:type owl:ObjectProperty .  # used on Piece OR Pin node
ex:pinnedTo rdf:type owl:ObjectProperty .

ex:from rdf:type owl:ObjectProperty ;
    rdfs:domain ex:Move ; rdfs:range ex:Square .
ex:to rdf:type owl:ObjectProperty ;
    rdfs:domain ex:Move ; rdfs:range ex:Square .
ex:movedPiece rdf:type owl:ObjectProperty ;
    rdfs:domain ex:Move ; rdfs:range ex:Piece .
ex:captures rdf:type owl:ObjectProperty ;
    rdfs:domain ex:Move ; rdfs:range ex:Piece .
ex:creates rdf:type owl:ObjectProperty ;
    rdfs:domain ex:Move ; rdfs:range ex:TacticalPattern .
```

## 핵심 DatatypeProperty (GRID view 호환 필수)

```turtle
ex:gridX rdf:type owl:DatatypeProperty ; rdfs:range xsd:integer .
ex:gridY rdf:type owl:DatatypeProperty ; rdfs:range xsd:integer .
ex:color rdf:type owl:DatatypeProperty ; rdfs:range xsd:string .
ex:pieceValue rdf:type owl:DatatypeProperty ; rdfs:range xsd:integer .
ex:file rdf:type owl:DatatypeProperty ; rdfs:range xsd:string .   # 보조: 'a'..'h'
ex:rank rdf:type owl:DatatypeProperty ; rdfs:range xsd:integer .  # 보조: 1..8
```

**중요:** OntoAir의 GRID view는 `gridX`/`gridY` (또는 alias `col`/`row`)를 인식. file/rank는 사람-읽기 보조.

좌표 변환:
- file 'a' → gridX 0, 'b' → 1, ..., 'h' → 7
- rank 1 → gridY 0, 2 → 1, ..., 8 → 7

## 전술 패턴: 3원 관계는 별도 노드로 (Reification)

**나쁜 예 (양원 관계로 표현):**
```turtle
ex:WhiteBishop_g5 ex:pinsAgainst ex:BlackQueen_d8 .  # 어떤 piece를 핀하는지 모름
```

**좋은 예 (Pin 노드로 reification):**
```turtle
ex:Pin_Nf6 rdf:type ex:Pin ;
    rdfs:label "Nf6 pinned to Qd8" ;
    ex:pinnedBy ex:WhiteBishop_g5 ;
    ex:focusedOn ex:BlackKnight_f6 ;
    ex:pinnedTo ex:BlackQueen_d8 .
```

OntoAir에서:
- Pin 노드가 3개 piece의 시각적 hub
- 4개 노드(Pin + 3 pieces)와 3개 엣지 → 삼각 패턴 가시화

## 적용 도메인 (체스 외)

이 reification 패턴은 다음에도 응용 가능:
- **소셜 그래프**: A introduces B to C → `Introduction` 노드
- **소송**: Plaintiff sues Defendant for Damages → `Lawsuit` 노드
- **생화학**: Enzyme catalyzes Reaction(Substrate → Product) → `Reaction` 노드

## 회피해야 할 것

- **64개 Square를 ABox에 모두 풀어놓기** — 시각적 폭발, 의미 없음. 키 square만.
- **각 가능한 move를 인스턴스화하기** — 분기점 후보 수만 (1-5개).
- **양방향 ObjectProperty 명시** (`attacks` + `attackedBy`) — 한 방향만, OntoAir reasoner 또는 SPARQL로 역방향 도출.
- **OWL restriction 깊게 사용** — OntoAir의 light reasoner는 단순 subClassOf와 typeOf만 잘 다룸.
