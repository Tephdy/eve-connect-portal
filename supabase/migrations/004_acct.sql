-- 004_acct.sql
-- Accounting module.

create schema if not exists acct;

create table acct.invoice (
  id         uuid primary key default gen_random_uuid(),
  lease_id   uuid not null references core.lease(id) on delete cascade,
  type       text not null check (type in ('rent','deposit','penalty','other')),
  amount     numeric(14,2) not null check (amount >= 0),
  due_date   date not null,
  status     text not null default 'unpaid'
               check (status in ('unpaid','paid','overdue','void')),
  created_at timestamptz not null default now()
);
create index invoice_lease_idx   on acct.invoice (lease_id, status);
create index invoice_due_idx     on acct.invoice (due_date) where status <> 'paid';

create table acct.payment (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references acct.invoice(id) on delete cascade,
  amount        numeric(14,2) not null check (amount > 0),
  method        text not null,     -- cash, bank_transfer, gcash, maya, check, other
  reference_no  text,
  paid_at       timestamptz not null default now(),
  recorded_by   uuid references core.app_user(id)
);

create table acct.deposit (
  id               uuid primary key default gen_random_uuid(),
  lease_id         uuid not null references core.lease(id) on delete cascade,
  amount           numeric(14,2) not null,
  status           text not null default 'held'
                     check (status in ('held','partial','returned','forfeited')),
  refunded_amount  numeric(14,2) not null default 0
);

create table acct.ledger_entry (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references core.tenant(id),
  type            text not null check (type in ('debit','credit')),
  amount          numeric(14,2) not null,
  balance_after   numeric(14,2) not null,
  ref_invoice_id  uuid references acct.invoice(id),
  created_at      timestamptz not null default now()
);
create index ledger_tenant_idx on acct.ledger_entry (tenant_id, created_at desc);
