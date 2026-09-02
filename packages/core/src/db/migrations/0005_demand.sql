create table imports (
  hs6        text not null,
  year       integer not null,
  reporter   integer not null default 682,
  flow       text not null default 'M',
  partner    integer not null default 0,
  value_usd  numeric not null,
  net_wgt    numeric,
  qty        numeric,
  fetched_at timestamptz not null default now(),
  primary key (hs6, year, reporter, flow, partner)
);

create table mandatory_list (
  hs4            text primary key,
  label_en       text,
  label_ar       text,
  effective_from date,
  source_url     text,
  note           text
);

create table mining_companies (
  id      integer primary key,
  name_ar text,
  name_en text,
  website text,
  email   text,
  mobile  text,
  raw     jsonb
);

alter table demand_lines
  add column qty numeric,
  add column qty_unit text,
  add column history_factor numeric not null default 1,
  add column annual_value_usd numeric,
  add column seed_hs6 text,
  add column simulated boolean not null default true,
  add column line_key text unique;

alter table pooled_orders
  add column family text,
  add column title text,
  add column annual_value_usd numeric,
  add column qty_unit text,
  add column gap_kind text check (gap_kind in ('covered', 'manufacturing_gap', 'supply_gap')),
  add column mandatory boolean not null default false,
  add column updated_at timestamptz not null default now();
create index pooled_orders_hs6_idx on pooled_orders (hs6);
create index pooled_orders_gap_idx on pooled_orders (gap_kind);

create table matches (
  id              uuid primary key default gen_random_uuid(),
  pooled_order_id uuid not null references pooled_orders (id) on delete cascade,
  capability_id   uuid not null references capabilities (id) on delete cascade,
  score           real not null,
  share           real,
  rank            integer not null,
  reasons         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  unique (pooled_order_id, capability_id)
);

create table gap_cases (
  pooled_order_id uuid primary key references pooled_orders (id) on delete cascade,
  run_id          uuid references runs (id),
  "case"          jsonb not null,
  created_at      timestamptz not null default now()
);
