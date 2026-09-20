-- 011_storage_buckets.sql
-- Storage buckets for signed contracts and tenant signatures.

insert into storage.buckets (id, name, public)
values
  ('contracts',  'contracts',  false),
  ('signatures', 'signatures', false)
on conflict (id) do nothing;

-- Only users with contract:read may read the contracts bucket
create policy contracts_read on storage.objects
  for select using (
    bucket_id = 'contracts'
    and public.has_perm('contract:read')
  );

-- Only users with contract:create may write to the contracts bucket
create policy contracts_write on storage.objects
  for insert with check (
    bucket_id = 'contracts'
    and public.has_perm('contract:create')
  );

-- Signatures bucket: readable to anyone with contract:read, writable by property_rep
create policy signatures_read on storage.objects
  for select using (
    bucket_id = 'signatures'
    and public.has_perm('contract:read')
  );

create policy signatures_write on storage.objects
  for insert with check (
    bucket_id = 'signatures'
    and public.has_perm('contract:create')
  );
