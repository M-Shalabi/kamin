# PIF Innovate Hackathon, Submission Answers

> Track 1, Live Map of National Capabilities / الخريطة الحية للقدرات الوطنية
> Companion files: `PIF_HACKATHON.md` (brief) · `DATA_SOURCES.md` (data inventory) · `BUILD_PLAN.md` (48h execution)

---

## 1. Idea Name

**KAMIN (كامن), The National Capability Graph**

*كامن* means what is present but undiscovered, the thing that is there before anyone has found it. Slogan: **It exists. Nobody has seen it.**

**One line:** MUSAHAMA knows who registered. KAMIN knows who never raised a hand, and can prove where nobody in the Kingdom can supply at all.

---

## 2. Explain how the solution works, its key features, and how it addresses the selected challenge

**English**

KAMIN is a live capability layer for Saudi industry. It is built and continuously refreshed by a swarm of AI agents, and it answers a question PIF cannot answer today: for everything the portfolio buys, who in the Kingdom could actually supply it, and where can we prove nobody can.

**Where the map starts.** Before any public discovery, KAMIN loads what PIF already holds: MUSAHAMA records, portfolio company vendor masters, and the engagement history of every supplier any portco has bought from, past or current. That incumbent baseline carries the strongest evidence on the map, because a delivered contract proves capability in a way no public source can, and it is still the minority of Saudi industry. Everything the agents find beyond it is **discovery lift computed as a set difference rather than asserted**, and the distance between *incumbent coverage* and *map coverage* is the sourcing opportunity in riyals.

**How it works.** The system is not a search box and it does not wait to be asked. KAMIN is an internal system with no supplier-facing surface, and it runs on two clocks: on event, when a purchase request is raised in a portfolio company ERP, and on a daily schedule that works the map for suppliers worth reaching. From that one line, four agent roles run in sequence.

1. **The Coordinator** resolves the request. Procurement text is messy, bilingual and free-form: `صمام كروي ٢ بوصة`, `BALL VLV 2IN SS` and `Valve, ball, stainless, 2 inch` are the same object written by three systems that will never agree. The Coordinator normalises each line into a specification anchored to an HS code, then pools every matching line across the 150+ portfolio companies and across purchase history. Twelve units in one company and forty in another become one order of 40,000 a year. Pooling itself is trivial arithmetic. Seeing that scattered requests *are* the same request is the hard part, and it is exactly why aggregated demand has stayed invisible.

2. **The Detective** searches for who can serve that pooled volume. It starts from the Ministry of Industry's Tarmeez catalogue and deliberately goes past it: only 3,153 factories are registered there against 12,946 operating in the Kingdom, so 76% of Saudi industry is outside the national catalogue. The Detective reads company web presence, commercial registers, awarded contracts on Etimad, certifications and product literature. Because the question is now "who can serve 40,000 units a year" rather than "who makes this", it surfaces providers whose economics a single company's occasional order could never have justified.

3. **The Auditor** verifies each candidate adversarially, and **classifies instead of eliminating**: manufacturer, assembler, authorised distributor, or trader. A local trader is still a local supplier; it employs Saudis and retains margin domestically, so its local content is lower, not zero. This gradient follows LCGPA methodology, which measures value added rather than legal form. Every claim carries a citation, an evidence tier and a confidence score.

   The same pass assigns each capability its **UNSPSC** code, the taxonomy MUSAHAMA speaks and the one that, unlike HS, expresses services as well as goods. And the Auditor works in a second place: after the Coordinator, a **request audit** takes a pooled order together with the requesting portcos' own bars, maximum lead time, required standards, minimum class, and returns the map ranked *for them*. This is what surfaces the third reason a purchase leaves the Kingdom: not that nobody makes it, and not that nobody knows who does, but that the supplier is real, local, verified and still does not meet this company's bar. Where two portcos in one pooled order disagree, the order splits rather than averaging the requirement. The capability audit writes to the map; the request audit only reads it.

4. **The Advisor** proposes options rather than reporting a gap. Where the map cannot serve the pooled order as it stands, it walks a ladder upward from the cheapest viable intervention until one holds: **buy it** from one supplier; **split it** across several so the volume does not exclude small players; **invest**, asking the supplier whether they could serve it if PIF expanded their capacity, against a contract for the volume; **partner**, asking whether they could bring a global manufacturer in with technology transfer; **localise**, where PIF attracts or builds the industry itself; or **import**, logging the gap with its annual value. Rungs three and four are asked, not inferred, and an unanswered rung is never recorded as a refusal. This is what separates a buyer from an owner: a procurement department can only note a gap, an owner can capitalise it, and what makes those rungs financeable is the pooled multi-year offtake rather than a one-off order.

