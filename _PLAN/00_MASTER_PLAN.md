# Thazin & Cherry English Training Centre
## Business Model + Database + Web App — Master Plan

**Version:** 1.0   **Date:** 2026-05-07   **Owner:** Thiha
**Stack decided:** Supabase (Postgres + Auth + RLS + Storage) · Next.js + `@supabase/ssr` · n8n (automation) · Vercel (hosting)
**Supabase project ref:** `ugjujibpbasskampuums`
**Audience:** Owner + admin/accounts staff (2–5 internal users)
**Currency:** MMK only (stored as `bigint`, no decimals)

**Setup commands (run in regular terminal, not in-app):**
```bash
# 1. Add the Supabase MCP server to your MCP client, pointed at:
#    https://mcp.supabase.com/mcp?project_ref=ugjujibpbasskampuums&features=docs,account,database,debugging,development,functions,branching,storage
# 2. Authenticate the "supabase" server in your MCP client.

# 3. Install Supabase agent skills (optional but recommended)
npx skills add supabase/agent-skills
```

Once authenticated, the Supabase MCP exposes tools for `database`, `functions`, `storage`, `branching`, etc. I'll use those in Phase 1+ to apply migrations and seed data.

---

## 1. Executive summary

Thazin & Cherry is an English training centre running:

- **ESL Cambridge ladder** — Early Childhood → Nursery → Pre-Starter → Starter → Movers → Flyers → KEY → PET → FCE → CAE.
- **Summer programs** — English, Math, Art & Fitness (3-month seasonal).
- **Events** — Awarding ceremony, Thingyan festival, etc.

> Note: EDU School is **out of scope** for this build — historical EDU rows in the spreadsheets will be skipped during import.

All data today lives in 33 Excel files split across student lists, attendance, daily income (cash + KPay), monthly income statements, opening costs, and an annual rollup (May 2025 → April 2026). Each spreadsheet is hand-maintained, so the same student can appear in 5+ places with slightly different spellings, and totals are recomputed manually every month.

This plan lays out, **without writing the app yet**:

1. What data we actually have (file-by-file inventory).
2. The business model in clean form (programs, fees, revenue, costs).
3. A normalized Postgres schema for Supabase.
4. An ETL plan to load every Excel file into the schema.
5. A web-app architecture using Supabase + Next.js + n8n.
6. A phased implementation roadmap.

The build itself is **Phase 2** — locked behind sign-off on this plan.

---

## 2. Data inventory (33 files, 7 groups)

### 2.1 Students & attendance — 12 files

| File | Sheets | What it holds |
|---|---|---|
| `2026 T&C Early Childhood Students_ list & Attendance List_.xlsx` | 1 | Early Childhood roster + Saturday/Sunday attendance |
| `2026 T&C Nursery Students_ list & Attendance List_.xlsx` | 1 | Nursery offline class roster + attendance |
| `2026 T& C Students_ list & Attendance Record/` (10 files) | per-level | One workbook per level: **Early Childhood, Nursery, Pre-Starters, Starters, Movers, Flyers, KEY, PET, FCE, CAE**. Each has a `Total Count` summary sheet plus 1 sheet per **time-slot section** (e.g. `KEY (7:45-9:45)`, `KEY (10-12)`, `KEY (3:15-5:15)`, `KEY Online (10-12)`). |

Each section sheet has the same shape:

```
Row 0: Class Name | <e.g. KEY (7:45-9:45)> | <month>
Row 1: CT Name    | <Teacher>             | date1 | date2 | ...
Row 2: No. | Myanmar Name | English Name | Viber No. | Phone No. | Status | Sat | Sun | Sat | Sun ...
Row 3+ : <student rows> with True/False in date columns
```

- **Statuses observed:** `Active`, `Break for 1 month`, `Left`.
- **Class times observed:** `(7:45-9:45)`, `(10-12)`, `(1-3)`, `(3:15-5:15)`, plus `Online` variants.
- **Teachers observed:** Tr James, Tr Saw, Tr Han, Tr May Phu, Tr Jimmy, Tr Ei Mon Phyu, Tr Thae Hsu, Tr Zarchi, Tr Hlaing Hnin Oo, Tr Zuu Zuu, Tr Eric, Tr Mia, Tr Swan Htet, Tr Su Htet, Tr Scarlett, Tr Cherry. Some sections are **co-taught** (e.g. `Tr Hlaing(Sat) + Tr Ei Mon Kyaw(Sun)`).
- Date columns are **already typed as datetimes** in Excel — easy ETL.

