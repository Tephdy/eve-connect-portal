insert into core.role_permission (role_id, permission_id)
select role_row.id, permission_row.id
from core.role role_row
cross join core.permission permission_row
where role_row.key = 'property_rep'
  and permission_row.key = 'payment:read'
on conflict do nothing;
