# Does Anybody Here Make This?

*KAMIN, explained simply.*

---

There is one question at the centre of this whole thing.

**"Does anybody in Saudi Arabia make this?"**

That's it. It sounds like something you should be able to type into a search box and get an answer.

Nobody can answer it.

---

## The situation

Saudi Arabia's Public Investment Fund owns more than 150 companies. Those companies buy things, steel, valves, cables, chemicals, packaging, medical supplies, machinery, thousands of different items, in enormous quantities, every single day.

A lot of it comes from abroad.

Some of it comes from abroad for a good reason: nobody in the Kingdom makes it. Some of it comes from abroad for a frustrating reason: somebody two hours down the road makes it, and the person buying simply didn't know they existed.

And some of it comes from abroad for a third reason, the sneakiest one: they *were* found, they are local and real, and they still do not fit. Their lead time is longer than that company can carry, or their quality sits under its bar. And the bar is not the same from one portfolio company to the next.

**Nobody can tell those three cases apart.** That is the entire problem, and everything below is about fixing it.

---

## Why nobody can answer

Two halves of the question are broken. You need both to work.

### Half one: ✋ we only know whoever raises their hand

The way anyone finds out what a Saudi factory can produce is that the factory *tells* someone. It signs up to a platform, fills in a form, lists its products.

So every supplier directory that exists, including PIF's own MUSAHAMA platform, is a list of companies that raised their hand.

Picture a phone book where you only get listed if you mail in a form. Now think about who actually mails in forms: large companies with sales teams whose literal job is to mail in forms. The workshop in Al-Kharj that has been machining precision parts for twenty years and gets all its work by word of mouth? Not in the phone book. Never will be.

**And that's exactly the supplier you were looking for**, because the big ones with sales teams already found you.

And this isn't a hunch. The Kingdom has **12,946 factories**. The national product catalogue lists **3,153** of them. **9,793 factories, 76%, don't appear even there**, let alone on anyone's approved-vendor list.

### Half two, the same item under three different names

The second half is stranger, and PIF has said it out loud: they have *limited visibility into aggregated demand.*

150+ companies. 150+ separate purchasing systems. Two languages. Free text typed by whoever was at the keyboard.

One company writes `صمام كروي ٢ بوصة`. Another writes `BALL VLV 2IN SS`. A third writes `Valve, ball, stainless, 2 inch`.

Same object. Three strings of text that a computer sees as completely unrelated.

So "what does the portfolio buy, in total?" has no answer either. Not because it's a secret, because it was never written down in one language.

---

## The thing that changed

Here's why this is possible now and wasn't five years ago.

**All the evidence is already public. It's just scattered.**

- A factory won a government contract → that's in the public tender record.
- A factory registered its products with the Ministry of Industry → that's a public catalogue with **3,153 factories and roughly 52,000 products** in it, out of **12,946 factories in the Kingdom**, so it covers about a quarter.
- Certifications are public. The company's own website is public.
- What Saudi Arabia imports, broken down by product category, is public.

A good researcher could take one factory, spend an afternoon with those sources, and write you an honest page about what it can genuinely produce.

The catch has always been arithmetic. There are **12,946 factories** in the Kingdom, and nobody has 12,946 afternoons.

**That's what changed.** An AI agent does that afternoon in about two minutes.

### The part where the numbers matter

Mapping a country's industrial capability is normally a consulting engagement. Teams of researchers, surveys mailed to factories, phone calls, months of fieldwork, **millions of riyals**. And the moment it's delivered, it starts rotting, because it's a photograph of a moving thing.

Run the numbers on doing it with agents instead:

> **12,946 factories × roughly $0.30 of AI compute each ≈ under $4,000.**

Run 50 agents at once and the whole Kingdom is mapped in under ten hours. And because rerunning it is just money, and not much money, **it refreshes itself instead of rotting.**

That's the whole bet. The expensive part of this problem was never the thinking. It was the sheer number of afternoons.

---

## First: what is "the map"?

Not a geographic map. **One large record with two sides**:

- **Supply:** every provider in the Kingdom, what they can supply, how they're classified, and the evidence behind every line.
- **Demand:** everything the portfolio buys, normalized and pooled, with its annual volume.

**The gap is the distance between the two sides.**

And the record **persists**. The agents don't answer and forget; they add what they found, so it's there for whoever asks next.

## How it works: four workers and one purchase request

The system doesn't wait to be asked. It starts **the moment a purchase request is raised in a company's system**, and it reads purchase history to learn what recurs across the portfolio.

### 1. The Coordinator

