# Thazin & Cherry Business Model

Internal management system: ESL Cambridge ladder + Summer programs + Events.

**Stack:** Supabase (Postgres + Auth + RLS + Storage) · Next.js + `@supabase/ssr` · n8n · Vercel
**Supabase project ref:** `ugjujibpbasskampuums`
**Currency:** MMK — stored as `bigint`, displayed with comma separator (`100,000`).
**Database mode:** **remote-only.** All migrations, ETL, and app traffic hit the hosted Supabase project (`ugjujibpbasskampuums`). No local Postgres, no `supabase start`. The `supabase/` folder holds migration SQL applied via `supabase db push` (or the Supabase MCP `apply_migration` tool).

## Layout

- [`_PLAN/`](_PLAN/) — design docs (master plan, schema, ETL mapping, data inventory, open questions)
- [`app/`](app/) — Next.js 15 web app
- [`supabase/`](supabase/) — migrations + seed
- [`etl/`](etl/) — historical Excel import scripts
- `2026 Thazin&Cherry Finance/` — source Excel files (finance)
- `2026 Thazin&Cherry student_s list/` — source Excel files (students/attendance)

## Status

Phase 0 (plan sign-off) → Phase 1 (schema + ETL) next.

This is a **local-only** repo — not published to GitHub.
