# KAMIN, form answers ready to paste

> Four fields, one block each. Everything inside a block is plain text with no markdown, so it pastes into a form textarea exactly as written. Arabic versions of all four are at the bottom.
> Source of record: `SUBMISSION.md` / `SUBMISSION_AR.md`. If you edit an answer here, mirror it there.

---

## 1. Solution Description

*Explain how solution works, its key features, and how it addresses the selected challenge*

```
KAMIN is a live capability layer for Saudi industry, built and continuously refreshed by a swarm of AI agents. It answers a question PIF cannot answer today: for everything the portfolio buys, who in the Kingdom could actually supply it, and where can we prove nobody can.

HOW IT WORKS

KAMIN is not a search box and it does not wait to be asked. It wakes on a signal that already exists inside every portfolio company: a purchase request raised in the ERP. From that single line, four agent roles run in sequence.

1. The Coordinator resolves the request. Procurement text is messy, bilingual and free-form. "صمام كروي ٢ بوصة", "BALL VLV 2IN SS" and "Valve, ball, stainless, 2 inch" are the same object written by three systems that will never agree. The Coordinator normalises each line into a specification anchored to an HS code, then pools every matching line across the 150+ portfolio companies and across purchase history. Twelve units in one company and forty in another become one order of 40,000 a year. Pooling itself is trivial arithmetic. Seeing that scattered requests are the same request is the hard part, and it is exactly why aggregated demand has stayed invisible.

2. The Detective searches for who can serve that pooled volume. It starts from the Ministry of Industry's Tarmeez catalogue and deliberately goes past it: 3,153 factories are registered there against 12,946 operating in the Kingdom, so 76 percent of Saudi industry sits outside the national catalogue. The Detective reads company web presence, commercial registers, awarded contracts on Etimad, certifications and product literature. Because the question is now "who can serve 40,000 units a year" rather than "who makes this", it surfaces providers whose economics a single company's occasional order could never have justified.

3. The Auditor verifies each candidate adversarially, and classifies instead of eliminating: manufacturer, assembler, authorised distributor, or trader. A local trader is still a local supplier. It employs Saudis and retains margin domestically, so its local content is lower, not zero. This gradient follows LCGPA methodology, which measures value added rather than legal form. Every claim carries a citation, an evidence tier and a confidence score.

4. The Advisor handles what is left. Where nobody in the Kingdom can supply the pooled order, it builds the case: annual value, regulatory obligation under the LCGPA Mandatory List, and which existing plant could pivot into it with equipment it already owns.

KEY FEATURES

- Cross-lingual demand resolution, the component that makes aggregate demand computable at all.
- Outside-in discovery. Every supplier directory that exists is a list of who raised their hand, which selects for firms with business-development teams and misses the specialised workshop that has machined precision parts for twenty years. KAMIN finds suppliers from public evidence instead of waiting for them to register.
- Classification, not elimination, with a declared evidence hierarchy behind every confidence score, so a procurement officer can audit the claim and a judge can challenge it.
- Split fulfilment. Where no single provider can absorb a pooled order, KAMIN proposes a split across several, which is what lets small local players serve large demand instead of being excluded by size.
- A gap ledger: pooled forward demand with its annual value, waiting for the first provider who can serve it. An investment memo, not a report.
- Coverage: the share of portfolio spend that is locally satisfiable today, and it moves.
- It compounds. Everything the agents learn stays on the map, so the next request starts from a bigger map and larger pooled demand.

HOW IT ADDRESSES THE CHALLENGE

Track 1 asks for a dynamic data layer surfacing local capabilities, raw materials and qualified companies able to meet portfolio companies' total demand. KAMIN delivers each term.

Dynamic, because the swarm refreshes continuously rather than waiting for re-registration, so the map does not go stale the way a consulting report does. Capabilities rather than company records, because a registry entry says "sector: metals" while a capability profile says what a plant can actually produce. Raw materials, through the Ta'adeen and Saudi Geological Survey layer that no supplier registry contains. Total demand, because the Coordinator is what turns 150+ disconnected procurement systems into one computable demand figure.

WHY IT HAS NOT BEEN DONE

The work is not intellectually hard, it is long. One factory takes a competent researcher a full afternoon. 12,946 of them takes about five years, and the first entries are stale before the last are written. That is why this exists today as a multi-million riyal consulting engagement and not as a product. Agents change the unit economics, not the method: roughly two minutes per factory, running in parallel, around the clock. Five years becomes under ten hours.

RELATIONSHIP TO MUSAHAMA

KAMIN is not a competing platform. MUSAHAMA is the system of record for local content across the portfolio and knows who registered. KAMIN is the discovery and enrichment layer underneath it, and knows who never did.
```

