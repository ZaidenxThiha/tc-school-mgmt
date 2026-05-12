# ETL Mapping — Excel → Supabase

This document specifies, **column-by-column**, how every Excel sheet in the workspace maps to Supabase tables. The loader will be a Python script using `openpyxl` + `supabase-py` (service-role key), executed once for the historical import and then archived.

## Order of operations

1. **Reference data first**: `levels` (seeded), `teachers`, `chart_of_accounts` (seeded), `discount_types` (seeded), `suppliers`, `products`.
2. **Sections** (parsed from class labels in the student attendance files).
3. **Guardians** + **Students** (de-duplicated by Myanmar name + phone). **Skip EDU students** (any sender/class label containing `Year 4`, `KG`, or appearing only in `EDU School Fee` tabs).
4. **Enrolments** (1 row per student per section per year).
5. **Class sessions** + **Attendance marks** (each date column = 1 session).
6. **Fee schedule** (from the Confirm Price file). **Multi-period support**: when later prices change, append a new row with `effective_from` set to the change date and close the old row by setting its `effective_to`.
7. **Student discounts** — read once from spreadsheets if any are flagged; otherwise leave empty for now.
8. **Daily income** → `invoices` + `invoice_lines` + `payments`. EDU rows are skipped; only ESL + Summer go in.
9. **KPay raw** → `kpay_transactions` (then run matcher to link with payments).
10. **Monthly income statements** → `ledger_entries`. EDU income lines (if any) skipped.
11. **Opening costs / orders** → `products`, `suppliers`, `purchase_orders`, `po_items`, **and an `inventory_movements` row of `direction='IN', reason='purchase'` for every PO item**.
12. **T-shirt opening counts** (from `2026 ESL Student Monthly Receive.xlsx → T Shirt Count`) → `inventory_movements` with `reason='opening_balance'`.
13. **Teacher salaries** (from monthly statements + annual file) → `teacher_payslips` rows (one per teacher per month) **plus** an aggregate ledger entry under `ESL Teacher Salary` / `Admin Teacher Salary`.
14. **Events** → `events`, `event_budget_items`.
15. **Run validation gates** (see §3 of master plan).

## File-by-file mapping

### A. Student attendance files (12 files)

`2026 T& C Students_ list & Attendance Record/<LEVEL> 2026 Ss Lists and Attendance_.xlsx`
plus `2026 T&C Early Childhood / Nursery Students_ list & Attendance List_.xlsx`.

Each section sheet's structure:

| Excel cell | Meaning | Target |
|---|---|---|
| Row 0, Col B | Class label (`KEY (7:45-9:45)`) | parse into `sections.level_id` (lookup), `sections.time_slot`, `sections.is_online` |
| Row 0, Col C | Month label (`February`) | informational only |
| Row 1, Col B | Teacher (`Tr Han`, possibly co-teacher) | `teachers.short_name` (split on `+` or `/`); link via `section_teachers` |
| Row 1, Col C+ | Date columns (already datetime) | one row in `class_sessions` per date |
| Row 2 | Header `No. \| Myanmar Name \| English Name \| Viber No. \| Phone No. \| Status \| Sat \| Sun \| ...` | (skip) |
| Row 3+ Col A | sequential No. | `students.external_id` |
| Row 3+ Col B | Myanmar Name | `students.myanmar_name` (de-dup) |
| Row 3+ Col C | English Name | `students.english_name` |
| Row 3+ Col D | Viber No. | `guardians.viber_number` |
| Row 3+ Col E | Phone No. (may be `09xxx/09xxx`) | `guardians.phone_primary`, `phone_secondary` |
| Row 3+ Col F | Status (`Active` / `Break for 1 month` / `Left`) | `students.current_status` (`Break for 1 month` → `Break`); also `enrolments.status` |
| Row 3+ Col G+ | Per-date `True`/`False` | `attendance_marks.status` (`Present` / `Absent`) |

Special: the `Total Count` summary sheet is **read-only validation** — confirm `v_section_active_count` matches it after the import.

### B. ESL daily income files (8 files)

#### B1. `… Daily K Pay Transcation.xlsx` → `K Pay Daily Transcation` sheet (raw)

