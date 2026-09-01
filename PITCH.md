# KAMIN, the pitch deck

> 19 slides, matching the published deck. Arabic version: `PITCH_AR.md`
> Story: `STORY.md` · Formal submission: `SUBMISSION.md`

---

## 1 · Cover

# KAMIN
*What exists but has never been found*
`K A M I N`

**It exists. Nobody has seen it.**
A live map of what Saudi Arabia can actually supply.

*Innovate Hackathon · Track One*

---

## 2 · Opening

# "Is there a local supplier?"

A question so simple you would expect one of these to answer it:

| ChatGPT | Saudi Made | `suppliers_approved.xlsx` |
|---|---|---|
| Answers with confidence | A mark on a product | The approved supplier list |
| **Has no Saudi data** | **Not a supplier directory** | **Only holds who we have bought from before** |

# And the truth? Nobody can answer it.

---

## 3 · Why it matters

PIF has more than **150 companies** buying every day: steel, valves, cables, chemicals, equipment. A large share of it comes from abroad.

**Case one · For a good reason**, genuinely nobody makes it locally.
**Case two · For a sad reason**, someone makes it two hours away, and nobody knows they exist.

# And to this day, nobody can tell the two apart.

---

## 4 · The problem, half one

# ✋ We only know who raises their hand

To find out what a Saudi factory can supply, **it** has to tell you. Every supplier directory in existence is a list of who raised their hand.

> Imagine a phone book you only appear in if you submit a form. **And who submits forms?** Large companies with sales teams whose job is submitting forms.
> The workshop in Al-Kharj that has been machining precision parts for twenty years? Not in the directory. Never will be.

# And it is exactly the one you were looking for.

**Even though it:**

- ✓ has won past government tenders
- ✓ has its products registered with the Ministry of Industry
- ✓ has published conformity certificates
- ✓ has a commercial register stating exactly what it does

**✗ It just is not on your supplier list.**

---

## 5 · The problem, half two

# The same item, three different names

More than 150 companies, each with a different procurement system, two languages, and free text.

| System | PR No. | Description |
|---|---|---|
| SAP MM | `PR-2026-0142` | صمام كروي ٢ بوصة |
| Oracle iProc | `REQ-88213` | `BALL VLV 2IN SS` |
| Excel | `-` | `Valve, ball, stainless, 2 inch` |

**Exactly the same thing.** And three strings a computer sees as unrelated.

---

## 6 · What changed

# The data exists, but it is scattered

| Source | What it holds |
|---|---|
| Monafasat | Government contract awards |
| Tarmeez · Ministry of Industry | National product catalogue, 3153 of 12946 factories |
| Saudi Made | Local content certificate |
| Local Content Authority | Local content calculation methodology |
| GASTAT | Imports by product code |
| Company site and registry | Catalogue, certificates, commercial register |

A good researcher spends one afternoon and comes back with an honest page on **one factory**.

---

## 7 · So why has nobody done it?

# Nobody has done it because it takes five years.

One factory needs a full day, and **13,000 factories** need five years.

## And the moment you finish, it is out of date!

Which is why it is a multi-million riyal consulting project, not a product.

---

## 8 · So what is the fix?

*Interstitial slide, colours inverted: orange ground, black type.*

# So what is the fix?

---

## 9 · So how do we solve it?

# Simple. We hire a team.

Four people. Here is what each of them does **the moment a purchase request is raised in a company system**.

| The Coordinator | The Detective | The Auditor | The Advisor |
|---|---|---|---|
| Understands the request and pools it | Finds who can supply it | Verifies and classifies | When nobody can |

---

## 10 · The Coordinator

**Understands what the item is, and pools matching requests into one**

| Company A | Company B | Company C |
|---|---|---|
| 2-inch ball valve | `BALL VLV 2IN SS` | `Valve, ball, stainless` |
| 12 units | 40 units | 5 units |

↓

**One pooled request**, `HS 8481.80` · 57 units now · 40,000 a year historically

# The demand was scattered because nobody could see it was the same request.

---

## 11 · The Detective

