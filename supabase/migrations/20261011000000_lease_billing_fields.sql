-- ---------------------------------------------------------------------------
-- 20261011000000_lease_billing_fields.sql
--
-- Extends core.lease with billing fields needed by the long-term contract
-- template, adds reservation-fee snapshot columns, and extends the contract
-- template registry to be property- and term-scoped.
--
-- Idempotent: safe to re-run.
-- ---------------------------------------------------------------------------

-- 1. core.lease — billing / contract-identity fields
alter table core.lease
  add column if not exists occupancy_fee numeric(12,2) not null default 0,
  add column if not exists utility_deposit numeric(12,2) not null default 0,
  add column if not exists due_day smallint,
  add column if not exists control_number text,
  add column if not exists barcode_value text;

-- Constrain due_day to 1..31 (nullable).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'lease_due_day_check'
  ) then
    alter table core.lease
      add constraint lease_due_day_check
      check (due_day is null or (due_day between 1 and 31));
  end if;
end $$;

-- 2. core.lease — reservation snapshot columns
-- These freeze the reservation terms at the moment the lease is created,
-- so the signed contract cannot be retroactively altered by changing the
-- underlying unit_reservation row.
alter table core.lease
  add column if not exists reservation_fee numeric(12,2),
  add column if not exists reservation_fee_nonrefundable_on date,
  add column if not exists deposit_nonrefundable_on date,
  add column if not exists target_move_in_date date,
  add column if not exists reservation_total_due numeric(12,2);

-- 3. core.property_payment_channel — bank / gcash / maya details per property
create table if not exists core.property_payment_channel (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid not null references core.property(id) on delete cascade,
  kind           text not null check (kind in ('bank','gcash','maya','other')),
  label          text,
  account_number text,
  account_name   text,
  sort_order     int  not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists property_payment_channel_property_idx
  on core.property_payment_channel (property_id, sort_order);

-- 4. prep.contract_template — scope by property and term duration
alter table prep.contract_template
  add column if not exists property_id uuid references core.property(id),
  add column if not exists term_type text,
  add column if not exists title text;

-- term_type allowed values (nullable = generic template usable by any property)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contract_template_term_type_check'
  ) then
    alter table prep.contract_template
      add constraint contract_template_term_type_check
      check (
        term_type is null
        or term_type in (
          'trial',
          'extended_trial',
          'monthly',
          'one_month',
          'three_months',
          'six_months',
          'long_term'
        )
      );
  end if;
end $$;

-- Only one active template per (property_id, term_type) at a time.
create unique index if not exists contract_template_active_scope_uniq
  on prep.contract_template (coalesce(property_id, '00000000-0000-0000-0000-000000000000'::uuid), term_type)
  where active = true;