# Supplier Data Schema

The interchange shape KAMIN populates and exchanges with MUSAHAMA. Not a submission form: there is no login, no upload and no approval queue, because a supplier never fills this in. See `supplier_data_point.md` for what fills each field, and `docs/CONTEXT.md` for the vocabulary.

Naming: snake_case, one object per section. Repeatable groups are arrays.

Shared types:
- `sourced<T>`: `{ value: T, source_url, source_type, tier, fetched_at }`. **Every asserted field is sourced.** A value with no source is not written
- `tier`: `0` buyer-attested · `1` third-party verified · `2` registry declaration · `3` self-published · `4` inferred
- `visibility`: `public` | `portfolio`. Tier 0 is always `portfolio`
- `yes_no`: boolean

## 1. company_profile

| Variable | Type | Required | Validation / Notes |
|---|---|---|---|
| vendor_name_en | sourced\<string\> | yes | 2-200 chars |
| vendor_name_ar | sourced\<string\> | yes | 2-200 chars |
| brand_name | sourced\<string\> | no | Max 100 |
| cr_number | string | yes | 10 digits, unique. **Join key across every source** |
| cr_registration_date | sourced\<date\> | no | ISO 8601 |
| cr_expiry_date | sourced\<date\> | no | ISO 8601 |
| vat_number | sourced\<string\> | no | 15 digits, starts and ends with 3 |
| office_address | sourced\<string\> | no | Max 300 |
| country_code | enum | yes | ISO 3166-1 alpha-2 |
| city_id | fk | no | Cities reference list |
| region | sourced\<string\> | no | From Tarmeez or MODON |

## 2. contact_points

Reachability, not accounts. The outreach cascade routes on `reachability`.

| Variable | Type | Required | Validation / Notes |
|---|---|---|---|
| email | sourced\<string\> | no | Valid email |
| phone | sourced\<string\> | no | E.164 |
| whatsapp_number | sourced\<string\> | no | E.164, confirmed on first send |
| website_url | sourced\<string\> | no | Valid URL |
| reachability | enum | system | `email_only`, `phone_only`, `both`, `neither`. Computed |
| preferred_channel | enum | no | `email`, `whatsapp`, `voice`. Learned from which stage answered |

## 3. supplier_profile

| Variable | Type | Required | Validation / Notes |
|---|---|---|---|
| is_sme | sourced\<boolean\> | no | Monsha'at classification |
| establishment_year | sourced\<integer\> | no | 1900 to current year |
| total_staff | sourced\<integer\> | no | HRSD or GOSI where public |
| saudization_rate | sourced\<decimal\> | no | 0 to 100. HRSD |
| turnover_last_year_sar | sourced\<decimal\> | no | Declared only, never estimated |
| contractor_grade | sourced\<string\> | no | Saudi Contractors Authority |
| lc_signals | object[] | system | Evidenced facts bearing on local content. Never a score |
| g1_score | decimal | no | Only from declared G1 inputs. Null is correct and common |

`supplier_type` is deliberately absent here. Class is held **per capability**, not per company.

## 4. capabilities

Array. The unit the Auditor judges.

| Variable | Type | Required | Validation / Notes |
|---|---|---|---|
| capability_id | uuid | system | |
| product_title | string | yes | |
| hs6 | string | no | HS anchor, goods only |
| unspsc_segment_code | string | no | 2 digits |
| unspsc_family_code | string | no | 4 digits, child of segment |
| unspsc_class_code | string | no | 6 digits, child of family. **The MUSAHAMA interchange key** |
| unspsc_assigned_by | uuid | system | The capability-audit run |
| spec_attrs | object | no | Size, rating, material, connection, standard |
| class | enum | yes | `manufacturer`, `assembler`, `authorised_distributor`, `trader` |
| **lead_time_days** | integer | no | |
| **lead_time_source** | enum | no | `stated`, `engagement`, `inferred`. An engagement beats a catalogue |
| **quality_standards** | object[] | no | `{ standard, certifier, expires_at, tier }` |
| verdict | enum | system | `pending`, `supported`, `refuted` |
| confidence | decimal | system | 0 to 1, always rendered with its reasons |
| evidence | sourced[] | yes | At least one. A capability without evidence is not a capability |
| origin | enum | system | `musahama`, `portco`, `tarmeez`, `mlcp`, `made_in_saudi`, `detective`, `hunt` |

Constraint: unique on (supplier_id, hs6, lower(product_title)).

## 5. engagements

Array. The incumbent baseline, Tier 0, `visibility: portfolio`.

| Variable | Type | Required | Validation / Notes |
|---|---|---|---|
| engagement_id | uuid | system | |
| portco | string | yes | PIF portfolio reference list |
| capability_id | uuid | no | Set once what was supplied is resolved |
| hs6 / unspsc_class_code | string | no | |
| description | string | yes | As the buyer recorded it |
| status | enum | yes | `current`, `past`, **`approved_not_used`** |
| first_at / last_at | date | no | |
| value_sar | decimal | no | May be withheld by the portco |
| **lead_time_days_actual** | integer | no | Delivered lead time. The strongest lead-time evidence held |
| outcome | enum | no | `delivered`, `disputed`, `terminated` |
| source | enum | yes | `musahama`, `portco_master`, `erp` |