| Excel column | Target |
|---|---|
| Transaction Date and Time | `kpay_transactions.txn_at` |
| Student Name (Myanmar) | `kpay_transactions.sender_mm` |
| Student Name (English) | `kpay_transactions.sender_en` |
| Class | `kpay_transactions.raw_class` |
| Payment Type | `kpay_transactions.payment_type` |
| Amount | `kpay_transactions.amount` |
| (filename) | `kpay_transactions.source_file` |

#### B2. `… Daily Income K Pay` / `Daily Transcation` (re-keyed) sheet

Each row → 1 invoice + 1 payment.

| Excel column | invoices / invoice_lines | payments |
|---|---|---|
| Date | `invoices.billing_month` (start of month), `payments.paid_at` | – |
| Myanmar Name + English Name | resolve to `students.id` | `payments.student_id` |
| Class | resolve to `sections.id` | – |
| ESL Fee | line `kind='class_fee'` | – |
| Book fee | line `kind='book'` | – |
| ID Card | line `kind='id'` | – |
| T-shirt | line `kind='tshirt'` | – |
| Discount / Fine | line `kind='discount'` or `'fine'` | – |
| Guide Fee | line `kind='guide'` | – |
| (sum) | `invoices.total_amount` | `payments.amount` |
| (filename) | – | `payments.channel` = `kpay` if from a "K Pay" file else `cash` |

#### B3. `Utilities Price` / `ESL Price` (within daily income) → `fee_schedule`

Use the **most-recent** April file as the active price book; older sheets archived.

#### B4. `EDU School Fee` (within Feb daily KPay) — **SKIP**

EDU School is out of scope. Loader logs these rows to `etl_skipped_rows` (a side-table for traceability) and continues.

#### B5. `May Fee` (within April daily KPay) → `invoices` (status=`open`) for May, no payment yet

These are advance bookings.

### C. Monthly income statements (4 files + 1 summary)

`January / February / March / April Income Statement.xlsx`.

#### C1. `General Expense` sheet → `ledger_entries`

| Excel column | Target |
|---|---|
| Date | `entry_date` |
| Description | `description` |
| Account Name | (informational) |
| Chart Of Account | `account_id` (canonicalise) |
| Income Cash | `income_cash` |
| Income K Pay | `income_kpay` |
| Outcome Cash | `expense_cash` |
| Outcome K Pay | `expense_kpay` |

`source` = `'GeneralExpense'`; `source_file` = filename.

#### C2. `Office Expense` sheet → `ledger_entries`

| Excel column | Target |
|---|---|
| Date | `entry_date` |
| Description | `description` |
| Income | (typically blank) |
| Account Name | `account_id` (lookup by group_name) |
| Qty | `qty` |
| Price | `unit_price` |
| Amount | `expense_cash` (assume cash unless flagged) |

`source` = `'OfficeExpense'`.

#### C3. Summary sheets → validation only

Used to confirm post-import totals.

### D. `All Months Income Summary (ESL).xlsx` — validation only

Confirms per-class income matches sum of `invoice_lines` per `billing_month`.

### E. Opening costs (3 files)

#### E1. `2026 ESL Confirm Price.xlsx`

| Sheet | Target |
|---|---|
| Summary | `fee_schedule` (one row per level, `effective_from = 2026-01-01`) |
| Textbook Price | `products` (kind=`textbook`) — `cost_price`, `retail_price`, `level_id` |
| Textbook Order Price List | `purchase_orders` + `po_items` |
| T Shirt | `products` (kind=`tshirt`, `size`) |
| ID Card | `products` (kind=`id_card`) for Lanyard / ID Card / ID Holder |

#### E2. `2026 ESL Opening Cost.xlsx`

| Sheet | Target |
|---|---|
| 2026 ESL Opening Cost (summary) | aggregates — validation only |
| Textbook Cost | `purchase_orders` + `po_items` (1st order) |
| 2nd order | `purchase_orders` + `po_items` |
| 3rd order | `purchase_orders` + `po_items` |
| T Shirt | `purchase_orders` + `po_items` |
| ESL Accessories | `products` (kind=`accessory`) + a single PO with mixed items |

Suppliers seen: **Kuu Kuu**, **Baby Union**, **Icon Kids** → seed `suppliers`.

