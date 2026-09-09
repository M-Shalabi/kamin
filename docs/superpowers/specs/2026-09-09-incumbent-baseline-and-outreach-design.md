# The incumbent baseline, the request audit, and the outreach cascade

Design, 2026-09-09. Status: proposed.

Read with `CONTEXT.md` (the glossary this spec extends) and `DATA_SOURCES.md`.

---

## 1. What changed

Four things surfaced that the current design does not carry.

1. **The map starts from what PIF already holds.** MUSAHAMA records, portco vendor masters, and the contract history of every supplier any portfolio company has worked with, past or current. Public discovery comes second, not first.
2. **A third reason a purchase leaves the Kingdom.** Not "nobody makes it" and not "somebody does and nobody knows", but "we found them and they do not fit", on lead time or on quality, against a bar that differs from one portco to the next.
3. **The Auditor works in two places on the map.** After the Detective as she does today, and again after the Coordinator on a new purchase request.
4. **Suppliers are reached, not waited for.** A three-stage outreach cascade, cheapest channel first, each stage running only on who did not answer the last.
5. **The Advisor stops reporting gaps and starts proposing options.** A local supplier too small for a pooled order is not a dead end. It is the first rung of a ladder that runs through capacity investment and technology transfer before it ends in an import.

### The framing that holds all of this together

The registered set is **the baseline we start from, and it is still the minority**. That is the same fact slide 4 already argues, 3,153 in Tarmeez against 12,946 operating, used constructively instead of only as an accusation. We take everything already known, and then we go and find the rest.

This is the line the pitch must not cross: **KAMIN is not a registration portal.** Suppliers never fill a blank form for us. The map is complete before anyone is contacted, and outreach confirms what the agents already inferred.

### KAMIN is internal, and it runs on two clocks

KAMIN has no supplier-facing surface at all. Its users are PIF and portco procurement; a supplier's only destination is MUSAHAMA's own registration. Nothing in the outreach links back to us.

It is a daemon, not a tool someone opens, and it wakes on two triggers:

- **On event.** A purchase request is raised in a portco system. Coordinator, pool, request audit, map.
- **On schedule, daily.** An acquisition pass that works the map for suppliers worth reaching, and feeds them into the outreach cascade toward MUSAHAMA registration.

The second trigger is why the map compounds without anyone asking it to, and it is what makes the coverage figure move between demos rather than sitting still.

---

## 2. The map gains a layer

| Layer | Population | Evidence standing |
|---|---|---|
| **0 · The known** ★ | MUSAHAMA registrations, portco vendor masters, engagement history | Tier 0, buyer-attested |
| **1 · Registered elsewhere** | Tarmeez, Made in Saudi, MLCP, Monafasat awards, commercial register, **HRSD**, **Ministry of Commerce**, **Saudi Contractors Authority** | Tier 1 to 2 |
| **2 · The unfound** | Detective over open web and relations | Tier 3 to 4 until audited |

Two consequences worth more than the layers themselves.

**Discovery lift stops being an assertion.** It becomes a computed set difference: supported suppliers in Layer 2 present in neither Layer 0 nor Layer 1. Today the number is defensible in principle and unmeasured in fact.

**A new headline number falls out.** *Incumbent coverage*, the share of pooled annual demand value a current vendor can already serve, against *map coverage*, the share any supported supplier can serve. The delta between them is the sourcing opportunity, in riyals, and it is the number a procurement committee acts on.

---

## 3. Evidence gains a top rung

A portco's own record that a supplier delivered a thing is stronger evidence than any public source. An Etimad award proves a government contract existed; an engagement record proves *this buyer* was served. It is also private, and must never leak outside the portfolio.

**Tier 0, buyer-attested.** The buyer's own record that this supplier delivered this thing.

The ladder becomes: T0 buyer-attested, T1 third-party verified, T2 registry declaration, T3 self-published, T4 inferred.

Why this is safe rather than a rewrite: the constraint moves from `tier between 1 and 4` to `tier between 0 and 4`, no existing row changes, and every comparison in the codebase is already written as "lower is stronger", so `tier <= 2` admits Tier 0 correctly without being touched.