---

## 2. Measurable impact

*How would you measure success*

```
Success is measured on five numbers, all computable from the system itself rather than asserted.

1. Discovery lift. The count of verified capable manufacturers surfaced that are absent from every registration-based platform. This directly measures the blind spot closed, and it is the core claim of the system. Our baseline is public: 3,153 factories registered in Tarmeez against 12,946 operating in the Kingdom.

2. Localization coverage. The share of resolved demand lines with at least one verified local supplier above the confidence threshold. This is the number PIF cannot state today, and it becomes a tracked KPI rather than an estimate.

3. Addressable spend. The SAR value of demand currently sourced abroad for which verified local capability exists. This is immediate, actionable local content uplift, and it is the figure a procurement decision is actually made on.

4. Gap ledger value. The SAR import value of pooled demand with zero domestic capability, ranked by HS line. This converts a data product into an industrial investment pipeline.

5. Match precision at 3. Human-validated precision on a stratified sample of resolved demand lines. This guards against the failure mode that matters most in procurement: confident wrong answers. A system that surfaces a supplier who cannot actually deliver is worse than one that returns nothing.

Supporting operational measures: demand-line resolution rate, meaning the share of messy bilingual input resolved above the confidence threshold; graph freshness, the median age of a capability claim; and evidence density, the share of claims backed by primary-source provenance rather than inference.

Strategic framing. Local content requirements were formally extended to state-owned entities, which is why PIF portfolio companies now carry this obligation. Every point of measured coverage translates into compliance headroom and into an LCGPA-aligned score improvement that can be evidenced rather than estimated.

One deliberate choice about aggregation: because demand is pooled before it is matched, coverage and addressable spend are reported at portfolio level, not per company. A part that no single company buys in meaningful volume can still be locally sourced once the portfolio is counted as one buyer, and that difference is precisely what these metrics are built to expose.
```

---

## 3. What makes your idea innovative?