### 2.2 ESL daily income — 8 files (Jan–Apr 2026, Cash + KPay)

Two flavours per month:

- `Daily K Pay Transcation.xlsx` — bank/wallet transfers.
- `ESL Daily Income Cash.xlsx` — over-the-counter cash.

Common sheets inside each workbook:

- `Summary` — class-by-class totals (Class Fee, Book, ID, T-Shirt, Discount/Fine, Guide Fee, Total).
- `K Pay Daily Transcation` — raw KPay export: `Transaction Date and Time | Student MM Name | English Name | Class | Payment Type | Amount`.
- `Daily Income K Pay` / `Daily Transcation` — accountant-rekeyed: `Date | MM Name | EN Name | Class | ESL Fee | Book Fee | ID Card | T-Shirt | Fine/Discount | Guide Fee | Month`.
- `ESL Class Name` — same data sliced by class.
- `Utilities Price` / `ESL Price` — the price book (see §2.4).
- `EDU School Fee` — separate stream for EDU School.
- `May Fee` (April file) — pre-collected fees for the next month.

### 2.3 Monthly income statements — 5 files

`January / February / March / April Income Statement.xlsx` and `All Months Income Summary (ESL).xlsx`. Every monthly file has 4 sheets:

- `General Expense Summary` — Income vs Outcome rollup, ESL Class Fee (Cash) vs (KPay).
- `General Expense` — line-by-line ledger: `Date | Description | Account Name | Chart Of Account | Income Cash | Income K Pay | Outcome Cash | Outcome K Pay`.
- `Office Expense Summary` — categorised office spend.
- `Office Expense` — line-by-line: `Date | Description | Income | Account Name | Qty | Price | Amount`.

`All Months Income Summary (ESL).xlsx` rolls the monthly per-class totals into one workbook (Jan ESL, Feb ESL, March ESL …).

### 2.4 Opening costs / price book — 3 files

| File | What's inside |
|---|---|
| `2026 ESL Confirm Price.xlsx` | Master price list per level: Class Fee, Textbook, T-Shirt, ID Card, Utilities-bundle, Discount, **New-student total** vs **Old-student total**. Plus textbook order list, T-shirt size matrix, ID card components. |
| `2026 ESL Opening Cost.xlsx` | Procurement: textbooks (1st/2nd/3rd order), T-shirts, ESL accessories (chairs, tables, blank books, etc.). Per-supplier costs (Kuu Kuu, Baby Union, Icon Kids). |
| `2026 Summer Opening Cost.xlsx` | Summer-program textbook list + Feb/March Summer Income (English / Math / Art & Fitness). |

### 2.5 Event budgets — 2 files

- `2026 Thingyan Festival Cost.xlsx` — items, qty, price, total (1.84M MMK).
- `2026 Awarding Budget_.xlsx` — trophies, medals, etc. (15.84M MMK estimated).

### 2.6 Annual financial statement — 2 files

- `Annual Statement of Office Expense in Thazin & Cherry.xlsx` — May 2025 → April 2026 office-expense rollup.
- `Thazin & Cherry Oveall Cost (From 2025 May to 2026 April).xlsx` — full-year P&L: 8 sheets covering income, expenses, and net-profit per month, plus the annual summary.

Income categories observed: ESL Class Fee (Cash), ESL Class Fee (Q Pay), EDU Class Fee (Cash), EDU Class Fee (Q Pay), Other Income.

Chart-of-accounts categories observed for expenses:

- Teacher Salary (ESL / EDU / Admin)
- Teaching Supply
- Monthly Operating Expense
- Monthly Operation Expense  *(typo variant)*
- Initial Capital & Major Operating Costs
- One-time Capital & Large Operational Expense
- Initial Minor Operating Cost
- One-time Minor Expense  *(also "One time minor Expense")*
- Drinking Water, Delivery & Transportation, Office Stationery, Internet & Communication Expense
- Government Tax
- Event
- Personal Expense
- Special Case
- Other Expense

→ **Note:** there are duplicate / mis-typed account names ("Monthly Operating Expense" vs "Monthly Operation Expense" vs "Monthly Opreation Expense"). ETL will need a canonical-mapping table.

