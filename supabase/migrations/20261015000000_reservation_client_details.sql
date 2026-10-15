alter table acct.unit_reservation
  add column if not exists gender text,
  add column if not exists company text,
  add column if not exists position text,
  add column if not exists valid_id_path text,
  add column if not exists vehicle_plate text,
  add column if not exists declared_occupants integer not null default 1
    check (declared_occupants >= 1);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'reservation-ids',
  'reservation-ids',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists reservation_ids_read on storage.objects;
create policy reservation_ids_read on storage.objects
  for select using (
    bucket_id = 'reservation-ids'
    and public.has_perm('unit:read')
  );

drop policy if exists reservation_ids_write on storage.objects;
create policy reservation_ids_write on storage.objects
  for insert with check (
    bucket_id = 'reservation-ids'
    and public.has_perm('unit:reserve')
  );

do $$
begin
  update prep.contract_template
  set body_markdown = replace(
    replace(
      body_markdown,
      '<tr><td>Total Payable:</td><td>P{{total_payable}}.00</td><td>Total Amount Paid:</td><td>P{{amount_paid}}.00</td></tr>',
      '<tr><td>Total Payable:</td><td>P{{total_payable}}</td><td>Total Amount Paid:</td><td>P{{amount_paid}}</td></tr>' ||
      E'\n    <tr><td>Remaining Balance:</td><td colspan="3">P{{remaining_balance}}</td></tr>'
    ),
    '}}.00',
    '}}'
  )
  where doc_type = 'reservation'
    and active = true
    and body_markdown not like '%{{remaining_balance}}%';
end $$;

notify pgrst, 'reload schema';