```
Direction. Every supplier platform in the Kingdom, MUSAHAMA included, is inside-out: suppliers register, the platform indexes what they declared. KAMIN is outside-in. It builds the capability picture without asking permission, which is the only way to see the manufacturers who never registered. That inversion is not a feature difference, it changes what is knowable.

Demand-side aggregation as the entry point. Every comparable effort starts from the supply side and tries to catalogue factories. KAMIN starts from a purchase request and works backwards. This matters because it solves PIF's stated problem, limited visibility into aggregated demand, as a precondition rather than as a later phase. Pooling is trivial once you can see that differently-worded requests describe one object, and seeing that requires cross-lingual semantic resolution, which is why the problem has persisted.

Capability inference, not catalogue lookup. A registry records what a factory has declared. KAMIN infers what a factory can produce, from certifications, equipment signals, awarded contract scope, adjacent product lines and hiring. This is what makes adjacency recommendations possible, and adjacency is how gaps actually close: not by finding a supplier who does not exist, but by identifying the four factories that could pivot into the gap next quarter.

Adversarial verification as a first-class component. Most AI systems in this space optimise for recall and present confident output. In procurement that is actively dangerous. KAMIN runs auditor agents whose explicit objective is to kill weak claims, and surfaces confidence and provenance on every assertion. Trustworthiness is designed in, not disclaimed.

Classification instead of elimination. The obvious design filters traders out to leave only manufacturers. That is wrong under Saudi local content rules, which measure value added rather than legal form. KAMIN classifies every provider as manufacturer, assembler, authorised distributor or trader, each with its own local content weight, because a local trader employing Saudis with margin retained domestically has lower local content, not zero.

The negative space. Absence is the hardest thing to prove and the most valuable thing to know. A search tool that finds nothing has told you nothing. Because KAMIN works against a bounded, continuously refreshed population, it can state with justification that no domestic capability exists for a given specification, and attach the import value to that absence. No registration platform can compute this, because registries hold only positives.

Saudi-specific depth that global platforms structurally cannot reach. Global supply-chain intelligence products are built on public bill-of-lading data. The Kingdom publishes none, which is why Saudi Arabia is a blind spot for all of them. None of them compute a local content score aligned to LCGPA's published methodology, and none handle Arabic industrial product text. Cross-lingual specification-level matching against Arabic-primary national catalogues is a genuine technical contribution, not a wrapper around a general model.

Emerging technology used where it is necessary rather than decorative. Every hard problem here is a language and reasoning problem with no deterministic solution: resolving free-text bilingual demand to specifications, inferring capability from fragmentary evidence, and adversarially testing claims. The multi-agent architecture exists because the work fans out across thousands of entities that each need an independent multi-step investigation, not because agents are fashionable.
```

---

## 4. Feasibility / MVP scope

*What could you realistically build during the hackathon?*

```
The build rests on data that is public and verifiable today, so the demo can be checked live by any judge.

DELIVERED IN THE HACKATHON WINDOW

Real capability spine. Ingest the Tarmeez national catalogue through its public endpoint: thousands of real factories with products, categories and regions. We arrive with substance, not placeholders.

Coordinator working on real messy input. Bilingual free-text demand lines resolved to normalised specifications and HS anchors, then pooled across companies and across time into single orders with real volume. This is the component the whole system depends on, so it is prototyped first.

Detective and Auditor swarm run at depth on a focused slice. Several hundred entities in one or two priority sectors, fully enriched and adversarially audited, each capability carrying citations, an evidence tier and a confidence score. Depth over breadth is a deliberate choice and we will say so on stage rather than imply full coverage.

Demand set built on real import values. Portfolio spend is confidential and will not be provided to us, so demand is simulated, but simulated on genuine HS-level Saudi import data, so every riyal figure traces to a real trade statistic. We state this explicitly. A clearly labelled seam is a stronger position than an unexplained dataset.

Gap ledger and coverage view. The primary interface, with drill-down from a gap to the full evidence chain behind every claim.

Live cold miss. One query the graph has never seen, run on stage, writing a new verified node into the map while the judges watch. This is what separates a live system from a prepared dataset.

EXPLICITLY DEFERRED, NAMED RATHER THAN HIDDEN

Wathq commercial-registration integration is built as an adapter with the commercial registration number as the join key, so it drops in the moment credentials exist. Registration timelines exceed the hackathon window.

The highest-value datasets in this domain are closed: LCGPA's registry of certified companies, SABER's product conformity registry, and customs microdata. We name these precisely as the government-access unlock, because knowing exactly what is missing and why is part of the proposal.

PRINCIPAL RISKS AND MITIGATIONS

Several Saudi government portals apply bot protection or render client-side. Mitigated by using captured JSON endpoints and paid scraping fallbacks priced in advance, rather than fighting protections live during the build.

Arabic to English product normalisation is the critical technical path, so it is spiked on twenty hand-picked lines in the first hours, in parallel with the data ingest, before anything is built on top of it.

Published figures conflict across sources, including national catalogue counts and mandatory-list sizes. Every number presented on stage is reconciled to a single cited source beforehand.

POST-HACKATHON PATH

The graph is an asset that compounds. Each refresh cycle improves coverage without manual curation, which is what makes this sustainable rather than a one-off analysis. KAMIN is positioned as a discovery and enrichment layer feeding MUSAHAMA, not a competing portal.
```

