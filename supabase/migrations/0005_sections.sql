-- 0005_sections.sql — work is owned by sections, and people inside a section can claim jobs.

-- A confirmed job (deposit in) lands in the designers' queue; they start designing themselves.
update stages set section = 'design' where key = 'CONFIRMED';

create table job_assignments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  job_id uuid not null references jobs(id) on delete cascade,
  section text not null,
  user_id uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (job_id, section)                      -- one person holds a job per section
);
create index on job_assignments (user_id);

alter table job_assignments enable row level security;

create policy assignments_read on job_assignments for select
  using (exists (select 1 from jobs j where j.id = job_assignments.job_id));

-- Staff may take an unassigned job in their own section; admins may assign anyone.
create policy assignments_insert on job_assignments for insert with check (
  shop_id = auth_shop()
  and exists (select 1 from jobs j where j.id = job_id)
  and (is_admin() or (user_id = auth.uid() and section = any (role_sections(auth_role()))))
);
-- Staff may release their own claim; admins may release any.
create policy assignments_delete on job_assignments for delete
  using (shop_id = auth_shop() and (is_admin() or user_id = auth.uid()));

-- Section staff only ever see colleagues' names (needed for "taken by"), never other shops'.
-- profiles_read already limits to the shop, so nothing else is needed.