Evidence gains `visibility` (`public` | `portfolio`). Portfolio-visibility evidence is excluded from any public-facing surface and from anything a supplier can see about itself.

---

## 4. Schema

Every change is additive. No column is dropped, no type narrowed, no existing row invalidated.

### 4.1 New tables

**`engagements`**, the incumbent history, Layer 0's substance.

| Column | Type | Notes |
|---|---|---|
| id | uuid | pk |
| supplier_id | text | fk suppliers |
| portco | text | the buying portfolio company |
| capability_id | uuid null | fk, set once the thing supplied is resolved |
| hs6 | text null | what was supplied |
| unspsc_class_code | text null | MUSAHAMA's own key |
| description | text | as recorded by the buyer |
| status | text | `current` \| `past` \| `approved_not_used` |
| first_at / last_at | date null | engagement window |
| value_sar | numeric null | may be withheld |
| lead_time_days_actual | integer null | delivered lead time, the strongest lead-time evidence we can hold |
| outcome | text null | `delivered` \| `disputed` \| `terminated` |
| source | text | `musahama` \| `portco_master` \| `erp` |
| visibility | text | default `portfolio` |

`approved_not_used` matters: a vendor on an approved list who has never been bought from is a different fact from an active supplier, and conflating them overstates the baseline.

**`portco_preferences`**, what Pass B reads.

| Column | Type | Notes |
|---|---|---|
| portco | text | pk part |
| unspsc_family_code | text null | pk part, null means the company default |
| max_lead_time_days | integer null | |
| required_standards | jsonb | `["ISO 9001", "API 6D"]` |
| min_class | text null | e.g. no traders for this family |
| notes | text null | |

Composite key on (portco, unspsc_family_code) with a null family as the fallback row. Category-specific rules override the company default.

**`outreach`**, the cascade's state.

| Column | Type | Notes |
|---|---|---|
| id | uuid | pk |
| supplier_id | text | fk suppliers |
| stage | smallint | 1 email, 2 whatsapp, 3 voice |
| channel | text | `email` \| `whatsapp` \| `voice` |
| sent_at | timestamptz | |
| responded_at | timestamptz null | |
| outcome | text null | `registered` \| `confirmed` \| `declined` \| `bounced` \| `no_response` |
| cost_usd | numeric null | per-contact cost, for the real cost report |
| run_id | uuid null | fk runs |

Unique on (supplier_id, stage). A supplier only ever receives each stage once.

### 4.2 Altered tables

**`suppliers`** gains `in_musahama`, `in_portco_master`, `in_hrsd`, `in_moc`, `in_sca`, all boolean default false, following the existing `in_tarmeez` pattern exactly.

**`capabilities`** gains `unspsc_segment_code`, `unspsc_family_code`, `unspsc_class_code`, `unspsc_assigned_by` (run id), `lead_time_days`, `lead_time_source` (`stated` | `engagement` | `inferred`). Its `origin` check gains `musahama` and `portco`.

**`demand_lines`** gains `required_lead_time_days` and `quality_standards jsonb`.

**`evidence`** gains `visibility` (`public` | `portfolio`, default `public`) and its tier check widens to 0.

**`runs`** gains `mode text` so the Auditor's two passes are distinguishable in the trajectory store without inventing a second role.

**`pooled_orders`** needs no migration. `spec_envelope` is already jsonb and will carry lead time and standards. What changes is the envelope *logic*, in section 7.

---

## 5. The Auditor in two places

She stays one character with one competence, judging a claim against evidence. She applies it to two different objects.

### Pass A, capability audit, after the Detective

Unchanged: refute or support, assign class, record lenses. **New:** assign the UNSPSC segment, family and class to the capability.

UNSPSC belongs to the Auditor and not the Detective because coding what a thing *is* against its evidence is a judgement, not a retrieval. It is also the interchange key: UNSPSC is what MUSAHAMA speaks, and unlike HS it can express services, which matters now that Saudi Contractors Authority is a source and contractors are in scope.

