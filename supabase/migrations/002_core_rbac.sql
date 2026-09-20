-- 002_core_rbac.sql
-- RBAC tables, audit log, event bus. Creates `core` schema.

create schema if not exists core;

-- -----------------------------------------------------------------------------
-- Users (mirrors auth.users.id from Supabase)
-- -----------------------------------------------------------------------------
create table core.app_user (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       citext unique not null,
  full_name   text not null default '',
  status      text not null default 'active'
                check (status in ('active','suspended')),
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Roles + Permissions
-- -----------------------------------------------------------------------------
create table core.role (
  id    uuid primary key default gen_random_uuid(),
  key   text unique not null,
  name  text not null
);

create table core.permission (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  description text
);

create table core.role_permission (
  role_id       uuid not null references core.role(id)       on delete cascade,
  permission_id uuid not null references core.permission(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table core.user_role (
  user_id            uuid not null references core.app_user(id) on delete cascade,
  role_id            uuid not null references core.role(id)     on delete cascade,
  scope_type         text not null default 'global'
                       check (scope_type in ('global','property','self')),
  scope_property_id  uuid,  -- FK added in migration 003
  primary key (user_id, role_id)
);

-- -----------------------------------------------------------------------------
-- Audit log
-- -----------------------------------------------------------------------------
create table core.audit_log (
  id             uuid primary key default gen_random_uuid(),
  actor_user_id  uuid references core.app_user(id),
  entity_type    text not null,
  entity_id      uuid not null,
  action         text not null
                   check (action in ('create','update','delete','archive','permission_denied')),
  before         jsonb,
  after          jsonb,
  reason         text,
  created_at     timestamptz not null default now()
);
create index audit_log_entity_idx on core.audit_log (entity_type, entity_id);
create index audit_log_actor_idx  on core.audit_log (actor_user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Domain event bus
-- -----------------------------------------------------------------------------
create table core.domain_event (
  id                 uuid primary key default gen_random_uuid(),
  event_key          text not null,
  payload            jsonb not null,
  emitted_by_user_id uuid references core.app_user(id),
  emitted_at         timestamptz not null default now(),
  processed_at       timestamptz,
  retry_count        int  not null default 0,
  dead_letter        boolean not null default false
);
create index domain_event_pending_idx
  on core.domain_event (event_key, emitted_at)
  where processed_at is null and dead_letter = false;