---
---

# النسخة العربية

## ١. وصف الحل

*اشرح آلية عمل الحل وخصائصه الرئيسية وكيف يعالج التحدي المختار*

```
كامن طبقة حيّة لقدرات الصناعة السعودية، تُبنى وتُحدَّث باستمرار عبر منظومة من وكلاء الذكاء الاصطناعي، وتجيب عن سؤال لا يستطيع الصندوق الإجابة عنه اليوم: لكل ما تشتريه شركات المحفظة، من في المملكة يستطيع توريده فعلاً، وأين يمكن إثبات أن لا أحد يستطيع.

آلية العمل

النظام ليس محرك بحث ولا ينتظر أن يُسأل، بل ينطلق من إشارة قائمة في كل شركة محفظة: طلب شراء يُرفع في نظام تخطيط الموارد. ومن هذا السطر الواحد تعمل أربعة أدوار على التوالي.

١. المنسّق يوحّد الطلب. نصوص المشتريات غير منظمة وثنائية اللغة وحرّة الصياغة: «صمام كروي ٢ بوصة» و«BALL VLV 2IN SS» و«Valve, ball, stainless, 2 inch» وصفٌ لشيء واحد كتبته ثلاثة أنظمة لن تتفق أبداً. يحوّل المنسّق كل بند إلى مواصفة موحّدة مرتبطة برمز HS، ثم يجمّع كل بند مطابق عبر أكثر من ١٥٠ شركة محفظة وعبر تاريخ الشراء. فتصبح اثنتا عشرة قطعة في شركة وأربعون في أخرى طلباً واحداً بأربعين ألف قطعة سنوياً. التجميع نفسه عملية حسابية بسيطة، أما الصعب فهو إدراك أن الطلبات المتناثرة هي الطلب نفسه، وهو بالضبط سبب بقاء الطلب المجمّع غير مرئي حتى اليوم.

٢. المحقّق يبحث عمّن يستطيع خدمة هذا الحجم المجمّع. يبدأ من كتالوج ترميز لوزارة الصناعة ويتجاوزه عمداً: ٣١٥٣ مصنعاً مسجّلاً مقابل ١٢٩٤٦ مصنعاً عاملاً في المملكة، أي أن ٧٦٪ من الصناعة السعودية خارج الكتالوج الوطني. يقرأ المحقّق مواقع الشركات والسجلات التجارية وترسيات العقود في منافسات والشهادات وأدلة المنتجات. ولأن السؤال صار «من يستطيع خدمة أربعين ألف قطعة سنوياً» بدلاً من «من يصنع هذا»، فإنه يكشف موردين لم يكن طلب شركة واحدة عابر ليبرّر جدواهم.

٣. المدقّق يتحقق من كل مرشّح بمنهج تفنيدي، ويصنّف بدل أن يستبعد: مصنّع، أو مجمّع، أو موزّع معتمد، أو تاجر. فالتاجر المحلي مورّد محلي أيضاً؛ يوظّف سعوديين ويبقى هامشه داخل البلد، فمحتواه المحلي أقل لا معدوم. وهذا التدرّج يوافق منهجية هيئة المحتوى المحلي التي تقيس القيمة المضافة لا الشكل النظامي للمنشأة. ويحمل كل ادعاء مصدره ومرتبته في هرم الأدلة ودرجة ثقته.

٤. المستشار يتولى ما تبقّى. فحيث لا يستطيع أحد في المملكة توريد الطلب المجمّع، يبني الحالة الاستثمارية: القيمة السنوية، والالتزام النظامي ضمن القائمة الإلزامية لهيئة المحتوى المحلي، وأي مصنع قائم يمكنه التحوّل إليه بمعداته الحالية.

الخصائص الرئيسية

- توحيد دلالي للطلب عبر اللغات، وهو المكوّن الذي يجعل حساب الطلب المجمّع ممكناً أصلاً.
- اكتشاف من الخارج إلى الداخل. كل دليل موردين قائم هو قائمة بمن رفعوا أيديهم، وهذا ينتقي الشركات التي لديها فرق تطوير أعمال ويُغفل الورشة المتخصصة التي تصنّع قطعاً دقيقة منذ عشرين سنة. كامن يجد الموردين من الأدلة العامة بدل انتظار تسجيلهم.
- تصنيف لا استبعاد، مع هرم أدلة معلَن خلف كل درجة ثقة، بحيث يستطيع مسؤول المشتريات تدقيق الادعاء ويستطيع المحكّم الاعتراض عليه.
- توزيع التوريد بين عدة موردين حين يعجز مورّد واحد عن استيعاب الطلب المجمّع، وهو ما يتيح للمنشآت المحلية الصغيرة خدمة طلب كبير بدل إقصائها بسبب حجمها.
- سجل الفجوات: طلب مجمّع مستقبلي بقيمته السنوية، ينتظر أول من يستطيع توريده. مذكرة استثمارية لا تقرير.
- نسبة التغطية: حصة إنفاق المحفظة القابلة للتلبية محلياً اليوم، وهي نسبة تتحرك.
- تراكمية. كل ما يتعلمه الوكلاء يبقى على الخريطة، فيبدأ الطلب التالي من خريطة أكبر وطلب مجمّع أكبر.

كيف يعالج التحدي المختار

يطلب المسار الأول طبقة بيانات حيّة تُظهر القدرات المحلية والمواد الخام والشركات المؤهلة القادرة على تلبية الطلب الكلي لشركات المحفظة. وكامن يحقق كل عنصر منها.

حيّة، لأن المنظومة تُحدِّث نفسها باستمرار بدلاً من انتظار إعادة التسجيل، فلا تتقادم الخريطة كما يتقادم التقرير الاستشاري. قدرات لا سجلات شركات، لأن قيد السجل يقول «القطاع: معادن» بينما ملف القدرة يقول ما يستطيع المصنع إنتاجه فعلاً. مواد خام، عبر طبقة تعدين وهيئة المساحة الجيولوجية التي لا يحويها أي دليل موردين. الطلب الكلي، لأن المنسّق هو ما يحوّل أكثر من ١٥٠ نظام مشتريات منفصل إلى رقم طلب واحد قابل للحساب.

لماذا لم تُنجَز من قبل

المهمة ليست صعبة فكرياً، بل طويلة. المصنع الواحد يستغرق من باحث كفء بعد ظهر كامل، و١٢٩٤٦ مصنعاً تستغرق نحو خمس سنوات، وتتقادم أوائل المدخلات قبل أن تُكتب أواخرها. ولهذا وُجد الأمر كمشروع استشاري بملايين الريالات لا كمنتج. الوكلاء يغيّرون اقتصاديات العمل لا منهجه: نحو دقيقتين للمصنع، بالتوازي، وعلى مدار الساعة. فتصبح الخمس سنوات أقل من عشر ساعات.

العلاقة بمنصة مساهمة

كامن ليس منصة منافسة. مساهمة هي السجل المرجعي للمحتوى المحلي عبر المحفظة، وتعرف من سجّل. وكامن هو طبقة الاكتشاف والإثراء تحتها، ويعرف من لم يسجّل قط.
```