**UNSPSC does not replace the HS anchor and does not become the pooling key.** HS stays the anchor for goods and pooling stays HS-anchored. UNSPSC is a second, additive coordinate. Making it a pooling key would be a rewrite of `coordinator/pool.ts` for no gain this side of the hackathon.

### Pass B, request audit, after the Coordinator

New. Input: a pooled order plus the preferences of the portcos whose lines are in it. Output: the map, filtered and ranked for them, with a per-candidate reason.

Each candidate resolves to one of four states:

- **fits**: meets lead time and standards
- **fits on spec, misses on lead time**
- **fits on spec, misses on quality**: a required standard is absent or unevidenced
- **conflicting preferences**: two portcos in the same pooled order disagree, so the order splits rather than picking a winner

That last state is the honest one. Pooling companies with different bars can produce an order nobody can serve as a whole, and the right answer is to split it, not to average the requirement.

**Pass B reads the map, Pass A writes it.** That boundary is what keeps Pass B cheap enough to run on every request, and it means Pass B has no migration of its own beyond `portco_preferences`.

The third reason on slide 3 is Pass B's output made visible. Without Pass B it is a claim; with it, it is a screen.

---

## 6. The Advisor walks a ladder

Today the Advisor is one per gap and produces one investment case. That case is the *last* rung of a ladder, and the rungs above it hold most of the value.

Her job becomes: take a pooled order the map cannot serve as it stands, and walk upward from the cheapest viable intervention until one holds.

| Rung | The question | Instrument | Answered by |
|---|---|---|---|
| 1 · Serve | Can one supplier serve this volume today? | Purchase | The map |
| 2 · Split | Can several serve it together? | Split award | The map |
| 3 · Expand | Could you serve it **if we invested in your capacity**? | Capex, offtake agreement | The supplier |
| 4 · Partner | Could you bring a global manufacturer in, with technology transfer? | JV, licensing | The supplier |
| 5 · Localise | Should PIF attract or build this outright? | Greenfield, FDI | PIF |
| 6 · Import | Nothing above is viable at this volume | Import, and the gap stays logged | Nobody |

Rungs 1 and 2 exist today. **Rungs 3 to 5 are new, and they are why this belongs to PIF and not to a procurement team.** A sovereign fund's instrument is not only purchasing, it is capital. A gap costs a buyer nothing to note; to an owner it is an investable position.

**The pooled offtake is what makes rungs 3 to 5 financeable.** This is the Coordinator's work paying off a second time. A one-off order underwrites nothing. A pooled, multi-year, contracted volume is the asset a capacity expansion or a joint venture is financed against. The deck already claims "a volume that justifies investment, not a one-off order"; the ladder is what that sentence means in practice.

**Rungs 3 and 4 are asked, not inferred.** The Advisor puts the question to the supplier, and the outreach cascade in section 8 is how it is delivered. So every rung carries a state: `inferred`, what the map believes; `asked`, put to the supplier; `answered`. **An unanswered rung is not a no**, and must never be rendered as one.

### Capacity is not capability

A supplier can be genuinely able to make a thing and unable to make *this much of it*. Today's model would call that pooled order covered, which overstates the baseline in exactly the direction that embarrasses you in front of a buyer.

So `pooled_orders` gains `volume_status` (`served` | `short` | `unknown`), kept separate from `gap_kind` rather than folded into it. `gap_kind` stays the capability question and its existing check constraint is untouched; volume becomes its own axis, and the option ladder keys off both.

New table **`options`**: `pooled_order_id`, `rung` (1 to 6), `state` (`inferred` | `asked` | `answered`), `answer` (`yes` | `no` | `conditional` | null), `supplier_id` null, `rationale`, `economics jsonb`, `run_id`. Unique on (pooled_order_id, rung, supplier_id).

### Scope, honestly

This makes the Advisor **multi-turn and stateful** where she is one-shot today, which is a real increase in build cost and the largest single one in this spec. And rungs 3 to 5 produce a recommendation for a human investment committee, never a commitment. KAMIN proposes; it does not allocate capital.

