-- Ensures audit:read and audit:manage exist and are granted to
-- the accounting and executive roles. Idempotent.

-- 1. Ensure permission rows exist
insert into core.permission (key) values ('audit:read')
on conflict (key) do nothing;

insert into core.permission (key) values ('audit:manage')
on conflict (key) do nothing;

-- 2. Grant audit:read to accounting + executive
insert into core.role_permission (role_id, permission_id)
select r.id, p.id
from core.role r
cross join core.permission p
where r.key in ('accounting', 'executive')
  and p.key = 'audit:read'
on conflict do nothing;

-- 3. Grant audit:manage to accounting + executive
insert into core.role_permission (role_id, permission_id)
select r.id, p.id
from core.role r
cross join core.permission p
where r.key in ('accounting', 'executive')
  and p.key = 'audit:manage'
on conflict do nothing;

-- 4. Verify (run these manually after applying):
-- select p.key from core.permission p where p.key like 'audit:%' order by p.key;
-- select r.key as role, p.key as permission
--   from core.role r
--   join core.role_permission rp on rp.role_id = r.id
--   join core.permission p on p.id = rp.permission_id
--  where r.key in ('accounting','executive') and p.key like 'audit:%'
--  order by r.key, p.key;
