# FACTS, open items to tackle later

Running log of corrections, unverified claims, and decisions still owed.
Newest concerns at the top of each section. Nothing here is fixed in the deliverables
unless the status says so.

---

## 1. Supplier ≠ factory  ✅ resolved, shipped everywhere

> **"Btw suppliers are not necessarily factories, it's at least still a local supplier."**

**Why it mattered.** The original design conflated *supplier* with *manufacturer*.
That is wrong in both directions:

- A local supplier can be a distributor, an assembler, a fabricator, a workshop, a service
  provider, or a systems integrator. None of them appear in a factory count.
- Even a trading company that imports and resells **is still a local supplier**. It employs
  Saudis, holds local assets, pays local margin. Its local content is *lower*, not *zero*.

**What it broke, and what it became:**

| Where | Was | Is now |
|---|---|---|
| المدقّق role (deck slide 12, script) | "manufacturer or reseller?" treated as pass/fail, "ثنتين من الأربع ما ينجون" | A **classification with a local-content score**, not a kill. Reseller is a valid tier, scored lower |
| Population math (12,946) | Presented as *the* supplier universe | It is the **manufacturing subset only**. The supplier universe is larger (commercial registrations, service providers) |
| Gap ledger | "nobody makes it" | "nobody can supply the pooled order". The finer split (**nobody manufactures it** vs **nobody supplies it locally**) is still owed, see below |
| Value story | Find the factory | Finding a local distributor still beats importing direct in some categories |

**Alignment note:** LCGPA's own methodology already treats this as a spectrum, scoring Saudi
salaries, local assets, and local procurement, not a binary "is it a factory". So moving to a
tiered supplier model makes the scoring *more* methodology-aligned, not less.

**Action taken.** The Auditor now **classifies instead of eliminating**: manufacturer, assembler,
authorised distributor, or trader, each carrying its own local-content weight. This is live in the
deck (AR slide 12 and EN slide 12), `SUBMISSION.md`, `SUBMISSION_AR.md`, `ANSWERS.md`, both story
files, both pitch files, and `BUILD_PLAN.md`.

**Still owed:** the gap ledger is not yet split into *no local manufacturing* vs *no local supply at
all*. Today it says "nobody can supply the pooled order", which is the second claim. The first is the
sharper one for an industrial investment case, and a MoI judge may ask for it by name.

---

## 2. Numbers that need a citable source before going on stage

- **12,946 factories (end of 2025)**, user-supplied, plausible, **source not pinned**.
  Likely Ministry of Industry / NIIC or GASTAT. Note the two counts measure different things:
  12,946 = licensed/operating factories; 3,153 = factories with *registered products* in Tarmeez.
  That difference is the whole argument, so state it explicitly before a MoI judge asks.
- **$0.30 per factory of AI compute**, my estimate, never measured. Run 10 real factories
  end to end and quote the measured cost. A measured number is unattackable; an estimate
  invites the wrong argument.
- Tarmeez product count: **52,824 (AR view) vs 12,641 (EN view)**, unresolved, do not cite
  either until reconciled.
- Mandatory List size: **1,444 vs 233 vs 116** are three different metrics, not three estimates.

---

## 3. Unverified process claims

- The as-is procurement flow (requisition → buyer → approved vendor list → decision) is
  **standard industrial practice**, high confidence. But the PIF-portfolio specifics
  AVL size, who approves it, what share of spend runs through it, are **inference, unverified**.
  One conversation with a real buyer in any portfolio company converts the strongest slide
  from persuasive logic into documented fact.

---

## 4. Decisions made but not yet written into the docs

- **RFQ scope.** Decided: the product stops at a **prepared package handed to the buyer**,
  who sends it from their own system. KAMIN never sends an RFQ. A capability-confirmation
  ping ("we think you can make this, correct?") is the feedback loop; supplier-side pull
  is roadmap. Not yet stated in SUBMISSION or on any slide, and it is the answer to
  "طيب وبعدين؟" which a judge will ask.

