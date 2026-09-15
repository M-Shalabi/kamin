# KAMIN — UI design brief

A brief for Claude Design. Read this before drawing anything. It says what the
product is, who opens it, what each screen has to make true, and what must never
appear on screen.

---

## 1. What KAMIN is

KAMIN (كامن, "what exists but has never been found") is an internal system for
Saudi Arabia's Public Investment Fund. It builds and continuously refreshes a
live map of local industrial capability, and sets that map against what PIF's
portfolio companies actually buy.

The problem it solves: every existing supplier directory in the Kingdom is a
list of companies that raised their hand. To be in one, a supplier had to fill
in a form. The workshop in Al Kharj that has been machining precision parts for
twenty years is not in any of them, and never will be. So when a portfolio
company needs a 2-inch stainless ball valve, nobody can answer whether it can be
bought locally, and the purchase leaves the Kingdom.

KAMIN answers that question from the outside in. It starts from what PIF already
knows (MUSAHAMA registrations, portfolio vendor masters, past and current
engagements), which is the baseline and still the minority, then discovers the
rest from public evidence: government tender awards, the industrial products
catalogue, Made in Saudi, the commercial register, HRSD, the Ministry of
Commerce, the Saudi Contractors Authority, and the suppliers' own sites and
catalogues.

Four AI agent roles run it. They are software, not people, but the product
speaks of them by name because the deck does:

| Role | Arabic | What it does |
|---|---|---|
| Coordinator | المنسّق | Turns one purchase line, in any language and format, into a normalised specification with an HS anchor and a UNSPSC code, then pools it with matching lines across companies and across time |
| Detective | المحقّق | Investigates one candidate supplier from public evidence, returns capabilities each with its source, and reaches out to the ones it finds |
| Auditor | المدقّق | Judges each claim against its evidence, classifies the supplier, and separately ranks the map against one portfolio company's own bar |
| Advisor | المستشار | Where the map says nobody can supply it, turns the gap into an ordered ladder of interventions rather than stopping at "no" |

**KAMIN holds no supplier registration of its own.** No supplier login, no
document upload, no approval queue. Registration belongs to MUSAHAMA, and the
only thing KAMIN sends a supplier is a link to MUSAHAMA's own registration. Do
not design a supplier-facing portal, an onboarding flow, or a vendor dashboard.
Every screen in this brief is for a PIF user.

---

## 2. Who opens it

Three kinds of user, one interface, different landing screens.

**The sourcing analyst at a portfolio company.** Has a purchase request in hand
and wants to know: can this be bought locally, from whom, at what lead time, to
what standard. Lands on pooled orders. Needs the answer to be defensible to a
procurement committee, which means every claim visible with its source.

**The local content team at PIF.** Wants the portfolio-level picture: what share
of pooled annual spend can be served locally, where the gaps are, what they are
worth per year, and which of them are investable. Lands on coverage. Reads the
gap ledger like a pipeline.

**The KAMIN operator.** Watches the agents work: which runs are queued, what the
Detective found today, which suppliers are at which stage of outreach, what the
Auditor refuted and why. Lands on runs.

---

## 3. Screens to design

Nine screens. The first four are the core; design those first and completely.

### 3.1 Pooled orders (الطلبات)

The demand side. A list of pooled orders, each being every purchase line across
every portfolio company that resolved to the same specification, counted once.

Each row carries: the normalised description, its HS anchor and UNSPSC class,
the number of source lines and how many companies they came from, quantity now
and annual quantity, annual value in SAR, the tightest lead time and the
strictest standard any line demands, and a coverage status.

Coverage status is a four-state thing and it must be legible at a glance,
because it is the whole point of the screen:

- **verified at spec** — at least one supported supplier states an attribute
  that agrees with the pooled envelope and none that conflicts
- **type verified** — a supported supplier names the product type, but no size
  or rating is confirmed
- **declared only** — a supported supplier declares the category with nothing in
  conflict, but has no specification on record
- **nobody** — this is a gap

