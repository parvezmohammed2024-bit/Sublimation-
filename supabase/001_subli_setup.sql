-- ========================================================================
-- Sublimation Job Tracker: full database setup (one paste)
--
-- Run once in the Supabase SQL editor of project adbpuppyrlzigahtxpau (same project as
-- StitchPay and the KG Production Tracker). Safe to run again: it only creates or replaces
-- objects whose names start with subli_, plus one storage bucket "subli-artwork".
-- It never touches StitchPay or tracker_ tables (it only READS tracker_admins once, to give
-- the same people admin access here).
--
-- Flow:  artwork (admin job sheet + customer approval)
--     -> printing (Template & Printing team)
--     -> production (Heat Press & QC team)
--     -> ready (green only when fully paid)
--     -> delivered
--
-- Who sees prices: admin and the customer only. Team functions never return a price.
-- Team login: mobile + 4-digit PIN, checked inside the database (no Edge Function needed).
-- ========================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables
create table if not exists public.subli_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.subli_team_members (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  mobile          text not null unique,          -- digits only, 60xxxxxxxxx
  pin_hash        text not null,                 -- bcrypt
  team            text not null check (team in ('printing','production')),
  active          boolean not null default true,
  must_set_pin    boolean not null default true, -- true while still on the default PIN
  failed_attempts int not null default 0,
  locked_until    timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists public.subli_team_sessions (
  token_hash text primary key,                   -- sha256 of the token the phone holds
  member_id  uuid not null references public.subli_team_members(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.subli_customers (
  id              uuid primary key default gen_random_uuid(),
  phone           text not null unique,
  name            text,
  code            text not null check (code ~ '^\d{4}$'),
  failed_attempts int not null default 0,
  locked_until    timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists public.subli_orders (
  id               uuid primary key default gen_random_uuid(),
  tracking_no      text not null unique,
  customer_name    text not null,
  customer_phone   text,
  item_type        text not null,                -- e.g. Jersey, Round-neck T-shirt
  fabric           text,                         -- e.g. Microfiber 100% polyester
  print_type       text not null default 'full' check (print_type in ('full','partial')),
  sizes            jsonb not null default '[]'::jsonb,  -- [{"size":"M","qty":10}]
  total_qty        int not null default 0,              -- trigger
  roster           jsonb not null default '[]'::jsonb,  -- [{"name":"AHMAD","number":"10","size":"L"}]
  notes            text,
  mockups          jsonb not null default '[]'::jsonb,  -- storage paths in bucket subli-artwork
  deadline         date not null,
  price_total      numeric(10,2) not null default 0 check (price_total >= 0),
  stage            text not null default 'artwork'
                   check (stage in ('artwork','printing','production','ready','delivered','cancelled')),
  stage_status     text not null default 'waiting' check (stage_status in ('waiting','in_progress')),
  approval_status  text not null default 'not_sent'
                   check (approval_status in ('not_sent','waiting','approved','changes')),
  approval_round   int not null default 1,
  approval_note    text,                         -- customer's change request
  approved_at      timestamptz,
  approved_by      text check (approved_by in ('customer','admin')),
  phone_attempts   int not null default 0,       -- wrong phone numbers on the approval form
  phone_locked_until timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid default auth.uid()
);
create index if not exists subli_orders_stage_idx on public.subli_orders (stage, deadline);

create table if not exists public.subli_progress (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.subli_orders(id) on delete cascade,
  step       text not null check (step in ('printed','pressed','qc_pass','qc_reject','reprinted')),
  qty        int not null check (qty > 0),
  reason     text,                               -- QC reject reason
  member_id  uuid references public.subli_team_members(id) on delete set null,
  by_name    text,
  created_at timestamptz not null default now()
);
create index if not exists subli_progress_order_idx on public.subli_progress (order_id, created_at);

create table if not exists public.subli_payments (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.subli_orders(id) on delete cascade,
  amount     numeric(10,2) not null check (amount > 0),
  method     text,                               -- Cash, Bank transfer, DuitNow ...
  note       text,
  paid_on    date not null default (now() at time zone 'Asia/Kuala_Lumpur')::date,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index if not exists subli_payments_order_idx on public.subli_payments (order_id);

create table if not exists public.subli_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.subli_orders(id) on delete cascade,
  stage      text not null,
  action     text not null,                      -- started, completed, moved_by_admin, sent_for_approval, approved, changes_requested
  note       text,
  by_name    text,
  created_at timestamptz not null default now()
);
create index if not exists subli_events_order_idx on public.subli_events (order_id, created_at);

-- --------------------------------------------------------------- helpers
create or replace function public.subli_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.subli_admins where user_id = auth.uid());
$$;

create or replace function public.subli_normalize_mobile(p text)
returns text language sql immutable as $$
  select case
    when regexp_replace(coalesce(p,''), '\D', '', 'g') like '0%'
      then '6' || regexp_replace(coalesce(p,''), '\D', '', 'g')
    else regexp_replace(coalesce(p,''), '\D', '', 'g')
  end;
$$;

-- SB-YYMM-XXXX, random (not countable), no 0/O/1/I
create or replace function public.subli_next_tracking_no()
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  c_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_ym text := to_char(now() at time zone 'Asia/Kuala_Lumpur', 'YYMM');
  v_bytes bytea; v_code text; v_no text; v_try int := 0;
begin
  loop
    v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    v_code := '';
    for i in 0..3 loop
      v_code := v_code || substr(c_alpha, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;
    v_no := 'SB-' || v_ym || '-' || v_code;
    exit when not exists (select 1 from public.subli_orders where tracking_no = v_no);
    v_try := v_try + 1;
    if v_try > 20 then raise exception 'could not allocate a tracking number'; end if;
  end loop;
  return v_no;
end $$;

create or replace function public.subli_orders_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and coalesce(new.tracking_no, '') = '' then
    new.tracking_no := public.subli_next_tracking_no();
  end if;
  if jsonb_typeof(new.sizes) is distinct from 'array' then
    raise exception 'sizes must be a JSON array of {size, qty}';
  end if;
  if jsonb_typeof(new.roster) is distinct from 'array' then new.roster := '[]'::jsonb; end if;
  if jsonb_typeof(new.mockups) is distinct from 'array' then new.mockups := '[]'::jsonb; end if;
  select coalesce(sum((e->>'qty')::int), 0) into new.total_qty from jsonb_array_elements(new.sizes) e;
  if new.total_qty <= 0 then raise exception 'order needs at least one piece'; end if;
  new.customer_phone := nullif(public.subli_normalize_mobile(new.customer_phone), '');
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists subli_orders_before_write on public.subli_orders;
create trigger subli_orders_before_write before insert or update on public.subli_orders
  for each row execute function public.subli_orders_before_write();

-- progress totals for one order
create or replace function public.subli_sums(p_order_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with s as (
    select
      coalesce(sum(qty) filter (where step = 'printed'),   0)::int as printed,
      coalesce(sum(qty) filter (where step = 'pressed'),   0)::int as pressed,
      coalesce(sum(qty) filter (where step = 'qc_pass'),   0)::int as passed,
      coalesce(sum(qty) filter (where step = 'qc_reject'), 0)::int as rejected,
      coalesce(sum(qty) filter (where step = 'reprinted'), 0)::int as reprinted
    from public.subli_progress where order_id = p_order_id
  )
  select jsonb_build_object('printed', printed, 'pressed', pressed, 'passed', passed,
    'rejected', rejected, 'reprinted', reprinted,
    'reprint_pending', greatest(rejected - reprinted, 0)) from s;
$$;

create or replace function public.subli_paid(p_order_id uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0) from public.subli_payments where order_id = p_order_id;
$$;

-- order as a team sees it: NO prices, NO payments
create or replace function public.subli_order_team_json(o public.subli_orders)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', o.id, 'tracking_no', o.tracking_no, 'customer_name', o.customer_name,
    'item_type', o.item_type, 'fabric', o.fabric, 'print_type', o.print_type,
    'sizes', o.sizes, 'total_qty', o.total_qty, 'roster', o.roster, 'notes', o.notes,
    'mockups', o.mockups, 'deadline', o.deadline, 'stage', o.stage, 'stage_status', o.stage_status,
    'approval_status', o.approval_status, 'created_at', o.created_at,
    'sums', public.subli_sums(o.id));
$$;

-- ---------------------------------------------------------- team login
create or replace function public.subli_session_member(p_token text)
returns public.subli_team_members language plpgsql volatile security definer
set search_path = public, extensions as $$
declare m public.subli_team_members;
begin
  select tm.* into m
  from public.subli_team_sessions s join public.subli_team_members tm on tm.id = s.member_id
  where s.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and s.expires_at > now() and tm.active;
  if not found then raise exception 'session_expired' using errcode = 'P0001'; end if;
  return m;
end $$;

create or replace function public.subli_issue_session(p_member_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_token text := encode(gen_random_bytes(32), 'hex'); v_exp timestamptz := now() + interval '14 hours';
begin
  delete from public.subli_team_sessions where expires_at < now();
  insert into public.subli_team_sessions (token_hash, member_id, expires_at)
  values (encode(digest(v_token, 'sha256'), 'hex'), p_member_id, v_exp);
  return jsonb_build_object('token', v_token, 'expires_at', extract(epoch from v_exp)::bigint);
end $$;

-- mobile + PIN -> session. Same answer for unknown number / wrong PIN. 5 wrong PINs = 15 min lock.
create or replace function public.subli_team_login(p_mobile text, p_pin text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_mobile text := public.subli_normalize_mobile(p_mobile); m public.subli_team_members; v_att int; v_s jsonb;
begin
  if length(v_mobile) < 10 or coalesce(p_pin, '') !~ '^\d{4}$' then
    return jsonb_build_object('error', 'invalid_credentials');
  end if;
  select * into m from public.subli_team_members where mobile = v_mobile for update;
  if not found or not m.active then return jsonb_build_object('error', 'invalid_credentials'); end if;
  if m.locked_until is not null and m.locked_until > now() then
    return jsonb_build_object('error', 'locked', 'locked_until', m.locked_until);
  end if;
  if crypt(p_pin, m.pin_hash) <> m.pin_hash then
    v_att := m.failed_attempts + 1;
    if v_att >= 5 then
      update public.subli_team_members set failed_attempts = 0, locked_until = now() + interval '15 minutes' where id = m.id;
      return jsonb_build_object('error', 'locked', 'locked_until', now() + interval '15 minutes');
    end if;
    update public.subli_team_members set failed_attempts = v_att where id = m.id;
    return jsonb_build_object('error', 'invalid_credentials');
  end if;
  update public.subli_team_members set failed_attempts = 0, locked_until = null where id = m.id;
  v_s := public.subli_issue_session(m.id);
  return v_s || jsonb_build_object('member', jsonb_build_object(
    'id', m.id, 'name', m.name, 'team', m.team, 'mobile', m.mobile, 'must_set_pin', m.must_set_pin));
end $$;

create or replace function public.subli_team_set_pin(p_token text, p_new_pin text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare m public.subli_team_members;
begin
  m := public.subli_session_member(p_token);
  if coalesce(p_new_pin, '') !~ '^\d{4}$' then return jsonb_build_object('error', 'invalid_new_pin'); end if;
  update public.subli_team_members
     set pin_hash = crypt(p_new_pin, gen_salt('bf', 10)), must_set_pin = (p_new_pin = right(m.mobile, 4))
   where id = m.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.subli_team_logout(p_token text)
returns void language sql volatile security definer set search_path = public, extensions as $$
  delete from public.subli_team_sessions where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

-- ------------------------------------------------------------ team work
-- Printing sees: its own stage + orders in production that need a reprint.
-- Production sees: its own stage. Both see a "coming next" list and a factory board (no prices).
create or replace function public.subli_team_queue(p_token text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare m public.subli_team_members;
begin
  m := public.subli_session_member(p_token);
  return jsonb_build_object(
    'member', jsonb_build_object('id', m.id, 'name', m.name, 'team', m.team, 'must_set_pin', m.must_set_pin),
    'orders', coalesce((
      select jsonb_agg(public.subli_order_team_json(o) order by o.deadline, o.created_at)
      from public.subli_orders o
      where o.stage = m.team
         or (m.team = 'printing' and o.stage = 'production'
             and (public.subli_sums(o.id)->>'reprint_pending')::int > 0)), '[]'::jsonb),
    'coming', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'tracking_no', o.tracking_no,
               'customer_name', o.customer_name, 'item_type', o.item_type, 'total_qty', o.total_qty,
               'deadline', o.deadline, 'stage', o.stage, 'stage_status', o.stage_status,
               'approval_status', o.approval_status, 'sums', public.subli_sums(o.id))
             order by o.deadline, o.created_at)
      from public.subli_orders o
      where o.stage in ('artwork','printing','production') and o.stage <> m.team), '[]'::jsonb),
    'log', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'order_id', p.order_id, 'step', p.step,
               'qty', p.qty, 'reason', p.reason, 'by_name', p.by_name, 'created_at', p.created_at,
               'mine', p.member_id = m.id) order by p.created_at desc)
      from public.subli_progress p join public.subli_orders o on o.id = p.order_id
      where o.stage in ('printing','production')), '[]'::jsonb)
  );
