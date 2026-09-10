# KAMIN — counts, tokens and runtime

**Measured from the live database, 10 September 2026.** Every figure is a query
result, not an estimate. Regenerate with `bun run numbers` and `bun run cost`.

---

## 1. Supplier and capability are not the same thing

This is the distinction the whole data model rests on, and it is easy to
conflate because the UI shows both in one row.

**Supplier** = a company. One row in `suppliers`.
**Capability** = a claim that *one supplier* can supply *one product* to a
stated specification, in a stated class, with evidence. One row in
`capabilities`.

So a single company holds many capabilities:

| Supplier | Capabilities |
|---|---|
| Prisma Metal Industry Company Ltd. | 98 |
| altiknulujia aldhakia lilsinaat almutatawira Company Ltd. | 79 |
| Nitaq alInjaz Company For Manufacturing | 58 |

**14,329 suppliers hold at least one capability, and there are 51,992
capabilities between them — an average of 3.6 each.**

A capability is the unit the Auditor judges. That matters: the Auditor does not
approve or reject a *company*, it judges one claim at a time. The same company
can have a supported valve capability and a refuted pump capability, and can be
a manufacturer of one and a trader of the other. **Class is per capability,
never per company.**

---

## 2. Suppliers

| | Count |
|---|---|
| **Suppliers on the map** | **15,025** |
| … registered in Tarmeez | 14,873 |
| … **absent from Tarmeez, found by KAMIN** | **152** |
| … Made in Saudi certified | 281 |
| … in the Madinah chamber directory (MLCP) | 435 |
| … discovered by the long-tail hunt, in no registry at all | 10 |
| Suppliers holding at least one capability | 14,329 |
| Test rows (excluded everywhere above) | 9 |

Categories overlap: the same plant can be in Tarmeez *and* Made in Saudi.

### How far each has been investigated

| `detective_status` | Count |
|---|---|
| `pending` — never attempted | 14,914 |
| `ok` — a run completed | 146 |
| `error` — the run threw | 9 |
| `skipped` — never used | 0 |

> `ok` means the run did not throw, nothing stronger. Of 160 recorded runs,
> **67 concluded the pages found described a different company**, and 64% wrote
> no capabilities.

---

## 3. Products and capabilities

Three different numbers get called "products". They are not interchangeable.

| | Count | What it is |
|---|---|---|
| **Registered tariff codes** | **4,836** | `products` — codes Saudi plants declared in Tarmeez |
| **Capabilities** | **51,992** | `capabilities` — one supplier × one product claim |
| **Distinct product titles** | **147** | Real product names read off company websites by the agents |
| HS codes in the reference | 10,794 | The tariff classification itself |

The gap between 4,836 and 10,794 is itself a finding: **Saudi plants have
registered in under half of the tariff classification.** The empty half is where
localisation opportunity lives.

The 147 distinct product titles are the honest measure of depth. 15,025
suppliers declared codes; only 147 products are on record under the name the
company itself uses.

### In the valve, pump and fitting slice

| | Count |
|---|---|
| Suppliers with a capability in the slice | 418 |
| Capabilities in the slice | 759 |
| … supported | 326 |
| … refuted | 31 |

### How much has actually been checked

| | Count | Share |
|---|---|---|
| Capabilities audited | **467** | **0.9%** |
| Capabilities supported | 323 | |
| **Capabilities never audited** | **51,525** | **99.1%** |

Everything the product claims rests on that 0.9%. The rest are unverified
registry declarations.

### Evidence and relations

| | Count |
|---|---|
| Evidence records, Tier 1 (third-party verified) | 1,387 |
| Evidence records, Tier 2 (official registry) | 52,016 |
| Evidence records, Tier 3 (self-published) | 419 |
| Typed relations in the graph | 73 |
| … suppliers carrying at least one relation | 18 |
| … edges resolving to another supplier | **0** |

---

## 4. Token spend, per run and per role

**Totals: 1,146 runs · 4,306 steps · 2,926,943 tokens in · 496,120 tokens out.**

| Role | Runs | Total in | Total out | Avg in / run | Avg out / run | Largest run |
|---|---|---|---|---|---|---|
| **Detective** | 185 | 1,093,427 | 181,182 | 6,248 | 1,035 | 15,560 |
| **Auditor** | 606 | 724,814 | 168,042 | 1,222 | 283 | 6,110 |
| **Coordinator** | 171 | 574,981 | 45,522 | 4,291 | 340 | 7,512 |
| **Specifier** | 181 | 529,694 | 98,426 | 4,138 | 769 | 11,730 |
| **Advisor** | 3 | 4,027 | 2,948 | 1,342 | 983 | 1,486 |

Reading it:

- **The Detective is the expensive one.** 6,248 tokens in per run, because it
  reads whole web pages. It is 16% of runs but 37% of all input tokens.
- **The Auditor is the cheap one.** 1,222 tokens in per run — it judges one
  capability against evidence already on record, so it never re-reads the web.
  It is 53% of all runs but only 25% of input tokens.
- **Input dwarfs output, 5.9 : 1.** These agents read far more than they write,
  which is what you want from an evidence pipeline.

### Cost

**Zero riyals in model spend.** Every one of the 1,146 runs used
`ollama:qwen3.5:9b` on local hardware. The only paid external service is Tavily
search, and its responses are cached to disk (507 distinct queries), so
re-running a stage costs nothing.

For reference, those 2.93M input tokens would carry a real price against a
frontier API. Running locally is what makes re-running the whole pipeline a free
decision rather than a budget one.

---

## 5. When it has been running

| | |
|---|---|
| **First run** | 2026-09-01 23:51 UTC |
| **Last run** | 2026-09-09 08:11 UTC |
| **Days with activity** | **4** |
| **Total agent runtime** | **73.0 hours** |

### Activity by day

| Date | Runs | Tokens in | Agent hours |
|---|---|---|---|
| 2026-09-01 | 9 | 2,357 | 9.8 |
| **2026-09-02** | **699** | **1,692,815** | **54.7** |
| 2026-09-03 | 191 | 487,745 | 2.4 |
| 2026-09-09 | 247 | 744,026 | 6.2 |

**2 September did most of the work** — 61% of all runs and 58% of all tokens in
a single day of 54.7 agent-hours. That is the build sprint.

**9 September** is the widening pass: Specifier over its queue, Detective from
80 to 146 suppliers, Auditor over the new capabilities, then re-match and
re-score.

> **Agent runtime is not wall-clock.** 73 hours of run time over 4 days is
> possible because runs overlap, but only two at a time — one local Ollama
> serialises every call, so `--concurrency 2` contends rather than parallelises.

### What is running continuously

The **application** is a different thing from the **agents**:

| Process | Uptime |
|---|---|
| Postgres (`kamin-db`, OrbStack) | 8 days |
| Ollama serving `qwen3.5:9b` | 8 days, 7 hours |
| `next start` under launchd, port 3600 | restarts on every deploy |

**The agents are not scheduled.** They run when someone runs them. The only
autonomous path is the cold miss: opening an uninvestigated supplier triggers a
live Detective run in the browser over SSE, which writes back to the graph.

---

## 6. The one-line summary

**15,025 suppliers · 51,992 capabilities · 4,836 registered tariff codes ·
467 audited (0.9%) · 73 relations · 1,146 agent runs · 2.93M tokens in ·
73 agent-hours over 4 days · zero riyals in model cost.**
