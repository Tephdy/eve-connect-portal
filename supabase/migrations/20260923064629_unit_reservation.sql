-- Unit reservations captured by marketing.
-- One row per reservation event. A unit is "reserved" while an open row
-- (released_at IS NULL) exists for it.

create table if not exists acct.unit_reservation (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null,
  client_name text not null,
  client_phone text,
  client_email text,
  reservation_fee numeric check (reservation_fee is null or reservation_fee >= 0),
  payment_mode text check (payment_mode in ('cash','gcash','bank','check','other') or payment_mode is null),
  reference_number text,
  reserved_at timestamptz not null default now(),
  reserved_by uuid,
  released_at timestamptz,
  released_by uuid,
  release_reason text
);

create index if not exists unit_reservation_unit_idx
  on acct.unit_reservation (unit_id, reserved_at desc);

create index if not exists unit_reservation_open_idx
  on acct.unit_reservation (unit_id) where released_at is null;

-- Grants
grant usage on schema acct to authenticated, service_role;
grant select, insert, update, delete on acct.unit_reservation to authenticated;
grant select, insert, update, delete on acct.unit_reservation to service_role;

-- RLS
alter table acct.unit_reservation enable row level security;

drop policy if exists unit_reservation_read on acct.unit_reservation;
drop policy if exists unit_reservation_write on acct.unit_reservation;

create policy unit_reservation_read
  on acct.unit_reservation for select
  to public using (true);

create policy unit_reservation_write
  on acct.unit_reservation for all
  to public using (true) with check (true);

notify pgrst, 'reload schema';
