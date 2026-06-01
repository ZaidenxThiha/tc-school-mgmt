-- Views
create or replace view public.v_monthly_pl as
  SELECT (date_trunc('month', (entry_date)::timestamptz))::date AS month,
    sum((income_cash + income_kpay)) AS income,
    sum((expense_cash + expense_kpay)) AS expense,
    (sum((income_cash + income_kpay)) - sum((expense_cash + expense_kpay))) AS net
   FROM ledger_entries
  GROUP BY ((date_trunc('month', (entry_date)::timestamptz))::date);

create or replace view public.v_product_stock as
  SELECT p.id AS product_id, p.name, p.kind, p.size,
    COALESCE(sum(CASE WHEN (m.direction = 'IN') THEN m.qty WHEN (m.direction = 'OUT') THEN (- m.qty) ELSE m.qty END), (0)::numeric) AS on_hand
   FROM (products p LEFT JOIN inventory_movements m ON ((m.product_id = p.id)))
  GROUP BY p.id, p.name, p.kind, p.size;

create or replace view public.v_monthly_income as
  SELECT (date_trunc('month', paid_at))::date AS month, channel, sum(amount) AS total
   FROM payments GROUP BY ((date_trunc('month', paid_at))::date), channel;

create or replace view public.v_section_active_count as
  SELECT s.id AS section_id, l.code AS level_code, s.time_slot, s.is_online,
    count(*) FILTER (WHERE ((e.end_date IS NULL) AND (st.current_status = 'Active'))) AS active_count
   FROM (((sections s JOIN levels l ON ((l.id = s.level_id)))
     LEFT JOIN enrolments e ON ((e.section_id = s.id)))
     LEFT JOIN students st ON ((st.id = e.student_id)))
  GROUP BY s.id, l.code, s.time_slot, s.is_online;

create or replace view public.teachers as
  SELECT id, full_name, short_name, is_active, notes, created_at FROM employees
  WHERE (category = ANY (ARRAY['esl_teacher','admin_teacher']));

-- Functions (auth_role() guards removed; authorization is enforced in the app)
create or replace function public.recompute_invoice_status(p_invoice_id bigint)
returns void language plpgsql set search_path to 'public','pg_catalog' as $$
declare v_total bigint; v_status text; v_paid bigint;
begin
  if p_invoice_id is null then return; end if;
  select total_amount, status into v_total, v_status from invoices where id = p_invoice_id;
  if not found or v_status = 'void' then return; end if;
  select coalesce(sum(amount),0) into v_paid from payments where invoice_id = p_invoice_id;
  update invoices set status = case
      when v_total > 0 and v_paid >= v_total then 'paid'
      when v_paid > 0 then 'partial' else 'open' end
   where id = p_invoice_id and status <> 'void';
end; $$;

create or replace function public.trg_payments_reconcile()
returns trigger language plpgsql set search_path to 'public','pg_catalog' as $$
begin
  if tg_op = 'DELETE' then perform public.recompute_invoice_status(old.invoice_id); return old; end if;
  if tg_op = 'UPDATE' and old.invoice_id is distinct from new.invoice_id then perform public.recompute_invoice_status(old.invoice_id); end if;
  perform public.recompute_invoice_status(new.invoice_id); return new;
end; $$;

drop trigger if exists payments_reconcile on public.payments;
create trigger payments_reconcile after insert or update or delete on public.payments
  for each row execute function public.trg_payments_reconcile();

create or replace function public.generate_invoices_for_month(target_month date)
returns integer language plpgsql set search_path to 'public','pg_catalog' as $$
declare cnt int := 0;
begin
  insert into invoices (student_id, section_id, billing_month, total_amount, status)
  select e.student_id, e.section_id, target_month, coalesce(fs.class_fee, 0), 'open'
  from enrolments e
  join students s on s.id = e.student_id and s.current_status='Active'
  left join fee_schedule fs on fs.level_id = (select level_id from sections where id = e.section_id)
                           and target_month between fs.effective_from and coalesce(fs.effective_to, target_month)
  where e.end_date is null
    and not exists (select 1 from invoices i where i.student_id = e.student_id and i.billing_month = target_month and i.status != 'void');
  get diagnostics cnt = row_count; return cnt;
