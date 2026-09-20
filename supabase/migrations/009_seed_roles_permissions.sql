-- 009_seed_roles_permissions.sql
-- Seeds roles, permissions, and role→permission mappings.

-- -----------------------------------------------------------------------------
-- Roles
-- -----------------------------------------------------------------------------
insert into core.role (key, name) values
  ('accounting',   'Accounting'),
  ('marketing',    'Marketing'),
  ('maintenance',  'Maintenance'),
  ('property_rep', 'Property Representative'),
  ('executive',    'Executive / Owner'),
  ('system_admin', 'System Administrator')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
insert into core.permission (key, description) values
  -- Core
  ('tenant:create','Create tenant'),
  ('tenant:read','Read tenant'),
  ('tenant:update','Update tenant'),
  ('tenant:archive','Archive tenant'),
  ('unit:create','Create unit'),
  ('unit:read','Read unit'),
  ('unit:update','Update unit'),
  ('unit:archive','Archive unit'),
  ('lease:create','Create lease'),
  ('lease:read','Read lease'),
  ('lease:update','Update lease'),
  ('lease:terminate','Terminate lease'),
  ('property:create','Create property'),
  ('property:read','Read property'),
  ('property:update','Update property'),
  ('property:archive','Archive property'),
  ('user:manage','Manage users'),
  ('role:manage','Manage roles'),
  ('audit:read','Read audit log'),
  -- Accounting
  ('invoice:create','Create invoice'),
  ('invoice:read','Read invoice'),
  ('invoice:update','Update invoice'),
  ('invoice:void','Void invoice'),
  ('payment:create','Record payment'),
  ('payment:read','Read payments'),
  ('payment:void','Void payment'),
  ('deposit:read','Read deposit'),
  ('deposit:refund','Refund deposit'),
  ('ledger:read','Read ledger'),
  -- Marketing
  ('listing:create','Create listing'),
  ('listing:read','Read listing'),
  ('listing:update','Update listing'),
  ('listing:publish','Publish listing'),
  ('forecast:read','Read forecast'),
  ('forecast:override','Override forecast'),
  ('inquiry:create','Create inquiry'),
  ('inquiry:read','Read inquiry'),
  ('inquiry:update','Update inquiry'),
  -- Maintenance
  ('joborder:create','Create job order'),
  ('joborder:read','Read job order'),
  ('joborder:update','Update job order'),
  ('joborder:assign','Assign job order'),
  ('joborder:close','Close job order'),
  ('worklog:create','Create work log'),
  ('worklog:read','Read work log'),
  ('asset:create','Create asset'),
  ('asset:read','Read asset'),
  ('asset:update','Update asset'),
  -- Property Rep
  ('contract:create','Create contract'),
  ('contract:read','Read contract'),
  ('contract:send','Send contract'),
  ('contract:void','Void contract'),
  ('template:manage','Manage contract templates'),
  -- Executive
  ('dashboard:executive','View executive dashboard'),
  ('report:read','Read reports')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Role → permission mapping
-- -----------------------------------------------------------------------------
do $$
declare
  r_accounting   uuid;
  r_marketing    uuid;
  r_maintenance  uuid;
  r_property_rep uuid;
  r_executive    uuid;
  r_sys_admin    uuid;
begin
  select id into r_accounting   from core.role where key = 'accounting';
  select id into r_marketing    from core.role where key = 'marketing';
  select id into r_maintenance  from core.role where key = 'maintenance';
  select id into r_property_rep from core.role where key = 'property_rep';
  select id into r_executive    from core.role where key = 'executive';
  select id into r_sys_admin    from core.role where key = 'system_admin';

  -- ACCOUNTING
  insert into core.role_permission (role_id, permission_id)
  select r_accounting, id from core.permission where key in (
    'tenant:create','tenant:read','tenant:update',
    'unit:read','lease:read',
    'invoice:create','invoice:read','invoice:update','invoice:void',
    'payment:create','payment:read','payment:void',
    'deposit:read','deposit:refund','ledger:read',
    'joborder:read'
  ) on conflict do nothing;

  -- MARKETING
  insert into core.role_permission (role_id, permission_id)
  select r_marketing, id from core.permission where key in (
    'tenant:read','unit:read','unit:update','lease:read',
    'listing:create','listing:read','listing:update','listing:publish',
    'forecast:read','forecast:override',
    'inquiry:create','inquiry:read','inquiry:update'
  ) on conflict do nothing;

  -- MAINTENANCE
  insert into core.role_permission (role_id, permission_id)
  select r_maintenance, id from core.permission where key in (
    'unit:read','lease:read',
    'joborder:create','joborder:read','joborder:update','joborder:assign','joborder:close',
    'worklog:create','worklog:read',
    'asset:create','asset:read','asset:update'
  ) on conflict do nothing;

  -- PROPERTY REP
  insert into core.role_permission (role_id, permission_id)
  select r_property_rep, id from core.permission where key in (
    'tenant:create','tenant:read','tenant:update',
    'unit:create','unit:read','unit:update',
    'lease:create','lease:read','lease:update',
    'property:create','property:read','property:update',
    'invoice:read',
    'listing:read','forecast:read',
    'joborder:create','joborder:read',
    'contract:create','contract:read','contract:send','contract:void',
    'template:manage'
  ) on conflict do nothing;

  -- EXECUTIVE
  insert into core.role_permission (role_id, permission_id)
  select r_executive, id from core.permission where key in (
    'tenant:create','tenant:read','tenant:update','tenant:archive',
    'unit:create','unit:read','unit:update','unit:archive',
    'lease:create','lease:read','lease:update','lease:terminate',
    'property:create','property:read','property:update','property:archive',
    'invoice:create','invoice:read','invoice:update','invoice:void',
    'payment:create','payment:read','payment:void',
    'deposit:read','deposit:refund','ledger:read',
    'listing:create','listing:read','listing:update','listing:publish',
    'forecast:read','forecast:override',
    'inquiry:create','inquiry:read','inquiry:update',
    'joborder:create','joborder:read','joborder:update','joborder:assign','joborder:close',
    'worklog:read',
    'asset:create','asset:read','asset:update',
    'contract:create','contract:read','contract:send','contract:void',
    'template:manage',
    'dashboard:executive','report:read','audit:read'
  ) on conflict do nothing;

  -- SYSTEM ADMIN (no business data by default)
  insert into core.role_permission (role_id, permission_id)
  select r_sys_admin, id from core.permission where key in (
    'user:manage','role:manage','audit:read'
  ) on conflict do nothing;
end $$;
