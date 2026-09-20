# Apartment Rental Operations Platform

Internal operations portal for a multi-property apartment rental business.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind · Supabase · Vercel

---

## Setup

### 1. Prerequisites
- Node.js **20+**
- npm **10+**
- A Supabase project (free tier OK)

### 2. Install
```bash
npm install
```

### 3. Configure environment
```bash
cp .env.example .env.local
```
Fill in `.env.local` with your Supabase project URL, anon key, and service role key.

### 4. Run migrations
In the Supabase SQL editor, run in order:
```
supabase/migrations/001_extensions.sql
supabase/migrations/002_core_rbac.sql
supabase/migrations/003_core_domain.sql
supabase/migrations/004_acct.sql
supabase/migrations/005_mkt.sql
supabase/migrations/006_maint.sql
supabase/migrations/007_prep.sql
supabase/migrations/008_rls.sql
supabase/migrations/009_seed_roles_permissions.sql
supabase/migrations/010_seed_job_task_types.sql
supabase/migrations/011_storage_buckets.sql
```

### 5. Create the first user
- Supabase → Authentication → Users → **Add user** (email + password)
- Then in SQL editor, assign a role:
```sql
insert into core.user_role (user_id, role_id, scope_type)
select '<user-uuid>', id, 'global' from core.role where key = 'system_admin';
```

### 6. Run
```bash
npm run dev
```
Open http://localhost:3000

---

## Roles

| Role | Scope | Landing |
|---|---|---|
| `accounting` | global | /accounting |
| `marketing` | global | /marketing |
| `maintenance` | property | /maintenance |
| `property_rep` | property | /property |
| `executive` | global | /executive |
| `system_admin` | — | /admin |
