-- Add payment_month to tenant_receipt.
-- Format: "September 2026" (matches Drive folder name).

alter table acct.tenant_receipt
  add column if not exists payment_month text;

-- Recreate the public view to expose the new column.
drop view if exists public.tenant_receipt;

create view public.tenant_receipt as
select id, tenant_id, property_id, unit_id, payment_for, custom_label,
       reservation_id, drive_folder_id, drive_folder_url, drive_file_ids,
       uploaded_by, uploaded_at, notes, payment_month
from acct.tenant_receipt;

grant select, insert, update, delete on public.tenant_receipt to anon;
grant select, insert, update, delete on public.tenant_receipt to authenticated;
grant select, insert, update, delete on public.tenant_receipt to service_role;

notify pgrst, 'reload schema';
