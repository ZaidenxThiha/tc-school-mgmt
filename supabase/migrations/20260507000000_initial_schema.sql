-- =====================================================================
-- Thazin & Cherry English Training Centre — Supabase schema
-- Project ref: ugjujibpbasskampuums
-- All amounts: MMK as bigint (no decimals). All timestamps: timestamptz.
-- =====================================================================

-- ─── Extensions ──────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ─── Reference: levels & sections ────────────────────────────────────
create table levels (
  id            smallserial primary key,
  code          text unique not null,
  name          text not null,
  display_order smallint not null
);

insert into levels (code, name, display_order) values
  ('EARLY_CHILDHOOD','Early Childhood',1),
  ('NURSERY','Nursery',2),
  ('PRE_STARTER','Pre-Starter',3),
  ('STARTER','Starter',4),
  ('MOVERS','Movers',5),
  ('FLYERS','Flyers',6),
  ('KEY','KEY',7),
  ('PET','PET',8),
  ('FCE','FCE',9),
  ('CAE','CAE',10),
  ('SUMMER_ENG','Summer English',30),
  ('SUMMER_MATH','Summer Math',31),
  ('SUMMER_ART','Summer Art & Fitness',32);

create table teachers (
  id          serial primary key,
  full_name   text not null,
  short_name  text not null,
  is_active   boolean default true,
  notes       text,
  created_at  timestamptz default now()
);

create table sections (
  id              serial primary key,
  level_id        smallint not null references levels,
  time_slot       text not null,
  is_online       boolean default false,
  capacity        smallint,
  start_date      date,
  end_date        date,
  created_at      timestamptz default now(),
  unique (level_id, time_slot, is_online)
);

create table section_teachers (
  section_id      int references sections on delete cascade,
  teacher_id      int references teachers on delete restrict,
  weekday_pattern text,
  primary key (section_id, teacher_id)
);

-- ─── People ──────────────────────────────────────────────────────────
create table guardians (
  id              serial primary key,
  full_name       text,
  phone_primary   text,
  phone_secondary text,
  viber_number    text,
  notes           text,
  created_at      timestamptz default now()
);

