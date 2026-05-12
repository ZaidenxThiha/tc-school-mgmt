# Data Inventory — file-by-file profile

Auto-generated from a scan of `/T&CBusinessModel/`. 33 Excel files, 7 logical groups.

> **Note (2026-05-07):** EDU School is out of scope for this build. Any sheets/rows tagged EDU (e.g. the `EDU School Fee` tabs in daily KPay files; `EDU Class Fee` lines in income statements; `EDU Teacher Salary` in the annual file) will be **skipped** during import and logged to `etl_skipped_rows` for traceability.

## Group totals

| Group | Files | Purpose |
|---|---|---|
| Students & attendance | 12 | Per-level rosters + Sat/Sun attendance grids |
| Daily income (cash + KPay) | 8 | Day-by-day fee receipts, two channels |
| Monthly income statements | 5 | One workbook per month + an ESL summary |
| Opening costs / price book | 3 | Stocked items, supplier orders, master prices |
| Event budgets | 2 | Thingyan, Awarding ceremony |
| Annual financial statements | 2 | May 2025 → April 2026 rollups |
| Other (counts, T-shirt sizing, rosters) | 1 | `2026 ESL Student Monthly Receive.xlsx` |

## Group A — Students & attendance (12 files)

### A1. Per-level workbooks under `2026 T& C Students_ list & Attendance Record/`

`CAE`, `Early Childhood`, `FCE`, `Flyers`, `KEY`, `Movers`, `Nursery`, `PET`, `Pre-Starters`, `Starters` (10 files).

Common shape:

- **Total Count** sheet: `Class | Total ss | Active | Break for 1 month | Left`.
- One sheet **per section** (= per time-slot/online split). Examples observed:
  - `KEY (7:45-9:45)`, `KEY (10-12)`, `KEY (3:15-5:15)`, `KEY Online (10-12)`
  - `Early Childhood (1-3)`, `Early Childhood (3:15-5:15)`
  - `FCE (7:45-9:45)`, `FCE (10-12)`, `FCE (1-3)`, `FCE Online (7:45-9:45)`
  - `Flyers (1-3)`, `Flyers (10-12)`, `Flyers (3:15-5:15)`, `Flyers (7:45-9:45)`, `Flyers Online (7:45-9:45)`
  - `Movers (1-3)`, `Movers (10-12)`, `Movers (3:15-5:15)`, `Movers Online (3:15-5:15)`
  - `Nursery (10-12)`, `Nursery (7:45-9:45)`, `Nursery Online (1-3)`
  - `CAE (10-12)`, `CAE (3:15-5:15)`, `CAE Online (1-3)`
  - …plus any `Class4`/template sheets which we ignore.

Per-section sheet layout:

```
Row 0: <Class Name>   <Class Label>            <Month>
Row 1: CT Name         <Teacher>                <date1> <date2> ...
Row 2: No. | Myanmar Name | English Name | Viber No. | Phone No. | Status | Sat | Sun | Sat | Sun ...
Row 3+ : student rows; True/False per session date; Status in {Active, Break for 1 month, Left}
```

**Teachers observed**: Tr Ei Mon Phyu, Tr Han, Tr Hlaing Hnin Oo + Tr Zuu Zuu, Tr Hlaing(Sat) + Tr Ei Mon Kyaw(Sun), Tr Htet/Tr ZarChi, Tr James, Tr May Phu, Tr Saw, Tr Swan Htet / Tr Su Htet, Tr Thae Hsu, Tr Zarchi, Tr Eric / Tr Mia, Tr Jimmy, Tr Scarlett, Tr Cherry.

### A2. `2026 T&C Early Childhood Students_ list & Attendance List_.xlsx` and `2026 T&C Nursery Students_ list & Attendance List_.xlsx`

Single-section variants. Same shape as A1.

## Group B — Daily income (8 files)

### B1. KPay daily transactions (4 files: Jan / Feb / March / April)

