-- 005_mkt.sql
-- Marketing module.

create schema if not exists mkt;

create table mkt.listing (
  id            uuid primary key default gen_random_uuid(),
  unit_id       uuid not null references core.unit(id) on delete cascade,
  title         text not null,
  description   text,
  photos        jsonb not null default '[]'::jsonb,
  asking_rent   numeric(14,2),
  published_at  timestamptz,
  status        text not null default 'draft'
                  check (status in ('draft','published','unlisted'))
);
create index listing_unit_idx on mkt.listing (unit_id, status);

create table mkt.availability_forecast (
  id                       uuid primary key default gen_random_uuid(),
  unit_id                  uuid not null references core.unit(id) on delete cascade,
  earliest_available_date  date not null,
  confidence               text not null default 'estimated'
                             check (confidence in ('confirmed','estimated')),
  notes                    text,
  computed_at              timestamptz not null default now()
);
create index forecast_unit_idx on mkt.availability_forecast (unit_id, computed_at desc);

create table mkt.inquiry (
  id            uuid primary key default gen_random_uuid(),
  unit_id       uuid references core.unit(id),
  prospect_name text not null,
  contact       text,
  source        text,
  status        text not null default 'open'
                  check (status in ('open','contacted','converted','lost')),
  created_at    timestamptz not null default now()
);
