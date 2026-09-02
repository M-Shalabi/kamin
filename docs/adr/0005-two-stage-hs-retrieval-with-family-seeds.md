# Two-stage HS retrieval with family seeds

Anchoring a demand line to a six-digit HS code needs the right code on the adjudicator's candidate list. Plain nearest-neighbour search over the 9,207 subheading titles failed on 2026-09-02: attribute words dominate short titles, so "stainless steel ball valve" retrieved stainless pipe and bar subheadings and the residual "other valves" subheading never surfaced. We chose two stages: rank four-digit headings by embedding similarity of both the object class and the description, by a lexical match of the object words against heading and subheading titles, and by seeds from the object family (valves under 8481, pumps under 8413 and 8414, fittings and flanges under 7307, 7412 and 3917, which is HS chapter structure, not a guess); then hand every subheading under the top headings to the model, ordered by heading rank and similarity, capped at sixty.

## Considered options

- **Subheading nearest-neighbour only**: the right heading was often in the top eight but the right subheading was not, and for "ball valve" neither was.
- **Lexical only**: term frequency ranks curtains and plastic hoses above iron fittings for "blind flange".

## Consequences

Seeds must be extended when a new sector is added; the map lives in `FAMILY_SEED_HEADINGS` in `packages/core/src/hs/search.ts`. Retrieval never decides; the adjudicator does, from a list that is guaranteed to contain the sector's core headings.
