-- 20261005000000_tenant_portal_foundation.sql
-- Foundation for the tenant self-service portal.
-- Adds:
--   * core.tenant_user (many-to-many link between auth users and tenants)
--   * a `tenant` role
--   * tenant-scoped permissions
--   * public.current_tenant_id() helper for future RLS policies
--
-- Does NOT enable RLS. Does NOT modify existing views.
-- Safe to run alongside the current app.

-- ============================================================================
-- 1. core.tenant_user — links auth users to tenant records
-- ============================================================================

create table if not exists core.tenant_user (
  auth_user_id uuid not null references core.app_user(id) on delete cascade,
  tenant_id    uuid not null references core.tenant(id)   on delete cascade,
  relationship text not null default 'self'
                 check (relationship in ('self','spouse','parent','guardian','other')),
  verified_at  timestamptz,
  verified_by  uuid references core.app_user(id),
  created_at   timestamptz not null default now(),
  primary key (auth_user_id, tenant_id)
);

create index if not exists tenant_user_tenant_idx
  on core.tenant_user (tenant_id);

create index if not exists tenant_user_auth_user_idx
  on core.tenant_user (auth_user_id);

-- ============================================================================
-- 2. Add `tenant` role
-- ============================================================================

insert into core.role (key, name) values
  ('tenant', 'Tenant')
on conflict (key) do nothing;

-- ============================================================================
-- 3. Tenant permissions
-- ============================================================================
-- Convention: `self:` prefix marks permissions that only apply to the caller's
-- own rows. The RLS layer enforces the "own rows" part via current_tenant_id().

insert into core.permission (key, description) values
  ('self:tenant_read',   'Read own tenant profile'),
  ('self:tenant_update', 'Update own tenant profile'),
  ('self:lease_read',    'Read own lease'),
  ('self:invoice_read',  'Read own invoices'),
  ('self:payment_read',  'Read own payments'),
  ('self:utility_read',  'Read own utility readings'),
  ('self:moveout_create','Submit a move-out notice')
on conflict (key) do nothing;

-- ============================================================================
-- 4. Grant tenant permissions to the tenant role
-- ============================================================================

do $$
declare
  r_tenant uuid;
begin
  select id into r_tenant from core.role where key = 'tenant';
  if r_tenant is null then
    raise exception 'tenant role missing after insert';
  end if;

  insert into core.role_permission (role_id, permission_id)
  select r_tenant, id
  from core.permission
  where key in (
    'self:tenant_read',
    'self:tenant_update',
    'self:lease_read',
    'self:invoice_read',
    'self:payment_read',
    'self:utility_read',
    'self:moveout_create'
  )
  on conflict do nothing;
end $$;

-- ============================================================================
-- 5. Helper: current_tenant_id()
-- ============================================================================
-- Returns the tenant_id linked to the currently authenticated user, or null.
-- Assumes a user has at most one 'self' relationship. If multiple exist,
-- returns the earliest created one for determinism.

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = core, public
as $$
  select tu.tenant_id
  from core.tenant_user tu
  where tu.auth_user_id = auth.uid()
    and tu.relationship = 'self'
  order by tu.created_at asc
  limit 1;
$$;

grant execute on function public.current_tenant_id() to authenticated;

-- ============================================================================
-- 6. Reload PostgREST schema cache
-- ============================================================================

notify pgrst, 'reload schema';