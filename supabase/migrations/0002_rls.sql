-- 0002_rls.sql — Row Level Security for every table.
-- Customers have no DB access: the public tracking page runs on the server with the
-- service-role key and looks jobs up by unguessable token. NEVER expose that key to the browser.

create or replace function auth_shop() returns uuid
language sql stable security definer set search_path = public as
$$ select shop_id from profiles where id = auth.uid() and active $$;

create or replace function auth_role() returns user_role
language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() and active $$;

create or replace function is_admin() returns boolean
language sql stable as $$ select coalesce(auth_role() in ('super_admin','admin'), false) $$;

create or replace function is_super() returns boolean
language sql stable as $$ select coalesce(auth_role() = 'super_admin', false) $$;

-- Sections each role works in (mirrors SECTION_ROLES in src/lib/rules/stages.ts).
create or replace function role_sections(r user_role) returns text[]
language sql immutable as $$
  select case r
    when 'designer' then array['design']
    when 'template' then array['template']
    when 'printing' then array['printing']
    when 'cutting_sewing' then array['sewing']
    when 'qc' then array['qc']
    when 'dispatch' then array['dispatch']
    else array['sales','design','template','printing','sewing','qc','dispatch']
  end $$;

-- A user can see a job if it's in their shop and (admin | job sits in their section | assigned designer).
create or replace function can_see_job(p_shop uuid, p_stage text, p_designer uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_shop = auth_shop() and (
    is_admin()
    or p_designer = auth.uid()
    or exists (select 1 from stages s
               where s.shop_id = p_shop and s.key = p_stage
                 and s.section = any (role_sections(auth_role())))
  )
$$;

-- ---------------------------------------------------------------- enable RLS everywhere
do $$
declare t text;
begin
  foreach t in array array[
    'shops','profiles','settings','stages','garment_types','fabrics','collar_types','size_charts',
    'customers','quotations','quotation_items','job_counters','jobs','job_items','job_stage_events',
    'mockups','approvals','name_list_entries','print_files','payments','qc_inspections','qc_defects',
    'deliveries','attachments','notifications','audit_log'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- shop-level + catalogue
create policy shops_read on shops for select using (id = auth_shop());
create policy shops_write on shops for update using (is_super() and id = auth_shop());

create policy profiles_read on profiles for select using (shop_id = auth_shop());
create policy profiles_self_update on profiles for update
  using (id = auth.uid()) with check (id = auth.uid() and role = auth_role() and shop_id = auth_shop());
create policy profiles_super_all on profiles for all
  using (is_super() and shop_id = auth_shop()) with check (is_super() and shop_id = auth_shop());

create policy settings_read on settings for select using (shop_id = auth_shop());
create policy settings_write on settings for all
  using (is_super() and shop_id = auth_shop()) with check (is_super() and shop_id = auth_shop());

do $$
declare t text;
begin
  foreach t in array array['stages','garment_types','fabrics','collar_types','size_charts'] loop
    execute format('create policy %1$s_read on %1$s for select using (shop_id = auth_shop())', t);
    execute format('create policy %1$s_write on %1$s for all
                    using (is_super() and shop_id = auth_shop())
                    with check (is_super() and shop_id = auth_shop())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- sales: customers & quotes (admin only)
create policy customers_rw on customers for all
  using (is_admin() and shop_id = auth_shop()) with check (is_admin() and shop_id = auth_shop());
-- Production staff can read customer name/phone for jobs they can see.
create policy customers_read_via_job on customers for select using (
  exists (select 1 from jobs j where j.customer_id = customers.id));

create policy quotations_rw on quotations for all
  using (is_admin() and shop_id = auth_shop()) with check (is_admin() and shop_id = auth_shop());
create policy quotation_items_rw on quotation_items for all
  using (is_admin() and shop_id = auth_shop()) with check (is_admin() and shop_id = auth_shop());

-- ---------------------------------------------------------------- jobs
create policy jobs_read on jobs for select using (can_see_job(shop_id, stage_key, designer_id));
create policy jobs_admin_write on jobs for all
  using (is_admin() and shop_id = auth_shop()) with check (is_admin() and shop_id = auth_shop());
-- Section staff may update their jobs, but stage changes go through the server action that
-- runs evaluateTransition(); the guard flags below cannot be flipped by non-admins directly.
create policy jobs_section_update on jobs for update
  using (can_see_job(shop_id, stage_key, designer_id))
  with check (shop_id = auth_shop());

create or replace function protect_job_guards() returns trigger
language plpgsql as $$
begin
  if not coalesce(is_admin(), false) and auth.uid() is not null then
    if new.design_approved is distinct from old.design_approved
       or new.name_list_confirmed is distinct from old.name_list_confirmed
       or new.total is distinct from old.total
       or new.deposit_waived is distinct from old.deposit_waived
       or new.tracking_token is distinct from old.tracking_token then
      raise exception 'Only admins may change approval, total or payment guard fields';
    end if;
  end if;
  return new;
end $$;
create trigger jobs_protect_guards before update on jobs
  for each row execute function protect_job_guards();

-- Design lock: once approved, mockups and name list are frozen unless a super admin unlocked
-- the job (which flips design_approved back to false via the unlock transition).
create or replace function lock_mockups() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from jobs where id = coalesce(new.job_id, old.job_id) and design_approved)
     and tg_op in ('UPDATE','DELETE') and old.status = 'approved' then
    raise exception 'Design is locked. A Super Admin must unlock it with a reason.';
  end if;
  return coalesce(new, old);
end $$;
create trigger mockups_lock before update or delete on mockups
  for each row execute function lock_mockups();

-- ---------------------------------------------------------------- job children (visible with the job)
do $$
declare t text;
begin
  foreach t in array array['job_items','job_stage_events','mockups','approvals','name_list_entries',
                           'print_files','qc_inspections','qc_defects','deliveries','attachments'] loop
    execute format('create policy %1$s_read on %1$s for select using (
      exists (select 1 from jobs j where j.id = %1$s.job_id))', t);
    execute format('create policy %1$s_admin_write on %1$s for all
      using (is_admin() and shop_id = auth_shop()) with check (is_admin() and shop_id = auth_shop())', t);
  end loop;
end $$;

-- Section-specific writes
create policy mockups_designer_write on mockups for insert
  with check (auth_role() = 'designer' and shop_id = auth_shop());
create policy print_files_template_write on print_files for insert
  with check (auth_role() = 'template' and shop_id = auth_shop());
create policy qc_inspections_qc_write on qc_inspections for insert
  with check (auth_role() = 'qc' and shop_id = auth_shop());
create policy qc_defects_qc_write on qc_defects for insert
  with check (auth_role() = 'qc' and shop_id = auth_shop());
create policy qc_defects_resolve on qc_defects for update
  using (auth_role() in ('qc','cutting_sewing','printing') and shop_id = auth_shop());
create policy deliveries_dispatch_write on deliveries for all
  using (auth_role() = 'dispatch' and shop_id = auth_shop())
  with check (auth_role() = 'dispatch' and shop_id = auth_shop());
create policy attachments_staff_insert on attachments for insert
  with check (shop_id = auth_shop() and exists (select 1 from jobs j where j.id = job_id));
-- Stage events are append-only: staff insert through the server action; nobody updates/deletes.
create policy stage_events_insert on job_stage_events for insert
  with check (shop_id = auth_shop() and exists (select 1 from jobs j where j.id = job_id));
drop policy job_stage_events_admin_write on job_stage_events;

-- ---------------------------------------------------------------- payments (money is admin + dispatch read)
create policy payments_admin_rw on payments for all
  using (is_admin() and shop_id = auth_shop()) with check (is_admin() and shop_id = auth_shop());
create policy payments_dispatch_read on payments for select
  using (auth_role() = 'dispatch' and shop_id = auth_shop());

-- Totals view must respect the caller's RLS.
alter view job_payment_totals set (security_invoker = true);

-- ---------------------------------------------------------------- misc
create policy notifications_own on notifications for select
  using (shop_id = auth_shop() and (user_id = auth.uid() or section = any (role_sections(auth_role()))));
create policy notifications_mark_read on notifications for update
  using (shop_id = auth_shop() and (user_id = auth.uid() or section = any (role_sections(auth_role()))));
create policy notifications_admin_insert on notifications for insert with check (shop_id = auth_shop());

create policy audit_read on audit_log for select using (is_super() and shop_id = auth_shop());
create policy audit_insert on audit_log for insert with check (shop_id = auth_shop());

create policy job_counters_none on job_counters for select using (false);

-- ---------------------------------------------------------------- storage buckets
insert into storage.buckets (id, name, public) values
  ('mockups','mockups',false), ('logos','logos',false), ('print-files','print-files',false),
  ('receipts','receipts',false), ('qc-photos','qc-photos',false), ('shop','shop',false)
on conflict (id) do nothing;

-- Staff in a shop may read/write objects whose first path segment is their shop_id.
create policy storage_staff_rw on storage.objects for all to authenticated
  using ((storage.foldername(name))[1] = auth_shop()::text)
  with check ((storage.foldername(name))[1] = auth_shop()::text);

-- Realtime for live queue/kanban
alter publication supabase_realtime add table jobs, job_stage_events, notifications;
