-- Whether a pooled order is covered at its stated specification, only at category level, or not at all.
alter table pooled_orders add column if not exists spec_status text check (spec_status in ('at_spec', 'category', 'none'));