Filename pattern: `2026 <Month>  Daily K Pay Transcation.xlsx`. Sheets:

- **Summary** — class-level rollup (Class Fee, Book, ID, T-shirt, Fine/Discount, Guide Fee, Total).
- **K Pay Daily Transcation** — raw KPay export, columns: `Transaction Date and Time, Student MM Name, Student EN Name, Class, Payment Type, Amount`.
- **Daily Income K Pay** — accountant-rekeyed: `Date, MM Name, EN Name, Class, ESL Fee, Book Fee, ID Card, T-Shirt, Fine, Guide Fee, Month`.
- **ESL Class Name** — same data sliced by class.
- **Utilities Price** — price book per level.
- **EDU School Fee** — separate stream (Year 4, KG, etc.).
- **May Fee** (April file only) — pre-collected fees for the next month.

### B2. Cash daily income (2 files: Feb, March, April; Jan in `2026 Jan ESL Opening Daily Cash Income.xlsx`)

Filenames: `2026 <Month>  ESL  Daily Income Cash.xlsx` and `<Month> ESL Daily Income.xlsx`. Sheets:

- **ESL Summary**, **Daily Transcation**, **ESL Class Name**, **ESL Price**.

## Group C — Monthly income statements (5 files)

`January / February / March / April Income Statement.xlsx`. Each has:

- **General Expense Summary** — Income vs Outcome rollup.
- **General Expense** — ledger lines: `Date, Description, Account Name, Chart Of Account, Income Cash, Income K Pay, Outcome Cash, Outcome K Pay`.
- **Office Expense Summary** — per-account totals.
- **Office Expense** — ledger lines: `Date, Description, Income, Account Name, Qty, Price, Amount`.

`All Months Income Summary (ESL).xlsx` — `Jan ESL`, `Feb ESL`, `March ESL` sheets, each holding the Cash + KPay totals per class.

Chart-of-Account categories observed:

- Teacher Salary
- Teaching Supply
- Monthly Operating Expense / Monthly Operation Expense / Monthly Opreation Expense (typo variants — canonicalise)
- Initial Capital & Major Operating Costs
- One-time Capital & Large Operational Expense
- Initial Minor Operating Cost
- One-time Minor Expense / One time minor Expense
- Internet & Communication Expense
- Government Tax
- Event
- Personal Expense
- Special Case
- Other Expense
- Drinking Water, Delivery & Transportation, Office Stationery (under Office Expense)

## Group D — Opening costs / price book (3 files)

### D1. `2026 ESL Confirm Price.xlsx`

| Sheet | Content |
|---|---|
| Summary | Per-level: Class Fee, Textbook, T-Shirt, ID Card, Utilities (1st/2nd), Total amounts (new vs old) |
| Textbook Price | Per-textbook cost + retail |
| Textbook Order Price List | First-order price list per supplier |
| T Shirt | Sizes (Baby XL, S, M, L, XL, etc.), purchase + confirm price |
| ID Card | Components: Lanyard, ID Card, ID Card Holder |

Confirmed prices (Class Fee + Textbook + T-Shirt + ID Card; old-student total in parentheses):

- Early Childhood: 90,000 + 50,000 + 15,000 + 7,000 → **162,000 new** (147,000 old)
- Nursery: 90,000 + 70,000 + 15,000 + 7,000 → **182,000 new** (167,000 old)
- Pre-Starter: 90,000 + 85,000 + 15,000 + 7,000 → **197,000 new** (182,000 old)
- Starter: 100,000 + 50,000 + 15,000 + 7,000 → **172,000 new** (157,000 old)
- (Movers / Flyers / KEY / PET / FCE / CAE: same pattern; values not yet inventoried)

### D2. `2026 ESL Opening Cost.xlsx`

Total opening textbook spend: ~₭25,631,950.

Sheets: 1st Order, Textbook Cost, 2nd order, 3rd order, T Shirt, ESL Accessories.

