-- 007_prep.sql
-- Property Rep module: contract templates + signed contracts.

create schema if not exists prep;

create table prep.contract_template (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  body_markdown  text not null,
  version        int not null default 1,
  active         boolean not null default true
);

create table prep.contract (
  id                   uuid primary key default gen_random_uuid(),
  lease_id             uuid not null references core.lease(id) on delete cascade,
  template_id          uuid references prep.contract_template(id),
  generated_body       text,
  status               text not null default 'draft'
                         check (status in ('draft','sent','signed','void')),
  signed_at            timestamptz,
  signed_document_url  text,
  tenant_signature     text,   -- base64 PNG or storage URL
  created_at           timestamptz not null default now()
);
create index contract_lease_idx on prep.contract (lease_id, status);