end; $$;

create or replace function public.dashboard_outstanding()
returns table(student_id integer, english_name text, myanmar_name text, open_invoices bigint, outstanding bigint, oldest_unpaid date)
language sql stable set search_path to 'public','pg_catalog' as $$
  select i.student_id, s.english_name, s.myanmar_name, count(*),
         sum(greatest(0, i.total_amount - coalesce(pp.paid,0)))::bigint, min(i.billing_month)
  from invoices i join students s on s.id = i.student_id
  left join lateral (select coalesce(sum(p.amount),0) as paid from payments p where p.invoice_id = i.id) pp on true
  where i.status in ('open','partial')
  group by i.student_id, s.english_name, s.myanmar_name
  having sum(greatest(0, i.total_amount - coalesce(pp.paid,0))) > 0
  order by 5 desc;
$$;

create or replace function public.copy_schedule_from_previous(target_month date, overwrite boolean default false)
returns table(copied integer, source_month date) language plpgsql set search_path to 'public','pg_catalog' as $$
declare src date; cnt int := 0;
begin
  select max(month) into src from schedule_assignments where month < target_month;
  if src is null then return query select 0, null::date; return; end if;
  if exists (select 1 from schedule_assignments where month = target_month) and not overwrite then
    return query select 0, src; return; end if;
  if overwrite then delete from schedule_assignments where month = target_month; end if;
  insert into schedule_assignments (month, day_of_week, time_slot, room_id, section_id, class_label, subject, mt_employee_id, ct_employee_id, notes)
  select target_month, day_of_week, time_slot, room_id, section_id, class_label, subject, mt_employee_id, ct_employee_id,
    coalesce(notes,'') || (case when notes is not null then ' · ' else '' end) || 'copied from ' || to_char(src,'Mon YYYY')
  from schedule_assignments where month = src;
  get diagnostics cnt = row_count; return query select cnt, src;
end; $$;

create or replace function public.generate_payslips_from_schedule(target_month date)
returns integer language plpgsql set search_path to 'public','pg_catalog' as $$
declare cnt int := 0; v_sat int; v_sun int; rec record; v_mt_h numeric; v_ct_h numeric; v_mt_a numeric; v_ct_a numeric; v_esl bigint;
begin
  select count(*) filter (where extract(dow from d)=6), count(*) filter (where extract(dow from d)=0)
    into v_sat, v_sun
    from generate_series(target_month, (target_month + interval '1 month' - interval '1 day')::date, interval '1 day') as d;
  for rec in
    select e.id as employee_id, coalesce(e.mt_hourly_fee,0) as mt_fee, coalesce(e.ct_hourly_fee,0) as ct_fee,
           sum(case when sa.mt_employee_id=e.id and sa.day_of_week='Sat' then 2 else 0 end)::numeric * v_sat as mt_sat_h,
           sum(case when sa.mt_employee_id=e.id and sa.day_of_week='Sun' then 2 else 0 end)::numeric * v_sun as mt_sun_h,
           sum(case when sa.ct_employee_id=e.id and sa.day_of_week='Sat' then 2 else 0 end)::numeric * v_sat as ct_sat_h,
           sum(case when sa.ct_employee_id=e.id and sa.day_of_week='Sun' then 2 else 0 end)::numeric * v_sun as ct_sun_h
    from employees e join schedule_assignments sa on (sa.mt_employee_id=e.id or sa.ct_employee_id=e.id) and sa.month=target_month
    group by e.id, e.mt_hourly_fee, e.ct_hourly_fee
  loop
    v_mt_h := rec.mt_sat_h + rec.mt_sun_h; v_ct_h := rec.ct_sat_h + rec.ct_sun_h;
    select coalesce(sum(hours) filter (where role='MT'),0), coalesce(sum(hours) filter (where role='CT'),0)
      into v_mt_a, v_ct_a from absences where employee_id=rec.employee_id and date_trunc('month', absent_date)=target_month;
    v_esl := (greatest(0,(v_mt_h - v_mt_a))::bigint * rec.mt_fee + greatest(0,(v_ct_h - v_ct_a))::bigint * rec.ct_fee);
    insert into employee_payslips (employee_id, pay_month, mt_hours, ct_hours, mt_absence_hrs, ct_absence_hrs, mt_hourly_fee, ct_hourly_fee, esl_pay)
    values (rec.employee_id, target_month, v_mt_h, v_ct_h, v_mt_a, v_ct_a, rec.mt_fee, rec.ct_fee, v_esl)
    on conflict (employee_id, pay_month) do update set
      mt_hours=excluded.mt_hours, ct_hours=excluded.ct_hours, mt_absence_hrs=excluded.mt_absence_hrs,
      ct_absence_hrs=excluded.ct_absence_hrs, mt_hourly_fee=excluded.mt_hourly_fee, ct_hourly_fee=excluded.ct_hourly_fee, esl_pay=excluded.esl_pay;
    cnt := cnt + 1;
  end loop;
  return cnt;
