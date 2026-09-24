-- Tenant receipt uploads (Google Drive-backed). Restore.
create table if not exists acct.tenant_receipt (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  property_id uuid,
  unit_id uuid,
  payment_for text[] not null default '{}',
  custom_label text,
  reservation_id uuid,
  drive_folder_id text not null,
  drive_folder_url text not null,
  drive_file_ids jsonb not null default '[]'::jsonb,
  uploaded_by uuid,
  uploaded_at timestamptz not null default now(),
  notes text
);

create index if not exists tenant_receipt_tenant_idx
  on acct.tenant_receipt (tenant_id, uploaded_at desc);
create index if not exists tenant_receipt_property_idx
  on acct.tenant_receipt (property_id, uploaded_at desc);

grant usage on schema acct to authenticated, service_role;
grant select, insert, update, delete on acct.tenant_receipt to authenticated;
grant select, insert, update, delete on acct.tenant_receipt to service_role;

alter table acct.tenant_receipt enable row level security;
drop policy if exists tenant_receipt_read on acct.tenant_receipt;
drop policy if exists tenant_receipt_write on acct.tenant_receipt;
create policy tenant_receipt_read on acct.tenant_receipt for select to public using (true);
create policy tenant_receipt_write on acct.tenant_receipt for all to public using (true) with check (true);

drop view if exists public.tenant_receipt;
create view public.tenant_receipt as
select id, tenant_id, property_id, unit_id, payment_for, custom_label,
       reservation_id, drive_folder_id, drive_folder_url, drive_file_ids,
       uploaded_by, uploaded_at, notes
from acct.tenant_receipt;

grant select, insert, update, delete on public.tenant_receipt to anon;
grant select, insert, update, delete on public.tenant_receipt to authenticated;
grant select, insert, update, delete on public.tenant_receipt to service_role;

notify pgrst, 'reload schema';
