create table public.absences (
  id bigserial, employee_id integer not null, absent_date date not null,
  hours numeric(5,2) not null, role text default 'MT', section_id integer,
  reason text, notes text, created_at timestamptz default now());

create table public.app_settings (
  key text not null, value text, updated_at timestamptz default now());

create table public.attendance_marks (
  session_id integer not null, student_id integer not null, status text not null,
  marked_at timestamptz default now(), marked_by uuid);

create table public.audit_log (
  id bigserial, table_name text not null, row_id text, action text,
  changed_by uuid, changed_at timestamptz default now(), diff jsonb);

create table public.backups (
  id bigserial, source text not null, row_count bigint, size_bytes bigint,
  payload jsonb not null, notes text, created_at timestamptz default now());

create table public.chart_of_accounts (
  id smallserial, category text not null, group_name text not null,
  parent_id smallint, is_active boolean default true);

create table public.class_sessions (
  id serial, section_id integer not null, session_date date not null, notes text);

create table public.discount_types (
  id smallserial, code text not null, name text not null, kind text not null,
  default_value bigint, is_active boolean default true, notes text);

create table public.employee_payslips (
  id bigserial, employee_id integer not null, pay_month date not null,
  mt_hours numeric(6,2) default 0, ct_hours numeric(6,2) default 0,
  mt_absence_hrs numeric(6,2) default 0, ct_absence_hrs numeric(6,2) default 0,
  mt_hourly_fee bigint default 0, ct_hourly_fee bigint default 0,
  esl_pay bigint default 0, management_pay bigint default 0, guide_pay bigint default 0,
  summer_pay bigint default 0, other_pay bigint default 0,
  total_pay bigint generated always as ((((esl_pay + management_pay) + guide_pay) + summer_pay) + other_pay) stored,
  payment_method text, paid_at date, ledger_entry_id bigint, notes text,
  created_at timestamptz default now());

create table public.employees (
  id serial, full_name text not null, short_name text not null,
  category text not null default 'esl_teacher', phone text, email text, address text,
  start_date date, end_date date, monthly_salary bigint, is_active boolean default true,
  notes text, created_at timestamptz default now(), date_of_birth date, national_id text,
  emergency_contact text, position_title text, education_level text, degree text,
  university text, available_slots text, mt_hourly_fee bigint, ct_hourly_fee bigint);

create table public.enrolments (
  id serial, student_id integer not null, section_id integer not null,
  start_date date not null, end_date date, status text not null default 'Active');

create table public.event_budget_items (
  id bigserial, event_id integer, item text, qty numeric, unit_price bigint,
  amount bigint, supplier_name text, is_estimate boolean default true);

create table public.events (
  id serial, name text not null, event_date date, budget bigint, actual_cost bigint, notes text);

create table public.fee_schedule (
  id serial, level_id smallint not null, effective_from date not null, effective_to date,
  class_fee bigint not null, textbook_fee bigint default 0, tshirt_fee bigint default 0,
  id_card_fee bigint default 0, guide_fee bigint default 0, default_discount bigint default 0, notes text);

create table public.guardians (
  id serial, full_name text, phone_primary text, phone_secondary text, viber_number text,
  notes text, created_at timestamptz default now());

create table public.inventory_movements (
  id bigserial, product_id integer not null, movement_at timestamptz not null default now(),
  direction text not null, qty numeric not null, reason text not null, related_po_id integer,
  related_invoice_id bigint, related_student_id integer, unit_cost bigint, notes text,
  recorded_by uuid, related_ledger_id bigint);

create table public.invoice_lines (
  id bigserial, invoice_id bigint, kind text not null, description text,
  qty numeric default 1, unit_price bigint, amount bigint not null);

create table public.invoices (
  id bigserial, student_id integer not null, section_id integer, billing_month date not null,
  is_new_student boolean default false, total_amount bigint not null, discount bigint default 0,
  fine bigint default 0, status text default 'open', created_at timestamptz default now(), created_by uuid);

create table public.kpay_transactions (
  id bigserial, txn_at timestamptz not null, sender_mm text, sender_en text, raw_class text,
  payment_type text, amount bigint not null, source_file text, matched boolean default false,
  matched_payment_id bigint, created_at timestamptz default now());

create table public.ledger_entries (
  id bigserial, entry_date date not null, description text, account_id smallint,
  income_cash bigint default 0, income_kpay bigint default 0, expense_cash bigint default 0,
  expense_kpay bigint default 0, qty numeric, unit_price bigint, source text, source_file text,
  created_by uuid, created_at timestamptz default now(), product_id integer);

create table public.levels (
  id smallserial, code text not null, name text not null, display_order smallint not null);

create table public.payments (
  id bigserial, invoice_id bigint, student_id integer, paid_at timestamptz not null,
  amount bigint not null, channel text not null, kpay_txn_id bigint, recorded_by uuid,
  note text, created_at timestamptz default now());

create table public.po_items (
  id bigserial, po_id integer, product_id integer, qty numeric, unit_cost bigint, amount bigint);

create table public.products (
  id serial, kind text not null, name text not null, level_id smallint, size text,
  cost_price bigint, retail_price bigint, is_active boolean default true);

create table public.purchase_orders (
  id serial, supplier_id integer, ordered_at date, total_amount bigint, notes text, source_file text);

create table public.rooms (
  id serial, name text not null, display_name text, notes text, is_active boolean default true,
  created_at timestamptz default now());

create table public.schedule_assignments (
  id bigserial, month date not null, day_of_week text not null, time_slot text not null,
  room_id integer, section_id integer, class_label text, subject text, mt_employee_id integer,
  ct_employee_id integer, notes text, created_at timestamptz default now());

create table public.section_teachers (
  section_id integer not null, teacher_id integer not null, weekday_pattern text, teaching_role text);

create table public.sections (
  id serial, level_id smallint not null, time_slot text not null, is_online boolean default false,
  capacity smallint, start_date date, end_date date, created_at timestamptz default now(), room_id integer);

create table public.student_discounts (
  id serial, student_id integer not null, discount_type_id smallint not null, value_override bigint,
  effective_from date not null, effective_to date, notes text, created_at timestamptz default now());

create table public.students (
  id serial, external_id text, myanmar_name text, english_name text, date_of_birth date,
  guardian_id integer, current_status text not null default 'Active', enrolled_at date, left_at date,
  notes text, created_at timestamptz default now(), updated_at timestamptz default now());

create table public.suppliers (id serial, name text not null, contact text);

create table public.teacher_payslips (
  id bigserial, teacher_id integer not null, pay_month date not null, base_salary bigint default 0,
  bonus bigint default 0, deduction bigint default 0,
  total bigint generated always as ((base_salary + bonus) - deduction) stored,
  paid_at timestamptz, payment_id bigint, notes text, created_at timestamptz default now());

-- App auth (replaces Supabase Auth)
create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  full_name text,
  role text not null default 'readonly',
  created_at timestamptz default now());