**Reaching the supplier.** A supplier discovered and never contacted changes nothing, so KAMIN closes the loop with a three-stage cascade, cheapest channel first, each stage running only on the previous stage's non-responders: email and wait five days, WhatsApp with a registration link and wait three days, then a voice agent for whoever is left. **Cost is bounded by the funnel rather than the population**, so reaching the smallest workshop by voice is affordable precisely because the large suppliers with sales teams answered the free email first. The economics hold even under a pessimistic funnel, which is why no optimistic response rate is load-bearing. The link goes to MUSAHAMA's own registration: KAMIN keeps no login, no upload and no approval queue.

**Key features**

- **The incumbent baseline first.** MUSAHAMA and portco data seed the map before any public discovery, which turns discovery lift and coverage from claims into computed figures.
- **Cross-lingual demand resolution**, the component that makes aggregate demand computable at all.
- **Outside-in discovery.** Every existing supplier directory is a list of who raised their hand, which selects for firms with business-development teams and misses the specialised workshop that has machined precision parts for twenty years. KAMIN finds suppliers from public evidence instead of waiting for them to register.
- **Classification, not elimination**, with a declared evidence hierarchy behind every confidence score, so a procurement officer can audit the claim and a judge can challenge it.
- **Split fulfilment.** Where no single provider can absorb a pooled order, KAMIN proposes a split across several, which is what lets small local players serve large demand instead of being excluded by size.
- **An option ladder, not a gap report.** Buy, split, invest in capacity, partner for technology transfer, localise, import. The pooled offtake is what makes the middle rungs financeable.
- **Reach, not registration.** A cost-ordered outreach cascade carries both the capability confirmation and the Advisor's questions, and hands the supplier to MUSAHAMA.
- **A gap ledger**, pooled forward demand with its annual value, waiting for the first provider who can serve it. An investment memo, not a report.
- **Coverage**, the share of portfolio spend that is locally satisfiable today, and it moves.
- **It compounds.** Everything the agents learn stays on the map, so the next request starts from a bigger map and larger pooled demand.

**How it addresses the challenge.** Track 1 asks for a dynamic data layer surfacing local capabilities, raw materials and qualified companies able to meet portfolio companies' **total demand**. KAMIN delivers each term. *Dynamic*, because the swarm refreshes continuously rather than waiting for re-registration, so the map does not go stale the way a consulting report does. *Capabilities* rather than company records, because a registry entry says `sector: metals` while a capability profile says what a plant can actually produce. *Raw materials*, through the Ta'adeen and Saudi Geological Survey layer that no supplier registry contains. *Total demand*, because the Coordinator is what turns 150+ disconnected procurement systems into one computable demand figure.

**Why it has not been done.** The work is not intellectually hard, it is long. One factory takes a competent researcher a full afternoon; 12,946 of them takes about five years, and the first entries are stale before the last are written. That is why it exists as a multi-million riyal consulting engagement and not as a product. Agents change the unit economics, not the method: roughly two minutes per factory, running in parallel, around the clock. Five years becomes under ten hours.

**Relationship to MUSAHAMA.** KAMIN is not a competing platform. MUSAHAMA is the system of record for local content across the portfolio and knows who registered. KAMIN is the discovery and enrichment layer underneath it, and knows who never did.

### The evidence base the agents work on

The agents do not operate on generic web search. They work against a structured evidence base whose sources carry **different trust weights**, and the auditor scores against that hierarchy rather than against intuition.

| Tier | Sources | Standing |
|---|---|---|
| **0, Buyer-attested** | A portco's own record that this supplier delivered this thing | Strongest evidence that exists, and private to the portfolio. A delivered engagement proves *this buyer* was served, where an award proves only that a contract existed |
| **1, Third-party verified** | Etimad contract awards · Made in Saudi certification (audited, ≥40% value-add) · ISO/SASO certifications | Strongest. A delivered public contract is proof of capability, not a claim about it |
| **2, Official registry declaration** | Tarmeez product registrations · commercial register activity codes · MLCP chamber listings · HRSD Saudization and headcount · Ministry of Commerce activity · Saudi Contractors Authority grading | Declared to a government body, accountable, but still self-reported. Covers 3,153 of 12,946 factories |
| **3, Self-published** | Company websites, product literature, catalogues | Marketing copy. Requires corroboration before it supports a claim |
| **4, Inferred** | Adjacency, equipment signals, capacity and hiring indicators | Never stands alone. Must be corroborated by a higher tier |

