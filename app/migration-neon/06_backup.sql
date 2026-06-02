-- 06_backup.sql — Backup & restore for Neon.
--
-- Ported from the Supabase RPCs. Two differences forced by Neon (which runs the
-- app as a non-superuser, `neondb_owner`):
--   1. Authorization is enforced in the app layer (requireRole owner / the cron
--      secret), so these functions carry no auth_role() checks.
--   2. The Supabase restore disabled ALL triggers via session_replication_role
--      to bypass FK enforcement + business-logic recompute. Neon forbids both
--      `set session_replication_role` and disabling system RI triggers. Instead:
--        - user (business) triggers are disabled per-table (allowed for the owner)
--          so payments_reconcile / absences_recompute / ledger_inventory_sync
--          don't cascade during a bulk reload;
--        - FK constraints are made DEFERRABLE (below) and SET DEFERRED inside the
--          restore txn, so the self-ref (chart_of_accounts) and the circular
--          payments<->kpay_transactions pair load in any order and are validated
--          once at commit.

-- 1. Make every public FK constraint deferrable (INITIALLY IMMEDIATE keeps normal
--    runtime behaviour identical; only restore opts into deferral). Idempotent.
do $$
declare r record;
begin
  for r in
    select conname, conrelid::regclass::text as tbl
    from pg_constraint
    where contype = 'f' and connamespace = 'public'::regnamespace
      and not condeferrable
  loop
    execute format('alter table %s alter constraint %I deferrable initially immediate', r.tbl, r.conname);
  end loop;
end$$;

-- 2. Full-database snapshot as jsonb. Excludes the backups table itself, the
--    app_settings key/value store, and the users (auth) table — logins are
--    managed separately, mirroring the old "excludes auth.users" behaviour.
create or replace function public.backup_all_data_internal()
returns jsonb
language plpgsql
as $function$
declare
  result jsonb := '{}'::jsonb;
  rec record;
  data jsonb;
  total bigint := 0;
begin
  for rec in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename not like 'pg_%'
      and tablename not in ('backups', 'app_settings', 'users')
    order by tablename
  loop
    execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from %I t', rec.tablename) into data;
    result := result || jsonb_build_object(rec.tablename, data);
    total := total + coalesce(jsonb_array_length(data), 0);
  end loop;
  return jsonb_build_object('version', 1, 'created_at', now(), 'row_count', total, 'tables', result);
end$function$;

-- 3. Restore: truncate every data table then reload from the payload.
create or replace function public.restore_all_data(payload jsonb)
returns integer
language plpgsql
as $function$
declare
  ord text[] := array[
    'levels','chart_of_accounts','discount_types','rooms','employees',
    'sections','section_teachers','guardians','students','enrolments',
    'class_sessions','attendance_marks','fee_schedule','student_discounts',
    'invoices','invoice_lines','kpay_transactions','payments','ledger_entries',
    'products','suppliers','purchase_orders','po_items','inventory_movements',
    'events','event_budget_items','absences','employee_payslips','teacher_payslips',
    'schedule_assignments','audit_log'
  ];
  t text; i int; rows jsonb; total int := 0; seq text; cols text;
begin
  -- Skip business-logic triggers during the bulk reload.
  for i in 1 .. array_length(ord, 1) loop
    execute format('alter table %I disable trigger user', ord[i]);
  end loop;

  -- Defer FK checks to commit (handles self-ref + circular FKs in any order).
  set constraints all deferred;

  -- Empty children-first.
  for i in reverse array_length(ord, 1) .. 1 loop
    execute format('truncate table %I cascade', ord[i]);
  end loop;

  -- Reload. List only non-generated columns (e.g. employee_payslips.total_pay,
  -- teacher_payslips.total are GENERATED and cannot be inserted into).
  for i in 1 .. array_length(ord, 1) loop
    t := ord[i];
    rows := payload -> 'tables' -> t;
    if rows is null or jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) = 0 then
      continue;
    end if;
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
      into cols
      from information_schema.columns
      where table_schema = 'public' and table_name = t and is_generated <> 'ALWAYS';
    execute format(
      'insert into %I (%s) select %s from jsonb_populate_recordset(null::%I, $1)',
      t, cols, cols, t
    ) using rows;
    total := total + jsonb_array_length(rows);
  end loop;

  -- Reset id sequences so future inserts continue cleanly. Skip tables with no
  -- `id` column (e.g. section_teachers has a composite PK).
  for i in 1 .. array_length(ord, 1) loop
    t := ord[i];
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'id'
    ) then
      seq := pg_get_serial_sequence(format('public.%I', t), 'id');
      if seq is not null then
        execute format('select setval(%L, coalesce((select max(id) from %I), 1))', seq, t);
      end if;
    end if;
  end loop;

  -- Validate the deferred FKs now (raises if the backup is internally
  -- inconsistent) so there are no pending trigger events blocking the ALTERs.
  set constraints all immediate;

  -- Re-enable business triggers.
  for i in 1 .. array_length(ord, 1) loop
    execute format('alter table %I enable trigger user', ord[i]);
  end loop;

  return total;
end$function$;
