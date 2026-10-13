-- ---------------------------------------------------------------------------
-- 20261013000002_reservation_contracts.sql
--
-- Adds doc_type discriminator to prep.contract_template, plus a new
-- prep.reservation_contract table to store rendered reservation contracts.
-- Idempotent.
-- ---------------------------------------------------------------------------

-- 1. Discriminator on contract_template
alter table prep.contract_template
  add column if not exists doc_type text not null default 'lease';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contract_template_doc_type_check'
  ) then
    alter table prep.contract_template
      add constraint contract_template_doc_type_check
      check (doc_type in ('lease','reservation'));
  end if;
end $$;

create index if not exists contract_template_doc_type_idx
  on prep.contract_template (doc_type, term_type, active);

-- 2. Reservation contract table
create table if not exists prep.reservation_contract (
  id                uuid primary key default gen_random_uuid(),
  reservation_id    uuid not null references acct.unit_reservation(id) on delete cascade,
  template_id       uuid references prep.contract_template(id),
  generated_body    text,
  status            text not null default 'draft'
                    check (status in ('draft','signed','void')),
  signed_at         timestamptz,
  tenant_signature  text,
  signature_token   text,
  token_expires_at  timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists reservation_contract_reservation_idx
  on prep.reservation_contract (reservation_id);

create index if not exists reservation_contract_token_idx
  on prep.reservation_contract (signature_token);

alter table prep.reservation_contract enable row level security;

drop policy if exists reservation_contract_staff_all on prep.reservation_contract;
create policy reservation_contract_staff_all
  on prep.reservation_contract for all
  to authenticated
  using (true)
  with check (true);

-- Public read by token (for the sign page, unauthenticated)
drop policy if exists reservation_contract_public_read on prep.reservation_contract;
create policy reservation_contract_public_read
  on prep.reservation_contract for select
  to anon
  using (signature_token is not null and token_expires_at > now());
