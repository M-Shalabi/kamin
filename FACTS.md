# FACTS, open items to tackle later

Running log of corrections, unverified claims, and decisions still owed.
Newest concerns at the top of each section. Nothing here is fixed in the deliverables
unless the status says so.

---

## 1. Supplier ≠ factory  🔴 not yet reflected anywhere

> **"Btw suppliers are not necessarily factories, it's at least still a local supplier."**

**Why it matters.** Everything currently written conflates *supplier* with *manufacturer*.
That is wrong in both directions:

- A local supplier can be a distributor, an assembler, a fabricator, a workshop, a service
  provider, or a systems integrator. None of them appear in a factory count.
- Even a trading company that imports and resells **is still a local supplier**. It employs
  Saudis, holds local assets, pays local margin. Its local content is *lower*, not *zero*.

**What it breaks right now:**

| Where | Current framing | Should become |
|---|---|---|
| المدقّق role (slides 11, 08, script) | "manufacturer or reseller?" treated as pass/fail, "ثنتين من الأربع ما ينجون" | A **classification with a local-content score**, not a kill. Reseller is a valid tier, scored lower |
| Population math (12,946) | Presented as *the* supplier universe | It is the **manufacturing subset only**. The supplier universe is larger (commercial registrations, service providers) |
| Gap ledger | "nobody makes it" | Two distinct claims: **nobody manufactures it** vs **nobody supplies it locally**. Different actions follow from each |
| Value story | Find the factory | Finding a local distributor still beats importing direct in some categories |

**Alignment note:** LCGPA's own methodology already treats this as a spectrum, scoring Saudi
salaries, local assets, and local procurement, not a binary "is it a factory". So moving to a
tiered supplier model makes the scoring *more* methodology-aligned, not less.

**Action:** rework the auditor from "kill the claim" to "classify and score the supplier type"
(manufacturer / assembler / authorised distributor / trader), and split the gap ledger into
*no local manufacturing* vs *no local supply at all*.

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

- **Figma MCP quota exhausted.** Starter plan + View seat = 20 tool calls/month, spent.
  The four role character images **are uploaded into the file** but sit as loose frames on the
  canvas; they still need dragging into slides 9–12, 8 and 14 by hand. Resets monthly, or
  upgrade to a Full/Dev seat for 200/day.
- **`figma-work` MCP server is a duplicate.** `whoami` shows the original `figma` connection
  is already sh414bi@gmail.com. Either authenticate `figma-work` to a genuinely different
  account (use a private window) or remove it.
- **Notion pages are stale.** All three still carry em dashes, the old 3,153-only framing,
  and the 15-months math. The local .md files and the canvas deck are current; Notion is not.

---

## 6. Style rules now in force

- **No em dashes anywhere.** 335 removed across all files. Use a comma, a colon, a middle dot,
  or restructure the sentence. This applies to anything generated from here on.
- Deck copy is in the user's **Saudi dialect**; SUBMISSION files remain MSA.
- Arabic-Indic numerals with a comma (`٣,١٥٣`) and the `·` separator both break the bidi
  engine and emit a phantom `٠`. Use bare digits (`٣١٥٣`) in Arabic runs.
- RTL flex: the **first DOM child renders rightmost**. Do not reverse the array in HTML the
  way you must in Figma auto-layout, which is always LTR.
