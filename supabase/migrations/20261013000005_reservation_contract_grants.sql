-- 20261013000005_reservation_contract_grants.sql
-- Grants schema access + table privileges. Fixes "permission denied".

-- Schema-level access (in case schema privileges were reset)
grant usage on schema prep to authenticated;
grant usage on schema prep to service_role;
grant usage on schema prep to anon;

-- Table privileges
grant select, insert, update, delete on prep.reservation_contract to authenticated;
grant select, insert, update, delete on prep.reservation_contract to service_role;
grant select on prep.reservation_contract to anon;

notify pgrst, 'reload schema';