**Overlays that qualify every match:** the LCGPA Mandatory List (regulatory priority, which products *must* be sourced locally), Comtrade and GASTAT (demand value at HS level), MODON (geolocation), Ta'adeen and the Saudi Geological Survey (raw material availability), and LCGPA G1/G2.2/G2.3 (the scoring function itself).

**Why this is a design component and not an appendix.** A confidence score is only defensible against a declared hierarchy. Saying a capability scores 0.8 means nothing; saying it is *corroborated by a Tier 1 award and a Tier 2 registration with no Tier 3 contradiction* is something a procurement officer can audit and a judge can challenge. The evidence tiers are what convert "our AI found this" into a claim that survives scrutiny, and they are also why commercial registration number is the join key throughout: it is what lets a Tier 1 source and a Tier 2 source be recognised as describing the same factory.

**العربية**

كامن طبقة حيّة لقدرات الصناعة السعودية، تُبنى وتُحدَّث باستمرار عبر منظومة من الوكلاء الأذكياء، وتجيب عن سؤال لا يستطيع الصندوق الإجابة عنه اليوم: لكل ما تشتريه شركات المحفظة، من في المملكة يستطيع توريده فعلاً، وأين يمكن إثبات أن لا أحد يستطيع.

**آلية العمل.** النظام ليس محرك بحث ولا ينتظر أن يُسأل، بل ينطلق من إشارة قائمة في كل شركة محفظة: طلب شراء يُرفع في نظام تخطيط الموارد. ومن هذا السطر الواحد تعمل أربعة أدوار على التوالي.

١. **المنسّق** يوحّد الطلب. نصوص المشتريات غير منظمة وثنائية اللغة وحرّة الصياغة: «صمام كروي ٢ بوصة» و`BALL VLV 2IN SS` و`Valve, ball, stainless, 2 inch` وصفٌ لشيء واحد كتبته ثلاثة أنظمة لن تتفق أبداً. يحوّل المنسّق كل بند إلى مواصفة موحّدة مرتبطة برمز HS، ثم يجمّع كل بند مطابق عبر أكثر من ١٥٠ شركة محفظة وعبر تاريخ الشراء. فتصبح اثنتا عشرة قطعة في شركة وأربعون في أخرى طلباً واحداً بأربعين ألف قطعة سنوياً. التجميع نفسه عملية حسابية بسيطة، أما الصعب فهو **إدراك أن الطلبات المتناثرة هي الطلب نفسه**، وهو بالضبط سبب بقاء الطلب المجمّع غير مرئي حتى اليوم.

٢. **المحقّق** يبحث عمّن يستطيع خدمة هذا الحجم المجمّع. يبدأ من كتالوج ترميز لوزارة الصناعة ويتجاوزه عمداً: ٣١٥٣ مصنعاً مسجّلاً مقابل ١٢٩٤٦ مصنعاً عاملاً في المملكة، أي أن ٧٦٪ من الصناعة السعودية خارج الكتالوج الوطني. يقرأ المحقّق مواقع الشركات والسجلات التجارية وترسيات العقود في منافسات والشهادات وأدلة المنتجات. ولأن السؤال صار «من يستطيع خدمة أربعين ألف قطعة سنوياً» بدلاً من «من يصنع هذا»، فإنه يكشف موردين لم يكن طلب شركة واحدة عابر ليبرّر جدواهم.

٣. **المدقّق** يتحقق من كل مرشّح بمنهج تفنيدي، و**يصنّف بدل أن يستبعد**: مصنّع، أو مجمّع، أو موزّع معتمد، أو تاجر. فالتاجر المحلي مورّد محلي أيضاً؛ يوظّف سعوديين ويبقى هامشه داخل البلد، فمحتواه المحلي أقل لا معدوم. وهذا التدرّج يوافق منهجية هيئة المحتوى المحلي التي تقيس القيمة المضافة لا الشكل النظامي للمنشأة. ويحمل كل ادعاء مصدره ومرتبته في هرم الأدلة ودرجة ثقته.