---

## ٢. الأثر القابل للقياس

*كيف تقيس النجاح*

```
يُقاس النجاح بخمسة مؤشرات، جميعها محسوبة من النظام نفسه لا مُدّعاة.

١. رفع الاكتشاف. عدد المصانع القادرة المُتحقَّق منها والتي لا توجد في أي منصة قائمة على التسجيل. وهو يقيس مباشرةً حجم النقطة العمياء التي أُغلقت، وهو الادعاء الجوهري للنظام. وخط الأساس معلن: ٣١٥٣ مصنعاً مسجّلاً في ترميز مقابل ١٢٩٤٦ مصنعاً عاملاً.

٢. تغطية التوطين. نسبة بنود الطلب الموحَّدة التي لها مورّد محلي واحد على الأقل متحقَّق منه فوق حد الثقة. وهو الرقم الذي لا يستطيع الصندوق ذكره اليوم، ويتحول إلى مؤشر أداء متتبَّع بدل أن يبقى تقديراً.

٣. الإنفاق القابل للتوطين. قيمة الطلب المستورد حالياً بالريال والذي توجد له قدرة محلية مؤكدة. وهو ارتفاع فوري وقابل للتنفيذ في المحتوى المحلي، وهو الرقم الذي يُتخذ عليه قرار الشراء فعلاً.

٤. قيمة سجل الفجوات. قيمة استيراد الطلب المجمّع الذي لا توجد له قدرة محلية إطلاقاً، مرتّبة حسب رمز HS. وهو ما يحوّل منتجاً معلوماتياً إلى خط أنابيب استثمار صناعي.

٥. دقة المطابقة. دقة مُتحقَّق منها بشرياً على عينة طبقية من بنود الطلب الموحَّدة. وهي تحمي من نمط الفشل الأخطر في المشتريات: الإجابة الخاطئة الواثقة. فالنظام الذي يقترح مورّداً لا يستطيع التسليم أسوأ من نظام لا يعيد شيئاً.

ويدعمها ثلاثة مؤشرات تشغيلية: معدل توحيد بنود الطلب، أي نسبة المدخلات غير المنظمة وثنائية اللغة التي تُوحَّد فوق حد الثقة؛ وحداثة الرسم البياني، أي الوسيط العمري لادعاء القدرة؛ وكثافة الأدلة، أي نسبة الادعاءات المسنودة بمصدر أولي لا باستنتاج.

الإطار الاستراتيجي: امتدت متطلبات المحتوى المحلي رسمياً إلى الجهات المملوكة للدولة، ولهذا تحمل شركات محفظة الصندوق هذا الالتزام اليوم. وكل نقطة تغطية مقاسة تتحول إلى هامش امتثال وإلى تحسّن في التقييم وفق منهجية الهيئة يمكن إثباته لا تقديره.

وثمة اختيار متعمد في التجميع: لأن الطلب يُجمَّع قبل أن يُطابَق، تُحتسب التغطية والإنفاق القابل للتوطين على مستوى المحفظة لا الشركة الواحدة. فالصنف الذي لا تشتريه أي شركة بمفردها بحجم مجدٍ قد يصبح قابلاً للتوريد محلياً متى ما اعتُبرت المحفظة مشترياً واحداً، وهذا الفرق بالذات هو ما بُنيت هذه المؤشرات لكشفه.
```

