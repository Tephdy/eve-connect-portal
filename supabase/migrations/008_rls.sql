-- 008_rls.sql
-- Expose core schema via public views + RPC, and enforce RLS.

-- -----------------------------------------------------------------------------
-- Public views so the app can query with the anon key without schema exposure
-- -----------------------------------------------------------------------------
create or replace view public.user_role as
  select ur.user_id,
         r.key          as role_key,
         ur.role_id,
         ur.scope_type,
         ur.scope_property_id
  from core.user_role ur
  join core.role r on r.id = ur.role_id;

create or replace view public.role as
  select id, key, name from core.role;

create or replace view public.permission as
  select id, key, description from core.permission;

create or replace view public.domain_event as
  select id, event_key, payload, emitted_by_user_id, emitted_at,
         processed_at, retry_count, dead_letter
  from core.domain_event;

-- -----------------------------------------------------------------------------
-- Helper: does current user have a permission?
-- -----------------------------------------------------------------------------
create or replace function public.has_perm(p_key text)
returns boolean
language sql stable security definer
set search_path = core, public
as $$
  select exists (
    select 1
    from core.user_role ur
    join core.role_permission rp on rp.role_id = ur.role_id
    join core.permission p       on p.id       = rp.permission_id
    where ur.user_id = auth.uid()
      and p.key      = p_key
  );
$$;

-- -----------------------------------------------------------------------------
-- Helper: is current user scoped to this property?
-- -----------------------------------------------------------------------------
create or replace function public.in_scope(p_property_id uuid)
returns boolean
language sql stable security definer
set search_path = core, public
as $$
  select exists (
    select 1 from core.user_role ur
    where ur.user_id = auth.uid()
      and (
        ur.scope_type = 'global'
        or (ur.scope_type = 'property' and ur.scope_property_id = p_property_id)
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- Enable RLS on core tables
-- -----------------------------------------------------------------------------
alter table core.app_user          enable row level security;
alter table core.role              enable row level security;
alter table core.permission        enable row level security;
alter table core.role_permission   enable row level security;
alter table core.user_role         enable row level security;
alter table core.audit_log         enable row level security;
alter table core.domain_event      enable row level security;
alter table core.property          enable row level security;
alter table core.unit              enable row level security;
alter table core.tenant            enable row level security;
alter table core.lease             enable row level security;

-- -----------------------------------------------------------------------------
-- RBAC read policies (any authenticated user can read RBAC tables)
-- -----------------------------------------------------------------------------
create policy app_user_self_read on core.app_user
  for select using (id = auth.uid() or public.has_perm('user:manage'));

create policy role_read on core.role
  for select using (auth.uid() is not null);

create policy permission_read on core.permission
  for select using (auth.uid() is not null);

create policy role_permission_read on core.role_permission
  for select using (auth.uid() is not null);

create policy user_role_read on core.user_role
  for select using (user_id = auth.uid() or public.has_perm('user:manage'));

create policy audit_read on core.audit_log
  for select using (public.has_perm('audit:read'));

create policy domain_event_read on core.domain_event
  for select using (auth.uid() is not null);

-- -----------------------------------------------------------------------------
-- Domain policies
-- -----------------------------------------------------------------------------
create policy property_read on core.property
  for select using (public.has_perm('property:read') and public.in_scope(id));

create policy property_write on core.property
  for all
  using      (public.has_perm('property:update') and public.in_scope(id))
  with check (public.has_perm('property:update'));

create policy unit_read on core.unit
  for select using (public.has_perm('unit:read') and public.in_scope(property_id));

create policy unit_write on core.unit
  for all
  using      (public.has_perm('unit:update') and public.in_scope(property_id))
  with check (public.has_perm('unit:update'));

create policy tenant_read on core.tenant
  for select using (public.has_perm('tenant:read'));

create policy tenant_write on core.tenant
  for all
  using      (public.has_perm('tenant:update'))
  with check (public.has_perm('tenant:update'));

create policy lease_read on core.lease
  for select using (
    public.has_perm('lease:read')
    and public.in_scope((select property_id from core.unit where id = unit_id))
  );

create policy lease_write on core.lease
  for all
  using (
    public.has_perm('lease:update')
    and public.in_scope((select property_id from core.unit where id = unit_id))
  )
  with check (public.has_perm('lease:update'));

-- -----------------------------------------------------------------------------
-- Grants for anon + authenticated roles (views + functions)
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.user_role    to authenticated;
grant select on public.role         to authenticated;
grant select on public.permission   to authenticated;
grant select on public.domain_event to authenticated;
grant execute on function public.has_perm(text)     to authenticated;
grant execute on function public.in_scope(uuid)     to authenticated;
