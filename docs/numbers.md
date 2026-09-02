# Numbers as measured

Generated 2026-09-02 20:07 UTC by `bun run numbers` from the live database. Regenerate after any run; never edit the values by hand.

| Number | Value | Produced by |
|---|---|---|
| Suppliers on the map | 15,025 | `select count(*) as v from suppliers where id not like 'test:%'` |
| … declared in Tarmeez | 14,873 | `select count(*) as v from suppliers where in_tarmeez and id not like 'test:%'` |
| … in the Madinah chamber directory (MLCP) | 435 | `select count(*) as v from suppliers where in_mlcp` |
| … Made in Saudi certified | 281 | `select count(*) as v from suppliers where in_made_in_saudi` |
| … absent from Tarmeez (found through MLCP, Made in Saudi or the hunt) | 152 | `select count(*) as v from suppliers where not in_tarmeez and id not like 'test:%'` |
| … discovered by the long-tail hunt, in no registry | 10 | `select count(*) as v from suppliers where source = 'hunt'` |
| Suppliers with a capability in the valve, pump and fitting slice | 418 | `select count(distinct supplier_id) as v from capabilities where left(hs6, 4) in ('8481', '8413', '7307') and supplier_id not like 'test:%'` |
| Capabilities on the map | 51,937 | `select count(*) as v from capabilities where supplier_id not like 'test:%'` |
| … in the slice | 734 | `select count(*) as v from capabilities where left(hs6, 4) in ('8481', '8413', '7307') and supplier_id not like 'test:%'` |
| Distinct tariff codes with a registered product (Tarmeez) | 4,836 | `select count(*) as v from products` |
| Evidence records, Tier 1 | 1,387 | `select count(*) as v from evidence e join capabilities c on c.id = e.capability_id where e.tier = 1 and c.supplier_id not like 'test:%'` |
| Evidence records, Tier 2 | 52,016 | `select count(*) as v from evidence e join capabilities c on c.id = e.capability_id where e.tier = 2 and c.supplier_id not like 'test:%'` |
| Evidence records, Tier 3 | 305 | `select count(*) as v from evidence e join capabilities c on c.id = e.capability_id where e.tier = 3 and c.supplier_id not like 'test:%'` |
| Evidence records, Tier 4 | 0 | `select count(*) as v from evidence e join capabilities c on c.id = e.capability_id where e.tier = 4 and c.supplier_id not like 'test:%'` |
| Suppliers investigated by a Detective | 80 | `select count(*) as v from suppliers where detective_status = 'ok' and id not like 'test:%'` |
| … Detective runs that errored | 3 | `select count(*) as v from suppliers where detective_status = 'error'` |
| Slice capabilities audited | 314 | `select count(*) as v from capabilities where audit_run_id is not null and left(hs6, 4) in ('8481', '8413', '7307')` |
| … supported | 200 | `select count(*) as v from capabilities where verdict = 'supported' and left(hs6, 4) in ('8481', '8413', '7307')` |
| … refuted | 15 | `select count(*) as v from capabilities where verdict = 'refuted' and left(hs6, 4) in ('8481', '8413', '7307')` |
| … still pending after audit | 104 | `select count(*) as v from capabilities where audit_run_id is not null and verdict = 'pending' and left(hs6, 4) in ('8481', '8413', '7307')` |
| Supported capabilities backed by Tier 1 or 2 (count toward coverage) | 183 | `select count(*) as v from capabilities c where c.verdict = 'supported' and left(hs6, 4) in ('8481', '8413', '7307') and exists (select 1 from evidence e where e.capability_id = c.id and e.tier <= 2)` |
| Supported by class: manufacturer | 178 | `select count(*) as v from capabilities where verdict = 'supported' and class = 'manufacturer' and left(hs6, 4) in ('8481', '8413', '7307')` |
| Supported by class: assembler | 0 | `select count(*) as v from capabilities where verdict = 'supported' and class = 'assembler' and left(hs6, 4) in ('8481', '8413', '7307')` |
| Supported by class: authorised distributor | 7 | `select count(*) as v from capabilities where verdict = 'supported' and class = 'authorised_distributor' and left(hs6, 4) in ('8481', '8413', '7307')` |
| Supported by class: trader | 15 | `select count(*) as v from capabilities where verdict = 'supported' and class = 'trader' and left(hs6, 4) in ('8481', '8413', '7307')` |
| Saudi imports, HS 8481, latest Comtrade year | USD 2,915,944,769 | `select coalesce(sum(value_usd), 0) as v from imports where left(hs6, 4) = '8481' and year = (select max(year) from imports)` |
| Saudi imports, HS 8413, latest Comtrade year | USD 1,314,705,479 | `select coalesce(sum(value_usd), 0) as v from imports where left(hs6, 4) = '8413' and year = (select max(year) from imports)` |
| Saudi imports, HS 7307, latest Comtrade year | USD 749,105,718 | `select coalesce(sum(value_usd), 0) as v from imports where left(hs6, 4) = '7307' and year = (select max(year) from imports)` |
| Comtrade year used | 2024 | `select max(year) as v from imports` |
| Portfolio share of national imports assumed for the simulated demand | 12.0% | `PORTFOLIO_IMPORT_SHARE in packages/core/src/demand/generate.ts` |
| Simulated demand lines | 96 | `select count(*) as v from demand_lines where simulated` |
| Portfolio companies named | 12 | `select count(distinct portco) as v from demand_lines where simulated` |
| Annual value of the simulated demand | USD 357,910,812 | `select coalesce(sum(annual_value_usd), 0) as v from demand_lines where simulated` |
| Demand lines resolved by the Coordinator to an HS anchor | 96 | `select count(*) as v from demand_lines where simulated and hs6 is not null` |
| Demand lines pooled into orders | 96 | `select count(*) as v from demand_lines where simulated and pooled_order_id is not null` |
| Pooled orders | 72 | `select count(*) as v from pooled_orders where title not like 'test %'` |
| … covered (a supported manufacturer or assembler at spec, Tier 1 or 2) | 70 | `select count(*) as v from pooled_orders where gap_kind = 'covered' and title not like 'test %'` |
| … manufacturing gaps (supplied locally, nobody manufactures it) | 0 | `select count(*) as v from pooled_orders where gap_kind = 'manufacturing_gap' and title not like 'test %'` |
| … supply gaps (no supported capability of any class) | 2 | `select count(*) as v from pooled_orders where gap_kind = 'supply_gap' and title not like 'test %'` |
| Coverage at the stated specification, spend-weighted share of pooled annual demand (the headline figure) | 0.0% | `packages/core/src/match/coverage.ts (bun run coverage)` |
| … orders covered at the stated specification | 0.0% | `same` |
| Type-verified coverage: the supplier names the order's product type with nothing in conflict, rating and size not yet confirmed | 70.5% | `same` |
| … orders with the product type verified | 75.0% | `same` |
| Category-level coverage: a verified supplier declares the subheading with nothing in conflict, spec unverified | 98.9% | `same` |
| … orders covered at category level | 97.2% | `same` |
| Orders with a supplier only at category level (the Specifier's next queue) | 16 | `select count(*) as v from pooled_orders where spec_status = 'category' and title not like 'test %'` |
| Capabilities carrying attributes written by the Specifier from catalogues | 22 | `select count(distinct c.id) as v from capabilities c join evidence e on e.capability_id = c.id join runs r on r.id = e.run_id where r.role = 'specifier'` |
| Annual value in manufacturing gaps | USD 0 | `select coalesce(sum(annual_value_usd), 0) as v from pooled_orders where gap_kind = 'manufacturing_gap' and title not like 'test %'` |
| Annual value in supply gaps | USD 4,086,002 | `select coalesce(sum(annual_value_usd), 0) as v from pooled_orders where gap_kind = 'supply_gap' and title not like 'test %'` |
| Gaps on the announced Mandatory List tranche | 0 | `select count(*) as v from pooled_orders where gap_kind <> 'covered' and mandatory and title not like 'test %'` |
| Investment cases written by the Advisor | 2 | `select count(*) as v from gap_cases` |
| Matches written | 864 | `select count(*) as v from matches m join pooled_orders o on o.id = m.pooled_order_id where o.title not like 'test %'` |
| Discovery lift: suppliers absent from Tarmeez with a supported capability in the slice | 7 | `select count(distinct c.supplier_id) as v from capabilities c join suppliers s on s.id = c.supplier_id where not s.in_tarmeez and s.id not like 'test:%' and c.verdict = 'supported' and left(hs6, 4) in ('8481', '8413', '7307')` |
| Discovery lift: pooled orders whose best match is a supplier absent from Tarmeez | 0 | `select count(distinct m.pooled_order_id) as v from matches m join capabilities c on c.id = m.capability_id join suppliers s on s.id = c.supplier_id join pooled_orders o on o.id = m.pooled_order_id where m.rank = 1 and not s.in_tarmeez and o.title not like 'test %'` |
| advisor: seconds per run on ollama:qwen3.5:9b (3 runs) | 63 s, 1,342 tokens in, 983 out | `runs and run_steps (bun run cost)` |
| auditor: seconds per run on ollama:qwen3.5:9b (361 runs) | 22 s, 1,061 tokens in, 262 out | `runs and run_steps (bun run cost)` |
| coordinator: seconds per run on ollama:qwen3.5:9b (123 runs) | 69 s, 4,570 tokens in, 356 out | `runs and run_steps (bun run cost)` |
| detective: seconds per run on ollama:qwen3.5:9b (97 runs) | 98 s, 5,697 tokens in, 934 out | `runs and run_steps (bun run cost)` |
| specifier: seconds per run on ollama:qwen3.5:9b (40 runs) | 51 s, 2,679 tokens in, 346 out | `runs and run_steps (bun run cost)` |

## Reconciliation with the deliverables' older figures

- **14,873 plants in the Tarmeez catalogue API** against the **12,946 operating factories** headline: the catalogue holds every registered plant, including traders and non-operating ones, so the two populations differ by definition. Say "14,873 registered plants" for the map and pin 12,946 to its Ministry source before using it.
- **59,611 product registrations** collapse to the distinct tariff codes above; the old 52,824 (Arabic view) and 12,641 (English view) counts are retired.
- **Coverage** is spend-weighted over the simulated demand, which is anchored on Comtrade values at the portfolio share above. It is a property of this demand set, not a national statistic.
- **Seconds per run** are on a 16 GB laptop with one local Ollama serialising every call. Paid-model cost per run is printed by `bun run cost`.

