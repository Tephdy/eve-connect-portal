-- Adds audit:manage and grants it to accounting + executive roles.
-- Schema: core.user_role, core.role_permission, core.permission, core.role

insert into core.permission (key, description)
values ('audit:manage', 'Run audits, resolve and dismiss findings')
on conflict (key) do nothing;

insert into core.role_permission (role_id, permission_id)
select r.id, p.id
from core.role r
cross join core.permission p
where r.key in ('accounting', 'executive')
  and p.key = 'audit:manage'
on conflict do nothing;
