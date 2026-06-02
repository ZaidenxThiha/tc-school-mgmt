-- Functions/triggers missed in the first schema pass.

create or replace function public.recompute_payslip(emp integer, m date)
returns void language plpgsql set search_path to 'public','pg_catalog' as $$
declare v_mt_abs numeric := 0; v_ct_abs numeric := 0;
begin
  select coalesce(sum(hours) filter (where role='MT'),0), coalesce(sum(hours) filter (where role='CT'),0)
    into v_mt_abs, v_ct_abs
    from absences a where a.employee_id = emp and date_trunc('month', a.absent_date) = m;
  update employee_payslips set
    mt_absence_hrs = v_mt_abs, ct_absence_hrs = v_ct_abs,
    esl_pay = greatest(0, mt_hours - v_mt_abs) * mt_hourly_fee + greatest(0, ct_hours - v_ct_abs) * ct_hourly_fee
  where employee_id = emp and pay_month = m;
end$$;

create or replace function public.trg_recompute_payslip_for_absence()
returns trigger language plpgsql set search_path to 'public','pg_catalog' as $$
begin
  if tg_op in ('INSERT','UPDATE') then
    perform public.recompute_payslip(new.employee_id, date_trunc('month', new.absent_date)::date);
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and (new.employee_id <> old.employee_id
        or date_trunc('month', new.absent_date) <> date_trunc('month', old.absent_date))) then
    perform public.recompute_payslip(old.employee_id, date_trunc('month', old.absent_date)::date);
  end if;
  return coalesce(new, old);
end$$;

drop trigger if exists absences_recompute on public.absences;
create trigger absences_recompute after insert or update or delete on public.absences
  for each row execute function public.trg_recompute_payslip_for_absence();

create or replace function public.sync_inventory_from_ledger()
returns trigger language plpgsql set search_path to 'public','pg_catalog' as $$
declare v_unit_cost bigint; v_qty numeric;
begin
  if (tg_op = 'UPDATE' or tg_op = 'DELETE') then
    delete from inventory_movements where related_ledger_id = old.id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.product_id is not null and new.qty is not null and new.qty > 0 then
    v_qty := new.qty;
    v_unit_cost := coalesce(new.unit_price,
      case when new.qty > 0 then ((new.expense_cash + new.expense_kpay) / nullif(new.qty, 0))::bigint else null end);
    insert into inventory_movements (product_id, direction, qty, reason, related_ledger_id, unit_cost, notes)
    values (new.product_id, 'IN', v_qty, 'purchase', new.id, v_unit_cost,
            'auto from ledger #' || new.id || coalesce(' — ' || new.description, ''));
  end if;
  return new;
end$$;

drop trigger if exists ledger_inventory_sync on public.ledger_entries;
create trigger ledger_inventory_sync after insert or update or delete on public.ledger_entries
  for each row execute function public.sync_inventory_from_ledger();