---

## 7. Two things that genuinely break

Everything else in this spec is additive. These two are not, and need care.

**`coordinator/pool.ts`, the spec envelope.** Today attributes intersect: the envelope is the tightest specification any line demands, and a missing attribute is compatible rather than a difference. Lead time and standards do not behave that way.

- **Lead time is tightest-wins.** An envelope pooling a 30-day line and a 90-day line demands 30, because the 90-day buyer is satisfied by 30 and the reverse is false.
- **Standards are a union.** An order pooling a line needing ISO 9001 and a line needing API 6D demands both.

Getting this backwards silently produces orders that look servable and are not, which is exactly the failure mode `match precision` exists to catch. It needs its own test before anything else in this spec is built.

**`match/coverage.ts`.** Coverage now reports twice, incumbent and map, over the same denominator. The existing spend-weighted, portfolio-level definition is unchanged; it is computed over two candidate sets instead of one.

---

## 8. The outreach cascade

A discovered supplier who never hears from anyone changes nothing. The cascade is how a capability on the map becomes a supplier in the room, and it is the answer to the "and then what?" question logged as open in `FACTS.md` item 4.

Three stages, cheapest channel first, each running **only on who did not answer the last**.

| Stage | Channel | Wait | Runs on |
|---|---|---|---|
| 1 | Email | 5 days | Every candidate supplier on the map |
| 2 | WhatsApp with a link | 3 days | Stage 1 non-responders |
| 3 | Voice agent | none | Stage 2 non-responders |

The design property that matters, and the one to say on stage: **cost is bounded by the funnel, not by the population.** The expensive channel only ever touches the remainder, so reaching the smallest workshop in Al-Kharj by voice is affordable precisely because the large suppliers with sales teams answered the free email first.

### The funnel's shape, and one assumption in it that does not hold

The cascade is ordered by cost. It is worth being explicit that it is not ordered by reach, and for this population those two differ.

The expectation that most suppliers answer the email rests on the large ones with sales teams replying first. But by construction those are already in Layer 0 or Layer 1: they registered, that is how they got there. **The cascade runs mostly on Layer 2**, the suppliers KAMIN found precisely because they never registered. That is the segment least reachable by business email and, in Saudi Arabia, most reachable by WhatsApp, where small-business penetration is far higher.

The design survives this, with two refinements.

**Route the entry point rather than always starting at stage 1.** `suppliers` already carries `email`, `phone` and `website`, populated from Tarmeez. A supplier with no email on record should not burn a five-day wait on a channel we know will fail; it enters at stage 2. The cascade stays cost-ordered, it just skips stages that are predictably wasted.

**Measure reachability before estimating response.** What share of candidate suppliers hold an email, a phone, both or neither is computable from the graph as it stands. That is a real number, available now, and it bounds the funnel before a single message is sent. Publish it instead of a guessed response rate.

### Why the cost argument does not depend on the response rate

Per contact, in order of magnitude: email is effectively free, a WhatsApp Business template message to Saudi Arabia is cents, and a two to four minute Arabic voice call across speech recognition, a model and speech synthesis plus telephony is well under a riyal.

Now take the pessimistic case, the one where the funnel barely narrows and nearly everyone has to be called anyway. The whole cascade across the full manufacturing population still lands in the low thousands of dollars, the same order as the figure already on the maths slide.

**That is the argument to make on stage, and it is stronger than any funnel chart: the economics hold even when the funnel does not.** Good response rates make it cheaper; they are not load-bearing. Which is precisely why no invented percentage belongs on slide 17.

Two more things to get right rather than discover later:

- **Response rates are unmeasured**, and per the above they should not be guessed at on a slide. Show reachability, which is real, and the cost bound, which holds regardless. This goes in `FACTS.md`.
- **WhatsApp Business API requires pre-approved message templates and has opt-in rules**, and outbound voice at scale has its own regulatory surface in the Kingdom. Both are ordinary B2B procurement outreach, and both have a compliance shape that should be named in the plan rather than found in week two.

