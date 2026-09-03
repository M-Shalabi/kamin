-- Typed relations between entities, each with its evidence: the explicit knowledge graph over the map.
create table if not exists relations (
  id            uuid primary key default gen_random_uuid(),
  subject_id    text not null references suppliers (id) on delete cascade,
  predicate     text not null check (predicate in ('distributes_brand', 'part_of_group', 'certified_by', 'meets_standard', 'same_entity_as', 'makes_with_material', 'uses_process')),
  object        text not null,
  object_id     text references suppliers (id) on delete cascade,
  evidence_id   uuid references evidence (id) on delete set null,
  source_url    text,
  excerpt       text,
  confidence    real not null default 0.7,
  run_id        uuid references runs (id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (subject_id, predicate, object)
);
create index if not exists relations_subject_idx on relations (subject_id, predicate);
create index if not exists relations_object_idx on relations (predicate, lower(object));