### 2.7 Other — 1 file

`2026 ESL Student Monthly Receive.xlsx` — pivot of monthly student counts (Active / Left / Break) per class, T-shirt size counts, and full active-student rosters with guardian phone numbers per level.

---

## 3. Business model — clean reading of the data

### 3.1 Programs & sections

| Program | Levels (= price tier) | Section format |
|---|---|---|
| **ESL (Cambridge)** | Early Childhood, Nursery, Pre-Starter, Starter, Movers, Flyers, KEY, PET, FCE, CAE | One **Section** per (level, time-slot, online?) — e.g. `KEY (7:45-9:45)`, `KEY Online (10-12)`. ~30+ sections in total. |
| **Summer Program** | English / Math / Art & Fitness | Seasonal (Feb–April). 3-month school-fee + book-fee bundle. |
| **Events** | Thingyan, Awarding | Cost-only, no direct revenue. |

EDU School is excluded from this build (per your call).

### 3.2 Revenue model (per ESL student per month)

`Monthly invoice = Class Fee + Book Fee (one-off) + ID Card (one-off) + T-Shirt (one-off) + Guide Fee − Discount + Fine`

Two **utility bundles** are observable:

- **1st-time utilities** (new student): bundle of textbook + ID + T-shirt added on top of class fee.
- **2nd-time utilities** (existing student): smaller top-up.

Confirmed prices (from `2026 ESL Confirm Price.xlsx`):

| Level | Class Fee | Textbook | T-Shirt | ID | Old-student total | New-student total |
|---|---:|---:|---:|---:|---:|---:|
| Early Childhood | 90,000 | 50,000 | 15,000 | 7,000 | 147,000 | 162,000 |
| Nursery | 90,000 | 70,000 | 15,000 | 7,000 | 167,000 | 182,000 |
| Pre-Starter | 90,000 | 85,000 | 15,000 | 7,000 | 182,000 | 197,000 |
| Starter | 100,000 | 50,000 | 15,000 | 7,000 | 157,000 | 172,000 |
| (Movers / Flyers / KEY / PET / FCE / CAE) | … | … | … | … | … | … |

### 3.3 Payment streams

- **Cash** at the office.
- **KPay (Q Pay)** — bank/wallet transfers, exported as a daily transaction list with timestamp, sender names, and amount.

Reconciling KPay → student is currently a **manual matching step** (the accountant types the name into the daily-income sheet). The schema needs a `payments_unmatched` queue for KPay rows that don't yet line up with a student.

### 3.4 Cost structure (annual, May 2025 → April 2026)

Approximate composition of expenses:

- **Teacher salaries** (ESL + EDU + Admin) — biggest line, ~₭8–13M/month.
- **Monthly operating expenses** — utilities, rent, etc.
- **Teaching supply** — books, stationery for class.
- **Office expense** — drinking water, delivery, office stationery, internet (~₭8.87M for the year).
- **Initial / one-time capital** — opening-cost textbook orders (~₭25.6M for ESL alone), T-shirts, chairs, tables.
- **Events** — Thingyan, Awarding.
- **Government tax**, personal expense, other / special case.

### 3.5 Operational flow

```
Enrol student → assign to Section → bill 1st-time utilities
   → monthly: charge class fee (cash or KPay)
   → mark attendance per session (Sat/Sun classes)
   → status changes (Active / Break / Left) feed monthly count
   → daily incomes flow to General Expense ledger
   → monthly Income Statement → Annual roll-up
```

---

## 4. Database schema (Postgres / Supabase)

All amounts in **MMK as `bigint`**. All timestamps `timestamptz`. Naming: `snake_case`, plural tables.

### 4.1 ER overview

```
guardians 1───* students *──1 sections *──1 levels
                       │              │
                       *              *
                  attendance       enrolments
                       │              │
                  attendance_marks  invoices ──* invoice_lines
                                       │
                                       *
                                    payments  ←  kpay_transactions (raw)

expenses ──1 chart_of_accounts
events 1──* event_budget_items
products (textbook, t-shirt, id) ──* purchase_orders ──* po_items
```

### 4.2 Core tables

