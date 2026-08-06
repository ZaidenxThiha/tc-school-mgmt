# Thazin & Cherry — School Management System

Internal admin system for an ESL school: students, enrolment, billing & payments,
scheduling, payroll, attendance, inventory, and events. Cambridge level ladder
(Early Childhood → CAE) plus Summer programs.

**Live:** https://tncengcenter.vercel.app · **Stack:** Next.js 15 (App Router) · Neon Postgres · NextAuth v5 · Vercel (region `sin1`)
**Currency:** MMK — stored as `bigint`, displayed with comma separators (`100,000`).

![Dashboard](docs/dashboard.png)

## Features

- **Dashboard** — active students, employees, open invoices, P&L, students owing (pre-aggregated).
- **Students & Enrolment** — searchable records, enrol into sections (capacity-checked), per-student billing/payment history & outstanding balance.
- **Billing** — monthly invoice generation, on-demand itemized invoices from the fee schedule, bulk actions (mark paid / void / delete), CSV export, "undo generate" (skips invoices with payments or linked inventory movements).
- **Payments** — record against a specific invoice; a DB trigger auto-reconciles invoice status (`open` → `paid`) on any payment change.
- **Schedule** — weekly timetable per month, copy-from-previous, and **CSV import** of the class-schedule template grid.
- **Backup** — full-database JSON backups (manual + nightly Vercel Cron), download/restore, restore guarded by the operator's own password.
- **Payroll, Absences, Inventory, Events, Reports, Settings/Users, Audit log.**
- **Face attendance** — camera scan at the door; local InsightFace sidecar on each laptop embeds faces in-browser, server matches against pgvector and records attendance. Admin **Record Face** for enrolment.

## Face attendance (local engine)

The deployed site (**https://tncengcenter.vercel.app**) cannot run Python/ONNX on Vercel. Each attendance laptop runs a small **face-engine** sidecar locally; the browser sends only 512-d embeddings to the server — **photos never leave the laptop**.

**On each attendance laptop (once per session):**

1. Open [`face-engine/run.command`](face-engine/run.command) (double-click) and leave the terminal open.  
   First run installs Python deps and downloads the `buffalo_l` model (~300 MB).
2. Open the site → **Attendance → Scan** (or **Record Face**).
3. Click **Start scanning** — the app auto-starts the engine if it is not already running.

| Port | Service |
|------|---------|
| `8765` | Launcher (`run.command`) — listens for “start engine” from the browser |
| `8000` | Face engine — InsightFace detect + embed |

**Local dev** (`npm run dev` on the same machine): set `FACE_ENGINE_URL=http://127.0.0.1:8000` and `FACE_ENGINE_TOKEN=…` in `app/.env.local`. The Next.js server can spawn uvicorn automatically; `run.command` is optional.

**Optional server-side mode:** host `face-engine` centrally and set `FACE_ENGINE_URL` + `FACE_ENGINE_TOKEN` on Vercel for server-side embedding (not used by the default camera UI). See [`face-engine/README.md`](face-engine/README.md).

## Auth & roles

NextAuth v5 (Auth.js) Credentials provider with bcrypt password hashes; JWT session
strategy. The role is carried in the JWT and enforced server-side in every mutation
via `requireRole(...)` (`src/lib/auth-guard.ts`):

- `owner` — full access (incl. user management, audit log, backups)
- `admin` — manage students/schedule/etc.
- `accounts` — finance (invoices/payments)
- `readonly` — limited read access

**Hardening:** login rate-limiting (5 failed attempts / 15 min per email, tracked in
`login_attempts`), and a security **audit log** (`/settings/audit`, owner-only) recording
logins, user management, and backup actions.

## Layout

- [`app/`](app/) — Next.js 15 web app (the deployed project; Vercel **Root Directory = `app`**)
- [`app/migration-neon/`](app/migration-neon/) — Neon schema: tables, constraints, indexes, views/functions, triggers, backup/restore, security
- [`supabase/`](supabase/) — legacy migration SQL (pre-Neon; kept for history)
- [`_PLAN/`](_PLAN/) — design docs (master plan, schema, ETL mapping, performance plan)
- [`etl/`](etl/) — historical Excel import scripts
- Source spreadsheets (finance / student lists) are **git-ignored** (contain PII).

## Database

**Remote-only.** App traffic hits a hosted **Neon** Postgres project (`ap-southeast-1`,
Singapore — matching the Vercel `sin1` function region). No local Postgres.
Schema lives in [`app/migration-neon/`](app/migration-neon/), applied in numeric order
(`01_tables` → `07_security`). The app connects via the `postgres` (porsager) client
using tagged-template SQL (`src/lib/db.ts`).

Backups run as a nightly Vercel Cron job (`/api/cron/backup`, daily on the Hobby plan)
and can also be triggered/downloaded/restored from the Backup page. Restore uses
deferrable FK constraints and per-table `DISABLE TRIGGER USER` so it works under Neon's
non-superuser role.

## Develop

```bash
cd app
cp .env.example .env.local   # fill DATABASE_URL + AUTH_SECRET (+ CRON_SECRET)
npm install
npm run dev          # http://localhost:3000
npm run type-check   # tsc --noEmit
npm run build
```

## Deploy

Hosted on **Vercel** with GitHub auto-deploy: every push to `main` builds from `app/`
and deploys to https://tncengcenter.vercel.app. Preview deployments are created per branch.

Required Vercel env vars:

- `DATABASE_URL` — Neon pooled connection string
- `AUTH_SECRET` — NextAuth secret (`openssl rand -base64 32`)
- `CRON_SECRET` — shared Bearer token for the nightly backup cron route

Optional (server-side face embedding only; browser-direct scanning does **not** need these on Vercel):

- `FACE_ENGINE_URL` — hosted sidecar URL
- `FACE_ENGINE_TOKEN` — shared bearer token matching the sidecar