What the supplier is asked is not "please register". It is **"we believe you can supply this, is that right?"**, with the pooled volume attached. The link hands them to MUSAHAMA. KAMIN keeps no login, no upload, and no approval queue.

**The cascade is also the Advisor's voice.** Rungs 3 and 4 of the option ladder are questions only the supplier can answer, and they travel the same three channels: could you serve this if we invested in your capacity, and could you bring a global manufacturer in. One channel, two callers. This is why the voice agent earns its cost at the bottom of the funnel: a conversation about a capacity investment is worth a call in a way that a confirmation ping is not.

---

## 9. The supplier record

`supplier_data_point.md` and `supplier_schema.md` are re-scoped from an onboarding form to **the interchange shape KAMIN populates**, aligned field-for-field with MUSAHAMA so records can move both ways.

Removed, because they belong to a registration portal and not to us: per-contact login credentials, `profile_completion_pct`, and the `draft → submitted → under_review → approved` status machine.

Added: `engagements`, per-capability lead time, per-capability quality standards, evidence and tier on every populated field, and a `source` per field so any value can be traced to what asserted it.

Kept unchanged: the UNSPSC segment/family/class hierarchy, which was already right and is now the Auditor's output.

---

## 10. Deck

Nineteen slides become twenty. Outreach earns its own slide because it answers the question the deck currently leaves open.

| Slide | Change |
|---|---|
| 3 | Third case: found, real, local, and still does not fit. The closing line moves from "nobody can tell the two apart" to three. |
| 5 | Demand lines carry a required lead time and a quality standard, so the pooling problem is not only naming. |
| 6 | Three sources added: HRSD, Ministry of Commerce, Saudi Contractors Authority. Nine rows. |
| 12 | The Auditor's two passes, and UNSPSC as her output. |
| 13 | The Advisor's option ladder replaces the single investment case. Serve, split, expand, partner, localise, import. |
| 15 | The map gains the internal layer as an input, and the Auditor appears twice. |
| 16 | The journey gains the request audit. |
| **17 ★new** | **The outreach cascade.** Three stages, the wait between them, the funnel shrinking, the voice agent at the end, and the cost argument. |
| 18, 19, 20 | The math, the close and the team shift down one. Footers move to `/ 20`. |

The English deck derives from the Arabic through `deck/gen_en.py` and `deck/tr_en.py`, so every new Arabic string needs a translation entry or the build fails loudly. That is the intended behaviour and not a problem to route around.

Logos are in the project root and confirmed: `the_ministry_of_human_resources_and_social_development_logo.png` (512², transparent), `ministry_of_commerce_logo.jpg` (1024×768), `saudi_contractors_authority_logo.jpeg` (200²).

---

## 11. Glossary additions to `CONTEXT.md`

**Engagement**: a record that one supplier supplied one portco, past or current. Tier 0 evidence and the substance of the incumbent baseline. _Avoid_: contract, relationship, history.

**Incumbent baseline**: the suppliers PIF and its portcos already know, from MUSAHAMA, vendor masters and engagements. Where the map starts, and still the minority. _Avoid_: existing vendors, known set.

**Incumbent coverage**: the share of pooled annual demand value a current vendor can serve. Read against map coverage; the delta is the sourcing opportunity.

**Capability audit** (تدقيق القدرة): the Auditor's pass over one capability. Refutes or supports, assigns class, assigns UNSPSC.

**Request audit** (تدقيق الطلب): the Auditor's pass over one pooled order against the requesting portcos' preferences. Reads the map, never writes it.

**Portco preference**: the bar one portfolio company sets for a category: maximum lead time, required standards, minimum class. What makes a supplier suitable for one buyer and not another.

**Outreach cascade** (سلسلة الوصول): email, then WhatsApp, then voice, each stage running only on the previous stage's non-responders.

**Option ladder** (سلّم الخيارات): the Advisor's ordered set of interventions for one pooled order, from serving it today to importing it, with capacity investment and technology transfer between. Walked upward until a rung holds. _Avoid_: options list, recommendations, escalation.

