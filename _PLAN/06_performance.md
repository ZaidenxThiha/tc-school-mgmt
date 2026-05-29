# 06 — Performance Plan

Status: **Phase 1 DB work complete & verified, 2026-05-30** (Phase 2 next)

### Done (2026-05-30)
- ✅ 1.1 RLS consolidated → **0 overlapping permissive policies** (was 68 advisories).
  Dropped 12 redundant owner-only subset policies; split ALL→per-command writes on
  employees/rooms/schedule_assignments/students. `auth_role()` wrapped in `(select …)`
  in the new policies. Verified: owner read+write, accounts read-only on students,
  readonly blocked — all behavior preserved.
- ✅ 1.2 Added 28 missing FK indexes.
- ✅ 1.4 Added composite/partial hot-path indexes (invoices status+month,
  enrolments active-section, students status+name).
- ⏳ 1.3 Drop 5 unused indexes — deferred until new query patterns settle.
- ✅ 2.1 Dashboard "students owing" now uses `dashboard_outstanding()` SQL function
  (per-student count/outstanding/oldest pre-aggregated, RLS-respecting) — one
  round-trip instead of fetching all open invoices + payments and summing in JS.
  Verified: returns correct netted outstanding (partial payments handled).

Goal: every interaction feels instant (<100ms perceived), minimal DB queries,
efficient indexes, smart caching, optimistic UI, background sync.

Stack: Next.js 15 App Router (server components) · Supabase Postgres + RLS ·
recharts · Vercel.

## Budgets
- Perceived interaction < 100ms (optimistic where a mutation is involved).
- List/detail page: ≤ 3 DB round-trips, all index-backed.
- Dashboard: 1 aggregate round-trip, cached ~60s.
- Search keystroke → results: debounced, server-side, < 200ms.

## Baseline findings (Supabase performance advisors, 2026-05-30)
- **68 × multiple_permissive_policies** — every table has two `ALL` permissive
  policies (`owner_all_*` + `admin_rw_*`/`accounts_rw_*`); both evaluated per row
  per command.
- **28 × unindexed_foreign_keys** — FK columns without a covering index.
- **5 × unused_index** — dead indexes that only cost writes.

---

## Phase 0 — Measure first
- Dev-only timing wrapper around Supabase calls (log query + ms).
- Capture cold-load baseline for dashboard, /students, /billing, /enrolments.

## Phase 1 — Database (P0, highest ROI)
1. **Consolidate RLS** — one policy per command, OR-combining owner/admin checks;
   wrap `auth.uid()`/`auth.role()` in `(select …)` so evaluated once per query.
   Removes the 68 advisories. **Risk: high — test login + CRUD after.**
2. **Add 28 missing FK indexes.** Priority: `payments.invoice_id`,
   `invoice_lines.invoice_id`, `invoices.section_id` (hit by reconciliation
   trigger + dashboard). One migration, zero risk.
3. **Drop 5 unused indexes** (after confirming new queries don't need them).
4. **Composite / partial indexes for hot filters:**
   - `invoices (status, billing_month) WHERE status <> 'void'`
   - `enrolments (section_id) WHERE end_date IS NULL`
   - `students (current_status, english_name)`

## Phase 2 — Kill N+1 / over-fetching (P0)
- Replace dashboard "students owing" (fetches all open invoices + payments,
  aggregates in JS) with a `dashboard_outstanding()` SQL function/view returning
  per-student count/outstanding/oldest pre-summed.
- Audit every page for fetch-then-filter; keep filters/aggregation server-side.
- Select only rendered columns in embedded queries.

### Phase 3 progress (2026-05-30)
- ✅ Created `lib/reference.ts` — `cache()`-memoized getters (getLevels, getSections,
  getRooms, getDiscountTypes); per-request dedup + one canonical query shape.
  Wired into billing page (levels+sections) and enrolment form (sections).
- ⏳ Cross-request caching (`unstable_cache`) deferred — needs a public-read or
  service-role path since reference reads go through the cookie/RLS client.
- ⏳ React `cache()` on `getUser()`, dashboard SWR (revalidate:60 + tags),
  `revalidateTag` on mutations — pending.

## Phase 3 — Caching (P1)
- `unstable_cache` + tags for reference data (levels, fee_schedule, sections,
  rooms, discount_types, chart_of_accounts); revalidate on edit.
- React `cache()` to dedupe identical queries within a request.
- Dashboard aggregates cached `revalidate: 60`, tags `invoices/payments/students`.
- Mutations call `revalidateTag(...)` instead of broad `revalidatePath('/')`.

## Phase 4 — Optimistic UI & rendering (P1)
- `useOptimistic` + `useTransition` for delete, void invoice, record payment,
  enrolment status changes.
- `<Suspense>` streaming for heavy dashboard sections (charts, owing table).
- Keep client surface tiny; pass primitives; memoize chart data.

## Phase 5 — Background sync (P2)
- Debounced (300ms) server-side search on list pages.
- Stale-while-revalidate dashboard; refresh via tag revalidation after writes.
- Optional Vercel cron to pre-warm dashboard aggregates.

## Phase 6 — Attendance (P2, when it ships)
- `attendance_marks`/`class_sessions` will be highest-volume: partial indexes,
  paginate by session/date, aggregate rates in SQL.

---

## Sequencing
Phase 1 + 2 = ~80% of the real win, mostly DB-only. RLS consolidation is the one
risky step (test thoroughly). Phases 3–5 make it *feel* instant.
