# Arbor Christi / Metatron Atlas — Data Model v1

**Status:** implementation specification  
**Version:** 1.0  
**Date:** 2026-11-07  
**Purpose:** define the smallest durable data contract for a source-led, navigable atlas. This is a project schema, not a claim that the traditions historically shared one system.

## 1. Non-negotiable research rules

1. The Christian research spine begins with the Greek Septuagint (LXX), the Greek New Testament, Greek patristic texts and Byzantine liturgical sources.
2. The Orthodox theological branch must be grounded in Orthodox sources. In particular, *ousia* (οὐσία) and *energeiai* (ἐνέργειαι) must retain their Palamite theological meanings; they are not interchangeable with sefirot.
3. Ge'ez / Ethiopian Orthodox Tewahedo, Coptic, and Syriac materials are independent source traditions with their own languages, canons, textual histories and scholarly apparatus.
4. Jewish Kabbalah, including the Zohar and Lurianic sources, Gothic Kabbalah, Hermetic writings and later Western esoteric systems remain distinct research branches.
5. Similarity is not proof of influence. A comparison must never be silently upgraded to a historical relationship.
6. Every substantive claim must carry provenance and an explicit evidence status.

## 2. Core entities

### 2.1 Node

A node is a navigable research object.

```json
{
  "id": "orthodox.theosis",
  "type": "concept",
  "label": {
    "en": "Theosis",
    "sv": "Theosis",
    "original": "θέωσις",
    "transliteration": "theōsis"
  },
  "traditionIds": ["greek-byzantine-orthodox", "hesychasm"],
  "languageIds": ["grc"],
  "summary": "Participation in divine life as described in Orthodox theological sources.",
  "description": "",
  "period": {
    "start": null,
    "end": null,
    "precision": "needs-research"
  },
  "placeIds": [],
  "sourceIds": [],
  "claimIds": [],
  "evidenceStatus": "research-in-progress",
  "tags": ["theology", "spiritual-life"],
  "createdAt": "2026-11-07T00:00:00Z",
  "updatedAt": "2026-11-07T00:00:00Z"
}
```

Allowed initial node types:
- `text`: scripture, manuscript, work, hymn, liturgical text.
- `concept`: theological, philosophical or mystical concept.
- `person`: author, theologian, translator, historical figure.
- `place`: church, monastery, city, manuscript centre or archaeological site.
- `symbol`: iconographic motif, diagram, object or visual sign.
- `tradition`: historically bounded tradition or school.
- `practice`: liturgical, ascetic or contemplative practice.
- `model`: a formal diagram or cosmological/navigation model.

A node must not be assigned a tradition merely because it resembles a concept in that tradition.

### 2.2 Tradition

```json
{
  "id": "greek-byzantine-orthodox",
  "label": "Greek-Byzantine Orthodox",
  "scope": "A historically situated Christian tradition and its textual, liturgical and visual sources.",
  "primaryLanguages": ["grc"],
  "sourcePolicy": "Greek primary texts and critical scholarship; translations are supporting access, not substitutes for source identification.",
  "isIndependentBranch": true
}
```

Initial tradition identifiers:
- `greek-byzantine-orthodox`
- `ethiopian-orthodox-tewahedo`
- `coptic-christian`
- `syriac-christian`
- `hesychasm` (a practice/theological stream within Orthodox history, not a separate church)
- `jewish-kabbalah`
- `gothic-kabbalah`
- `hermetic-and-western-esoteric`

These identifiers are a navigation taxonomy, not a claim that each item has the same institutional or historical status.

### 2.3 Source

```json
{
  "id": "lxx.genesis.28",
  "kind": "primary-text",
  "title": "Genesis 28",
  "work": "Genesis",
  "passage": "28:10-22",
  "originalLanguage": "grc",
  "witnessOrEdition": "edition-or-manuscript-id-required",
  "date": {
    "earliest": null,
    "latest": null,
    "basis": "needs-research"
  },
  "url": null,
  "bibliography": [],
  "notes": "Record the exact LXX edition or manuscript used for quotations and lexical analysis."
}
```