```sql
-- ─── Reference ────────────────────────────────────────────────
create table levels (
  id            smallserial primary key,
  code          text unique not null,        -- 'EARLY_CHILDHOOD','NURSERY',…,'CAE'
  name          text not null,
  display_order smallint not null
);

create table teachers (
  id          serial primary key,
  full_name   text not null,
  short_name  text not null,                 -- 'Tr James'
  is_active   boolean default true,
  notes       text
);

create table sections (
  id              serial primary key,
  level_id        smallint references levels not null,
  time_slot       text not null,             -- '7:45-9:45','10-12','1-3','3:15-5:15'
  is_online       boolean default false,
  label           text generated always as
                  ((select code from levels l where l.id = level_id)
                   || case when is_online then ' Online ' else ' ' end
                   || time_slot) stored,
  capacity        smallint,
  start_date      date,
  end_date        date,
  unique (level_id, time_slot, is_online)
);

create table section_teachers (              -- co-teaching supported
  section_id      int references sections on delete cascade,
  teacher_id      int references teachers on delete restrict,
  weekday_pattern text,                      -- 'Sat','Sun','Sat+Sun'
  primary key (section_id, teacher_id)
);

-- ─── People ───────────────────────────────────────────────────
create table guardians (
  id             serial primary key,
  full_name      text,
  phone_primary  text,
  phone_secondary text,
  viber_number   text,
  notes          text
);

create table students (
  id             serial primary key,
  external_id    text,                       -- the spreadsheet "Student ID"
  myanmar_name   text,
  english_name   text,
  date_of_birth  date,
  guardian_id    int references guardians,
  current_status text not null
                 check (current_status in ('Active','Break','Left','Prospect')),
  enrolled_at    date,
  left_at        date,
  notes          text
);

create table enrolments (                   -- student ↔ section, with history
  id             serial primary key,
  student_id     int references students on delete cascade,
  section_id     int references sections,
  start_date     date not null,
  end_date       date,
  status         text not null,             -- 'Active','Break','Left'
  unique (student_id, section_id, start_date)
);

-- ─── Attendance ───────────────────────────────────────────────
create table class_sessions (               -- one Saturday class, one Sunday class …
  id           serial primary key,
  section_id   int references sections,
  session_date date not null,
  notes        text,
  unique (section_id, session_date)
);

create table attendance_marks (
  session_id   int references class_sessions on delete cascade,
  student_id   int references students on delete cascade,
  status       text not null
               check (status in ('Present','Absent','Leave','Break')),
  marked_at    timestamptz default now(),
  primary key (session_id, student_id)
);

-- ─── Pricing ──────────────────────────────────────────────────
create table fee_schedule (                 -- price book, level-based, time-bounded
  id              serial primary key,
  level_id        smallint references levels,
  effective_from  date not null,
  effective_to    date,
  class_fee       bigint not null,
  textbook_fee    bigint default 0,
  tshirt_fee      bigint default 0,
  id_card_fee     bigint default 0,
  guide_fee       bigint default 0,
  default_discount bigint default 0
);

-- ─── Billing ──────────────────────────────────────────────────
create table invoices (
  id            bigserial primary key,
  student_id    int references students,
  section_id    int references sections,
  billing_month date not null,              -- first-of-month
  is_new_student boolean,
  total_amount  bigint not null,
  discount      bigint default 0,
  fine          bigint default 0,
  status        text default 'open'         -- 'open','paid','partial','void'
);

create table invoice_lines (
  id           bigserial primary key,
  invoice_id   bigint references invoices on delete cascade,
  kind         text not null,               -- 'class_fee','book','id','tshirt','guide','fine','discount'
  description  text,
  qty          numeric default 1,
  unit_price   bigint,
  amount       bigint not null
);

-- ─── Payments ─────────────────────────────────────────────────
create table payments (
  id              bigserial primary key,
  invoice_id      bigint references invoices,
  student_id      int references students,
  paid_at         timestamptz not null,
  amount          bigint not null,
  channel         text not null check (channel in ('cash','kpay','wave','bank','other')),
  kpay_txn_id     bigint references kpay_transactions,
  recorded_by     uuid references auth.users,
  note            text
);

create table kpay_transactions (            -- raw KPay export, one row per txn
  id            bigserial primary key,
  txn_at        timestamptz not null,
  sender_mm     text,
  sender_en     text,
  raw_class     text,                       -- as appears in the export
  payment_type  text,
  amount        bigint not null,
  source_file   text,
  matched       boolean default false,
  matched_payment_id bigint references payments
);

-- ─── Accounting ledger ────────────────────────────────────────
create table chart_of_accounts (
  id        smallserial primary key,
  category  text not null,                  -- 'Income','Expense'
  group_name text not null,                 -- e.g. 'Teacher Salary','Office Expense'
  parent_id smallint references chart_of_accounts,
  is_active boolean default true
);

create table ledger_entries (               -- general + office expense merged
  id            bigserial primary key,
  entry_date    date not null,
  description   text,
  account_id    smallint references chart_of_accounts,
  income_cash   bigint default 0,
  income_kpay   bigint default 0,
  expense_cash  bigint default 0,
  expense_kpay  bigint default 0,
  qty           numeric,
  unit_price    bigint,
  source        text,                       -- 'GeneralExpense','OfficeExpense'
  source_file   text,
  created_by    uuid references auth.users,
  created_at    timestamptz default now()
);

-- ─── Inventory & procurement ──────────────────────────────────
create table products (
  id           serial primary key,
  kind         text not null,               -- 'textbook','tshirt','id_card','accessory'
  name         text not null,
  level_id     smallint references levels,
  size         text,
  cost_price   bigint,
  retail_price bigint
);

create table suppliers (
  id   serial primary key,
  name text not null,
  contact text
);

create table purchase_orders (
  id          serial primary key,
  supplier_id int references suppliers,
  ordered_at  date,
  total_amount bigint,
  notes       text
);

create table po_items (
  id            bigserial primary key,
  po_id         int references purchase_orders on delete cascade,
  product_id    int references products,
  qty           numeric,
  unit_cost     bigint,
  amount        bigint
);

-- ─── Events ───────────────────────────────────────────────────
create table events (
  id          serial primary key,
  name        text not null,
  event_date  date,
  budget      bigint,
  actual_cost bigint,
  notes       text
);

create table event_budget_items (
  id        bigserial primary key,
  event_id  int references events on delete cascade,
  item      text,
  qty       numeric,
  unit_price bigint,
  amount    bigint,
  supplier_name text,
  is_estimate boolean default true
);

-- ─── Audit ────────────────────────────────────────────────────
create table audit_log (
  id          bigserial primary key,
  table_name  text,
  row_id      text,
  action      text,                          -- 'INSERT','UPDATE','DELETE'
  changed_by  uuid references auth.users,
  changed_at  timestamptz default now(),
  diff        jsonb
);
```