create table students (
  id              serial primary key,
  external_id     text,
  myanmar_name    text,
  english_name    text,
  date_of_birth   date,
  guardian_id     int references guardians,
  current_status  text not null default 'Active'
                  check (current_status in ('Active','Break','Left','Prospect')),
  enrolled_at     date,
  left_at         date,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index on students (current_status);
create index on students (english_name);

create table enrolments (
  id          serial primary key,
  student_id  int not null references students on delete cascade,
  section_id  int not null references sections,
  start_date  date not null,
  end_date    date,
  status      text not null default 'Active'
              check (status in ('Active','Break','Left')),
  unique (student_id, section_id, start_date)
);
create index on enrolments (student_id);
create index on enrolments (section_id);

-- ─── Attendance ──────────────────────────────────────────────────────
create table class_sessions (
  id            serial primary key,
  section_id    int not null references sections,
  session_date  date not null,
  notes         text,
  unique (section_id, session_date)
);
create index on class_sessions (session_date);

create table attendance_marks (
  session_id    int references class_sessions on delete cascade,
  student_id    int references students on delete cascade,
  status        text not null check (status in ('Present','Absent','Leave','Break')),
  marked_at     timestamptz default now(),
  marked_by     uuid references auth.users,
  primary key (session_id, student_id)
);
create index on attendance_marks (student_id);

-- ─── Pricing ─────────────────────────────────────────────────────────
create table fee_schedule (
  id               serial primary key,
  level_id         smallint not null references levels,
  effective_from   date not null,
  effective_to     date,
  class_fee        bigint not null,
  textbook_fee     bigint default 0,
  tshirt_fee       bigint default 0,
  id_card_fee      bigint default 0,
  guide_fee        bigint default 0,
  default_discount bigint default 0,
  notes            text
);
create index on fee_schedule (level_id, effective_from);

-- ─── Discounts ───────────────────────────────────────────────────────
create table discount_types (
  id           smallserial primary key,
  code         text unique not null,
  name         text not null,
  kind         text not null check (kind in ('fixed','percent')),
  default_value bigint,                       -- amount in MMK or basis points (10000 = 100%)
  is_active    boolean default true,
  notes        text
);

insert into discount_types (code, name, kind, default_value, notes) values
  ('OLD_STUDENT','Old-student utilities (no T-shirt re-issue)','fixed',15000,'Returning students skip T-shirt'),
  ('SIBLING','Sibling discount','percent',1000,'10% (10000 = 100%)'),
  ('SCHOLARSHIP','Scholarship','percent',null,'Case-by-case'),
  ('STAFF_CHILD','Staff child','percent',null,null),
  ('REFERRAL','Referral discount','fixed',null,null),
  ('PROMO','Seasonal promo','fixed',null,null);

create table student_discounts (              -- which student has which discount, when
  id                serial primary key,
  student_id        int not null references students on delete cascade,
  discount_type_id  smallint not null references discount_types,
  value_override    bigint,                   -- overrides default_value if set
  effective_from    date not null,
  effective_to      date,
  notes             text,
  created_at        timestamptz default now()
);
create index on student_discounts (student_id);

-- ─── Billing ─────────────────────────────────────────────────────────
create table invoices (
  id              bigserial primary key,
  student_id      int not null references students,
  section_id      int references sections,
  billing_month   date not null,
  is_new_student  boolean default false,
  total_amount    bigint not null,
  discount        bigint default 0,
  fine            bigint default 0,
  status          text default 'open' check (status in ('open','paid','partial','void')),
  created_at      timestamptz default now(),
  created_by      uuid references auth.users
);
create index on invoices (student_id);
create index on invoices (billing_month);

create table invoice_lines (
  id           bigserial primary key,
  invoice_id   bigint references invoices on delete cascade,
  kind         text not null check (kind in ('class_fee','book','id','tshirt','guide','fine','discount','other')),
  description  text,
  qty          numeric default 1,
  unit_price   bigint,
  amount       bigint not null
);

-- ─── Payments + KPay reconciliation ──────────────────────────────────
create table kpay_transactions (
  id               bigserial primary key,
  txn_at           timestamptz not null,
  sender_mm        text,
  sender_en        text,
  raw_class        text,
  payment_type     text,
  amount           bigint not null,
  source_file      text,
  matched          boolean default false,
  matched_payment_id bigint,
  created_at       timestamptz default now()
);
create index on kpay_transactions (txn_at);
create index on kpay_transactions (matched) where matched = false;

create table payments (
  id              bigserial primary key,
  invoice_id      bigint references invoices,
  student_id      int references students,
  paid_at         timestamptz not null,
  amount          bigint not null,
  channel         text not null check (channel in ('cash','kpay','wave','bank','other')),
  kpay_txn_id     bigint references kpay_transactions,
  recorded_by     uuid references auth.users,
  note            text,
  created_at      timestamptz default now()
);
create index on payments (paid_at);
create index on payments (student_id);

alter table kpay_transactions
  add constraint kpay_transactions_matched_payment_fk
  foreign key (matched_payment_id) references payments(id);

-- ─── Accounting ledger ───────────────────────────────────────────────
create table chart_of_accounts (
  id         smallserial primary key,
  category   text not null check (category in ('Income','Expense','Equity','Asset','Liability')),
  group_name text not null,
  parent_id  smallint references chart_of_accounts,
  is_active  boolean default true
);

insert into chart_of_accounts (category, group_name) values
  ('Income','ESL Class Fee'),
  ('Income','Summer Program Fee'),
  ('Income','Other Income'),
  ('Expense','ESL Teacher Salary'),
  ('Expense','Admin Teacher Salary'),
  ('Expense','Admin Salary'),
  ('Expense','Teaching Supply'),
  ('Expense','Office Expense'),
  ('Expense','Monthly Operating Expense'),
  ('Expense','Initial Capital & Major Operating Costs'),
  ('Expense','One-time Minor Expense'),
  ('Expense','One-time Capital & Large Operational Expense'),
  ('Expense','Internet & Communication Expense'),
  ('Expense','Drinking Water'),
  ('Expense','Delivery & Transportation'),
  ('Expense','Office Stationery'),
  ('Expense','Government Tax'),
  ('Expense','Event'),
  ('Expense','Personal Expense'),
  ('Expense','Special Case'),
  ('Expense','Other Expense');

create table ledger_entries (
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
  source        text check (source in ('GeneralExpense','OfficeExpense','Auto','Manual')),
  source_file   text,
  created_by    uuid references auth.users,
  created_at    timestamptz default now()
);
create index on ledger_entries (entry_date);
create index on ledger_entries (account_id);

-- ─── Inventory & procurement ─────────────────────────────────────────
create table products (
  id           serial primary key,
  kind         text not null check (kind in ('textbook','tshirt','id_card','accessory','other')),
  name         text not null,
  level_id     smallint references levels,
  size         text,
  cost_price   bigint,
  retail_price bigint,
  is_active    boolean default true
);

create table suppliers (
  id      serial primary key,
  name    text not null,
  contact text
);

create table purchase_orders (
  id            serial primary key,
  supplier_id   int references suppliers,
  ordered_at    date,
  total_amount  bigint,
  notes         text,
  source_file   text
);

create table po_items (
  id           bigserial primary key,
  po_id        int references purchase_orders on delete cascade,
  product_id   int references products,
  qty          numeric,
  unit_cost    bigint,
  amount       bigint
);

-- ─── Inventory movements (full T-shirt + textbook tracking) ──────────
create table inventory_movements (
  id           bigserial primary key,
  product_id   int not null references products,
  movement_at  timestamptz not null default now(),
  direction    text not null check (direction in ('IN','OUT','ADJUST')),
  qty          numeric not null,              -- always positive; direction tells the sign
  reason       text not null check (reason in (
                  'purchase','sale','give_to_student','damage',
                  'return','opening_balance','closing_count','correction'
                )),
  related_po_id      int references purchase_orders,
  related_invoice_id bigint references invoices,
  related_student_id int references students,
  unit_cost    bigint,
  notes        text,
  recorded_by  uuid references auth.users
);
create index on inventory_movements (product_id, movement_at);

-- Live stock view: signed sum of movements per product
create or replace view v_product_stock as
  select p.id as product_id, p.name, p.kind, p.size,
         coalesce(sum(case when m.direction='IN' then m.qty
                           when m.direction='OUT' then -m.qty
                           else m.qty end), 0) as on_hand
  from products p
  left join inventory_movements m on m.product_id = p.id
  group by p.id, p.name, p.kind, p.size;

-- ─── Teacher payslips (per-teacher per-month) ────────────────────────
create table teacher_payslips (
  id            bigserial primary key,
  teacher_id    int not null references teachers,
  pay_month     date not null,                -- first-of-month
  base_salary   bigint default 0,
  bonus         bigint default 0,
  deduction     bigint default 0,
  total         bigint generated always as (base_salary + bonus - deduction) stored,
  paid_at       timestamptz,
  payment_id    bigint references payments,
  notes         text,
  created_at    timestamptz default now(),
  unique (teacher_id, pay_month)
);
create index on teacher_payslips (pay_month);

-- ─── Events ──────────────────────────────────────────────────────────
create table events (
  id           serial primary key,
  name         text not null,
  event_date   date,
  budget       bigint,
  actual_cost  bigint,
  notes        text
);

create table event_budget_items (
  id             bigserial primary key,
  event_id       int references events on delete cascade,
  item           text,
  qty            numeric,
  unit_price     bigint,
  amount         bigint,
  supplier_name  text,
  is_estimate    boolean default true
);

-- ─── Audit log ───────────────────────────────────────────────────────
create table audit_log (
  id          bigserial primary key,
  table_name  text not null,
  row_id      text,
  action      text check (action in ('INSERT','UPDATE','DELETE')),
  changed_by  uuid references auth.users,
  changed_at  timestamptz default now(),
  diff        jsonb
);

-- ─── Reporting views ─────────────────────────────────────────────────
create or replace view v_monthly_income as
  select date_trunc('month', paid_at)::date as month,
         channel, sum(amount) as total
  from payments group by 1, 2;

create or replace view v_monthly_pl as
  select date_trunc('month', entry_date)::date as month,
         sum(income_cash + income_kpay)         as income,
         sum(expense_cash + expense_kpay)       as expense,
         sum(income_cash + income_kpay)
         - sum(expense_cash + expense_kpay)     as net
  from ledger_entries group by 1;

create or replace view v_section_active_count as
  select s.id as section_id, l.code as level_code, s.time_slot, s.is_online,
         count(*) filter (where e.end_date is null and st.current_status='Active') as active_count
  from sections s
  join levels   l  on l.id = s.level_id
  left join enrolments e on e.section_id = s.id
  left join students   st on st.id = e.student_id
  group by s.id, l.code, s.time_slot, s.is_online;

-- ─── Helper functions ────────────────────────────────────────────────
create or replace function generate_invoices_for_month(target_month date)
returns int language plpgsql as $$
declare cnt int := 0;
begin
  insert into invoices (student_id, section_id, billing_month, total_amount, status)
  select e.student_id, e.section_id, target_month,
         coalesce(fs.class_fee, 0), 'open'
  from enrolments e
  join students s on s.id = e.student_id and s.current_status='Active'
  left join fee_schedule fs on fs.level_id = (select level_id from sections where id = e.section_id)
                           and target_month between fs.effective_from
                                              and coalesce(fs.effective_to, target_month)
  where e.end_date is null
  on conflict do nothing;
  get diagnostics cnt = row_count;
  return cnt;
end$$;

-- ─── Row-Level Security ──────────────────────────────────────────────
alter table students          enable row level security;
alter table guardians         enable row level security;
alter table sections          enable row level security;
alter table section_teachers  enable row level security;
alter table teachers          enable row level security;
alter table enrolments        enable row level security;
alter table class_sessions    enable row level security;
alter table attendance_marks  enable row level security;
alter table fee_schedule      enable row level security;
alter table invoices          enable row level security;
alter table invoice_lines     enable row level security;
alter table payments          enable row level security;
alter table kpay_transactions enable row level security;
alter table ledger_entries    enable row level security;
alter table chart_of_accounts enable row level security;
alter table products          enable row level security;
alter table suppliers         enable row level security;
alter table purchase_orders   enable row level security;
alter table po_items          enable row level security;
alter table events             enable row level security;
alter table event_budget_items enable row level security;
alter table audit_log          enable row level security;
alter table discount_types     enable row level security;
alter table student_discounts  enable row level security;
alter table inventory_movements enable row level security;
alter table teacher_payslips   enable row level security;

-- Helper: pull role from JWT
create or replace function auth_role() returns text
language sql stable as $$
  select coalesce((auth.jwt() ->> 'role')::text, 'readonly');
$$;

-- Owner: full power on everything
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('create policy "owner_all_%s" on %I for all to authenticated using (auth_role()=''owner'') with check (auth_role()=''owner'')', t, t);
  end loop;
end$$;

-- Admin: read+write on operational tables
create policy "admin_rw_students"      on students      for all to authenticated using (auth_role() in ('owner','admin')) with check (auth_role() in ('owner','admin'));
create policy "admin_rw_guardians"     on guardians     for all to authenticated using (auth_role() in ('owner','admin')) with check (auth_role() in ('owner','admin'));
create policy "admin_rw_attendance"    on attendance_marks for all to authenticated using (auth_role() in ('owner','admin')) with check (auth_role() in ('owner','admin'));
create policy "admin_rw_class_sessions" on class_sessions for all to authenticated using (auth_role() in ('owner','admin')) with check (auth_role() in ('owner','admin'));

-- Accounts: full power on payments + ledger, read-only on student data
create policy "accounts_r_students"    on students      for select to authenticated using (auth_role() in ('owner','admin','accounts'));
create policy "accounts_rw_payments"   on payments      for all to authenticated using (auth_role() in ('owner','admin','accounts')) with check (auth_role() in ('owner','admin','accounts'));
create policy "accounts_rw_invoices"   on invoices      for all to authenticated using (auth_role() in ('owner','admin','accounts')) with check (auth_role() in ('owner','admin','accounts'));
create policy "accounts_rw_kpay"       on kpay_transactions for all to authenticated using (auth_role() in ('owner','admin','accounts')) with check (auth_role() in ('owner','admin','accounts'));
create policy "accounts_rw_ledger"     on ledger_entries for all to authenticated using (auth_role() in ('owner','admin','accounts')) with check (auth_role() in ('owner','admin','accounts'));

-- Read-only fallback for everyone authenticated on reference tables
create policy "any_r_levels"          on levels          for select to authenticated using (true);
create policy "any_r_sections"        on sections        for select to authenticated using (true);
create policy "any_r_teachers"        on teachers        for select to authenticated using (true);
create policy "any_r_discount_types"  on discount_types  for select to authenticated using (true);

-- Owner controls discounts and payslips
create policy "owner_rw_student_discounts" on student_discounts
  for all to authenticated using (auth_role() in ('owner','admin')) with check (auth_role() in ('owner','admin'));
create policy "owner_rw_inventory_movements" on inventory_movements
  for all to authenticated using (auth_role() in ('owner','admin','accounts')) with check (auth_role() in ('owner','admin','accounts'));
create policy "owner_rw_teacher_payslips" on teacher_payslips
  for all to authenticated using (auth_role() in ('owner','accounts')) with check (auth_role() in ('owner','accounts'));

-- =====================================================================
-- End of schema. Apply via Supabase MCP or `supabase db push` after the
-- project ref ugjujibpbasskampuums is linked.
-- =====================================================================