Suppliers: **Kuu Kuu** (₭8,896,100 first order), **Baby Union** (₭2,269,800), **Icon Kids** (₭2,519,000+).

ESL accessories include: blank books, student chairs (₭23,000 × 40 = ₭920,000), tables, etc.

### D3. `2026 Summer Opening Cost.xlsx`

| Sheet | Content |
|---|---|
| Textbook | English L1+L2 books + worksheets |
| Summer Income | Feb + March income for English / Math / Art & Fitness |

Summer income observed:

- Feb 2026: English 1,830,000 · Math 1,080,000 · Art & Fitness 1,120,000
- March 2026: English 1,080,000 · Math 1,080,000 · Art & Fitness 840,000

## Group E — Event budgets (2 files)

- `2026 Thingyan Festival Cost.xlsx` — total budget **₭1,836,600**. Items: artificial grass, palm leaves (with delivery fees), shop names + addresses captured.
- `2026 Awarding Budget_.xlsx` — total estimated budget **₭15,843,525**. Items: trophies (150 × 6,000), gold medals (10 × 6,000), plastic medals (146 × 4,500), …

## Group F — Annual financial statements (2 files)

### F1. `Annual Statement of Office Expense in Thazin & Cherry.xlsx`

- **Annual Summary**: per-category totals (₭8,872,700 grand total) — Drinking Water 1,117,300; Delivery 763,300; Office Stationery 1,131,700; …
- **From 2025 May to 2026 April Det**: monthly breakdown matrix.

### F2. `Thazin & Cherry Oveall Cost (From 2025 May to 2026 April).xlsx`

Eight sheets including monthly income, expense, and net-profit rollups per quarter and the annual summary. Observed annual income lines:

- ESL Class Fee (Cash) ₭259,599,000
- ESL Class Fee (Q Pay) ₭265,847,300
- EDU Class Fee (Cash) ₭274,660,000

These are the truth-source numbers the post-import validation must match.

## Group G — Other (1 file)

### `2026 ESL Student Monthly Receive.xlsx`

| Sheet | Content |
|---|---|
| Student Count (Feb to April) | per-class Active / Left / Break columns × 3 months |
| Student Count (May to July) | future-month skeleton |
| Sheet9 | March-only with class fee × count |
| Student Changes | month-over-month delta |
| T Shirt Count | per-level × per-size opening + closing |
| Early Childhood, Nursery, Pre-Starter, Starter, Mover, Flyer, KEY, PET, FCE, CAE | per-level full rosters with month-by-month status, Myanmar + English name, Viber, guardian phone, guardian name |

This file is rich in guardian-phone data and is **the best source for `guardians.full_name`** during the historical import.

---

## Data-quality notes that affect the import

1. **Student-name spelling drift** — same student across files spelled slightly differently. Match key: `(myanmar_name, primary_phone)`.
2. **Account-name typos** — three spellings of "Monthly Operating Expense" exist. Canonicalise.
3. **Class labels** — sometimes `KEY (1-3)`, sometimes `key`, sometimes `KEY Online (10-12)`. Parser must be tolerant.
4. **Multiple phones in one cell** — split on `/`, `,`, `;`.
5. **Mid-sheet header repeats** — some workbooks repeat the header row mid-sheet for readability; skip these.
6. **Empty/sum rows** — spreadsheets contain decorative blank rows and `Total` rows; filter by checking for student name / non-zero amount.
7. **Date variants** — `1.4.2026`, `2026-04-01`, native Excel datetime — accept all three.
8. **EDU stream is intermingled** — EDU school fees appear in `EDU School Fee` tabs inside ESL workbooks. Treat as same `payments` table, different `sections.level_id`.
9. **Pre-paid fees** — April daily file has a `May Fee` tab. Import as `invoices` for May with no payment yet (or payment dated April but billing month May).
10. **KPay sender names** are **not always students** — sometimes guardians. Match KPay txn → student via guardian phone fallback.