### 4.3 Reporting views (materialized where heavy)

```sql
create view v_monthly_income as
  select date_trunc('month', paid_at)::date as month,
         channel,
         sum(amount) as total
  from payments group by 1,2;

create view v_monthly_pl as
  select date_trunc('month', entry_date)::date as month,
         sum(income_cash + income_kpay)        as income,
         sum(expense_cash + expense_kpay)      as expense,
         sum(income_cash + income_kpay)
         - sum(expense_cash + expense_kpay)    as net
  from ledger_entries group by 1;

create materialized view mv_active_students_by_section as
  select s.label as section, count(*) filter (where st.current_status='Active') as active
  from sections s
  join enrolments e on e.section_id = s.id and e.end_date is null
  join students  st on st.id = e.student_id
  group by s.label;
```

### 4.4 Indexes (initial)

```sql
create index on attendance_marks (student_id);
create index on class_sessions (session_date);
create index on payments (paid_at);
create index on payments (student_id);
create index on ledger_entries (entry_date);
create index on kpay_transactions (txn_at);
create index on kpay_transactions (matched) where matched = false;
```

### 4.5 Row-Level Security (Supabase)

```sql
-- Enable RLS on every table
alter table students enable row level security;
-- … repeat for all tables

-- Roles via auth.users.raw_user_meta_data.role: 'owner','admin','accounts','readonly'

create policy "owner full" on students
  for all to authenticated
  using ((auth.jwt() ->> 'role') = 'owner')
  with check ((auth.jwt() ->> 'role') = 'owner');

create policy "admin read+write students" on students
  for all to authenticated
  using ((auth.jwt() ->> 'role') in ('owner','admin'))
  with check ((auth.jwt() ->> 'role') in ('owner','admin'));

create policy "accounts read students, write payments" on payments
  for select to authenticated
  using ((auth.jwt() ->> 'role') in ('owner','admin','accounts'));
create policy "accounts insert payments" on payments
  for insert to authenticated
  with check ((auth.jwt() ->> 'role') in ('owner','admin','accounts'));
```

