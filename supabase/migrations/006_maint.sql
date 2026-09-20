-- 006_maint.sql
-- Maintenance module with per-task-type PHP approval thresholds.

create schema if not exists maint;

create table maint.job_task_type (
  id                     uuid primary key default gen_random_uuid(),
  key                    text unique not null,
  name                   text not null,
  approval_threshold_php numeric(14,2) not null default 0
);

create table maint.job_order (
  id                   uuid primary key default gen_random_uuid(),
  unit_id              uuid not null references core.unit(id),
  task_type_id         uuid not null references maint.job_task_type(id),
  requested_by_user_id uuid references core.app_user(id),
  priority             text not null default 'normal'
                         check (priority in ('low','normal','high','urgent')),
  description          text,
  status               text not null default 'open'
                         check (status in ('open','pending_approval',
                                           'assigned','in_progress',
                                           'done','cancelled')),
  cost_estimate        numeric(14,2),
  assigned_to          uuid references core.app_user(id),
  created_at           timestamptz not null default now(),
  closed_at            timestamptz
);
create index job_order_unit_idx   on maint.job_order (unit_id, status);
create index job_order_status_idx on maint.job_order (status, priority);

create table maint.work_log (
  id                  uuid primary key default gen_random_uuid(),
  job_order_id        uuid not null references maint.job_order(id) on delete cascade,
  technician_user_id  uuid references core.app_user(id),
  notes               text,
  hours               numeric(6,2),
  parts_used          jsonb not null default '[]'::jsonb,
  completed_at        timestamptz
);

create table maint.asset (
  id             uuid primary key default gen_random_uuid(),
  unit_id        uuid not null references core.unit(id) on delete cascade,
  name           text not null,
  type           text,
  install_date   date,
  warranty_until date
);