end $$;

create or replace function public.subli_team_start(p_token text, p_order_id uuid)
returns void language plpgsql volatile security definer set search_path = public, extensions as $$
declare m public.subli_team_members; o public.subli_orders;
begin
  m := public.subli_session_member(p_token);
  select * into o from public.subli_orders where id = p_order_id for update;
  if not found or o.stage <> m.team then raise exception 'This job is not in your queue'; end if;
  if o.stage_status = 'in_progress' then return; end if;
  update public.subli_orders set stage_status = 'in_progress' where id = o.id;
  insert into public.subli_events (order_id, stage, action, by_name) values (o.id, o.stage, 'started', m.name);
end $$;

-- printing: 'printed', 'reprinted'   production: 'pressed', 'qc_pass', 'qc_reject'
create or replace function public.subli_team_log(p_token text, p_order_id uuid, p_step text, p_qty int, p_reason text default null)
returns void language plpgsql volatile security definer set search_path = public, extensions as $$
declare m public.subli_team_members; o public.subli_orders; s jsonb;
begin
  m := public.subli_session_member(p_token);
  select * into o from public.subli_orders where id = p_order_id for update;
  if not found then raise exception 'Job not found'; end if;
  if p_qty is null or p_qty <= 0 or p_qty > 100000 then raise exception 'Enter a quantity'; end if;
  s := public.subli_sums(o.id);

  if p_step = 'printed' then
    if m.team <> 'printing' or o.stage <> 'printing' then raise exception 'This job is not in printing'; end if;
    if o.stage_status <> 'in_progress' then raise exception 'Tap Start first'; end if;
  elsif p_step = 'reprinted' then
    if m.team <> 'printing' then raise exception 'Printing team only'; end if;
    if p_qty > (s->>'reprint_pending')::int then
      raise exception 'Only % piece(s) need a reprint', (s->>'reprint_pending');
    end if;
  elsif p_step in ('pressed','qc_pass','qc_reject') then
    if m.team <> 'production' or o.stage <> 'production' then raise exception 'This job is not in production'; end if;
    if o.stage_status <> 'in_progress' then raise exception 'Tap Start first'; end if;
    if p_step = 'qc_pass' and (s->>'passed')::int + p_qty > o.total_qty then
      raise exception 'QC passed cannot be more than the order quantity (%)', o.total_qty;
    end if;
    if p_step = 'qc_reject' and coalesce(trim(p_reason), '') = '' then raise exception 'Choose a reason'; end if;
  else
    raise exception 'Unknown step';
  end if;

  insert into public.subli_progress (order_id, step, qty, reason, member_id, by_name)
  values (o.id, p_step, p_qty, nullif(trim(coalesce(p_reason, '')), ''), m.id, m.name);
  update public.subli_orders set updated_at = now() where id = o.id;