A summary of the role matrix:

| Module | Owner | Admin | Accounts |
|---|---|---|---|
| Students | RW | RW | R |
| Attendance | RW | RW | R |
| Invoices / Payments | RW | RW | RW |
| Ledger / Expenses | RW | R | RW |
| Reports | RW | R | R |
| Settings | RW | – | – |

---

## 5. ETL plan — Excel → Supabase

### 5.1 Approach

- One-shot **historical import** (a Python script using `openpyxl` + `psycopg2` / `supabase-py`).
- After cutover, the Excel files are **read-only archives**. New data goes straight into the app.
- **n8n** picks up the daily KPay export from a watched folder / email and inserts into `kpay_transactions`.

### 5.2 File-to-table mapping

| Source file/sheet | Target table(s) | Notes |
|---|---|---|
| Per-level `… Ss Lists and Attendance_.xlsx` → each section sheet | `sections`, `students`, `guardians`, `enrolments`, `class_sessions`, `attendance_marks` | Header row 1 carries date columns; row 0 carries the class label; row 1 the teacher. |
| `2026 T&C Early Childhood / Nursery Students_ list & Attendance List_.xlsx` | same | Same shape, just a single section per workbook. |
| `2026 ESL Student Monthly Receive.xlsx` | (validation only) | Use to cross-check active-counts after import. |
| `… Daily K Pay Transcation.xlsx` → `K Pay Daily Transcation` | `kpay_transactions` | Raw txn list. |
| `… Daily Income K Pay` and `Daily Transcation` (cash) | `invoices`, `invoice_lines`, `payments` | Each row = one invoice + one payment. Channel = `kpay` or `cash`. |
| `Utilities Price` / `ESL Price` (within daily files) | `fee_schedule` | Use the most recent file as the active price book. |
| `2026 ESL Confirm Price.xlsx` → `Summary` | `fee_schedule` | Authoritative version. |
| `2026 ESL Confirm Price.xlsx` → `Textbook Price`, `T Shirt`, `ID Card` | `products` | Cost + retail prices. |
| `2026 ESL Opening Cost.xlsx` (1st/2nd/3rd order, T-Shirt, Accessories) | `purchase_orders`, `po_items`, `suppliers` | Suppliers: Kuu Kuu, Baby Union, Icon Kids. |
| `2026 Summer Opening Cost.xlsx` | `products`, `purchase_orders` (kind='summer'); plus seasonal income lines for English/Math/Art & Fitness in `ledger_entries` | |
| `January / Feb / March / April Income Statement.xlsx` → `General Expense` | `ledger_entries` (one row per ledger line) | `Chart Of Account` → `chart_of_accounts.group_name` (after canonicalising the typo variants). |
| same → `Office Expense` | `ledger_entries` with `source='OfficeExpense'` | |
| `All Months Income Summary (ESL).xlsx` | (validation only) | Used to reconcile the monthly totals after import. |
| `Annual Statement of Office Expense …xlsx` | (validation only) | Sanity-check 12-month totals. |
| `Thazin & Cherry Oveall Cost (May 2025 – April 2026).xlsx` | (validation only) | Annual P&L truth source. |
| `2026 Thingyan Festival Cost.xlsx` | `events`, `event_budget_items` | |
| `2026 Awarding Budget_.xlsx` | `events`, `event_budget_items` | |

### 5.3 Cleanup rules baked into the loader

1. **Name normalisation** — same student spelt slightly differently across files. Build a `name_aliases` lookup keyed on (myanmar_name + guardian_phone).
2. **Phone normalisation** — strip whitespace, slashes, "/", commas; keep up to two phones (primary + secondary).
3. **Class-label parsing** — regex `^(?P<level>[A-Za-z &-]+?)( Online)? \((?P<slot>\d.*?)\)$`.
4. **Account-name canonicalisation** — map "Monthly Operating Expense", "Monthly Operation Expense", "Monthly Opreation Expense" → single `Monthly Operating Expense`.
5. **Currency** — strip thousands separators, cast to `bigint`.
6. **Date** — `1.4.2026` → `2026-04-01`, accept both `D.M.YYYY` and `YYYY-MM-DD`.
7. **Month suffix** ("April") on daily-income rows → ignore (use `Date` column).
8. **Summary rows** — skip rows where the first cell is a sum-formula header (e.g. `Total`, single number).