٤. **المستشار** يتولى ما تبقّى. فحيث لا يستطيع أحد في المملكة توريد الطلب المجمّع، يبني الحالة الاستثمارية: القيمة السنوية، والالتزام النظامي ضمن القائمة الإلزامية لهيئة المحتوى المحلي، وأي مصنع قائم يمكنه التحوّل إليه بمعداته الحالية.

**الخصائص الرئيسية**

- **توحيد دلالي للطلب عبر اللغات**، وهو المكوّن الذي يجعل حساب الطلب المجمّع ممكناً أصلاً.
- **اكتشاف من الخارج إلى الداخل.** كل دليل موردين قائم هو قائمة بمن رفعوا أيديهم، وهذا ينتقي الشركات التي لديها فرق تطوير أعمال ويُغفل الورشة المتخصصة التي تصنّع قطعاً دقيقة منذ عشرين سنة. كامن يجد الموردين من الأدلة العامة بدل انتظار تسجيلهم.
- **تصنيف لا استبعاد**، مع هرم أدلة معلَن خلف كل درجة ثقة، بحيث يستطيع مسؤول المشتريات تدقيق الادعاء ويستطيع المحكّم الاعتراض عليه.
- **توزيع التوريد.** حيث لا يستوعب مورّد واحد الطلب المجمّع، يقترح كامن تقسيمه بين عدة موردين، وهو ما يتيح للمنشآت المحلية الصغيرة خدمة طلب كبير بدل إقصائها بسبب حجمها.
- **سجل الفجوات**، طلب مجمّع مستقبلي بقيمته السنوية، ينتظر أول من يستطيع توريده. مذكرة استثمارية لا تقرير.
- **نسبة التغطية**، حصة إنفاق المحفظة القابلة للتلبية محلياً اليوم، وهي نسبة تتحرك.
- **تراكمية.** كل ما يتعلمه الوكلاء يبقى على الخريطة، فيبدأ الطلب التالي من خريطة أكبر وطلب مجمّع أكبر.

**كيف يعالج التحدي المختار.** يطلب المسار الأول طبقة بيانات حيّة تُظهر القدرات المحلية والمواد الخام والشركات المؤهلة القادرة على تلبية **الطلب الكلي** لشركات المحفظة. وكامن يحقق كل عنصر منها. *حيّة*، لأن المنظومة تُحدِّث نفسها باستمرار بدلاً من انتظار إعادة التسجيل، فلا تتقادم الخريطة كما يتقادم التقرير الاستشاري. *قدرات* لا سجلات شركات، لأن قيد السجل يقول «القطاع: معادن» بينما ملف القدرة يقول ما يستطيع المصنع إنتاجه فعلاً. *مواد خام*، عبر طبقة تعدين وهيئة المساحة الجيولوجية التي لا يحويها أي دليل موردين. *الطلب الكلي*، لأن المنسّق هو ما يحوّل أكثر من ١٥٠ نظام مشتريات منفصل إلى رقم طلب واحد قابل للحساب.

**لماذا لم تُنجَز من قبل.** المهمة ليست صعبة فكرياً، بل طويلة. المصنع الواحد يستغرق من باحث كفء بعد ظهر كامل، و١٢٩٤٦ مصنعاً تستغرق نحو خمس سنوات، وتتقادم أوائل المدخلات قبل أن تُكتب أواخرها. ولهذا وُجد الأمر كمشروع استشاري بملايين الريالات لا كمنتج. الوكلاء يغيّرون اقتصاديات العمل لا منهجه: نحو دقيقتين للمصنع، بالتوازي، وعلى مدار الساعة. فتصبح الخمس سنوات أقل من عشر ساعات.

**العلاقة بمنصة مساهمة.** كامن ليس منصة منافسة. مساهمة هي السجل المرجعي للمحتوى المحلي عبر المحفظة، وتعرف من سجّل. وكامن هو طبقة الاكتشاف والإثراء تحتها، ويعرف من لم يسجّل قط.

---

## 3. Measurable impact

**English**

Success is measured on five numbers, all computable from the system itself rather than asserted:

| Metric | Definition | Why it matters |
|---|---|---|
| **Discovery lift** | Count of verified capable manufacturers surfaced that are absent from registration-based platforms | Directly measures the blind spot closed. The core claim of the system. |
| **Localization coverage** | Share of resolved demand lines with ≥1 verified local supplier at ≥ confidence threshold | The number PIF cannot state today. Becomes a tracked KPI. |
| **Addressable spend** | SAR value of demand currently sourced abroad for which verified local capability exists | Immediate, actionable local content uplift. |
| **Gap ledger value** | SAR import value of demand with zero domestic capability, ranked by HS line | Converts a data product into an industrial investment pipeline. |
| **Match precision@3** | Human-validated precision on a stratified sample of resolved lines | Guards against the failure mode that matters: confident wrong answers. |

Supporting operational measures: demand-line resolution rate (share of messy input resolved above confidence threshold), graph freshness (median age of a capability claim), and evidence density (share of claims with primary-source provenance).

The strategic framing: local content requirements were formally extended to state-owned entities, which is why PIF portfolio companies now carry this obligation. Every point of measured coverage translates into compliance headroom and into LCGPA-aligned score improvement that can be evidenced rather than estimated.

**العربية**

يُقاس النجاح بخمسة مؤشرات، جميعها محسوبة من النظام نفسه لا مُدّعاة: **رفع الاكتشاف** (عدد المصانع القادرة المُتحقَّق منها وغير الموجودة في المنصات القائمة على التسجيل)؛ **تغطية التوطين** (نسبة بنود الطلب التي لها مورد محلي متحقَّق)؛ **الإنفاق القابل للتوطين** (قيمة الطلب المستورد الذي توجد له قدرة محلية مؤكدة بالريال)؛ **قيمة سجل الفجوات** (قيمة استيراد الطلب الذي لا قدرة محلية له)؛ و**دقة المطابقة** (مُتحقَّق منها بشرياً على عينة). ويدعمها: معدل توحيد بنود الطلب، وحداثة الرسم البياني، وكثافة الأدلة.

---

## 4. What makes your idea innovative?

**English**

**Direction.** Every supplier platform in the Kingdom, including MUSAHAMA, is inside-out: suppliers register, the platform indexes what they declared. KAMIN is outside-in, it builds the capability picture without asking permission, which is the only way to see the manufacturers who never registered. That inversion is not a feature difference; it changes what is knowable.

**Capability inference, not catalogue lookup.** A registry records what a factory *has declared*. KAMIN infers what a factory *can produce*, from certifications, equipment signals, awarded contract scope, adjacent product lines and hiring. This is what makes adjacency recommendations possible, and adjacency is how gaps actually get closed: not by finding a supplier who doesn't exist, but by identifying the four factories that could pivot into the gap next quarter.

**Adversarial verification as a first-class component.** Most AI systems in this space optimise for recall and present confident output. In procurement that is actively dangerous. KAMIN runs auditor agents whose explicit objective is to kill weak claims, and it surfaces confidence and provenance on every assertion. Trustworthiness is designed in, not disclaimed.

**The negative space.** Absence is the hardest thing to prove and the most valuable thing to know. A search tool that finds nothing has told you nothing. Because KAMIN works against a bounded, continuously refreshed population, it can state with justification that no domestic capability exists for a given specification, and attach the import value. No registration platform can compute this, because registries hold only positives.

**Saudi-specific depth that global platforms structurally cannot reach.** Global supply-chain intelligence products are built on public bill-of-lading data; the Kingdom publishes none, which is why Saudi Arabia is a blind spot for all of them. None of them compute a local content score aligned to LCGPA's published methodology, and none handle Arabic industrial product text. Cross-lingual specification-level matching against Arabic-primary national catalogues is a genuine technical contribution, not a wrapper.

**Emerging technology used where it is necessary, not decorative.** Every hard problem here is a language and reasoning problem that has no deterministic solution: resolving free-text bilingual demand to specifications, inferring capability from fragmentary evidence, and adversarially testing claims. The multi-agent architecture exists because the work fans out across thousands of entities each needing independent multi-step investigation, not because agents are fashionable.

**العربية**

