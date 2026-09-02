alter table suppliers
  add column detective_status text not null default 'pending' check (detective_status in ('pending', 'ok', 'error', 'skipped')),
  add column detective_run_id uuid references runs (id),
  add column detective_at timestamptz,
  add column summary text;

alter table capabilities
  alter column tariff_code drop not null,
  add column product_title text,
  add column origin text not null default 'tarmeez' check (origin in ('tarmeez', 'detective', 'mlcp', 'made_in_saudi', 'hunt')),
  add column class_confidence real check (class_confidence between 0 and 1),
  add column lenses jsonb,
  add column audit_run_id uuid references runs (id),
  add column audited_at timestamptz;
create unique index capabilities_found_unique on capabilities (supplier_id, hs6, lower(product_title)) where tariff_code is null;
create index capabilities_verdict_idx on capabilities (verdict);

alter table evidence
  add column run_id uuid references runs (id),
  add column title text;
create index evidence_tier_idx on evidence (tier);