### 5.4 Validation gates

After load, run:

- Sum of `payments.channel='cash'` per month == `Income Statement → ESL Class Fee (Cash)`.
- Sum of `payments.channel='kpay'` per month == `Income Statement → ESL Class Fee (Q Pay)`.
- Active student count per level matches `2026 ESL Student Monthly Receive.xlsx`.
- Monthly P&L from `ledger_entries` matches `Thazin & Cherry Oveall Cost` annual file.

Anything off by > ₭10,000 → flag for manual review before sign-off.

---

## 6. Web app architecture (build in Phase 2 — not yet)

### 6.1 Stack

| Layer | Tech |
|---|---|
| Database | Supabase Postgres |
| Auth | Supabase Auth (email/password + magic link) |
| API | Supabase auto-generated REST/GraphQL + Postgres functions |
| Storage | Supabase Storage (uploaded Excel exports, student photos) |
| Frontend | Next.js 15 (App Router) + `@supabase/ssr` |
| UI | Tailwind + shadcn/ui + Recharts |
| Automation | **n8n** (self-hosted on Render/Fly or n8n.cloud) |
| Hosting | Vercel free + Supabase free + n8n free tier (Render/Fly self-host or n8n.cloud free) |
| Backups | Supabase daily PITR + weekly Excel export to Google Drive via n8n |
| UI language | English only for v1 (Myanmar deferred) |
| Receipts | Deferred to a later release |

### 6.2 Module map

1. **Dashboard** (home)
   - This-month income vs expense, net profit
   - Active students by level
   - Outstanding invoices
   - Today's attendance status
   - 12-month income trend chart

2. **Students**
   - List with filters (level, section, status)
   - Profile: enrolment history, attendance timeline, fee/payment history, guardian
   - Add / edit / change-status (Active → Break → Left)
   - CSV / Excel export

3. **Sections & timetable**
   - Calendar view of Sat/Sun sessions
   - Per-section roster
   - Teacher assignments (single + co-teach)

4. **Attendance**
   - Mobile-friendly mark sheet (one tap per student)
   - Bulk "mark all present"
   - History view

5. **Billing**
   - Generate monthly invoices for a section (one click → all active students)
   - Apply 1st-time-utilities or 2nd-time-utilities bundle automatically
   - **Discounts** auto-applied per `student_discounts` (sibling, scholarship, staff-child, referral, promo, old-student)
   - Fines added manually
   - Uses the **active row** in `fee_schedule` for the billing month (handles inflation)

6. **Payments**
   - Record cash payment
   - **KPay reconciliation queue**: unmatched KPay rows on the left, candidate students on the right, drag-and-drop to match
   - Receipt printing / PDF export

7. **Expenses & ledger**
   - Add expense (date, account, cash/kpay split, qty, unit, amount)
   - Office vs General toggle
   - Chart-of-accounts CRUD

8. **Inventory & procurement**
   - Products (textbook / t-shirt / id-card / accessory)
   - Purchase orders by supplier
   - **Live stock** view per product (T-shirt size, textbook level) via `inventory_movements`
   - Movement log: every IN (purchase), OUT (give-to-student / sell), ADJUST (count correction)
   - Auto-decrement stock when an invoice line of `kind='tshirt'`/`'book'` is paid

9. **Events**
   - Budget vs actual

10. **Reports**
    - Monthly income statement (recreates the Excel layout)
    - Annual P&L (recreates `Thazin & Cherry Oveall Cost`)
    - Per-level revenue breakdown
    - **Salary** page with two tabs:
      - *Per-teacher* — `teacher_payslips` view, monthly grid by teacher
      - *Ledger* — aggregate "Teacher Salary" rolled up from `ledger_entries`
    - Excel/PDF export of any report

11. **Settings**
    - Users & roles
    - Price book (`fee_schedule`) editor
    - Levels, sections, teachers
    - Backups / import job logs

### 6.3 Page list (Next.js App Router)

```
/(auth)/login
/dashboard
/students                   /students/[id]
/sections                   /sections/[id]
/attendance                 /attendance/[sessionId]
/billing/invoices           /billing/invoices/[id]
/payments                   /payments/reconcile
/expenses
/inventory/products         /inventory/orders
/events                     /events/[id]
/reports/monthly            /reports/annual          /reports/by-level
/settings/users             /settings/price-book     /settings/levels
```

