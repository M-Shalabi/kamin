-- A rung between category level and at spec: the supplier's stated product type matches the order's object class.
alter table pooled_orders drop constraint if exists pooled_orders_spec_status_check;
alter table pooled_orders add constraint pooled_orders_spec_status_check check (spec_status in ('at_spec', 'type', 'category', 'none'));
