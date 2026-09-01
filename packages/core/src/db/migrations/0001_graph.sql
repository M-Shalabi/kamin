create extension if not exists vector;

create table suppliers (
  id               text primary key,
  name_ar          text,
  name_en          text,
  cr_number        text,
  city_ar          text,
  city_en          text,
  region_ar        text,
  region_en        text,
  investment_type  text,
  website          text,
  email            text,
  phone            text,
  tarmeez_id       integer unique,
  tarmeez_symbol   text,
  in_tarmeez       boolean not null default false,
  in_made_in_saudi boolean not null default false,
  in_mlcp          boolean not null default false,
  source           text not null,
  raw              jsonb,
  fetched_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index suppliers_cr_idx on suppliers (cr_number);
create index suppliers_name_ar_idx on suppliers using gin (to_tsvector('simple', coalesce(name_ar, '')));

create table products (
  tariff_code text primary key,
  hs6         text not null,
  title_ar    text,
  title_en    text,
  tarmeez_id  integer,
  source      text not null,
  fetched_at  timestamptz not null default now()
);
create index products_hs6_idx on products (hs6);

create table capabilities (
  id              uuid primary key default gen_random_uuid(),
  supplier_id     text not null references suppliers (id) on delete cascade,
  tariff_code     text not null references products (tariff_code),
  hs6             text not null,
  spec_attrs      jsonb not null default '{}'::jsonb,
  class           text not null check (class in ('manufacturer', 'assembler', 'authorised_distributor', 'trader')),
  verdict         text not null default 'pending' check (verdict in ('pending', 'supported', 'refuted')),
  confidence      real check (confidence between 0 and 1),
  declared_amount numeric,
  declared_unit   text,
  declared_lines  jsonb not null default '[]'::jsonb,
  status          text not null default 'declared',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (supplier_id, tariff_code)
);
create index capabilities_hs6_idx on capabilities (hs6);
create index capabilities_supplier_idx on capabilities (supplier_id);

create table evidence (
  id            uuid primary key default gen_random_uuid(),
  capability_id uuid not null references capabilities (id) on delete cascade,
  tier          smallint not null check (tier between 1 and 4),
  source_type   text not null,
  source_url    text not null,
  excerpt       text,
  raw           jsonb,
  fetched_at    timestamptz not null default now()
);
create index evidence_capability_idx on evidence (capability_id);

create table pooled_orders (
  id            uuid primary key default gen_random_uuid(),
  hs6           text not null,
  spec_envelope jsonb not null,
  qty_now       numeric,
  qty_annual    numeric,
  portco_count  integer not null default 0,
  created_at    timestamptz not null default now()
);

create table demand_lines (
  id              uuid primary key default gen_random_uuid(),
  raw_text        text not null,
  portco          text not null,
  source_system   text,
  language        text check (language in ('ar', 'en', 'mixed')),
  normalized_spec jsonb,
  hs6             text,
  confidence      real check (confidence between 0 and 1),
  pooled_order_id uuid references pooled_orders (id),
  run_id          uuid,
  created_at      timestamptz not null default now()
);
create index demand_lines_hs6_idx on demand_lines (hs6);