### 6.4 n8n automations (Phase 2.5)

| Workflow | Trigger | Action |
|---|---|---|
| **KPay daily sync** | Email arrives with attached daily KPay CSV | parse → insert into `kpay_transactions` → notify accounts user |
| **Auto-match payments** | Cron 6 PM daily | run `match_kpay()` Postgres function on unmatched rows where sender name matches a student, mark matched |
| **Monthly invoice generation** | 1st of each month, 06:00 | call Postgres function `generate_invoices(month)` → email summary to owner |
| **Attendance reminder** | 1 hour before each Sat/Sun session | Viber / SMS reminder to teacher's phone |
| **Outstanding-fee reminder** | Cron weekly | Viber message to guardian with unpaid invoices |
| **Weekly backup** | Sunday 02:00 | export key tables to Excel, push to Google Drive |
| **Monthly report email** | 1st of each month, 09:00 | render the monthly P&L PDF and email it to owner |

### 6.5 Security & privacy

- Postgres RLS for all reads/writes (cf. §4.5).
- Supabase Auth with **email + password + 2FA** (TOTP) for owner.
- All amounts encrypted at rest by Supabase; HTTPS in transit.
- Service-role key (n8n) stored only in n8n's encrypted credentials; never exposed to the browser.
- Audit log on all writes (table `audit_log`).
- Daily PITR backups + weekly off-site Excel export.

### 6.6 Out of scope (for v1)

- Online payments (Stripe / KBZPay-Open-API integration) — defer to v2.
- Parent-facing portal — v3.
- Mobile native app — never; we'll keep the web app responsive instead.

---

## 7. Phased implementation roadmap

| Phase | Goal | Duration | Output |
|---|---|---|---|
| **0. Plan sign-off** | Approve this document | this week | This file |
| **1. Schema & ETL** | Postgres schema in Supabase + historical import + validation | 1–2 weeks | All 33 Excel files loaded; reports match Excel ±₭10k |
| **2. Web app v1** | Read-only dashboard + Students + Attendance + Payments | 3–4 weeks | Internal staff can replace student/payment Excel work |
| **2.5 n8n automations** | KPay sync + monthly invoice + reminders | parallel with Phase 2 | Daily ops drop manual steps |
| **3. Web app v2** | Expenses, Reports, Inventory, Events, Settings | 3 weeks | Excel files retired, app is the system of record |
| **4. Hardening** | RLS audits, backups, 2FA, audit-log UI | 1 week | Production-ready |
| **5. Future** | Online payments, parent portal | TBD | — |

---

## 8. Decisions locked in (your answers, 2026-05-07)

1. **EDU School** — **Excluded.** Skip during import; not surfaced in the app.
2. **T-shirt inventory** — **Full tracking** (every IN/OUT). Modeled via `inventory_movements`.
3. **Fee schedule** — **Multi-period** to support inflation. `fee_schedule` keeps history with `effective_from` / `effective_to`. UI to add a new price row at any time.
4. **Discounts** — **Yes**, modeled as `discount_types` + `student_discounts` (sibling, scholarship, staff-child, referral, promo, old-student). Applied automatically when generating invoices.
5. **Student photos** — **No.**
6. **Teacher pay** — **Both.** Per-teacher table (`teacher_payslips`) **and** aggregate ledger line. Web app shows two tabs in the Salary section: *Per-teacher* and *Ledger*.
7. **Receipts** — **Defer.** No receipt printing in v1; revisit later.
8. **Language** — **English only** for v1.
9. **n8n hosting** — **Free tier** only. Self-host on Render / Fly free tier (or n8n.cloud free) with a sleep-then-wake pattern for daily jobs. Workflows kept minimal so they fit free-tier quotas.

→ All four files in `_PLAN/` reflect these decisions. Phase 1 is unblocked.

---

## 9. Files in this plan folder

- `00_MASTER_PLAN.md` — this document.
- `01_data_inventory.md` — long-form file-by-file profile (auto-generated).
- `02_schema.sql` — full Supabase migration script.
- `03_etl_mapping.md` — column-by-column mapping per source file.
- `04_open_questions.md` — questions in §8 broken out for your replies.

(Files 01–04 will be generated next — say the word.)
