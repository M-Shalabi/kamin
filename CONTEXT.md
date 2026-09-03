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
The agent that investigates one candidate supplier and returns capabilities, each with evidence.
_Avoid_: Scout, investigator

**Specifier** (المُحدِّد):
The Detective's second pass over one supplier: it reads the supplier's catalogues and datasheets and writes the specifications they actually state, sizes, ratings, materials, connections and standards, onto the matching capabilities, each with catalogue evidence. It is what moves a pooled order from declared at category level to verified at specification.
_Avoid_: spec crawler, enricher

**Auditor** (المدقّق):
The agent that tries to refute one capability and assigns its class.
_Avoid_: Verifier, checker

**Advisor** (المستشار):
The agent that turns one gap into an investment case.
_Avoid_: Strategist

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

## Supply side

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
The standing of one piece of evidence. Tier 1, third-party verified: an Etimad award, Made in Saudi certification, ISO or SASO. Tier 2, official registry declaration: Tarmeez, commercial register activity, MLCP. Tier 3, self-published: the supplier's own site and catalogues. Tier 4, inferred: adjacency and equipment signals, never standing alone. Where a page lives decides the tier before what it claims: a certificate shown on the supplier's own site is Tier 3, the certifier's or the registry's page for it is Tier 1 or 2.
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

