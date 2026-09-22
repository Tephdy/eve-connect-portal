-- Utilities module: meters, readings, rates; utility invoice types; permissions.
-- Idempotent where possible.

-- ============================================================================
-- 1. Extend acct.invoice.type CHECK constraint to allow utility types
-- ============================================================================

alter table acct.invoice drop constraint if exists invoice_type_check;
alter table acct.invoice
  add constraint invoice_type_check
  check (type = any (array[
    'rent','deposit','penalty','other',
    'utility','electricity','water','gas'
  ]::text[]));

-- ============================================================================
-- 2. Meter table (one row per billable meter per unit)
-- ============================================================================

create table if not exists acct.meter (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null,
  utility_type text not null check (utility_type in ('electricity','water','gas','other')),
  meter_number text,
  unit_label text not null default 'unit',   -- 'kWh', 'm3', etc.
  initial_reading numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (unit_id, utility_type, meter_number)
);

create index if not exists meter_unit_idx on acct.meter (unit_id);
create index if not exists meter_active_idx on acct.meter (active);

-- ============================================================================
-- 3. Meter readings (one row per reading event)
-- ============================================================================

create table if not exists acct.meter_reading (
  id uuid primary key default gen_random_uuid(),
  meter_id uuid not null references acct.meter(id) on delete cascade,
  reading numeric not null check (reading >= 0),
  reading_date date not null,
  recorded_by uuid,
  photo_url text,
  notes text,
  created_at timestamptz not null default now(),
  unique (meter_id, reading_date)
);

create index if not exists meter_reading_meter_idx on acct.meter_reading (meter_id, reading_date desc);

-- ============================================================================
-- 4. Utility rates (versioned by property + utility type + effective date)
-- ============================================================================

create table if not exists acct.utility_rate (
  id uuid primary key default gen_random_uuid(),
  property_id uuid,   -- null = global default
  utility_type text not null check (utility_type in ('electricity','water','gas','other')),
  rate_per_unit numeric not null check (rate_per_unit >= 0),
  effective_from date not null,
  effective_to date,   -- null = still in effect
  created_at timestamptz not null default now()
);

create index if not exists utility_rate_lookup_idx
  on acct.utility_rate (property_id, utility_type, effective_from desc);

-- ============================================================================
-- 5. Grants (mirror the pattern used for other acct tables)
-- ============================================================================

grant usage on schema acct to authenticated, service_role;
grant select, insert, update, delete on acct.meter, acct.meter_reading, acct.utility_rate to authenticated;
grant select, insert, update, delete on acct.meter, acct.meter_reading, acct.utility_rate to service_role;

alter default privileges in schema acct
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema acct
  grant select, insert, update, delete on tables to service_role;

-- ============================================================================
-- 6. RLS (enable + permissive read/write policies, matches acct.audit_* pattern)
-- ============================================================================

alter table acct.meter           enable row level security;
alter table acct.meter_reading   enable row level security;
alter table acct.utility_rate    enable row level security;

drop policy if exists meter_read          on acct.meter;
drop policy if exists meter_write         on acct.meter;
drop policy if exists meter_reading_read  on acct.meter_reading;
drop policy if exists meter_reading_write on acct.meter_reading;
drop policy if exists utility_rate_read   on acct.utility_rate;
drop policy if exists utility_rate_write  on acct.utility_rate;

create policy meter_read           on acct.meter           for select to public using (true);
create policy meter_write          on acct.meter           for all    to public using (true) with check (true);
create policy meter_reading_read   on acct.meter_reading   for select to public using (true);
create policy meter_reading_write  on acct.meter_reading   for all    to public using (true) with check (true);
create policy utility_rate_read    on acct.utility_rate    for select to public using (true);
create policy utility_rate_write   on acct.utility_rate    for all    to public using (true) with check (true);

-- ============================================================================
-- 7. Permissions
-- ============================================================================

insert into core.permission (key) values
  ('utility:read'),
  ('utility:manage'),
  ('utility:record'),
  ('utility:bill')
on conflict (key) do nothing;

-- Grant to roles
insert into core.role_permission (role_id, permission_id)
select r.id, p.id from core.role r cross join core.permission p
where r.key in ('accounting','executive','property_rep')
  and p.key in ('utility:read','utility:record')
on conflict do nothing;

insert into core.role_permission (role_id, permission_id)
select r.id, p.id from core.role r cross join core.permission p
where r.key in ('accounting','executive')
  and p.key in ('utility:manage','utility:bill')
on conflict do nothing;

-- ============================================================================
-- 8. Seed audit rule row for meter-reading-anomaly
-- ============================================================================

insert into acct.audit_rule (key, name, description, severity, enabled)
values (
  'METER_READING_ANOMALY',
  'Meter reading anomaly',
  'Current reading is lower than previous, or consumption is 3x the trailing 3-month average.',
  'high',
  true
)
on conflict (key) do nothing;

notify pgrst, 'reload schema';