end $$;

-- undo your own entry within 2 hours, while the job is still in the workshop
create or replace function public.subli_team_undo(p_token text, p_entry_id uuid)
returns void language plpgsql volatile security definer set search_path = public, extensions as $$
declare m public.subli_team_members;
begin
  m := public.subli_session_member(p_token);
  delete from public.subli_progress p using public.subli_orders o
   where p.id = p_entry_id and o.id = p.order_id and p.member_id = m.id
     and p.created_at > now() - interval '2 hours' and o.stage in ('printing','production');
  if not found then raise exception 'This entry can no longer be removed. Ask the admin.'; end if;
end $$;

create or replace function public.subli_team_done(p_token text, p_order_id uuid)
returns void language plpgsql volatile security definer set search_path = public, extensions as $$
declare m public.subli_team_members; o public.subli_orders; s jsonb; v_next text;
begin
  m := public.subli_session_member(p_token);
  select * into o from public.subli_orders where id = p_order_id for update;
  if not found or o.stage <> m.team then raise exception 'This job is not in your queue'; end if;
  if o.stage_status <> 'in_progress' then raise exception 'Tap Start first'; end if;
  s := public.subli_sums(o.id);
  if o.stage = 'production' then
    if (s->>'reprint_pending')::int > 0 then raise exception 'Waiting for % reprint(s) from Printing', s->>'reprint_pending'; end if;
    if (s->>'passed')::int < o.total_qty then
      raise exception 'QC passed % of %. Finish QC first.', s->>'passed', o.total_qty;
    end if;
    v_next := 'ready';
  else
    v_next := 'production';
  end if;
  update public.subli_orders set stage = v_next, stage_status = 'waiting' where id = o.id;
  insert into public.subli_events (order_id, stage, action, by_name) values (o.id, o.stage, 'completed', m.name);
