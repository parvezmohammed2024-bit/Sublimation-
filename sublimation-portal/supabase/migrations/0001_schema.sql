-- 0001_schema.sql — core schema. Single-tenant for now; every table carries shop_id.
create extension if not exists "pgcrypto";

create type user_role as enum
  ('super_admin','admin','designer','template','printing','cutting_sewing','qc','dispatch');
create type payment_method as enum ('bank_transfer','duitnow_qr','cash','card','cheque');
create type customer_type as enum ('individual','school','club','corporate','government');
create type job_priority as enum ('normal','rush');
create type mockup_status as enum ('draft','sent','approved','revision_requested','superseded');

-- ---------------------------------------------------------------- shops
create table shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  shop_id uuid not null references shops(id),
  full_name text not null,
  role user_role not null,
  locale text not null default 'ms' check (locale in ('en','ms')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Settings: one row per shop, JSON for the long tail, columns for what the rules need.
create table settings (
  shop_id uuid primary key references shops(id),
  shop_profile jsonb not null default '{}',     -- name, address, phone, logo_path
  bank_details jsonb not null default '{}',     -- bank, account_no, account_name
  duitnow_qr_path text,
  job_prefix text not null default 'SB',
  default_deposit_percent numeric(5,2) not null default 50,
  default_lead_time_days int not null default 14,
  quote_validity_days int not null default 30,
  use_public_holidays boolean not null default true,
  tax_enabled boolean not null default false,
  tax_rate numeric(5,2),                        -- never hardcoded in code
  tax_number text,
  terms text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- catalogue
create table stages (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  key text not null,
  position int,                                  -- null = side/loop stage
  section text not null,
  label_en text not null,
  label_ms text not null,
  customer_label_en text not null,
  customer_label_ms text not null,
  enabled boolean not null default true,
  is_terminal boolean not null default false,
  unique (shop_id, key)
);

create table garment_types (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  name text not null, is_garment boolean not null default true, active boolean not null default true,
  unique (shop_id, name)
);
create table fabrics (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  name text not null, gsm int,
  is_polyester boolean not null default true,    -- sublimation warning when false
  active boolean not null default true,
  unique (shop_id, name)
);
create table collar_types (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  name text not null, active boolean not null default true,
  unique (shop_id, name)
);
create table size_charts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  name text not null,
  sizes text[] not null,                         -- e.g. {2XS,XS,S,M,L,XL,2XL,3XL,4XL,5XL}
  image_path text,
  measurements jsonb not null default '{}'
);

-- ---------------------------------------------------------------- customers & quotes
create table customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  name text not null,
  organisation text,
  type customer_type not null default 'individual',
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email text,
  address text,
  credit_terms boolean not null default false,
  created_at timestamptz not null default now()
);
create index on customers (shop_id, phone_e164);
create index on customers using gin (to_tsvector('simple', name || ' ' || coalesce(organisation,'')));

create table quotations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  quote_no text not null,
  customer_id uuid not null references customers(id),
  status text not null default 'draft' check (status in ('draft','sent','accepted','expired','rejected')),
  valid_until date,
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (shop_id, quote_no)
);
create table quotation_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  quotation_id uuid not null references quotations(id) on delete cascade,
  description text not null,
  qty int not null check (qty > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  addons jsonb not null default '[]'
);

-- ---------------------------------------------------------------- jobs
create table job_counters (                       -- running number per prefix-YYMM
  shop_id uuid not null references shops(id),
  period text not null,                           -- 'YYMM'
  last_no int not null default 0,
  primary key (shop_id, period)
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  job_no text not null,                           -- SB-2610-0001
  tracking_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  customer_id uuid not null references customers(id),
  quotation_id uuid references quotations(id),
  stage_key text not null default 'QUOTATION_DRAFT',
  prev_stage_key text,                            -- where to resume from ON_HOLD
  priority job_priority not null default 'normal',
  order_date date not null default (now() at time zone 'Asia/Kuala_Lumpur')::date,
  due_date date,
  estimated_ready_date date,
  sales_person uuid references profiles(id),
  designer_id uuid references profiles(id),
  total numeric(12,2) not null default 0,
  deposit_percent numeric(5,2) not null default 50,
  deposit_waived boolean not null default false,
  design_approved boolean not null default false, -- design lock
  name_list_confirmed boolean not null default false,
  revision_count int not null default 0,
  design_brief text,
  internal_notes text,
  customer_notes text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (shop_id, job_no),
  foreign key (shop_id, stage_key) references stages (shop_id, key)
);
create index on jobs (shop_id, stage_key, due_date);
create index on jobs (customer_id);