A request arrives in either language: *"2-inch stainless ball valve, 12 units."* They work out what the object actually is and tags it with an HS code, the same numbering customs uses.

**And here's the unlock:** because they can see that three different descriptions are one object, they can **pool them**. One company wants 12, another wrote `BALL VLV 2IN SS` and wants 40, a third is on a spreadsheet and wants 5. Out comes **one aggregated order**: 57 units now, 40,000 a year once you read the history.

> Demand was fragmented because nobody could see it was the same demand.

### 2. The Detective

They take the aggregated order and hunt: company websites, the commercial register, who has won comparable contracts on Etimad, certifications, catalogues.

**The question has changed.** Not *"who makes this?"* but **"who could serve 40,000 units a year?"**, which opens up suppliers a single company's order would never have justified.

One rule: never say anything without saying where you learned it.

### 3. The Auditor, twice

She is the only one who works in two places on the map.

**After the Detective**, they verify each candidate **to classify, not to strike off**: manufacturer, assembler, authorised distributor, or trader, each with a different local-content weight.

Because a local trader **is still a local supplier**, Saudi employees, local assets, margin that stays in the country. Lower local content, not zero. That gradient is exactly what LCGPA's methodology measures, so classifying beats gatekeeping. They also stamp each capability with its **UNSPSC** code, which is the code MUSAHAMA speaks, so the two registers can understand each other.

**After the Coordinator**, they do something different: they read the requesting company's own bar, and hand back the map ranked *for that company*. Lead time it can carry, standards it requires, class it accepts. This is the third case from the opening, caught before it wastes anyone's week.

### 4. The Advisor

They work where the answer is **nobody**, and they do not stop at the gap. They hand back a ladder, cheapest rung first:

1. **Buy it**, if one supplier can serve the volume today.
2. **Split it** between several, so the size of the order doesn't exclude the small.
3. **Invest.** Go to the supplier and ask: *could you, if we expanded your capacity?* Capex, against a contract for the volume.
4. **Partner.** *Could you bring a global manufacturer in with you?* A joint venture, and knowledge transfer.
5. **Localise.** Nobody can, so the Fund brings the industry itself into the Kingdom.
6. **Import**, and log the gap with its annual value.

Rungs 3 and 4 are **asked, not inferred**, and an unanswered rung is never treated as a no.

**This is where aggregation pays off, and it's also the difference between a buyer and an owner.** A purchasing department can only note a gap. An owner can capitalise it. And what makes rungs 3 to 5 financeable is the pooled, multi-year volume: a one-off order finances nothing.

## What comes out

**1. A vetted provider list**, classified and evidenced. And if no single provider can take the whole order, it's **split across several**, which is how a large pooled order becomes servable by small local players instead of excluding them.

**2. The gap ledger**, pooled demand with its annual value, waiting for the first supplier who can serve it. An investment memo, not a complaint.

**3. Coverage**, what share of portfolio spend could be bought here today.

## Why you can believe it

Not all evidence is equal, so the system doesn't pretend it is. Four levels:

| Level | What it means | How much it counts |
|---|---|---|
| **Strongest** | They won and delivered a government contract | Proof, not a claim |
| **Strong** | They registered the product with a government body | Accountable, but still their own words |
| **Weak** | Their website says so | Marketing copy |
| **Weakest** | We worked it out ourselves | Never counts on its own |

So when the system says it's confident, that isn't a feeling. It means: *backed by a contract award and a ministry registration, with nothing contradicting it.* You can click it and look.

---

## What we're honest about

**Some of the best data is locked.** The register of officially certified local-content companies, the national product conformity database, detailed customs records, all of it exists, none of it is public. We know exactly what's behind those doors and exactly what it would add. With access, this gets dramatically better. Without it, it still works.

**The demand side is simulated, deliberately.** Real purchasing data is confidential and nobody is going to hand it over. So we generate realistic demand, but anchored to **genuine Saudi import figures**, so every riyal on screen traces back to a real trade statistic. We say this out loud rather than hiding it.

**We go deep before we go wide.** A few hundred factories investigated properly beats three thousand skimmed. Breadth is just more money and more time, the hard part is proving the method works.

---

## The one-line version

> **MUSAHAMA knows who registered.**
> **KAMIN knows who never raised a hand.**

One is a list of people who put their hand up. The other is a map of what's actually out there, including everyone who never did.

We're not replacing the platform. We're the layer underneath it, feeding it the manufacturers it was never going to find on its own, and telling it plainly where the Kingdom can't yet make something and what it would take to change that.
