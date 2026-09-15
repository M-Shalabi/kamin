# Supplier Profile Data Points

**What this is.** The target shape of one supplier record on the map, aligned field for field with MUSAHAMA so records can move both ways.

**What this is not.** A form. KAMIN never asks a supplier for anything and holds no registration: no login, no upload, no approval queue. The agents populate every field below from internal and public evidence, and a supplier's only destination is MUSAHAMA's own registration, reached through the outreach cascade. See `docs/CONTEXT.md` for the vocabulary.

**Every populated field carries three things:** the value, the source that asserted it, and that source's evidence tier. A field with no source is not on the record.

Format: Field · How KAMIN fills it

---

## 1. Company Profile

- Vendor Name (EN) · Commercial register, Tarmeez
- Entity Name in Arabic · Commercial register, Tarmeez
- Brand or Abbreviated Name · Company site, catalogues
- CR Number · Commercial register. **The join key across every source**
- CR Registration Date · Commercial register
- CR Expiry Date · Commercial register
- Company's VAT Number · ZATCA lookup where public
- Company General Email · Company site, Tarmeez, chamber listings
- Website URL · Discovery, search
- Main Office Address · Commercial register, MODON, company site
- Country / City / Postal Code · Registry, geocoded against MODON

## 2. Contact Points

Reachability, not user accounts. This is what the outreach cascade routes on: a supplier with no email on record enters at stage two rather than burning a five-day wait.

- Email · Registry, company site
- Phone / Mobile · Registry, company site, chamber listings
- WhatsApp-capable number · Inferred from mobile prefix, confirmed on first send
- Preferred channel · Learned from which stage they answered
- Reachability status · `email_only` · `phone_only` · `both` · `neither`

## 3. Supplier Profile

- Supplier Type · Per capability, not per company: manufacturer, assembler, authorised distributor, trader. Assigned by the capability audit
- SME · Monsha'at classification, headcount, turnover
- Experience / Reference · Awarded contracts on Monafasat, delivered engagements
- Establishment Year (in Saudi) · Commercial register
- Total Number of Staff · HRSD, GOSI where public
- Saudization rate · HRSD
- Turnover Last Calendar Year · Declared only. Never estimated
- Local Content · **LC signals**, never an invented score. A real G1 comes only from declared inputs
- Contractor grade · Saudi Contractors Authority, where the supplier is a contractor
- Goods and Services · UNSPSC Segment > Family > Class, assigned by the capability audit. Repeatable

## 4. Capabilities

The unit the Auditor judges. One row per product a supplier can supply, each carrying its own class, not one class for the whole company.

- Product / Service · Detective, then the Specifier reads catalogues for stated specifications
- HS anchor · Coordinator's resolution, for goods
- UNSPSC class · Capability audit. **The interchange key with MUSAHAMA**, and the only one of the two that expresses services
- Stated specification · Size, rating, material, connection, standard. From catalogues and datasheets
- Class · manufacturer · assembler · authorised distributor · trader
- **Lead time (days)** · Stated in catalogues, or measured from a delivered engagement, which is far stronger
- **Quality standards held** · ISO 9001, ISO 14001, API, SASO, sector-specific. Each with its certifier and expiry
- Verdict · supported or refuted
- Evidence · One or more, each with its tier and URL
- Confidence · Always shown with its reasons, never as a bare number

## 5. Engagements

The incumbent baseline. Tier 0, buyer-attested, and private to the portfolio.

- Portco · Which portfolio company
- Status · `current` · `past` · **`approved_not_used`**
- What was supplied · Description as the buyer recorded it, resolved to HS and UNSPSC
- Window · First and last engagement dates
- Value · Where the portco shares it
- **Actual delivered lead time** · The strongest lead-time evidence that exists
- Outcome · delivered · disputed · terminated

`approved_not_used` is deliberate. A vendor on an approved list nobody has ever bought from is a different fact from an active supplier, and merging them overstates the baseline.

## 6. Documents

Links to evidence, not uploads. KAMIN records where a document lives and what tier that location earns it. A certificate on the supplier's own site is Tier 3; the same certificate on the certifier's page is Tier 1.

- Commercial Registration · Ministry of Commerce
- Industrial Licence · Ministry of Industry, where a manufacturer
- Made in Saudi certificate · Saudi Made
- LCGPA Local Content certificate · LCGPA
- ISO / SASO / sector certifications · The certifier's own registry
- GOSI / Jadeer · HRSD, Monsha'at
- Catalogues and datasheets · The supplier's own site, read by the Specifier

## 7. Awards

- Name · Year · Provider · Source URL

## 8. What the supplier confirms

Only reached through the outreach cascade, and only ever a confirmation of something already on the record.

- Is this capability correct? · The capability-confirmation ping
- Can you serve this pooled volume? · Ladder rung 1
- Could you, if we invested in your capacity? · **Ladder rung 3**
- Could you bring a global manufacturer in, with technology transfer? · **Ladder rung 4**
- Standard lead time, confirmed
- Current certifications, confirmed

An unanswered question is not a no, and is never recorded as one.

## 9. System

- Supplier ID · CR number where known, else a generated key
- Layer · `0 known` · `1 registered elsewhere` · `2 unfound`. What drives discovery lift
- Source flags · in_musahama, in_portco_master, in_tarmeez, in_made_in_saudi, in_mlcp, in_hrsd, in_moc, in_sca
- Visibility · `public` or `portfolio` per field. Tier 0 evidence is always portfolio
- Fetched at / Updated at
