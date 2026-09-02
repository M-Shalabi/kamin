# Coordinator spike, 2026-09-02, ollama:qwen3.5:9b

Twenty hand-picked bilingual demand lines from `packages/core/eval/demand-lines.json`, run end to end through the Coordinator (normalise, two-stage HS retrieval, anchor) on a local Qwen 3.5 9B via Ollama on a 16 GB Mac, with bge-m3 embeddings. Raw results: `packages/core/eval/results/` (gitignored).

**Result: 20/20 HS anchors correct, attribute score 0.986, 15 pooled orders from 20 lines, 17.6 minutes, about 53 seconds per line.** The plan's checkpoint was 15 of 20.

## Pooled orders with more than one line

- 848180: L01, L02, L03 (quantity now 57)
- 848180: L04, L05 (quantity now 16)
- 841370: L12, L13 (quantity now 5)
- 730723: L16, L17 (quantity now 170)

The one attribute miss is L11, where the model set the material of a "DI/SS/EPDM" butterfly valve to "other" with grade "DI/SS" instead of ductile iron.

## Per line

| id | line | predicted | expected | ok | attrs | confidence | s |
|---|---|---|---|---|---|---|---|
| L01 | صمام كروي من الفولاذ المقاوم للصدأ ٢ بوصة، ضغط ٤٠ بار | 848180 | 848180 | yes | 4/4 | 1 | 58 |
| L02 | BALL VLV 2IN SS316 CL150 FLGD | 848180 | 848180 | yes | 6/6 | 1 | 52 |
| L03 | Valve, ball, stainless, 2 inch, full bore | 848180 | 848180 | yes | 3/3 | 1 | 51 |
| L04 | صمام بوابة حديد زهر DN100 PN16 بشفة | 848180 | 848180 | yes | 5/5 | 1 | 54 |
| L05 | GATE VALVE 4" CI PN16 FLANGED BS5163 | 848180 | 848180 | yes | 5/5 | 1 | 55 |
| L06 | صمام عدم رجوع (لا رجعي) نحاس ١ بوصة ملولب | 848130 | 848130 | yes | 4/4 | 1 | 51 |
| L07 | CHK VLV SWING 6IN CS CL300 RF | 848130 | 848130 | yes | 4/4 | 1 | 52 |
| L08 | صمام أمان ضغط 10 بار مدخل ½ بوصة للغلاية | 848140 | 848140 | yes | 3/3 | 1 | 51 |
| L09 | PRESSURE REDUCING VALVE 3/4 IN BRASS 16 TO 3 BAR | 848110 | 848110 | yes | 3/3 | 1 | 50 |
| L10 | صمام فراشة DN200 PN10 جسم حديد زهر مطاوع، قرص ستانلس، مقعد EPDM | 848180 | 848180 | yes | 4/4 | 1 | 55 |
| L11 | BUTTERFLY VALVE WAFER 8" DI/SS/EPDM PN10 W/ GEAR OPERATOR | 848180 | 848180 | yes | 4/5 | 1 | 55 |
| L12 | مضخة طرد مركزي أفقية 50 م3/س، رفع 40 م، 15 كيلوواط، 380 فولت | 841370 | 841370 | yes | 1/1 | 1 | 54 |
| L13 | PUMP CENTRIFUGAL END SUCTION 50M3/HR 40M HEAD 15KW 3PH | 841370 | 841370 | yes | 1/1 | 1 | 54 |
| L14 | غطاس مياه صرف 5 حصان ٣ فاز مع عوامة | 841370 | 841370/841381 | yes | 1/1 | 0.95 | 53 |
| L15 | DOSING PUMP DIAPHRAGM 20 L/H 10 BAR PVDF HEAD 220V | 841350 | 841350/841381 | yes | 2/2 | 0.95 | 55 |
| L16 | كوع 90 درجة ستانلس ستيل 316L قطر 2 بوصة لحام تناكبي SCH40 ASTM A403 | 730723 | 730723 | yes | 5/5 | 1 | 53 |
| L17 | ELBOW 90 LR 2" SCH40 SS316L BW A403 WP316L | 730723 | 730723 | yes | 5/5 | 1 | 54 |
| L18 | شفة عمياء (بليند) كربون ستيل 4 بوصة كلاس 150 RF ASTM A105 | 730791 | 730791 | yes | 4/4 | 1 | 52 |
| L19 | فلنجة ستانلس ٣١٦ عنق لحام ٦ بوصة ١٥٠# ، 8 حبات | 730721 | 730721 | yes | 5/5 | 1 | 53 |
| L20 | NIPPLE HEX BRASS 1/2" NPT | 741220 | 741220 | yes | 4/4 | 1 | 47 |

The `qwen3:8b` A/B did not run: the model was no longer on the machine. Re-run with `COORDINATOR_MODEL=ollama:qwen3:8b bun run spike` after `ollama pull qwen3:8b`.