Filters that matter: by portfolio company, by coverage status, by HS chapter, by
annual value.

### 3.2 Pooled order detail

One pooled order, opened. This is the screen the analyst screenshots into a
committee deck, so it has to be complete and it has to be sourced.

Four regions:

1. **The spec envelope.** The tightest specification any line demands, attribute
   by attribute (size, rating, material, connection, standard). Show which line
   set each attribute. Equivalent units are equal and should render as one value
   with the equivalence visible on hover: DN50 and 2 inch, PN40 and 40 bar.
2. **The lines behind it.** Every source demand line, as it was actually raised:
   its portfolio company, its system (SAP, Oracle iProc, a spreadsheet), its raw
   text in its original language, its quantity, its lead time and its standard.
   The raw text matters. Seeing "صمام كروي ٢ بوصة", "BALL VLV 2IN SS" and
   "Valve, ball, stainless, 2 inch" stacked together is the argument for why
   pooling is hard.
3. **Ranked suppliers.** The Auditor's request audit: the map ranked for the
   companies that raised these lines, with a fit verdict per candidate against
   each company's own bar. A supplier can be supported, correctly classed, and
   still not fit, and the screen must say which of lead time, standard or class
   it missed on, and for which company. Different companies have different bars,
   so one supplier can fit for one and miss for another in the same list.
4. **Volume status.** Served, short, or unknown. Separate from whether anyone can
   make the thing. A supplier can be able to make it and unable to make this much.

### 3.3 Suppliers (الموردون)

The list on deck slide 15, built properly. Rows of suppliers with, for each:
name in Arabic and English, city, commercial registration number, the class held
for the capability in question (manufacturer, assembler, authorised distributor,
trader), lead time, standards held, and a confidence bar.

Two badges, and their difference is load-bearing:

- **اكتشفه كامن / Sourced by KAMIN** — KAMIN found and identified this supplier
  from public evidence. It is not registered on MUSAHAMA yet.
- **موثّق من كامن / Verified by KAMIN** — KAMIN reached out, the supplier
  registered on MUSAHAMA, and KAMIN audited and verified it.

Every supplier KAMIN found carries the first badge. Only some carry the second.
A row with only the first badge should read as an opportunity, not as a failure,
and should show where it sits in the outreach cascade.

The search field on this screen searches the map. When the query is something
the map has never seen, that is a **cold miss** and it triggers a live agent run:
design the waiting state, because it takes minutes, not seconds. Show which agent
is working and what it has found so far. Do not design a spinner.

### 3.4 Supplier detail

One supplier. Sections:

- **Identity.** Names, CR number (the join key across every source), VAT,
  registration and expiry dates, address, region, establishment year, headcount,
  Saudization rate, contractor grade where it applies.
- **Capabilities.** One row per product, each with its own class, its HS anchor
  and UNSPSC class, its stated specification, its lead time and the source of
  that lead time, the standards it holds, its verdict (supported or refuted),
  and its evidence. Class is per capability, never one class for the whole
  company. Show refuted capabilities, do not hide them; the audit trail is the
  product.
- **Evidence.** Every asserted field carries its source and that source's tier.
  Tier 0 buyer-attested, tier 1 third-party verified, tier 2 official registry
  declaration, tier 3 self-published, tier 4 inferred. Where a page lives decides
  the tier before what it claims: a certificate on the supplier's own site is
  tier 3, the same certificate on the certifier's page is tier 1.
- **Engagements.** Tier 0 evidence: this supplier supplied this portfolio company,
  past or current, with the delivered lead time where known. State is current,
  past, or approved but never used, and the third is a genuinely different fact
  from the first two. Engagements are private to the portfolio and must be
  visually marked as such.
- **Relations.** Typed edges to brands, groups, certifiers, standards, materials
  and processes: distributes brand, part of group, certified by, meets standard,
  same entity as, works in material, runs process. This is what makes the map a
  graph rather than a table.
- **Outreach state.** Which stage, when it was sent, whether it was answered.

### 3.5 Gap ledger (سجل الفجوات)

