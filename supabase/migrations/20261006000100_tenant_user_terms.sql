-- Records the terms/privacy version agreed to by each linked tenant.

alter table core.tenant_user
  add column if not exists terms_version_agreed text,
  add column if not exists terms_agreed_at timestamptz;

notify pgrst, 'reload schema';
