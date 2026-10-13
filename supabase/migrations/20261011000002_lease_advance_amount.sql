-- ---------------------------------------------------------------------------
-- 20261011000002_lease_advance_amount.sql
--
-- Adds advance rental snapshot columns and initial meter readings to
-- prep.unit_inspection. Idempotent: safe to re-run.
-- ---------------------------------------------------------------------------

-- 1. core.lease — advance amount + due date snapshot
alter table core.lease
  add column if not exists advance_amount numeric(12,2) not null default 0,
  add column if not exists advance_due_date date;

-- 2. prep.unit_inspection — initial water/electric readings at move-in
alter table prep.unit_inspection
  add column if not exists water_initial numeric(12,2),
  add column if not exists electric_initial numeric(12,2);