**One per candidate supplier**

**Input:** Pooled demand: 40,000 units a year across nine companies

Reads company websites, checks the commercial register, sees who won similar contracts on Monafasat, finds certificates and reads catalogues.

And the question changes: not "who makes this?" but **"who can serve this volume?"** That opens up suppliers a single company order could never justify.

# Output: candidates who can serve the volume, each with its evidence.

---

## 12 · The Auditor

**One per claim**

**Input:** The candidates the Detective found

It does not strike the trader out, it **classifies** them: manufacturer, assembler, authorised distributor, or trader. Each class carries its own weight in local content.

Because a local trader is still a local supplier: they employ Saudis and their margin stays in the country. Lower local content, not zero.

# Output: every supplier with its class, its evidence, and a confidence score.

---

## 13 · The Advisor

**One per gap**

**The gap:** Pooled demand nobody in the Kingdom can supply

What is it worth in riyals a year? Do the regulations mandate localising it? And which existing factory could supply it if anyone ever asked?

And here is the difference: the demand is now **pooled and forward-looking**, a volume that justifies investment, not a one-off order.

# Nobody ever asked.

---

## 14 · The reveal

Four people. To cover 12,946 factories you would need thousands of them, and you would still wait five years.

## But we do not hire them.
# We run them.

And you run four thousand as easily as four. Five years becomes under ten hours.

`AI agents` · `Two minutes per factory, not a day` · `24 hours, no stopping` · `They never forget a thing`

---

## 15 · The map

# Not answers. A map.

*Two faces: what the Kingdom can supply, and what the portfolio buys, pooled*

`Public sources → The Detective → The Auditor → THE MAP`
`Purchase requests → The Coordinator → THE MAP`

**THE MAP:** capability + pooled demand

**Outputs:** Vetted supplier list · Gap register · Coverage rate

---

## 16 · The journey of one request

*From a small line in one company system to a deal a local supplier can serve*

| | Does | Produces |
|---|---|---|
| **Purchase request** | Raised in the company system | 2-inch ball valve, 12 units |
| **The Coordinator** | Understands it and pools it with others | Pooled demand: 40,000 a year |
| **The Detective** | Finds who can serve the volume | Candidates, each with evidence |
| **The Auditor** | Verifies and classifies each candidate | Manufacturer · assembler · distributor · trader |
| **The Advisor** | When nobody can supply it | An investment case at pooled scale |

↓ **THE MAP**, two faces: what the Kingdom can supply, and what the portfolio buys, pooled

*and stays there for good. So the next request starts from a bigger map, and bigger pooled demand.*

**Outputs:**
- **Vetted supplier list**, with their class and evidence, and the demand split between them if no one can carry it alone
- **Gap register**, pooled demand with its annual value, waiting for the first to supply it
- **Coverage rate**, how much of the portfolio spend we can buy from here

---

## 17 · The math

| | The old way | KAMIN |
|---|---|---|
| **Time** | Five years | Under 10 hours |
| **Cost** | Millions of riyals | ≈ $0.30 per factory, under $4,000 in total |
| **Freshness** | A report born stale | Updates itself |

# The expensive part was never the thinking. It was the number of days.

> The $0.30 figure is an estimate. Run 10 real factories and quote the measured cost before saying it on stage.

---

## 18 · The close

# Musahama knows who registered.
# KAMIN knows who never raised a hand.

The first is a list of names that raised their hand. The second is a map of what actually exists, including everyone who never raised theirs.

*We are not a replacement for the platform. We are the layer underneath it.*

---

## 19 · Who we are

# Three people. Thousands of agents.

The team building KAMIN.

| Mohammed Shalabi | Ali Bamuallim | Abdulaziz Al Harthi |
|---|---|---|
| Owner · AI-Native Principle Engineer | Product Consultant | Data Engineer / DevOps |

---

## Appendix · Without us (outside the numbering)

How the question gets answered today: `Purchase request → The buyer → The approved supplier list → A decision in minutes`

**And "nobody makes it locally" is not a fact, it is "nobody on my list."**