**Rung**: one intervention on the ladder, with its instrument, its economics and its state. States are inferred, asked and answered. An unanswered rung is not a refusal.

**Volume status**: whether a pooled order's supported capabilities can serve its quantity: served, short, or unknown. Separate from gap kind, which is about capability. A supplier can be able to make a thing and unable to make this much of it.

**Offtake**: the pooled, multi-year, contracted volume behind a pooled order. What makes a capacity investment or a joint venture financeable, and the reason pooling matters a second time.

**Fit**: whether a supported capability meets a specific portco's preferences. Distinct from verdict, which is about truth, and from class, which is about kind. A capability can be supported, correctly classed, and still not fit.

---

## 12. Non-goals

- KAMIN does not become a registration surface. No login, no upload, no approval queue.
- UNSPSC does not become the pooling key.
- The evidence ladder is not renumbered; it is extended upward.
- Portfolio-visibility evidence is never shown publicly, including in the demo.
- No existing migration is edited. Changes land as new numbered migrations.
- KAMIN proposes interventions. It never commits capital, awards a contract, or signs anything.

---

## 13. Order of work

Sequenced so each step is independently verifiable and nothing later invalidates something earlier.

1. **Envelope semantics.** Lead time tightest-wins, standards union, with tests. Nothing else is correct until this is.
2. **Migrations 0010 to 0014.** In order: `0010` evidence tier 0 and `visibility`, plus `runs.mode`; `0011` the `engagements` and `portco_preferences` tables plus the five `suppliers.in_*` flags and the widened `capabilities.origin` check; `0012` UNSPSC and lead time on `capabilities`, and lead time and standards on `demand_lines`; `0013` the `options` table and `pooled_orders.volume_status`; `0014` the `outreach` table.
3. **Incumbent ingest.** Load Layer 0 from real MUSAHAMA and portco data. Reconcile on commercial registration number, which is already the join key everywhere else. Expect the messiest matching in the project here: vendor masters carry trade names and typos, not clean CRs.
4. **Coverage, twice.** Incumbent against map, and the delta.
5. **Pass A gains UNSPSC.**
6. **Pass B, request audit.** The new run mode and the four fit states.
7. **The option ladder.** `volume_status`, the `options` table, and rungs 1 and 2 computed from the map. Rungs 3 to 5 produce their questions and their economics; the answers arrive through outreach. This is the largest single build in the spec because it makes the Advisor stateful.
8. **Outreach.** Stage 1 real, stages 2 and 3 designed and costed. Carries both the Auditor's confirmation and the Advisor's rung 3 and 4 questions. The most independently shippable piece and the most defensible to leave partly on the roadmap.
9. **Deck and docs.** All twelve markdown files, `CONTEXT.md`, both supplier files, the deck in both languages (17 slides after the 2026-09-09 cut), the three PDFs, the canvas.

Steps 1 to 8 are the build. Step 9 is the deliverable, and can proceed in parallel with the build from the moment this spec is approved.

---

## 14. Open questions

**Closed.**

- ~~Is real MUSAHAMA or portco data available?~~ **Yes.** MUSAHAMA and portfolio company data are both available. Layer 0 is real, so incumbent coverage and discovery lift are measured figures, not simulated ones. This is the single largest credibility gain in this spec: the two strongest numbers in the deck stop needing an asterisk. Note the asymmetry that remains, demand lines are still simulated against real HS import values, while the incumbent baseline is real. Say which is which.
- ~~Where does the registration link point?~~ **MUSAHAMA's supplier registration.** Nothing on KAMIN. See the two-clock note in section 1.

**Still open.**

- **Reachability, not response rate.** See section 8. What share of candidate suppliers hold a usable email or phone is computable from the graph today and bounds the funnel before anything is sent. Run it before slide 17 is finalised.
- **Per-message costs** for the WhatsApp Business API in Saudi Arabia and for the voice stack should be priced from real quotes rather than my order-of-magnitude figures, since a number on a slide invites a challenge.
