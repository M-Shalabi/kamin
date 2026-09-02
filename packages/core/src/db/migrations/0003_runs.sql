create table runs (
  id          uuid primary key default gen_random_uuid(),
  role        text not null check (role in ('coordinator', 'detective', 'auditor', 'advisor')),
  input_ref   text not null,
  model       text not null,
  status      text not null default 'running' check (status in ('running', 'ok', 'error')),
  error       text,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index runs_role_started_idx on runs (role, started_at desc);

create table run_steps (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references runs (id) on delete cascade,
  seq         integer not null,
  kind        text not null check (kind in ('llm_call', 'tool_call', 'retrieval', 'note', 'error')),
  name        text not null,
  input       jsonb,
  output      jsonb,
  duration_ms integer,
  tokens_in   integer,
  tokens_out  integer,
  created_at  timestamptz not null default now(),
  unique (run_id, seq)
);

alter table demand_lines add constraint demand_lines_run_fk foreign key (run_id) references runs (id);
