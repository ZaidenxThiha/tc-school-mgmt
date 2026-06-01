# 07 — Migrate Supabase → Vercel (Neon Postgres)

Goal: run everything on Vercel; drop Supabase. Branch: `migrate-neon` (keep `main`
deployed/working until cutover).

## Scope (measured)
- 71 files import the Supabase client · 201 `.from/.rpc/.auth` call sites · 38 server actions.
- Data is small: students 535, invoices 1254, payments 1167, schedule 306, payslips 119, **auth users 2**.
- Supabase currently provides: Postgres · **Auth** · **RLS (`auth_role()`)** · functions/triggers.
- Neon provides: **Postgres only** → we must replace Auth + RLS in app code.

## Progress
- ✅ **P0** Neon provisioned (Singapore `ap-southeast-1`), connected.
- ✅ **P1** Schema on Neon: 34 tables, 43 FKs, all indexes, 5 views, business
  functions, payment-reconcile trigger. RLS/`auth_role()` stripped; `users` table added.
- ✅ **P2** Data copied via Supabase secret key → Neon (exact counts): students 535,
  guardians 537, employees 41, enrolments 535, invoices 1254, invoice_lines 1538,
  payments 1167, ledger 1623, schedule 306, payslips 119, … + both login users
  (bcrypt hashes). Sequences reset.
- ⬜ **P3** Auth.js (login/session/roles) — code rewrite, next.
- ⬜ **P4** Data layer: 201 call sites (71 files) supabase-js → Postgres.
- ⬜ **P5** Cutover: env→Neon, drop @supabase/*, functions→sin1, test, merge.

## Phases (detail)
- **P0 — Provision (BLOCKING, user):** Create Neon DB in Vercel → Storage → Create Database → Neon.
  Adds `DATABASE_URL` to the Vercel project. Provide the connection string for local work.
- **P1 — Schema on Neon:** Load tables + FKs + indexes + pure SQL functions/triggers
  (recompute_invoice_status, trg_payments_reconcile, generate_invoices_for_month,
  generate_payslips_from_schedule, dashboard_data, dashboard_outstanding,
  copy_schedule_from_previous). Drop RLS + `auth_role()`. Add an app `users` table
  (id, email, password_hash, full_name, role).
- **P2 — Data copy:** Export every table from Supabase (via MCP) → load into Neon.
  Migrate the 2 auth users (bcrypt hashes carry over) into `users`.
- **P3 — Auth (Auth.js / NextAuth):** Credentials provider + JWT session; role from
  `users.role`. Replace `lib/supabase/{server,client,middleware}` + login + signout +
  callback. Re-implement the `(app)` layout guard + role checks (was RLS).
- **P4 — Data layer:** Introduce `lib/db.ts` (`postgres` lib). Rewrite 201 call sites
  from the supabase query builder to SQL. Enforce role permissions in server
  actions/queries (replacing RLS). RPC calls → `select * from fn(...)`.
- **P5 — Cutover:** Set Vercel env to Neon, remove `@supabase/*` deps, full type-check
  + build + manual test (login, each module, payments trigger), then merge to `main`.

## Risks / notes
- Biggest effort: P3 (auth) + P4 (201 call sites). Highest risk: permissions parity
  (RLS → app checks) and the payments→invoice reconcile trigger (keep in Neon SQL).
- Neon free tier: 0.5 GB + autosuspend (cold starts). Confirm acceptable.
- Keep `main` live on Supabase until P5 passes end-to-end on the branch.