---

## ٣. ما الذي يجعل الفكرة مبتكرة

```
الاتجاه. كل منصات الموردين في المملكة، ومنها مساهمة، تعمل من الداخل إلى الخارج: المورّد يسجّل، والمنصة تفهرس ما أعلنه. وكامن يعمل من الخارج إلى الداخل، فيبني صورة القدرات دون استئذان، وهو السبيل الوحيد لرؤية المصانع التي لم تسجّل قط. وهذا الانعكاس ليس فرقاً في الخصائص، بل يغيّر ما يمكن معرفته أصلاً.

التجميع من جهة الطلب كنقطة انطلاق. كل جهد مشابه يبدأ من جهة العرض ويحاول فهرسة المصانع. وكامن يبدأ من طلب شراء ويعمل رجوعاً. وأهمية ذلك أنه يحل المشكلة التي صرّح بها الصندوق نفسه، محدودية الرؤية للطلب المجمّع، كشرط مسبق لا كمرحلة لاحقة. فالتجميع سهل متى ما استطعت رؤية أن أوصافاً مختلفة تشير إلى شيء واحد، وهذه الرؤية تتطلب فهماً دلالياً عابراً للغة، ولهذا استمرت المشكلة.

استنتاج القدرة لا استعراض الكتالوج. السجل يوثّق ما أعلنه المصنع. وكامن يستنتج ما يستطيع المصنع إنتاجه، من الشهادات وإشارات المعدات ونطاق العقود المرساة وخطوط المنتجات المجاورة والتوظيف. وهذا ما يتيح توصيات التحوّل الصناعي، والتحوّل هو الطريقة التي تُسدّ بها الفجوات فعلاً: لا بالعثور على مورّد غير موجود، بل بتحديد المصانع الأربعة التي تستطيع التحوّل إلى الفجوة في الربع القادم.

التحقق التفنيدي كمكوّن أساسي. معظم الأنظمة الذكية في هذا المجال تُحسّن الاسترجاع وتعرض مخرجات واثقة. وهذا في المشتريات خطر فعلي. ويشغّل كامن وكلاء مدقّقين هدفهم المعلن دحض الادعاءات الضعيفة، ويُظهر درجة الثقة والمصدر لكل معلومة. فالجدارة بالثقة مُصمَّمة في النظام لا مُتبرَّأ منها في هامش.

التصنيف بدل الاستبعاد. التصميم البديهي يستبعد التجار ليُبقي المصنّعين فقط. وهذا خطأ وفق أنظمة المحتوى المحلي السعودية التي تقيس القيمة المضافة لا الشكل النظامي. فكامن يصنّف كل مورّد: مصنّع، أو مجمّع، أو موزّع معتمد، أو تاجر، ولكل تصنيف وزنه، لأن التاجر المحلي الذي يوظّف سعوديين ويبقي هامشه في البلد محتواه المحلي أقل لا معدوم.

الفضاء السالب. الغياب أصعب ما يُثبت وأثمن ما يُعرف. وأداة البحث التي لا تجد شيئاً لم تخبرك بشيء. ولأن كامن يعمل مقابل مجتمع بيانات محدود ومحدَّث باستمرار، يستطيع أن يقرر بمسوّغ أن لا قدرة محلية لمواصفة بعينها، وأن يرفق بذلك الغياب قيمة استيراده. ولا تستطيع أي منصة تسجيل حساب هذا، لأن السجلات لا تحوي إلا الإيجابيات.

عمق محلي يتعذّر بنيوياً على المنصات العالمية. تُبنى منتجات ذكاء سلاسل الإمداد العالمية على بيانات بوالص الشحن العامة، والمملكة لا تنشرها، ولهذا فالسعودية نقطة عمياء لديها جميعاً. ولا تحسب أي منها المحتوى المحلي وفق منهجية الهيئة المنشورة، ولا تتعامل أي منها مع النص الصناعي العربي. والمطابقة على مستوى المواصفة عبر اللغات مقابل كتالوجات وطنية عربية الأصل إسهام تقني حقيقي لا غلاف حول نموذج عام.

التقنيات الحديثة مستخدمة حيث تلزم لا للزينة. كل مشكلة صعبة هنا هي مشكلة لغة واستدلال بلا حل حتمي: توحيد نص طلب حرّ ثنائي اللغة إلى مواصفات، واستنتاج القدرة من أدلة مجزّأة، واختبار الادعاءات تفنيدياً. والبنية متعددة الوكلاء موجودة لأن العمل يتوزع على آلاف المنشآت يحتاج كلٌّ منها تحقيقاً مستقلاً متعدد الخطوات، لا لأن الوكلاء رائجون.
```

