-- 003_core_domain.sql
-- Core shared domain: property, unit, tenant, lease.

create table core.property (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  address      text,
  type         text not null default 'residential'
                 check (type in ('residential','commercial','mixed')),
  total_units  int  not null default 0,
  created_at   timestamptz not null default now(),
  archived_at  timestamptz
);

create table core.unit (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references core.property(id) on delete cascade,
  unit_number  text not null,
  floor        int,
  bedrooms     int,
  bathrooms    numeric(3,1),
  area_sqm     numeric(8,2),
  base_rent    numeric(14,2),
  status       text not null default 'vacant'
                 check (status in ('vacant','occupied','reserved','maintenance','unavailable')),
  created_at   timestamptz not null default now(),
  unique (property_id, unit_number)
);
create index unit_property_idx on core.unit (property_id, status);

create table core.tenant (
  id             uuid primary key default gen_random_uuid(),
  full_name      text not null,
  email          citext unique,
  phone          text,
  government_id  text,
  status         text not null default 'prospect'
                   check (status in ('prospect','active','former','blacklisted')),
  created_at     timestamptz not null default now()
);

create table core.lease (
  id                  uuid primary key default gen_random_uuid(),
  unit_id             uuid not null references core.unit(id),
  tenant_id           uuid not null references core.tenant(id),
  start_date          date not null,
  end_date            date not null,
  monthly_rent        numeric(14,2) not null,
  deposit_amount      numeric(14,2) not null default 0,
  notice_period_days  int not null default 30,
  status              text not null default 'draft'
                        check (status in ('draft','active','expiring','ended','terminated')),
  created_at          timestamptz not null default now(),
  check (end_date > start_date)
);
create index lease_unit_idx   on core.lease (unit_id, status);
create index lease_tenant_idx on core.lease (tenant_id);

-- Now that property exists, wire the FK on user_role.scope_property_id
alter table core.user_role
  add constraint user_role_scope_property_fk
  foreign key (scope_property_id) references core.property(id) on delete cascade;
