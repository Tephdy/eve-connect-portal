-- 20261005000001_tenant_invite.sql
-- Tenant invitation flow.
-- Staff generates a one-time invite link per tenant.
-- Tenant clicks the link, enters email + password, gets linked to the tenant row.
--
-- Does NOT enable RLS. Does NOT modify existing views.
-- Safe to run alongside the current app.

-- ============================================================================
-- 1. core.tenant_invite
-- ============================================================================

create table if not exists core.tenant_invite (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references core.tenant(id) on delete cascade,
  token_hash   text not null unique,   -- sha256 hex of the raw token
  created_by   uuid references core.app_user(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  used_at      timestamptz,
  used_by      uuid references core.app_user(id) on delete set null
);

create index if not exists tenant_invite_tenant_idx
  on core.tenant_invite (tenant_id, created_at desc);

create index if not exists tenant_invite_token_idx
  on core.tenant_invite (token_hash);

-- Only one unused, unexpired invite per tenant at a time.
-- Enforced by a partial unique index rather than a constraint
-- (because unused+unexpired is time-dependent).
create unique index if not exists tenant_invite_one_active_per_tenant
  on core.tenant_invite (tenant_id)
  where used_at is null;

-- ============================================================================
-- 2. RLS: lock down the table immediately
-- ============================================================================
-- Even though we haven't enabled RLS on the rest of the schema yet, this
-- table must be locked. It holds invite tokens.

alter table core.tenant_invite enable row level security;

-- No public reads. Only staff with tenant:update can see invites (via admin client).
-- The accept-invite flow uses the admin client (service role) to look up
-- the token — service role bypasses RLS.

drop policy if exists tenant_invite_staff_read on core.tenant_invite;
drop policy if exists tenant_invite_staff_write on core.tenant_invite;

create policy tenant_invite_staff_read on core.tenant_invite
  for select using (public.has_perm('tenant:read'));

create policy tenant_invite_staff_write on core.tenant_invite
  for all
  using      (public.has_perm('tenant:update'))
  with check (public.has_perm('tenant:update'));

-- ============================================================================
-- 3. Grants for service_role (admin client)
-- ============================================================================

grant select, insert, update, delete on core.tenant_invite to service_role;
grant select on core.tenant_invite to authenticated;

-- ============================================================================
-- 4. Reload PostgREST schema cache
-- ============================================================================

notify pgrst, 'reload schema';