Source kinds:
- `primary-text`
- `manuscript-witness`
- `critical-edition`
- `peer-reviewed-study`
- `institutional-catalogue`
- `field-observation`
- `secondary-reference`

A web page is not automatically a primary source. A manuscript image is not automatically a readable or fully catalogued witness.

### 2.4 Claim and Evidence Passport

Claims are separate from nodes so that one node can contain competing interpretations without hiding disagreement.

```json
{
  "id": "claim.jacobs-ladder.vertical-ascent",
  "subjectNodeId": "biblical.jacobs-ladder",
  "predicate": "interpreted-as",
  "object": "A biblical image of connection between earth and heaven",
  "sourceIds": ["lxx.genesis.28"],
  "evidenceStatus": "direct-textual-support",
  "interpretationLevel": "textual-description",
  "confidence": "high",
  "counterClaims": [],
  "reviewNotes": "Do not conflate the Genesis narrative with later four-world Kabbalistic diagrams.",
  "reviewedAt": null,
  "reviewer": null
}
```

Evidence status vocabulary:
- `direct-textual-support`
- `manuscript-attested`
- `historically-documented`
- `scholarly-consensus`
- `scholarly-debate`
- `later-traditional-interpretation`
- `comparative-parallel`
- `working-hypothesis`
- `unresolved`
- `rejected`

Confidence is not a substitute for evidence status. A low-confidence hypothesis remains a hypothesis even when it is interesting.

## 3. Typed relationships

Every edge has a direction, a type, a rationale and supporting claims.

```json
{
  "id": "edge.genesis28-to-jacobs-ladder",
  "from": "lxx.genesis.28",
  "to": "biblical.jacobs-ladder",
  "type": "SOURCE_OF",
  "claimIds": ["claim.jacobs-ladder.vertical-ascent"],
  "rationale": "The passage is the textual source for the ladder narrative.",
  "evidenceStatus": "direct-textual-support",
  "directional": true
}
```

Allowed relationship types:
- `SOURCE_OF`: direct textual or material source.
- `AUTHORED_BY`: authorship, with attribution status recorded.
- `TRANSLATED_FROM`: documented translation relationship.
- `HISTORICAL_INFLUENCE`: influence supported by historical evidence.
- `LOCATED_AT`: documented physical or institutional location.
- `DEPICTS`: a text or object depicts a subject.
- `INTERPRETS`: a source interprets another source or concept.
- `PARALLEL_TO`: a comparative resemblance, not a causal claim.
- `CONTRASTS_WITH`: a meaningful doctrinal, historical or textual distinction.
- `PART_OF`: membership in a documented larger corpus, tradition or model.
- `UNRESOLVED`: a proposed relationship awaiting research.

The interface should visually distinguish historical influence from comparison and unresolved proposals.

## 4. Journey record

A journey is a user's ordered path through the atlas. It stores references to nodes and edges, not copies of the underlying scholarship.

```json
{
  "id": "journey.local.example",
  "title": "From Genesis 28 to the Orthodox theology of ascent",
  "startNodeId": "lxx.genesis.28",
  "destinationNodeId": "orthodox.theosis",
  "steps": [
    {
      "index": 0,
      "nodeId": "lxx.genesis.28",
      "viaEdgeId": null,
      "note": "Read the Greek text and record the selected edition."
    },
    {
      "index": 1,
      "nodeId": "biblical.jacobs-ladder",
      "viaEdgeId": "edge.genesis28-to-jacobs-ladder",
      "note": "Separate the narrative from later interpretations."
    },
    {
      "index": 2,
      "nodeId": "orthodox.theosis",
      "viaEdgeId": null,
      "note": "A comparative destination, not an asserted direct historical derivation."
    }
  ],
  "storage": "local-first",
  "createdAt": "2026-11-07T00:00:00Z",
  "updatedAt": "2026-11-07T00:00:00Z"
}
```