end $$;

-- ------------------------------------------------------------ admin work
create or replace function public.subli_create_team_member(p_name text, p_mobile text, p_team text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_mobile text := public.subli_normalize_mobile(p_mobile);
begin
  if not public.subli_is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Name is required'; end if;
  if length(v_mobile) < 10 or length(v_mobile) > 13 then raise exception 'Invalid mobile number'; end if;
  if p_team not in ('printing','production') then raise exception 'Unknown section'; end if;
  insert into public.subli_team_members (name, mobile, pin_hash, team)
  values (trim(p_name), v_mobile, crypt(right(v_mobile, 4), gen_salt('bf', 10)), p_team)
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'A worker with this mobile number already exists';
end $$;

create or replace function public.subli_reset_member_pin(p_member_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.subli_is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  update public.subli_team_members
     set pin_hash = crypt(right(mobile, 4), gen_salt('bf', 10)), must_set_pin = true,
         failed_attempts = 0, locked_until = null
   where id = p_member_id;
  delete from public.subli_team_sessions where member_id = p_member_id;
end $$;

create or replace function public.subli_update_member(p_member_id uuid, p_team text, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.subli_is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if p_team not in ('printing','production') then raise exception 'Unknown section'; end if;
  update public.subli_team_members set team = p_team, active = p_active where id = p_member_id;
  if not p_active then delete from public.subli_team_sessions where member_id = p_member_id; end if;
end $$;

-- p_action: 'send' (ask customer), 'approve' (approved by admin, e.g. on WhatsApp), 'reset'
create or replace function public.subli_admin_approval(p_order_id uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare o public.subli_orders;
begin
  if not public.subli_is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  select * into o from public.subli_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if p_action = 'send' then
    if jsonb_array_length(o.mockups) = 0 then raise exception 'Upload the mockup first'; end if;
    update public.subli_orders
       set approval_status = 'waiting',
           approval_round = case when o.approval_status = 'changes' then o.approval_round + 1 else o.approval_round end,
           phone_attempts = 0, phone_locked_until = null
     where id = o.id;
    insert into public.subli_events (order_id, stage, action) values (o.id, 'artwork', 'sent_for_approval');
  elsif p_action = 'approve' then
    update public.subli_orders
       set approval_status = 'approved', approved_at = now(), approved_by = 'admin',
           stage = case when o.stage = 'artwork' then 'printing' else o.stage end,
           stage_status = case when o.stage = 'artwork' then 'waiting' else o.stage_status end
     where id = o.id;
    insert into public.subli_events (order_id, stage, action, note) values (o.id, 'artwork', 'approved', 'by admin');
  elsif p_action = 'reset' then
    update public.subli_orders set approval_status = 'not_sent', approved_at = null, approved_by = null where id = o.id;
  else
    raise exception 'Unknown action';
  end if;
end $$;

create or replace function public.subli_admin_move(p_order_id uuid, p_stage text, p_force boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare o public.subli_orders;
begin
  if not public.subli_is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if p_stage not in ('artwork','printing','production','ready','delivered','cancelled') then
    raise exception 'Unknown stage';
  end if;
  select * into o from public.subli_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if p_stage = 'delivered' and not p_force and o.price_total > public.subli_paid(o.id) then
    raise exception 'BALANCE_DUE';
  end if;
  update public.subli_orders set stage = p_stage, stage_status = 'waiting' where id = o.id;
  insert into public.subli_events (order_id, stage, action, note)
  values (o.id, p_stage, 'moved_by_admin', case when p_force then 'delivered with balance due' end);
end $$;

-- ------------------------------------------------------------ customers
create or replace function public.subli_random_code()
returns text language sql volatile as $$
  select lpad(((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint % 10000))::text, 4, '0');
$$;

create or replace function public.subli_customer_for_phone(p_phone text, p_name text default null)
returns table (id uuid, phone text, name text, code text)
language plpgsql security definer set search_path = public as $$
declare v_phone text := public.subli_normalize_mobile(p_phone);
begin
  if not public.subli_is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if length(v_phone) < 10 or length(v_phone) > 13 then raise exception 'Invalid phone number'; end if;
  insert into public.subli_customers (phone, name, code)
  values (v_phone, nullif(trim(coalesce(p_name, '')), ''), public.subli_random_code())
  on conflict on constraint subli_customers_phone_key do update
    set name = coalesce(public.subli_customers.name, excluded.name);
  return query select c.id, c.phone, c.name, c.code from public.subli_customers c where c.phone = v_phone;
end $$;

create or replace function public.subli_customer_new_code(p_customer_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text := public.subli_random_code();
begin
  if not public.subli_is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  update public.subli_customers set code = v_code, failed_attempts = 0, locked_until = null where id = p_customer_id;
  return v_code;
end $$;

-- --------------------------------------------------------- public (anon)
create or replace function public.subli_public_json(o public.subli_orders)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'tracking_no', o.tracking_no, 'customer_name', o.customer_name, 'item_type', o.item_type,
    'fabric', o.fabric, 'total_qty', o.total_qty, 'sizes', o.sizes, 'roster', o.roster,
    'mockups', o.mockups, 'deadline', o.deadline, 'stage', o.stage, 'stage_status', o.stage_status,
    'approval_status', o.approval_status, 'approval_round', o.approval_round, 'approval_note', o.approval_note,
    'approved_at', o.approved_at, 'received_at', o.created_at,
    'price_total', o.price_total, 'paid', public.subli_paid(o.id),
    'balance', greatest(o.price_total - public.subli_paid(o.id), 0),
    'sums', public.subli_sums(o.id),
    'done', jsonb_build_object(
      'artwork',    o.approved_at,
      'printing',   (select max(created_at) from public.subli_events e where e.order_id = o.id and e.stage = 'printing'   and e.action = 'completed'),
      'production', (select max(created_at) from public.subli_events e where e.order_id = o.id and e.stage = 'production' and e.action = 'completed'),
      'delivered',  (select max(created_at) from public.subli_events e where e.order_id = o.id and e.stage = 'delivered'  and e.action = 'moved_by_admin')));
$$;

create or replace function public.subli_track_order(p_tracking_no text)
returns jsonb language sql stable security definer set search_path = public as $$
  select public.subli_public_json(o) from public.subli_orders o
  where o.tracking_no = upper(trim(p_tracking_no)) and o.stage <> 'cancelled';
$$;

-- Customer approves the mockup or asks for changes. Needs the phone number on the order.
create or replace function public.subli_customer_decide(p_tracking_no text, p_phone text, p_approve boolean, p_note text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare o public.subli_orders;
begin
  select * into o from public.subli_orders where tracking_no = upper(trim(p_tracking_no)) for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if o.approval_status <> 'waiting' then return jsonb_build_object('error', 'not_waiting'); end if;
  if o.phone_locked_until is not null and o.phone_locked_until > now() then
    return jsonb_build_object('error', 'locked');
  end if;
  if o.customer_phone is null then return jsonb_build_object('error', 'no_phone'); end if;
  if public.subli_normalize_mobile(p_phone) <> o.customer_phone then
    if o.phone_attempts + 1 >= 5 then
      update public.subli_orders set phone_attempts = 0, phone_locked_until = now() + interval '15 minutes' where id = o.id;
      return jsonb_build_object('error', 'locked');
    end if;
    update public.subli_orders set phone_attempts = o.phone_attempts + 1 where id = o.id;
    return jsonb_build_object('error', 'wrong_phone');
  end if;
  if p_approve then
    update public.subli_orders
       set approval_status = 'approved', approved_at = now(), approved_by = 'customer', approval_note = null,
           phone_attempts = 0,
           stage = case when o.stage = 'artwork' then 'printing' else o.stage end,
           stage_status = case when o.stage = 'artwork' then 'waiting' else o.stage_status end
     where id = o.id;
    insert into public.subli_events (order_id, stage, action, by_name) values (o.id, 'artwork', 'approved', 'customer');
    return jsonb_build_object('status', 'approved');
  else
    if coalesce(trim(p_note), '') = '' then return jsonb_build_object('error', 'note_required'); end if;
    update public.subli_orders set approval_status = 'changes', approval_note = left(trim(p_note), 1000), phone_attempts = 0
     where id = o.id;
    insert into public.subli_events (order_id, stage, action, note, by_name)
    values (o.id, 'artwork', 'changes_requested', left(trim(p_note), 1000), 'customer');
    return jsonb_build_object('status', 'changes');
  end if;
end $$;

-- "My orders": phone + 4-digit code -> active orders (delivered/cancelled drop off)
create or replace function public.subli_track_customer(p_phone text, p_code text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_phone text := public.subli_normalize_mobile(p_phone); c public.subli_customers; v_att int;
begin
  if length(v_phone) < 10 or coalesce(p_code, '') !~ '^\d{4}$' then return jsonb_build_object('error', 'invalid'); end if;
  select * into c from public.subli_customers where phone = v_phone for update;
  if not found then return jsonb_build_object('error', 'invalid'); end if;
  if c.locked_until is not null and c.locked_until > now() then
    return jsonb_build_object('error', 'locked', 'locked_until', c.locked_until);
  end if;
  if c.code <> p_code then
    v_att := c.failed_attempts + 1;
    if v_att >= 5 then
      update public.subli_customers set failed_attempts = 0, locked_until = now() + interval '15 minutes' where id = c.id;
      return jsonb_build_object('error', 'locked');
    end if;
    update public.subli_customers set failed_attempts = v_att where id = c.id;
    return jsonb_build_object('error', 'invalid');
  end if;
  update public.subli_customers set failed_attempts = 0, locked_until = null where id = c.id;
  return jsonb_build_object('name', c.name, 'orders', coalesce((
    select jsonb_agg(public.subli_public_json(o) order by o.deadline, o.created_at)
    from public.subli_orders o
    where o.customer_phone = c.phone and o.stage not in ('delivered','cancelled')), '[]'::jsonb));
end $$;

-- ------------------------------------------------- row level security
alter table public.subli_admins        enable row level security;
alter table public.subli_team_members  enable row level security;
alter table public.subli_team_sessions enable row level security;
alter table public.subli_customers     enable row level security;
alter table public.subli_orders        enable row level security;
alter table public.subli_progress      enable row level security;
alter table public.subli_payments      enable row level security;
alter table public.subli_events        enable row level security;

revoke all on public.subli_admins, public.subli_team_members, public.subli_team_sessions,
  public.subli_customers, public.subli_orders, public.subli_progress, public.subli_payments,
  public.subli_events from anon;
revoke all on public.subli_team_sessions from authenticated;

drop policy if exists subli_admins_self on public.subli_admins;
create policy subli_admins_self on public.subli_admins for select to authenticated using (user_id = auth.uid());

-- workers: admin reads (never the PIN hash); writes only through the functions above
revoke all on public.subli_team_members from authenticated;
grant select (id, name, mobile, team, active, must_set_pin, failed_attempts, locked_until, created_at)
  on public.subli_team_members to authenticated;
drop policy if exists subli_members_admin on public.subli_team_members;
create policy subli_members_admin on public.subli_team_members for select to authenticated using (public.subli_is_admin());

do $$
declare t text;
begin
  foreach t in array array['subli_customers','subli_orders','subli_progress','subli_payments','subli_events'] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.subli_is_admin()) with check (public.subli_is_admin())', t || '_admin_all', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ------------------------------------------------------- function grants
do $$
declare f text;
begin
  -- internal helpers: nobody calls these directly
  foreach f in array array[
    'subli_session_member(text)', 'subli_issue_session(uuid)', 'subli_next_tracking_no()',
    'subli_random_code()', 'subli_order_team_json(public.subli_orders)', 'subli_public_json(public.subli_orders)',
    'subli_sums(uuid)', 'subli_paid(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  -- admin (signed in with email): each checks subli_is_admin() itself
  foreach f in array array[
    'subli_is_admin()', 'subli_create_team_member(text,text,text)', 'subli_reset_member_pin(uuid)',
    'subli_update_member(uuid,text,boolean)', 'subli_admin_approval(uuid,text)',
    'subli_admin_move(uuid,text,boolean)', 'subli_customer_for_phone(text,text)',
    'subli_customer_new_code(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- public + teams (teams use the anon key and prove who they are with their session token)
  foreach f in array array[
    'subli_team_login(text,text)', 'subli_team_set_pin(text,text)', 'subli_team_logout(text)',
    'subli_team_queue(text)', 'subli_team_start(text,uuid)', 'subli_team_log(text,uuid,text,int,text)',
    'subli_team_undo(text,uuid)', 'subli_team_done(text,uuid)', 'subli_track_order(text)',
    'subli_customer_decide(text,text,boolean,text)', 'subli_track_customer(text,text)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;
-- admins need the totals on their screens
grant execute on function public.subli_sums(uuid), public.subli_paid(uuid) to authenticated;

-- ----------------------------------------------------- artwork storage
-- Public bucket: mockups are shown on the customer tracking page. Files get random names,
-- so a link can't be guessed. Only admins can upload, replace or delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('subli-artwork', 'subli-artwork', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true;

drop policy if exists subli_artwork_admin_insert on storage.objects;
create policy subli_artwork_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'subli-artwork' and public.subli_is_admin());
drop policy if exists subli_artwork_admin_update on storage.objects;
create policy subli_artwork_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'subli-artwork' and public.subli_is_admin());
drop policy if exists subli_artwork_admin_delete on storage.objects;
create policy subli_artwork_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'subli-artwork' and public.subli_is_admin());

-- --------------------------------------------------- first admin(s)
-- The people who are admins of the KG Production Tracker become admins here too.
insert into public.subli_admins (user_id)
select user_id from public.tracker_admins
on conflict do nothing;

select 'Sublimation tracker ready. Admins: ' || (select count(*) from public.subli_admins) as result;
