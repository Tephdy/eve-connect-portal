-- 20261005000002_tenant_portal_rls.sql
-- Tenant-scoped RLS policies for the self-service portal.
--
-- Every policy has TWO conditions:
--   1. has_perm('self:xxx')          — the caller has a tenant permission
--   2. row belongs to current tenant — enforced by tenant_id or a join
--
-- This pattern ensures:
--   * Staff with tenant:read continue to see all rows (via their existing policies)
--   * Tenants see ONLY their own rows
--   * No policy is bypassed just by having the permission
--
-- Does NOT enable security_invoker on public views. That is a SEPARATE migration
-- (20261005000003) applied only after these policies are tested and working.

-- ============================================================================
-- 1. Grants — RLS does the row filtering; grants let queries run at all
-- ============================================================================

grant select on core.tenant_user to authenticated;
grant select, update on core.tenant to authenticated;
grant select on core.lease to authenticated;
grant select on acct.invoice to authenticated;
grant select on acct.payment to authenticated;
grant select on acct.ledger_entry to authenticated;
grant select on acct.meter_reading to authenticated;
grant select on acct.meter to authenticated;

-- ============================================================================
-- 2. Enable RLS on tables that don't have it yet
-- ============================================================================

alter table core.tenant_user      enable row level security;
alter table acct.invoice          enable row level security;
alter table acct.payment          enable row level security;
alter table acct.ledger_entry     enable row level security;
alter table acct.meter            enable row level security;
alter table acct.meter_reading    enable row level security;

-- ============================================================================
-- 3. Tenant RLS policies
-- ============================================================================

-- 3.1 tenant_user: tenant can read their own link rows
drop policy if exists tenant_user_self_read on core.tenant_user;
create policy tenant_user_self_read on core.tenant_user
  for select using (
    public.has_perm('self:tenant_read')
    and auth_user_id = auth.uid()
  );

-- 3.2 tenant: read own record
drop policy if exists tenant_self_read on core.tenant;
create policy tenant_self_read on core.tenant
  for select using (
    public.has_perm('self:tenant_read')
    and id = public.current_tenant_id()
  );

-- 3.3 tenant: update own record
drop policy if exists tenant_self_update on core.tenant;
create policy tenant_self_update on core.tenant
  for update using (
    public.has_perm('self:tenant_update')
    and id = public.current_tenant_id()
  )
  with check (
    public.has_perm('self:tenant_update')
    and id = public.current_tenant_id()
  );

-- 3.4 lease: read own leases
drop policy if exists lease_self_read on core.lease;
create policy lease_self_read on core.lease
  for select using (
    public.has_perm('self:lease_read')
    and tenant_id = public.current_tenant_id()
  );

-- 3.5 invoice: read own invoices
drop policy if exists invoice_self_read on acct.invoice;
create policy invoice_self_read on acct.invoice
  for select using (
    public.has_perm('self:invoice_read')
    and tenant_id = public.current_tenant_id()
  );

-- 3.6 payment: read own payments
drop policy if exists payment_self_read on acct.payment;
create policy payment_self_read on acct.payment
  for select using (
    public.has_perm('self:payment_read')
    and tenant_id = public.current_tenant_id()
  );

-- 3.7 ledger_entry: read own ledger entries
drop policy if exists ledger_self_read on acct.ledger_entry;
create policy ledger_self_read on acct.ledger_entry
  for select using (
    public.has_perm('self:tenant_read')
    and tenant_id = public.current_tenant_id()
  );

-- 3.8 meter: read meters on the unit(s) they have an active lease on
drop policy if exists meter_self_read on acct.meter;
create policy meter_self_read on acct.meter
  for select using (
    public.has_perm('self:utility_read')
    and unit_id in (
      select l.unit_id
      from core.lease l
      where l.tenant_id = public.current_tenant_id()
        and l.status in ('active','expiring')
    )
  );

-- 3.9 meter_reading: read readings for meters on the unit(s) they rent
drop policy if exists meter_reading_self_read on acct.meter_reading;
create policy meter_reading_self_read on acct.meter_reading
  for select using (
    public.has_perm('self:utility_read')
    and meter_id in (
      select m.id
      from acct.meter m
      join core.lease l on l.unit_id = m.unit_id
      where l.tenant_id = public.current_tenant_id()
        and l.status in ('active','expiring')
    )
  );

-- ============================================================================
-- 4. Reload PostgREST schema cache
-- ============================================================================

notify pgrst, 'reload schema';