Journey requirements:
- Show the current node, previous steps and available outgoing edges.
- Explain why a suggested next step is available.
- Preserve user notes and timestamps.
- Support undo, replay and JSON export.
- Label a suggested comparison as a comparison.
- Do not imply that a path is historically causal unless its edges support that claim.
- Local browser storage is acceptable for the prototype; server sync requires a separate authenticated persistence design.

## 5. First seed set

The first usable dataset should be deliberately small and source-led:

| Node ID | Node | Tradition | Initial source anchor |
|---|---|---|---|
| `lxx.genesis.2-3` | Tree of Life in Genesis | Greek-Byzantine Orthodox research spine | LXX Genesis 2–3 |
| `lxx.proverbs.3.18` | Tree of Wisdom | Greek-Byzantine Orthodox research spine | LXX Proverbs 3:18 |
| `nt.john.15` | Vine discourse | Greek-Byzantine Orthodox research spine | Greek John 15 |
| `nt.revelation.22` | Tree of Life in Revelation | Greek-Byzantine Orthodox research spine | Greek Revelation 22 |
| `lxx.genesis.28` | Jacob's Ladder passage | Biblical source node | LXX Genesis 28 |
| `orthodox.ousia-energeia` | Essence and energies distinction | Orthodox theology | Palamite corpus; exact passages to be catalogued |
| `orthodox.theosis` | Theosis | Orthodox theology | Greek patristic and liturgical sources |
| `tewahedo.1-enoch` | 1 Enoch in Ge'ez tradition | Ethiopian Orthodox Tewahedo | Ge'ez witnesses and critical editions |
| `coptic.monastic-sources` | Coptic monastic writings | Coptic Christian | Sahidic/Bohairic witnesses and editions |
| `jewish.zohar` | Zohar | Jewish Kabbalah | Critical editions and historical scholarship |
| `gothic.bureus-adulruna` | Bureus / Adulruna | Gothic Kabbalah | Bureus primary works and modern critical studies |
| `hermetic.corpus-hermeticum` | Corpus Hermeticum | Hermetic tradition | Greek text and critical edition |

The seed set is a work queue, not a completed bibliography. Exact editions, manuscript shelfmarks, folios, dates and translations must be added before claims are promoted beyond research-in-progress.

## 6. First navigation paths

Initial paths should be curated, not algorithmically inferred from superficial word similarity:

1. **Biblical tree path:** LXX Genesis 2–3 → Proverbs 3:18 → John 15 → Revelation 22.
2. **Jacob's Ladder path:** LXX Genesis 28 → patristic interpretations → Orthodox liturgical/artistic reception. Each historical link requires its own evidence.
3. **Orthodox inner-life path:** Greek patristic sources → nous / hesychia → Palamite ousia and energeia → theosis.
4. **Comparative path:** Jacob's Ladder → later Jewish mystical ascent models → explicitly labelled comparison with Orthodox ascent imagery. No influence claim without evidence.
5. **Manuscript geography path:** text witness → language → repository / monastery / place → catalogue record.

## 7. Acceptance criteria for v1

- Every node has a stable ID, node type, tradition and at least one research status.
- Every source identifies its original language and exact witness or edition, or explicitly says that this is still missing.
- Every claim links to one or more source records.
- Every relationship uses the controlled vocabulary and carries a rationale.
- The UI distinguishes source, influence, comparison and unresolved relationship.
- A user can create, undo, replay and export a journey.
- The journey never invents a historical connection simply to make a route continuous.
- Mobile layout remains usable at narrow viewport widths.
- No equivalence is asserted between the Orthodox doctrine of uncreated energies and the sefirot.

## 8. Next implementation slice

1. Convert the existing eight tradition cards into records using the IDs above.
2. Add a small JSON seed dataset for the twelve initial nodes.
3. Render node detail from data rather than hard-coded HTML strings.
4. Add typed edges and a “why this path?” explanation to Journey Engine.
5. Add an evidence panel showing source language, edition/witness and evidence status.
6. Add browser-level tests for mobile layout, node selection, journey persistence, undo and export.
7. Only after these checks, connect the atlas to MindCloud EvidenceGraph through a documented API contract.