The ranked list of pooled orders the Kingdom cannot serve, each with its annual
value in SAR. Opens on manufacturing gaps (no supported manufacturer or
assembler) because that is the investment case. Supply gaps (no supported
capability of any class) are the harder subset, and every supply gap is also a
manufacturing gap.

Rank by annual value. This screen is read as a pipeline, so it should feel like
one: total gap value at the top, and the ability to select several gaps and see
their combined annual value, because that combined figure is what makes a
capacity investment financeable.

### 3.6 Option ladder (سلّم الخيارات)

One gap, opened, and the Advisor's answer. Six rungs, walked upward until one
holds:

| # | Decision | Instrument |
|---|---|---|
| ١ | نشتريه / buy it | أمر شراء / purchase order |
| ٢ | نقسّمه / split it | ترسية مقسّمة / split award |
| ٣ | نستثمر / invest | توسعة مقابل تعاقد / capacity expansion against offtake |
| ٤ | نشارك / partner | شراكة ونقل معرفة / partnership and technology transfer |
| ٥ | نوطّن / localise | استثمار مباشر / direct investment |
| ٦ | نستورد / import | استيراد / import |

Rungs 3 and 4 are PIF's own instruments and should be visually distinguished
from the rest.

The critical rule on this screen: **a rung has a state, and the states are not
the same thing.** A rung is *inferred* (what the map believes), *asked* (put to
the supplier through the outreach cascade), or *answered*. An unanswered rung is
not a refusal and must never render as a no. Rungs 3 and 4 in particular are
asked of the supplier by name ("could you serve this if we expanded your
capacity?", "could you bring a global manufacturer in with you?"), never
inferred, and the screen should show the question, who it went to, through which
channel, and what came back including "not yet".

Coverage is what is left after every rung above import has been tried, so this
screen ends by saying what the ladder did to the number.

### 3.7 Coverage (نسبة التغطية)

The portfolio-level figure: the share of pooled annual demand value, in riyals,
for which at least one supported capability exists. Spend-weighted, portfolio
level, never per company.

Three things on one screen:

- **The three coverage figures stacked**, since they are not interchangeable:
  at stated specification (the headline), type-verified, and category-level.
- **Incumbent coverage against full map coverage.** The same figure computed
  only over suppliers PIF already knew, set against the figure over the whole
  map. The delta between them, in riyals, is the sourcing opportunity, and it is
  the single most important number in the product. Design it as such.
- **Discovery lift.** The count of supported suppliers KAMIN surfaced that
  appear in no registration-based platform at all.

Also on this screen: line coverage as a secondary, operational metric, clearly
subordinate to the spend-weighted headline.

### 3.8 Outreach (سلسلة الوصول)

The cascade, as a funnel, because the argument is that the count falls at every
stage so the more expensive channel stays cheap in total:

1. **Email**, carrying the MUSAHAMA registration link. Wait five days.
2. **WhatsApp**, carrying the same link, to whoever did not answer. Wait three days.
3. **A voice call placed by an AI voice agent**, to whoever still has not answered.

Per stage: how many are in it, how many answered, cost per contact and cost in
total. A supplier with no email on record enters at stage two rather than waiting
out a five-day timer, so the funnel is a routing decision and not just a
sequence.

### 3.9 Runs (التشغيلات)

The operator's screen. Every run is one execution of one role against one input,
and its trajectory is the provenance behind every claim it produced. Show what is
queued, what is running, what failed and why, how long each role takes, and let
any claim anywhere in the product link back to the run that produced it.

---

## 4. Visual direction

**Two surfaces, deliberately different.** The pitch deck is near-black
(`#0B0A09`) with a hot orange accent (`#FF5C1A`). The product is light. This
contrast is intentional and already established on deck slides 5 and 15: the
product screens read as real software precisely because they are not the deck.
Design the product light.

### Palette (product)

| Token | Hex | Use |
|---|---|---|
| paper | `#FFFFFF` | Content surface |
| chrome | `#F1EEE9` | Window and toolbar |
| side | `#FAF8F5` | Sidebar, table headers |
| line | `#E6E2DB` | Borders, dividers |
| row | `#F0EDE7` | Row hover |
| ink | `#1A1714` | Primary text |
| mut | `#6B6660` | Secondary text |
| dim | `#9A938A` | Labels, column headers |
| acc | `#E14E12` | Accent, active nav, links |
| accbg | `#FFF4EE` | Active row tint |
| ok bg / ink / line | `#E7F6EC` / `#12703A` / `#BFE5CC` | Verified badge |
| warn | `#C98A16` | Pending, awaiting registration |

The product accent (`#E14E12`) is the deck accent darkened for contrast on white.
Use the deck orange only where the deck itself appears.

### Type

- **Arabic:** Thmanyah. Heavy weights (900) for display, regular for body.
- **Latin:** Archivo. Thmanyah has no usable Latin.
- **Codes and numbers** (CR numbers, HS anchors, UNSPSC codes, PR numbers,
  currency, dates): IBM Plex Mono.

**Hard constraint: IBM Plex Mono has no Arabic glyphs.** Any Arabic set in the
mono family silently falls back to a system font and looks broken. Never set
Arabic in mono. This has already bitten the deck twice.

### Direction

Arabic is the primary language and the interface is **RTL first**, with an LTR
mirror. Two traps that have already cost time on this project:

- In an RTL flex row, the **first element in the source renders rightmost**. Do
  not reverse arrays to compensate.
- Latin runs and Arabic-Indic digit runs adjacent to punctuation produce bidi
  artefacts, most visibly a phantom `٠`. Isolate every Latin or number run
  (`dir="ltr"` or a bidi isolate) rather than relying on the algorithm.

Numerals: Arabic-Indic (٠١٢٣) in Arabic prose, Western (0123) inside codes,
currency and mono runs.

### Tone

Dense, calm, factual. This is a tool for people who will be asked to defend a
sourcing decision, not a dashboard for a screen on a wall. Prefer a table that
shows everything over a card that shows a summary. No gratuitous charts, no
gauges, no progress rings, no decorative iconography, no gradients.

---

## 5. Rules the interface must never break

These are not stylistic. Each one exists because breaking it makes the product
lie.

1. **Every asserted field shows its source and that source's tier.** A value with
   no source is not on the record and must not be on the screen.
2. **Confidence is never a bare number.** It always appears with the reasons
   behind it, reachable in one interaction.
3. **A null answer means unanswered.** Never render it as a no, on any rung, any
   confirmation, any outreach stage.
4. **Class is per capability, not per company.** Never show one class badge on a
   supplier's header.
5. **Being a trader is not a failure.** It is a class with lower local content,
   not zero. Never style it as a rejection.
6. **Local content is a spectrum with evidenced signals, never an invented
   score.** Show LC signals. A G1 score appears only when its declared inputs
   exist, and a null G1 is correct and common.
7. **Tier 0 evidence is private to the portfolio** and must be visually marked
   as such wherever it appears.
8. **Coverage is spend-weighted and portfolio-level.** Never render a per-company
   coverage percentage.
9. **"Approved but never used" is not an active supplier.** Never merge the two
   states in a count.
10. **No supplier-facing surface.** No login, no upload, no approval queue, no
    profile completion meter. Those belong to MUSAHAMA.

---

## 6. What to deliver

Design, in this order:

1. Suppliers list and supplier detail (3.3, 3.4) — the screens the deck already shows
2. Pooled orders and pooled order detail (3.1, 3.2)
3. Gap ledger and option ladder (3.5, 3.6)
4. Coverage (3.7)
5. Outreach (3.8) and runs (3.9)

For each screen: the RTL Arabic version as the primary artboard. Include the
empty state, the loading state where a live agent run is involved, and the state
where evidence is thin, because thin evidence is the normal case and the design
has to be honest about it rather than hiding it.

Desktop first, 1440 wide. This is an internal tool used on a laptop.
