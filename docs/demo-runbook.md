# Demo runbook

Seven minutes, seven steps, one laptop. Everything below is local: Postgres in Docker, `qwen3.5:9b` and `bge-m3` on Ollama, Tavily for the live search. The only thing that needs the network is step 6, and it has a recording.

## Before the room

1. `orbctl start` (Docker), then `ollama list` must show `qwen3.5:9b` and `bge-m3`. `OLLAMA_HOST` in `.env` must point at the machine that runs them.
2. `.env` present at the repository root with `DATABASE_URL`, `OLLAMA_HOST`, `TAVILY_API_KEY`.
3. `bun run db:up`, then `bun run demo`. Open http://localhost:3000. The header shows the coverage figure; if it shows 0%, the database is empty: restore the snapshot (below).
4. Open the four tabs in order: `/`, `/orders/<first manufacturing gap>`, `/suppliers?family=valve`, the recorded cold-miss supplier (below). Warm each once so the first click on stage is instant.
5. Say the disclosure once, out loud, before step 2: demand is simulated on real Comtrade import values under real PIF portfolio names, at a 12% portfolio share. It is also in the footer of every screen.

## The seven steps

| # | Say | Show |
|---|---|---|
| 1 | The number PIF has never been able to state | Header: coverage at the stated specification, with the type-verified and category-level figures under it. Say all three: nearly every order has a verified plant declaring the subheading, seven in ten have a supplier that names the product type, none is verified at size and rating. That ladder is the blind spot, and the Detectives and the Specifier climb it |
| 2 | Purchase requests, pooled | `/orders/<id>` from a ledger row: the lines in their ERP formats and the envelope they pooled into |
| 3 | Who can supply it, at spec, with evidence | Same page, the match table: class, verdict, tier, score |
| 4 | The map, filtered | `/suppliers?family=valve&verdict=supported`, then a supplier page; OMB Valves (`/suppliers/tarmeez%3A91094`) shows what the documents say about the company, part of UBSCO Group, and Rainbow (`/suppliers/tarmeez%3A43073`) shows a catalogue-specified flange line |
| 5 | The Auditor killing a claim | `/evidence/548d017f-0072-4923-867d-98cfb925cf8f`, KSB Pumps Arabia's declared check valves, refuted on the real lens with killer evidence; any row with verdict refuted in `/suppliers?verdict=refuted` works too |
| 6 | The cold miss | The recorded supplier's page, Play recording; or a pending supplier's page, Investigate live |
| 7 | The gap ledger and an investment case | `/?kind=supply_gap`, open the 4-inch carbon steel butt weld tee, read the Advisor's case and its pivot candidates; then `/?kind=covered` to show that "covered" means declared, spec unverified |

## Cold miss suppliers

- **Recorded:** `tarmeez:72825` (مصنع صمامات بارق للصناعة, Bareq valve factory). Its page shows Play recording; the recording is `apps/web/public/cold-miss/tarmeez:72825.json`.
- **Live:** `tarmeez:91094` (OMB Valves Saudi Arabia, AlKhobar), still pending for the Detective; the Specifier already attached one catalogue line to it, which the live run will build on. Investigate live runs the Detective and the Auditor and reloads the page when the verdicts land, four to six minutes on the local model (the recordings ran 244 to 339 seconds).
- Any other pending supplier works for the live path: `select s.id, s.name_en from suppliers s join capabilities c on c.supplier_id = s.id where s.detective_status = 'pending' and c.hs6 like '8481%' order by random() limit 5;`

## If something fails

- **Network down:** step 6 plays the recording. Say so: "this is the recording of the same run, made this morning".
- **Ollama slow or down:** every screen reads from Postgres and works without it; only step 6 needs the model.
- **Database empty or wrong:** `bun run db:restore data/dump/kamin.sql.gz`, about a minute, then refresh.
- **Port 3000 taken:** `pkill -f "next dev"` and `bun run demo` again.

## The three questions

1. *How is this different from MUSAHAMA?* Registration-based platforms see only who opted in. This is outside-in: it reads registries, chambers, certifications and the open web, and hands the result to the platform.
2. *How do I know these capabilities are real?* Step 5. Every capability carries its evidence chain with tiers, and the Auditor's three lenses with the one that refuted it.
3. *What happens after the gap ledger?* A prepared package handed to the buyer, who sends the RFQ from their own system. KAMIN never sends it.