`approved_not_used` is load-bearing: an approved vendor never bought from is not an active supplier, and merging the two overstates the baseline.

## 6. documents

Links to where evidence lives, not uploads. Location decides tier before content does: a certificate on the supplier's own site is Tier 3, the same certificate on the certifier's page is Tier 1.

| Variable | Type | Notes |
|---|---|---|
| cr_certificate | sourced\<url\> | Ministry of Commerce |
| industrial_licence | sourced\<url\> | Expected where class includes manufacturer |
| made_in_saudi_certificate | sourced\<url\> | |
| lcgpa_certificate | sourced\<url\> | |
| certifications | sourced\<url\>[] | ISO, SASO, sector-specific |
| gosi_certificate / jadeer_certificate | sourced\<url\> | HRSD, Monsha'at |
| catalogues | sourced\<url\>[] | Read by the Specifier |

## 7. awards

| Variable | Type | Notes |
|---|---|---|
| award_name / award_year / award_provider | sourced | |

## 8. confirmations

What the supplier told us, only ever through the outreach cascade, and only ever confirming something already on the record.

| Variable | Type | Notes |
|---|---|---|
| capability_id | uuid | What was asked about |
| question | enum | `capability`, `volume`, `rung_3_expand`, `rung_4_partner`, `lead_time`, `certifications` |
| channel | enum | `email`, `whatsapp`, `voice` |
| answer | enum | `yes`, `no`, `conditional`, **null** |
| conditions | text | Where the answer was conditional |
| answered_at | timestamptz | |

**A null answer means unanswered, and is never rendered as a no.**

## 9. outreach

| Variable | Type | Notes |
|---|---|---|
| stage | smallint | 1 email, 2 whatsapp, 3 voice |
| sent_at / responded_at | timestamptz | |
| outcome | enum | `registered`, `confirmed`, `declined`, `bounced`, `no_response` |
| cost_usd | decimal | Per contact, for the measured cost report |

Unique on (supplier_id, stage). Stage N runs only on stage N-1 non-responders; a supplier with no email skips stage 1 rather than waiting it out.

## 10. metadata

| Variable | Type | Notes |
|---|---|---|
| supplier_id | string | CR number where known, else generated |
| **layer** | enum | `0` known, `1` registered elsewhere, `2` unfound. What discovery lift counts |
| source flags | boolean | in_musahama, in_portco_master, in_tarmeez, in_made_in_saudi, in_mlcp, in_hrsd, in_moc, in_sca |
| created_at / updated_at | timestamptz | |

No `status` and no `profile_completion_pct`. Both belong to a registration workflow, which is MUSAHAMA's job and not ours.

## TypeScript

```ts
type Tier = 0 | 1 | 2 | 3 | 4;
type Visibility = "public" | "portfolio";

interface Sourced<T> {
  value: T;
  source_url: string;
  source_type: string;
  tier: Tier;
  visibility: Visibility;
  fetched_at: string;
}

type SupplierClass =
  | "manufacturer"
  | "assembler"
  | "authorised_distributor"
  | "trader";

interface QualityStandard {
  standard: string;
  certifier?: string;
  expires_at?: string;
  tier: Tier;
}

interface Capability {
  capability_id: string;
  product_title: string;
  hs6?: string;
  unspsc_segment_code?: string;
  unspsc_family_code?: string;
  unspsc_class_code?: string;
  spec_attrs: Record<string, unknown>;
  class: SupplierClass;
  lead_time_days?: number;
  lead_time_source?: "stated" | "engagement" | "inferred";
  quality_standards: QualityStandard[];
  verdict: "pending" | "supported" | "refuted";
  confidence?: number;
  evidence: Sourced<string>[];
  origin: string;
}

interface Engagement {
  engagement_id: string;
  portco: string;
  capability_id?: string;
  description: string;
  status: "current" | "past" | "approved_not_used";
  first_at?: string;
  last_at?: string;
  value_sar?: number;
  lead_time_days_actual?: number;
  outcome?: "delivered" | "disputed" | "terminated";
  source: "musahama" | "portco_master" | "erp";
}

interface Confirmation {
  capability_id: string;
  question:
    | "capability"
    | "volume"
    | "rung_3_expand"
    | "rung_4_partner"
    | "lead_time"
    | "certifications";
  channel: "email" | "whatsapp" | "voice";
  /** null means unanswered. Never render it as a refusal. */
  answer: "yes" | "no" | "conditional" | null;
  conditions?: string;
  answered_at?: string;
}

interface Supplier {
  supplier_id: string;
  layer: 0 | 1 | 2;
  company_profile: CompanyProfile;
  contact_points: ContactPoints;
  supplier_profile: SupplierProfile;
  capabilities: Capability[];
  engagements: Engagement[];
  documents: Documents;
  confirmations: Confirmation[];
  outreach: OutreachAttempt[];
  created_at: string;
  updated_at: string;
}
```
