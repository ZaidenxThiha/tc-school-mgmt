-- 07_security.sql — security hardening support.
--
-- login_attempts backs the credential rate-limiter in src/auth.ts (the app runs
-- on Neon with no Supabase auth, so throttling lives in the DB). audit_log
-- already exists (id, table_name, row_id, action, changed_by, changed_at, diff)
-- and is written from the app layer (src/lib/audit.ts) for security events.

create table if not exists login_attempts (
  id          bigserial primary key,
  email       text not null,
  ip          text,
  success     boolean not null default false,
  attempted_at timestamptz not null default now()
);

-- Lookup for "recent failures for this email" and for pruning.
create index if not exists login_attempts_email_time_idx
  on login_attempts (lower(email), attempted_at desc);

-- Help the audit viewer paginate newest-first.
create index if not exists audit_log_changed_at_idx
  on audit_log (changed_at desc);

-- The original CHECK limited action to INSERT/UPDATE/DELETE (row-change auditing).
-- audit_log is now a general security log (login, user_*, backup_*), so drop it.
alter table audit_log drop constraint if exists audit_log_action_check;
