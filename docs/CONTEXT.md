# KAMIN (كامن)

An outside-in graph of what Saudi industry can supply, set against what PIF portfolio companies buy, built and refreshed by AI agents. This glossary is the canonical vocabulary for the code, the UI and the pitch, in both languages.

## The graph

**Graph** (الخريطة):
The persisted record of everything the agents have established about what the Kingdom can supply and what the portfolio buys. "The map" is its name on stage.
_Avoid_: Knowledge base, database, map (in code), workflow graph

**Run**:
One execution of one role against one input. Its trajectory is the provenance behind every claim it produced.
_Avoid_: Trace (Langfuse's word), thread, job, graph execution

## Roles

**Coordinator** (المنسّق):
The agent that turns one demand line into a normalised specification with an HS anchor, then pools it with matching lines across companies and time.
_Avoid_: Resolver, matcher

**Detective** (المحقّق):
The agent that investigates one candidate supplier and returns capabilities, each with evidence, then reaches out to that supplier through the outreach cascade. Finding and reaching are one role, not two.
_Avoid_: Scout, investigator

**Specifier** (المُحدِّد):
The Detective's second pass over one supplier: it reads the supplier's catalogues and datasheets and writes the specifications they actually state, sizes, ratings, materials, connections and standards, onto the matching capabilities, each with catalogue evidence. It is what moves a pooled order from declared at category level to verified at specification.
_Avoid_: spec crawler, enricher

**Auditor** (المدقّق):
The agent that judges a claim against its evidence. She works in two places on the map, in two passes.
_Avoid_: Verifier, checker

**Capability audit** (تدقيق القدرة):
The Auditor's pass after the Detective, over one capability. Refutes or supports it, assigns its class, and assigns its UNSPSC code. Writes to the map.
_Avoid_: Verification pass, audit (unqualified)

**Request audit** (تدقيق الطلب):
The Auditor's pass after the Coordinator, over one pooled order against the requesting portcos' preferences. Returns the map ranked for them, with a fit per candidate. Reads the map, never writes it.
_Avoid_: Matching, filtering, ranking pass

**Advisor** (المستشار):
The agent that turns one pooled order the map cannot serve into an option ladder. Does not stop at the gap.
_Avoid_: Strategist

**Option ladder** (سلّم الخيارات):
The Advisor's ordered set of interventions for one pooled order, walked upward until a rung holds: buy it, split it, invest in capacity, partner for technology transfer, localise, import. _Avoid_: options list, recommendations, escalation

**Rung**:
One intervention on the ladder, with its instrument, its economics and its state. States are inferred, what the map believes; asked, put to the supplier; and answered. An unanswered rung is not a refusal.

**Offtake**:
The pooled, multi-year, contracted volume behind a pooled order. What makes a capacity investment or a joint venture financeable, and the reason pooling matters a second time.

## Demand side

**Demand line** (بند طلب):
One line of a purchase request as raised in a portco's own system, in whatever language and format it arrived.
_Avoid_: PR line, requisition, purchase line

**Pooled order** (طلب مجمّع):
All demand lines that resolve to the same specification, across companies and purchase history, counted as one order.
_Avoid_: Pooled request, pooled demand, aggregated order

**Spec envelope**:
The tightest specification any line in a pooled order demands, attribute by attribute. Equivalent units and ratings are equal (DN50 and 2 inch, PN40 and 40 bar), a subtype tightens the envelope (SS316 within stainless), and a missing attribute is compatible, never a difference. Suppliers are matched against the envelope.
_Avoid_: Merged spec, common spec, intersection

**HS anchor**:
The Harmonized System code a specification resolves to. Two lines with the same HS anchor can still be different specifications; the anchor narrows, it does not match.

**Portco** (شركة محفظة):
A PIF portfolio company. The buyer.
_Avoid_: Client, customer, account

**Portco preference**:
The bar one portfolio company sets for a category: maximum lead time, required standards, minimum class. What makes a supplier suitable for one buyer and not another.
_Avoid_: Requirements, criteria (both too general), SLA

**Fit**:
Whether a supported capability meets a specific portco's preferences. Distinct from verdict, which is about truth, and from class, which is about kind. A capability can be supported, correctly classed, and still not fit.
_Avoid_: Match (reserved for the demand-to-supply join), suitability score

## Supply side

**Engagement** (التعامل):
A record that one supplier supplied one portco, past or current. Tier 0 evidence, and the substance of the incumbent baseline. An approved vendor never bought from is a different fact from an active one, and is recorded as such.
_Avoid_: Contract, relationship, history

**Incumbent baseline**:
The suppliers PIF and its portcos already know, from MUSAHAMA, vendor masters and engagements. Where the map starts, and still the minority: the national catalogue itself holds 3,153 of 12,946 factories.
_Avoid_: Existing vendors, known set, legacy suppliers

**Outreach cascade** (سلسلة الوصول):
The Detective's second job. Email, then WhatsApp, then an AI voice agent, each stage running only on the previous stage's non-responders, and every message carrying MUSAHAMA's own registration link. It is not a fourth role: the agent that finds the supplier is the agent that reaches them. How a capability on the map becomes a supplier registered on MUSAHAMA. KAMIN holds no registration of its own.
_Avoid_: Campaign, sequence, drip

**Supplier** (المورّد):
A company in the Kingdom that can put a product in a buyer's hands, whatever its class. Identified by commercial registration number wherever one is known.
_Avoid_: Factory, provider, vendor, manufacturer (as the noun)

**Capability** (القدرة):
A claim that one supplier can supply one product to a stated specification, in a stated class, with evidence and a confidence. The unit the Auditor judges.
_Avoid_: Listing, offering, product entry, claim (as the noun)

**Class**:
One of four kinds of supply behind a single capability: manufacturer, assembler, authorised distributor, trader. A supplier holds a class per capability, not one class overall. A trader is a local supplier with lower local content, not zero.
_Avoid_: Tier (reserved for evidence), type, category

**Evidence** (الدليل):
One cited source behind one capability, with its tier. A capability without evidence is not a capability.
_Avoid_: Proof, citation (as the noun), source record

**Relation** (العلاقة):
A typed edge between a supplier and a brand, group, certifier, standard, material or process, stated by a document and carrying its evidence: distributes brand, part of group, certified by, meets standard, same entity as, works in material, runs process. Relations are what make the map a knowledge graph; the Auditor's local lens and the Advisor's adjacency read them.
_Avoid_: link, tag, attribute (reserved for a capability's stated specification)

**Evidence tier**:
The standing of one piece of evidence. Tier 0, buyer-attested: a portco's own record that this supplier delivered this thing. Stronger than any public source, and private to the portfolio. Tier 1, third-party verified: an Etimad award, Made in Saudi certification, ISO or SASO. Tier 2, official registry declaration: Tarmeez, commercial register activity, MLCP. Tier 3, self-published: the supplier's own site and catalogues. Tier 4, inferred: adjacency and equipment signals, never standing alone. Where a page lives decides the tier before what it claims: a certificate shown on the supplier's own site is Tier 3, the certifier's or the registry's page for it is Tier 1 or 2.
_Avoid_: Primary/secondary/marketing, strongest/weakest, source type

**Verdict**:
The Auditor's finding on one capability: supported or refuted. Refuted means not real. A product that is real but not at its stated specification stays supported at category level, with the unsubstantiated attributes removed. Being a trader is never grounds for refutation; that is a class.
_Avoid_: Kill (fine on stage, not in code), rejected, failed, passed

**Supported capability**:
A capability whose verdict is supported and which holds at least one Tier 1 or Tier 2 evidence. Only supported capabilities count toward coverage and close gaps, and only at the pooled order's own subheading with no stated attribute in conflict with the envelope; a sibling subheading or a conflicting attribute is a lead, never coverage.
_Avoid_: Verified (loose stage word), confirmed, validated

**Unverified capability**:
A capability whose verdict is supported but whose evidence is Tier 3 or 4 only. Shown on the supplier, excluded from coverage, queued for the next Detective pass.
_Avoid_: Pending, weak, provisional

**Confidence**:
How strongly the evidence tiers and verdicts behind a capability support it. Always shown with its reasons, never as a bare number.

## Outputs

**Gap** (الفجوة):
A pooled order the Kingdom cannot serve, in one of two kinds below. Always carries its annual value.
_Avoid_: Miss, unmatched line, shortfall

**Manufacturing gap**:
A pooled order with no supported capability in the manufacturer or assembler classes. The investment case, and the gap ledger's default view.
_Avoid_: Production gap, no local maker

**Supply gap**:
A pooled order with no supported capability of any class. Every supply gap is also a manufacturing gap.
_Avoid_: Total gap, hard gap

**Gap ledger** (سجل الفجوات):
The ranked list of gaps, opening on manufacturing gaps, each with its annual value.
_Avoid_: Gap register, gap list, gap analysis

**Coverage** (نسبة التغطية):
The share of pooled annual demand value, in riyals, for which at least one supported capability exists. Spend-weighted and portfolio-level, never per company.
_Avoid_: Coverage rate, localization coverage, coverage percentage

**Incumbent coverage**:
The same figure computed only over suppliers already in the incumbent baseline. Read against full map coverage; the delta between them is the sourcing opportunity, in riyals.

**Volume status**:
Whether a pooled order's supported capabilities can serve its quantity: served, short, or unknown. Separate from gap kind, which is about capability. A supplier can be able to make a thing and unable to make this much of it.
_Avoid_: Capacity gap (ambiguous against the gap kinds), fulfilment status

The headline coverage is **at the stated specification**: the best supported supplier states at least one attribute that agrees with the pooled envelope and none that conflicts, and names the object class on a catch-all subheading. **Type-verified coverage** sits between: the best supported supplier names the order's product type in its title or stated type with nothing in conflict, but no size or rating is confirmed. **Category-level coverage** is the secondary figure: a verified supplier declares the subheading with nothing in conflict but no specification on record. Each pooled order carries a spec status: verified at spec, type verified, declared only, or nobody.

**Line coverage**:
The share of pooled orders with at least one supported capability. A secondary, operational metric; the header shows coverage.
_Avoid_: Resolution rate (that is the Coordinator's own metric), match rate

**Discovery lift** (رفع الاكتشاف):
The count of supported suppliers KAMIN surfaced that appear in no registration-based platform.

**Cold miss**:
A query the graph has never seen, answered by running the agents live and writing the result back into the graph.

## Regulatory

**Local content** (المحتوى المحلي):
The share of value a supplier adds inside the Kingdom, as measured by LCGPA methodology. A spectrum, never a yes or no.
_Avoid_: Localisation score

**Mandatory List** (القائمة الإلزامية):
LCGPA's list of national products that government and state-owned entities must source locally.

**LC signal**:
An evidenced fact that bears on local content without being a score: class, Made in Saudi certification, Mandatory List membership, commercial register activity. What KAMIN shows for a supplier until its real G1 inputs exist.
_Avoid_: LC score, indicative score, estimated local content

**G1 score**:
LCGPA's entity-level local content score, computed from a supplier's Saudi salaries, local procurement, local assets and capability building. Computed only from declared inputs, never estimated from class.
_Avoid_: LC percentage, local content score (as a synonym for LC signal)