For every `po_items` row inserted, also insert a matching `inventory_movements` row (`direction='IN'`, `reason='purchase'`, `qty=po_items.qty`).

#### E3. `2026 Summer Opening Cost.xlsx`

| Sheet | Target |
|---|---|
| Textbook | `products` (kind=`textbook`, summer levels) + a PO |
| Summer Income | `ledger_entries` (Income, account=`Summer Program Fee`, two months: Feb + March) |

### F. Event budgets (2 files)

#### F1. `2026 Thingyan Festival Cost.xlsx`

- One row in `events` (`name='Thingyan Festival 2026'`, `event_date=…`, `budget=1,836,600`).
- Per-line items → `event_budget_items`.

#### F2. `2026 Awarding Budget_.xlsx`

- One row in `events` (`name='Awarding Ceremony 2026'`, `budget=15,843,525`, `is_estimate=true`).
- Per-line items → `event_budget_items`.

### G. Annual statements (2 files)

Both used for **validation only** — confirm:

- Sum of `ledger_entries` per month matches the annual P&L.
- Sum of `Office Expense` ledger lines matches the office-expense annual rollup.

### H. `2026 ESL Student Monthly Receive.xlsx`

| Sheet | Target |
|---|---|
| Student Count (Feb to April) | validation: matches `v_section_active_count` |
| Student Count (May to July) | (future months — informational) |
| Student Changes | computed from enrolment status changes — validation only |
| T Shirt Count | seed `products` (kind=`tshirt`) per size, then insert one `inventory_movements` row per size with `reason='opening_balance'` and `qty = opening`. The closing column is reconstructed from movements. |
| Per-level rosters (Early Childhood, Nursery, …, CAE) | redundant with the dedicated attendance files; use only as guardian-phone enrichment |

## Teacher salary mapping (new in v1.1)

The annual file `Thazin & Cherry Oveall Cost.xlsx` and each monthly Income Statement contain Teacher Salary lines. The loader does **two things at once** for each row:

1. Insert one **`teacher_payslips`** row per teacher per month. The annual file aggregates by `ESL Teacher Salary`, `EDU Teacher Salary` (skip), `Admin Teacher Salary`. Where the per-teacher breakdown is not available in the spreadsheet, allocate the bulk to a placeholder teacher named `(unallocated)` per role; the owner reassigns inside the app later.
2. Insert one **`ledger_entries`** row with `account_id` = `ESL Teacher Salary` / `Admin Teacher Salary` so the P&L still ties out.

Both representations co-exist — the salary page in the app surfaces them as two tabs.

## Cleanup rules

| Issue | Rule |
|---|---|
| Multiple phone numbers in one cell | split on `/`, `,`, `;`; first → primary, second → secondary |
| Spelling variants of the same student | match on (myanmar_name, guardian_phone_primary); maintain `name_aliases.csv` for manual overrides |
| Account-name typos | mapping table: `Monthly Operation Expense` / `Monthly Opreation Expense` → `Monthly Operating Expense`; `One time minor Expense` → `One-time Minor Expense` |
| Currency separators | strip `,` and trailing decimals; cast to bigint |
| Date formats | accept `YYYY-MM-DD`, `D.M.YYYY`, native Excel datetime |
| Class labels | regex `^(?P<lvl>[A-Za-z &-]+?)( Online)? ?\((?P<slot>\d.*?)\)$` |
| Empty / sum / blank rows | skip rows where all of (myanmar_name, english_name) are null |
| Headers repeated mid-sheet | skip rows whose first cell equals the header |

## Validation queries (run post-import)

```sql
-- Per-month KPay total vs Excel
select date_trunc('month', paid_at)::date as m, sum(amount)
from payments where channel='kpay' group by 1 order by 1;

-- Per-month cash total vs Excel
select date_trunc('month', paid_at)::date as m, sum(amount)
from payments where channel='cash' group by 1 order by 1;

-- Active students per section vs Total Count sheet
select level_code, time_slot, is_online, active_count
from v_section_active_count order by 1, 2;

-- Monthly P&L vs annual file
select month, income, expense, net from v_monthly_pl order by month;
```

Targets: each must match the corresponding Excel value within ±10,000 MMK. Anything larger gets logged to a `etl_discrepancies` table for manual review.
