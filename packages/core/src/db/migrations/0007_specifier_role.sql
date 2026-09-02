-- The Specifier: a Detective pass that reads catalogues and datasheets for stated specifications.
alter table runs drop constraint if exists runs_role_check;
alter table runs add constraint runs_role_check check (role in ('coordinator', 'detective', 'specifier', 'auditor', 'advisor'));
