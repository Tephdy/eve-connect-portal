-- Adds billing fields to acct.meter_reading for the per-property bulk readings grid.
-- Idempotent. Safe to re-run.

alter table acct.meter_reading
  add column if not exists rate_snapshot  numeric,
  add column if not exists amount_due     numeric,
  add column if not exists penalty_amount numeric not null default 0,
  add column if not exists total_due      numeric,
  add column if not exists or_number      text,
  add column if not exists invoice_id     uuid;

create index if not exists meter_reading_or_idx
  on acct.meter_reading (or_number) where or_number is not null;

create index if not exists meter_reading_invoice_idx
  on acct.meter_reading (invoice_id) where invoice_id is not null;

notify pgrst, 'reload schema';