end; $$;

create or replace function public.dashboard_data(target_year integer default null)
returns jsonb language plpgsql stable set search_path to 'public','pg_catalog' as $$
declare
  y int := coalesce(target_year, extract(year from now())::int);
  now_d date := now()::date; this_month_start date; this_month_end date;
  year_start date; year_end date; trend_start date; trend_end date;
  active_count bigint; break_count bigint; left_count bigint; open_invoices bigint; employee_count bigint;
  this_month_pl record; year_pl record; this_month_inc record; year_inc record; trend jsonb; level_counts jsonb;
begin
  if y = extract(year from now_d)::int then this_month_start := date_trunc('month', now_d)::date;
  else this_month_start := make_date(y,12,1); end if;
  this_month_end := (this_month_start + interval '1 month')::date;
  year_start := make_date(y,1,1); year_end := make_date(y+1,1,1);
  trend_start := make_date(y-1,1,1); trend_end := make_date(y+1,1,1);
  select count(*) into active_count from students where current_status='Active';
  select count(*) into break_count from students where current_status='Break';
  select count(*) into left_count from students where current_status='Left';
  select count(*) into open_invoices from invoices where status='open';
  select count(*) into employee_count from employees where is_active = true;
  select coalesce(sum(income),0) income, coalesce(sum(expense),0) expense, coalesce(sum(net),0) net
    into this_month_pl from v_monthly_pl where month >= this_month_start and month < this_month_end;
  select coalesce(sum(income),0) income, coalesce(sum(expense),0) expense, coalesce(sum(net),0) net
    into year_pl from v_monthly_pl where month >= year_start and month < year_end;
  select coalesce(sum(case when channel='cash' then total else 0 end),0) cash, coalesce(sum(case when channel='kpay' then total else 0 end),0) kpay
    into this_month_inc from v_monthly_income where month >= this_month_start and month < this_month_end;
  select coalesce(sum(case when channel='cash' then total else 0 end),0) cash, coalesce(sum(case when channel='kpay' then total else 0 end),0) kpay
    into year_inc from v_monthly_income where month >= year_start and month < year_end;
  select coalesce(jsonb_agg(jsonb_build_object('month',to_char(month,'Mon ''YY'),'income',income,'expense',expense,'net',net) order by month),'[]'::jsonb)
    into trend from v_monthly_pl where month >= trend_start and month < trend_end;
  select coalesce(jsonb_object_agg(t.level_code, t.total_active),'{}'::jsonb) into level_counts
    from (select v.level_code, sum(v.active_count) total_active from v_section_active_count v group by v.level_code) t;
  return jsonb_build_object('fiscal_year',y,'this_month_start',this_month_start,'students_active',active_count,
    'students_break',break_count,'students_left',left_count,'employees',employee_count,'open_invoices',open_invoices,
    'this_month',jsonb_build_object('income',this_month_pl.income,'expense',this_month_pl.expense,'net',this_month_pl.net,'cash',this_month_inc.cash,'kpay',this_month_inc.kpay),
    'year_totals',jsonb_build_object('income',year_pl.income,'expense',year_pl.expense,'net',year_pl.net,'cash',year_inc.cash,'kpay',year_inc.kpay),
    'trend',trend,'level_counts',level_counts);
end; $$;