**الاتجاه:** كل المنصات القائمة تعمل من الداخل للخارج، المورد يسجّل، والمنصة تفهرس ما أعلنه. كامن يعمل من الخارج للداخل، وهو السبيل الوحيد لرؤية المصانع التي لم تسجّل قط. **استنتاج القدرة لا استعراض الكتالوج:** نستنتج ما *يستطيع* المصنع إنتاجه لا ما أعلن عنه، وهو ما يتيح توصيات التحوّل الصناعي. **التحقق التفنيدي كمكوّن أساسي:** وكلاء مهمتهم دحض الادعاءات، مع إظهار الثقة والمصدر لكل معلومة. **الفضاء السالب:** إثبات غياب القدرة المحلية، وهو أصعب ما يُثبت وأثمن ما يُعرف، ممكن فقط مقابل مجتمع بيانات محدود ومحدّث. **عمق محلي يتعذّر على المنصات العالمية:** لا تنشر المملكة بيانات بوالص الشحن، ولا تحسب أي منصة عالمية المحتوى المحلي وفق منهجية الهيئة، ولا تتعامل مع النص الصناعي العربي.

---

## 5. Feasibility / MVP scope

**English**

The build rests on data that is public and verifiable today, the demo can be checked live by any judge.

**Delivered in the hackathon window:**
- **Real capability spine.** Ingest the Tarmeez national catalogue via its public endpoint: thousands of real factories with products, categories and regions. We arrive with substance, not placeholders.
- **Detective + Auditor swarm run at depth on a focused slice.** Several hundred entities in one or two priority sectors, fully enriched and adversarially audited, each capability carrying citations and confidence. Depth over breadth is deliberate and we will say so.
- **Coordinator working on real messy input.** Bilingual free-text demand lines resolved to normalised specs and HS anchors.
- **Demand set built on real import values.** Portfolio spend is confidential and will not be provided, so demand is simulated, but simulated on genuine HS-level Saudi import data, so every riyal figure traces to a real trade statistic. We state this explicitly on stage; a clearly-labelled seam is a stronger position than an unexplained dataset.
- **Gap ledger and coverage view.** The primary interface, with drill-down from a gap to the evidence chain.
- **Live cold-miss.** One query the graph has never seen, run on stage, writing a new verified node into the map while the judges watch.

**Explicitly deferred, and named rather than hidden:**
- Wathq commercial-registration integration is built as an adapter with commercial registration number as the join key, so it drops in the moment credentials exist, registration timelines exceed the hackathon window.
- The highest-value datasets in this domain are closed: LCGPA's registry of certified companies, SABER's product conformity registry, and customs microdata. We will name these precisely as the government-access unlock, because knowing exactly what is missing and why is part of the proposal.

**Principal risks and mitigations:** several Saudi government portals apply bot protection or render client-side, mitigated by using captured JSON endpoints and paid scraping fallbacks priced in advance rather than fighting protections live. Arabic to English product normalisation is the critical technical path and is spiked on twenty hand-picked lines in the first hours, in parallel with the data ingest. Published figures conflict across sources (national catalogue counts, mandatory-list sizes), so every number presented on stage is reconciled to a single cited source beforehand.

**Post-hackathon path:** the graph is an asset that compounds, each refresh cycle improves coverage without manual curation, which is what makes this sustainable rather than a one-off analysis. KAMIN is positioned as a discovery and enrichment layer feeding MUSAHAMA, not a competing portal.

**العربية**

يقوم البناء على بيانات عامة يمكن للمحكّمين التحقق منها مباشرة. **ضمن مدة الهاكاثون:** استيعاب كتالوج ترميز الوطني كعمود فقري حقيقي؛ تشغيل المحقّق والمدقّق بعمق على شريحة قطاعية مركّزة مع توثيق ودرجات ثقة؛ محرك توحيد يعمل على بنود طلب حقيقية غير منظّمة؛ مجموعة طلب مُحاكاة مبنية على قيم استيراد حقيقية على مستوى رمز HS, مع التصريح بذلك صراحةً لأن بيانات الإنفاق سرية؛ وواجهة سجل الفجوات والتغطية؛ وعرض حي لاستعلام جديد يُضيف عقدة موثّقة للرسم البياني أمام اللجنة.

**مؤجَّل بشكل معلن:** تكامل واثق يُبنى كمهايئ جاهز باستخدام رقم السجل التجاري كمفتاح ربط. وأثمن البيانات في هذا المجال مغلقة (سجل الشركات المعتمدة لدى هيئة المحتوى المحلي، وسجل سابر، وبيانات الجمارك التفصيلية), وسنُسمّيها بدقة باعتبارها ما يفتحه الوصول الحكومي.

---

## Optional: supporting materials

Recommended attachments: architecture diagram (four agent roles over the two-sided map), gap ledger screenshot, one worked evidence chain for a single supplier claim, and the data provenance table from `DATA_SOURCES.md` showing verified vs. unverified sources.