create table job_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  job_id uuid not null references jobs(id) on delete cascade,
  garment_type_id uuid references garment_types(id),
  fabric_id uuid references fabrics(id),
  collar_type_id uuid references collar_types(id),
  sleeve text check (sleeve in ('short','long','sleeveless')),
  cutting text check (cutting in ('regular','slim','muslimah')),
  qty int not null check (qty > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  addons jsonb not null default '[]',
  notes text
);

create table job_stage_events (                   -- the timeline
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  job_id uuid not null references jobs(id) on delete cascade,
  from_stage text, to_stage text not null,
  actor_id uuid references profiles(id),
  actor_kind text not null default 'staff' check (actor_kind in ('staff','customer','system')),
  note text, reason text, photo_path text,
  customer_visible boolean not null default false,
  created_at timestamptz not null default now()
);
create index on job_stage_events (job_id, created_at);

-- ---------------------------------------------------------------- design & name list
create table mockups (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  job_id uuid not null references jobs(id) on delete cascade,
  version int not null,
  file_path text not null,
  status mockup_status not null default 'draft',
  comment text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (job_id, version)
);
create table approvals (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  job_id uuid not null references jobs(id) on delete cascade,
  mockup_id uuid not null references mockups(id),
  kind text not null check (kind in ('approved','revision_requested')),
  typed_name text, comment text, image_path text,
  ip inet, created_at timestamptz not null default now()
);
create table name_list_entries (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  job_id uuid not null references jobs(id) on delete cascade,
  line_no int not null,
  name text, number text, size text not null,
  sleeve text, notes text
);
create index on name_list_entries (job_id);
create table print_files (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  job_id uuid not null references jobs(id) on delete cascade,
  file_path text not null,
  piece_counts jsonb not null default '{}',       -- {"M": 12, "L": 8}
  confirmed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- payments
create table payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  job_id uuid not null references jobs(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method payment_method not null,
  reference text,
  paid_on date not null default (now() at time zone 'Asia/Kuala_Lumpur')::date,
  receipt_path text,
  source text not null default 'staff' check (source in ('staff','customer')),
  verified boolean not null default true,         -- customer uploads insert with false
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index on payments (job_id);

-- ---------------------------------------------------------------- QC, dispatch
create table qc_inspections (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  job_id uuid not null references jobs(id) on delete cascade,
  inspector_id uuid references profiles(id),
  passed_qty int not null default 0,
  failed_qty int not null default 0,
  result text not null check (result in ('pass','fail')),
  created_at timestamptz not null default now()
);
create table qc_defects (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  inspection_id uuid not null references qc_inspections(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  defect_type text not null check (defect_type in
    ('colour_off','misprint','ghosting','wrong_spelling','wrong_size','stitching','stain','other')),
  qty int not null check (qty > 0),
  sent_back_to text not null,                     -- stage key
  resolved boolean not null default false,
  photo_path text, note text
);
create table deliveries (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  job_id uuid not null references jobs(id) on delete cascade,
  method text not null check (method in ('self_pickup','courier','lalamove','shop_delivery')),
  courier text, tracking_no text,
  recipient_name text, signature_path text, photo_path text,
  handed_over_at timestamptz,
  recorded_by uuid references profiles(id)
);

-- ---------------------------------------------------------------- misc
create table attachments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  job_id uuid not null references jobs(id) on delete cascade,
  kind text not null check (kind in ('logo','reference','mockup','print_file','receipt','qc_photo','other')),
  file_path text not null, file_name text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create table notifications (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  user_id uuid references profiles(id),           -- staff recipient
  section text,                                   -- or whole section
  job_id uuid references jobs(id) on delete cascade,
  title text not null, body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create table audit_log (
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id),
  actor_id uuid references profiles(id),
  entity text not null, entity_id uuid,
  action text not null, detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- helpers
-- Atomic job number: prefix-YYMM-0001.
create or replace function next_job_no(p_shop uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_period text := to_char(now() at time zone 'Asia/Kuala_Lumpur', 'YYMM'); v_no int; v_prefix text;
begin
  select job_prefix into v_prefix from settings where shop_id = p_shop;
  insert into job_counters (shop_id, period, last_no) values (p_shop, v_period, 1)
    on conflict (shop_id, period) do update set last_no = job_counters.last_no + 1
    returning last_no into v_no;
  return coalesce(v_prefix,'SB') || '-' || v_period || '-' || lpad(v_no::text, 4, '0');
end $$;

-- Verified paid total per job (single source for the TS rules module).
create or replace view job_payment_totals as
  select job_id, coalesce(sum(amount) filter (where verified), 0) as paid_verified,
         coalesce(sum(amount) filter (where not verified), 0) as pending_verification
  from payments group by job_id;
