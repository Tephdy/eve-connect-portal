-- ---------------------------------------------------------------------------
-- 20261013000001_marketing_report_read.sql
--
-- Grants report:read to the marketing role so they can access the
-- /marketing/spreadsheet module. Idempotent.
-- ---------------------------------------------------------------------------

do $$
declare
  r_marketing uuid;
begin
  select id into r_marketing from core.role where key = 'marketing';
  if r_marketing is null then
    raise exception 'Role "marketing" not found in core.role';
  end if;

  insert into core.role_permission (role_id, permission_id)
  select r_marketing, id from core.permission where key = 'report:read'
  on conflict do nothing;

  raise notice 'Granted report:read to marketing (if not already present).';
end $$;