---

## 5. Blocked / external

- **Notion pages are stale, and this is now the largest gap.** All three still carry the name
  **نسيج**, the pre-reshape mechanism (factory-by-factory discovery, no demand pooling), the old
  role names, 17 slides, and no English version at all. The local `.md` files, the PDFs and the
  published canvas are current; Notion is roughly three reshapes behind.
- **Figma file is stale and quota-blocked.** Starter plan + View seat = 20 tool calls/month, spent.
  The four role character images are uploaded but sit as loose frames on the canvas. It also predates
  the KAMIN rename, the interstitial, the team slide and the English deck, so it is a rebuild rather
  than a touch-up. Resets monthly, or upgrade to a Full/Dev seat for 200/day.
- **`figma-work` MCP server is a duplicate.** `whoami` shows the original `figma` connection is
  already sh414bi@gmail.com. Either authenticate `figma-work` to a genuinely different account
  (use a private window) or remove it.
- **`codegraph` MCP server fails to start**, executable not found in `$PATH`. Unrelated to this
  project, but it errors on every session start.

---

## 6. Style rules now in force

- **No em dashes anywhere.** 335 removed across all files. Use a comma, a colon, a middle dot,
  or restructure the sentence. This applies to anything generated from here on.
- Deck copy is in the user's **Saudi dialect**; SUBMISSION files remain MSA.
- Arabic-Indic numerals with a comma (`٣,١٥٣`) and the `·` separator both break the bidi
  engine and emit a phantom `٠`. Use bare digits (`٣١٥٣`) in Arabic runs.
- RTL flex: the **first DOM child renders rightmost**. Do not reverse the array in HTML the
  way you must in Figma auto-layout, which is always LTR. The corollary: an LTR derivation of an
  RTL slide needs **no** reordering, only `dir` flipped, because DOM order is reading order in both.
- **Thmanyah has no usable Latin**, and the embedded subset is Arabic-only. The English deck sets
  in **Archivo** (Google Fonts, allowed by the artifact CSP) at the same weights. IBM Plex Mono
  has no Arabic glyphs at all, so it is used only for numerals and Latin labels.
- Arabic line-heights are loose for its ascenders. Latin display type derived from them must be
  tightened (1.06 at 46px and above) or the slide overflows its footer.
- Latin copy runs longer than the Arabic it came from. Two headlines needed a smaller size or a
  shorter phrasing to hold one line: slide 7 and slide 19.

---

## 7. Current state of the deliverables

- **Deck: 19 slides plus an unnumbered appendix, in both Arabic and English**, 40 artboards on one
  canvas. Slide 8 is the inverted-colour interstitial; slide 19 is the team.
- **The English deck is derived, not hand-written.** `deck/gen_en.py` reads each Arabic artboard and
  applies a 221-entry translation map from `deck/tr_en.py`, flips `dir`, swaps the font stack,
  converts Arabic-Indic numerals, flips the flow arrows and mirrors the map diagram. So a change to
  `deck/gen2.py` propagates to both languages, and any new Arabic string fails loudly until it is
  translated. Do not hand-edit `EN_*.dc.html`.
- **PDFs:** `KAMIN-Pitch-Deck.pdf` (38 pages, AR then EN), `-AR.pdf` and `-EN.pdf` (19 each), fonts
  embedded so exports keep their typography.
- **Canonical name:** كامن / KAMIN, "the thing that exists but has never been found".
  Slogan: **موجود. بس ما أحد شافه.**
- **Team of three:** Mohammed Shalabi (Owner, AI-Native Principle Engineer), Ali Bamuallim
  (Product Consultant), Abdulaziz Al Harthi (Data Engineer / DevOps). `BUILD_PLAN.md` is written
  against these three by name.
- **Open question for the user:** the title reads "AI-Native **Principle** Engineer" as supplied.
  If *Principal* was meant, it changes in the deck, both PDFs, both pitch files and the canvas.