---

## ٤. الجدوى ونطاق النموذج الأولي

*ما الذي يمكن بناؤه واقعياً خلال الهاكاثون*

```
يقوم البناء على بيانات عامة يمكن لأي محكّم التحقق منها مباشرة أثناء العرض.

ما سيُنجَز خلال مدة الهاكاثون

عمود فقري حقيقي للقدرات. استيعاب كتالوج ترميز الوطني عبر واجهته العامة: آلاف المصانع الحقيقية بمنتجاتها وفئاتها ومناطقها. نحضر بمادة لا بعناصر نائبة.

منسّق يعمل على مدخلات حقيقية غير منظمة. بنود طلب حرّة ثنائية اللغة تُوحَّد إلى مواصفات ورموز HS، ثم تُجمَّع عبر الشركات وعبر الزمن في طلبات واحدة بحجم حقيقي. وهو المكوّن الذي يعتمد عليه النظام كله، ولهذا يُبنى أولاً.

تشغيل وكلاء المحقّق والمدقّق بعمق على شريحة مركّزة. عدة مئات من المنشآت في قطاع أو قطاعين ذوي أولوية، مُثراة بالكامل ومدقّقة تفنيدياً، ولكل قدرة مصادرها ومرتبتها في هرم الأدلة ودرجة ثقتها. والعمق على حساب الاتساع اختيار متعمد سنصرّح به على المنصة بدل الإيحاء بتغطية كاملة.

مجموعة طلب مبنية على قيم استيراد حقيقية. إنفاق المحفظة سرّي ولن يُتاح لنا، فالطلب مُحاكى، لكنه مُحاكى على بيانات استيراد سعودية حقيقية على مستوى رمز HS، فكل رقم بالريال يعود إلى إحصاء تجاري فعلي. ونصرّح بذلك صراحةً، لأن الحدّ المعلَن أقوى موقفاً من مجموعة بيانات غير مفسَّرة.

واجهة سجل الفجوات والتغطية. الواجهة الأساسية، مع تعمّق من الفجوة إلى سلسلة الأدلة الكاملة خلف كل ادعاء.

عرض حي لاستعلام جديد. استعلام لم يره الرسم البياني من قبل، يُشغَّل على المنصة ويكتب عقدة موثّقة جديدة في الخريطة أمام اللجنة. وهذا ما يفرّق النظام الحي عن مجموعة بيانات مُعدّة مسبقاً.

ما سيُؤجَّل، معلَناً لا مخفياً

تكامل واثق للسجل التجاري يُبنى كمهايئ جاهز باستخدام رقم السجل التجاري كمفتاح ربط، فيدخل فور توفر الصلاحيات. ومُدد التسجيل تتجاوز مدة الهاكاثون.

وأثمن البيانات في هذا المجال مغلقة: سجل الشركات المعتمدة لدى هيئة المحتوى المحلي، وسجل سابر لمطابقة المنتجات، وبيانات الجمارك التفصيلية. ونُسمّيها بدقة باعتبارها ما يفتحه الوصول الحكومي، لأن معرفة الناقص بالضبط وسببه جزء من المقترح.

المخاطر الرئيسية ومعالجتها

عدة بوابات حكومية سعودية تطبّق حماية ضد الروبوتات أو تُصيّر محتواها من جهة العميل. وتُعالَج باستخدام واجهات JSON المرصودة وبدائل استخلاص مدفوعة مُسعَّرة مسبقاً، بدل مصارعة الحمايات أثناء البناء.

توحيد أسماء المنتجات بين العربية والإنجليزية هو المسار التقني الحرج، ولهذا يُختبر على عشرين بنداً منتقاة في الساعات الأولى، بالتوازي مع استيعاب البيانات، قبل أن يُبنى عليه شيء.

الأرقام المنشورة متضاربة بين المصادر، ومنها أعداد الكتالوج الوطني وأحجام القوائم الإلزامية. ولهذا يُسنَد كل رقم يُعرض على المنصة إلى مصدر واحد مذكور، مسبقاً.

ما بعد الهاكاثون

الرسم البياني أصل تراكمي. فكل دورة تحديث ترفع التغطية دون تنسيق يدوي، وهذا ما يجعله مستداماً لا تحليلاً لمرة واحدة. وكامن موضوع كطبقة اكتشاف وإثراء تغذّي منصة مساهمة، لا كبوابة منافسة.
```
