-- 0003_quotes_jobs.sql — Phase 2: quotation line detail, rush fee, price tiers, safer job numbering.

alter table garment_types add column price_tiers jsonb not null default '[]';  -- [{"minQty":1,"priceSen":6500}, ...]

alter table quotations
  add column rush_fee numeric(12,2) not null default 0 check (rush_fee >= 0),
  add column priority job_priority not null default 'normal',
  add column due_date date;

alter table quotation_items
  add column garment_type_id uuid references garment_types(id),
  add column fabric_id uuid references fabrics(id),
  add column collar_type_id uuid references collar_types(id),
  add column sleeve text check (sleeve in ('short','long','sleeveless')),
  add column cutting text check (cutting in ('regular','slim','muslimah')),
  add column notes text;

alter table jobs
  add column subtotal numeric(12,2) not null default 0,
  add column rush_fee numeric(12,2) not null default 0,
  add column tax_amount numeric(12,2) not null default 0;

-- A quotation converts to at most one job.
create unique index jobs_one_per_quotation on jobs (quotation_id) where quotation_id is not null;

-- Numbering: only admins of the same shop may draw a number (functions are security definer).
create or replace function next_job_no(p_shop uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_period text := to_char(now() at time zone 'Asia/Kuala_Lumpur', 'YYMM'); v_no int; v_prefix text;
begin
  if auth.uid() is not null and not (is_admin() and p_shop = auth_shop()) then
    raise exception 'not allowed';
  end if;
  select job_prefix into v_prefix from settings where shop_id = p_shop;
  insert into job_counters (shop_id, period, last_no) values (p_shop, v_period, 1)
    on conflict (shop_id, period) do update set last_no = job_counters.last_no + 1
    returning last_no into v_no;
  return coalesce(v_prefix,'SB') || '-' || v_period || '-' || lpad(v_no::text, 4, '0');
end $$;

-- Quotation numbers: Q-YYMM-0001, counted in the same table under a 'Q'-prefixed period.
create or replace function next_quote_no(p_shop uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_ym text := to_char(now() at time zone 'Asia/Kuala_Lumpur', 'YYMM'); v_no int;
begin
  if auth.uid() is not null and not (is_admin() and p_shop = auth_shop()) then
    raise exception 'not allowed';
  end if;
  insert into job_counters (shop_id, period, last_no) values (p_shop, 'Q' || v_ym, 1)
    on conflict (shop_id, period) do update set last_no = job_counters.last_no + 1
    returning last_no into v_no;
  return 'Q-' || v_ym || '-' || lpad(v_no::text, 4, '0');
end $$;

-- Anonymous callers must not draw numbers.
revoke execute on function next_job_no(uuid) from public, anon;
revoke execute on function next_quote_no(uuid) from public, anon;
grant execute on function next_job_no(uuid) to authenticated;
grant execute on function next_quote_no(uuid) to authenticated;
