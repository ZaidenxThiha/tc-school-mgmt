# Plan — Camera-based Attendance with InsightFace

Implementation plan for adding automatic face-recognition attendance (students +
employees) to the Thazin & Cherry app, **without rewriting the project** and
following the existing conventions (Next.js 15 App Router, Neon Postgres via the
`postgres` tagged-template client, NextAuth v5 role guards, `(app)` route group,
`src/lib/actions/*` server actions, `migration-neon/NN_*.sql` migrations).

> Status: **IMPLEMENTED** (Python-sidecar option, §1a). Type-check + production
> build pass. Remaining to go live: apply `08_face.sql` to Neon, deploy the
> `face-engine/` sidecar, and set `FACE_ENGINE_URL` / `FACE_ENGINE_TOKEN`.

---

## 1. The one decision that needs sign-off: where InsightFace runs

InsightFace is a **Python / ONNX-Runtime** library (the `buffalo_l` model pack is
~300 MB). It **cannot run inside Next.js / Vercel serverless functions** (no Python
runtime, package-size and cold-start limits). So embedding extraction must live
somewhere that can load the model.

**Recommended: a small Python FastAPI "face engine" sidecar.**

```
Browser (camera)
   │  base64 JPEG frame
   ▼
Next.js API route  /api/face-recognition/recognize   ← auth, role, rate-limit, DB
   │  forwards image bytes (in-memory, never stored)
   ▼
Python FastAPI face-engine  (InsightFace buffalo_l)
   │  returns [{ bbox, det_score, embedding[512], quality }]  (NO image kept)
   ▼
Next.js matches embeddings against pgvector, applies attendance + dedup logic, writes DB
```

- The Next.js app stays the single source of truth for **auth, roles, DB, UI, and
  all attendance/dedup business logic**. The Python service is a **stateless,
  pure function: image → embeddings**. It holds no DB connection, no secrets
  beyond a shared `FACE_ENGINE_TOKEN`, and stores nothing.
- Matching (cosine similarity) is done **in Neon via `pgvector`**, not in Python —
  keeps all data in one place, matches "follow existing DB structure," and is
  plenty fast at this scale (hundreds–low-thousands of people). FAISS can be added
  later only if needed.
- Deploy the sidecar on any cheap always-on host (Railway / Render / Fly.io / a
  small VPS). Vercel cannot host it.

**Alternative (no Python):** run InsightFace via **ONNX Runtime Web (WASM)** in the
browser, generating embeddings client-side and posting only the 512-float vector.
Pros: no extra service, image never leaves the device. Cons: larger client bundle,
slower on weak devices, slightly lower accuracy, harder quality checks. Listed as a
fallback; the sidecar is the primary recommendation.

**→ Decision needed:** (a) Python sidecar [recommended] vs (b) in-browser WASM, and
(c) where to host the sidecar. Rest of this plan assumes (a) + pgvector.

---

## 2. How it maps onto the existing app (no duplication)

| Need | Existing thing to reuse / extend | New thing |
|---|---|---|
| Student attendance rows | **`attendance_marks`** (session_id, student_id, status, marked_at, marked_by) — currently unused in code | extend with face columns + unique constraint |
| Class session per day | **`class_sessions`** (section_id, session_date) — currently unused | add unique(section_id, session_date) + helper to get-or-create |
| Which class is "now" | **`schedule_assignments`** (month, day_of_week Sat/Sun, time_slot text, section_id) + **`enrolments`** (student→section) | session-resolver service |
| Config/thresholds | **`app_settings`** (key/value text) | seed `face.*` keys |
| Audit | **`audit_log`** + `src/lib/audit.ts` | log face_* actions |
| Roles | `requireRole(WRITE_ADMIN)` = owner/admin | face registration = admin only |
| Person records | **`students`** (id serial int), **`employees`** (id serial int) | — |
| Employee absence/attendance | **`absences`** exists but is leave-tracking, not daily check-in | new `employee_attendance` |

We do **not** add the proposed standalone `attendance_records` table — its role is
already filled by `attendance_marks` + `class_sessions`. We extend those instead.

---

## 3. Database — new migration `app/migration-neon/08_face.sql`

Follows the existing migration style (plain `public.` DDL, `if not exists`, applied
in numeric order). Also added to `06_backup.sql`'s table lists if those tables
should be backed up (face_profiles: yes; scan_logs: optional).

```sql
-- 08_face.sql — face-recognition attendance.
create extension if not exists vector;   -- pgvector (Neon-supported)

-- 1) Face embeddings (NO photos ever stored).
create table if not exists face_profiles (
  id            bigserial primary key,
  person_id     integer not null,
  person_type   text not null check (person_type in ('student','employee')),
  embedding     vector(512) not null,         -- buffalo_l / ArcFace dim
  model_name    text not null default 'buffalo_l',
  embedding_version text not null default 'v1',
  threshold_used numeric(4,3),
  metadata      jsonb default '{}'::jsonb,
  is_active     boolean not null default true,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists face_profiles_person_active_uniq
  on face_profiles (person_type, person_id) where is_active;   -- one active face/person
create index if not exists face_profiles_lookup_idx on face_profiles (person_type, person_id);
-- ANN index for cosine search (optional; exact scan is fine at this scale):
-- create index face_profiles_embedding_idx on face_profiles
--   using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- 2) Extend the existing student attendance tables (reuse, don't duplicate).
alter table class_sessions add column if not exists start_time time;
create unique index if not exists class_sessions_section_date_uniq
  on class_sessions (section_id, session_date);

alter table attendance_marks add column if not exists scan_time timestamptz;
alter table attendance_marks add column if not exists confidence_score numeric(5,4);
alter table attendance_marks add column if not exists source text default 'manual';  -- face_camera|manual|import
alter table attendance_marks add column if not exists subject text;
-- prevent duplicate student attendance per session:
create unique index if not exists attendance_marks_session_student_uniq
  on attendance_marks (session_id, student_id);

-- 3) Employee daily check-in / check-out.
create table if not exists employee_attendance (
  id              bigserial primary key,
  employee_id     integer not null,
  attendance_date date not null,
  check_in_time   timestamptz,
  check_out_time  timestamptz,
  check_in_confidence  numeric(5,4),
  check_out_confidence numeric(5,4),
  status          text not null default 'present',  -- present|incomplete|completed
  device_id       text,
  location        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists employee_attendance_emp_date_uniq
  on employee_attendance (employee_id, attendance_date);

-- 4) Scan logs (recognized/unknown/low_conf/duplicate/no_active_class/failed). No photos.
create table if not exists attendance_scan_logs (
  id            bigserial primary key,
  person_id     integer,
  person_type   text,
  match_status  text not null,   -- recognized|unknown|low_confidence|duplicate|no_active_class|failed
  confidence_score numeric(5,4),
  reason        text,
  device_id     text,
  location      text,
  scanned_at    timestamptz not null default now(),
  metadata      jsonb default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists scan_logs_time_status_idx on attendance_scan_logs (scanned_at desc, match_status);

-- 5) Config defaults (reuse app_settings key/value).
insert into app_settings(key, value) values
  ('face.match_threshold', '0.45'),   -- cosine similarity floor
  ('face.late_minutes',    '10'),     -- minutes after start_time => 'late'
  ('face.cooldown_seconds','45'),     -- server-side per-person cooldown
  ('face.min_face_px',     '80')      -- min bbox size for a usable face
on conflict (key) do nothing;
```

Notes:
- `vector(512)` cosine match: `1 - (embedding <=> $query)` ≥ threshold.
- Composite `attendance_marks` already lacks an `id`; we rely on the
  `(session_id, student_id)` unique index for dedup + upsert (`on conflict do nothing`).
- Backup/restore (`06_backup.sql`) row-order: add `face_profiles`, `employee_attendance`
  after their parent tables; `attendance_scan_logs` likely excluded from backups.

---

## 4. Python face-engine sidecar (new top-level `face-engine/`)

Minimal, stateless. Lives in repo root (sibling of `app/`), deployed separately.

```
face-engine/
  main.py            # FastAPI: POST /embed  (Bearer FACE_ENGINE_TOKEN)
  requirements.txt   # fastapi, uvicorn, insightface, onnxruntime, numpy, pillow
  Dockerfile
  README.md
```

`POST /embed` — body: `{ image: <base64 jpeg> }` → response:
```json
{ "faces": [ { "bbox":[x,y,w,h], "det_score":0.99,
               "embedding":[...512 floats, L2-normalized...],
               "quality": { "size_px":120, "blur":42.1, "brightness":0.6, "pose_ok":true } } ] }
```
- Loads `FaceAnalysis(name='buffalo_l')` once at startup.
- Decodes image **in memory**, runs detect+embed, returns vectors, **discards the
  image immediately** (no disk write, no logging of pixels).
- Stateless: no DB, no person identities — it never knows who anyone is.

---

## 5. Next.js API routes (`app/src/app/api/...`) — match existing route style

All under the NextAuth middleware gate (already covers `/api/*` except auth/cron).
Use `Response.json`, `auth()` + role checks, `audit()`, like `api/backup/restore`.

| Method & path | Purpose | Guard |
|---|---|---|
| `POST /api/face-profiles` | register: image → embed (via sidecar) → insert face_profiles | admin |
| `PUT /api/face-profiles/[id]` | re-record (deactivate old, insert new) | admin |
| `DELETE /api/face-profiles/[id]` | deactivate (`is_active=false`) | admin |
| `POST /api/face-recognition/recognize` | frame → sidecar embed → pgvector match → returns identities + status (no DB write) | admin/accounts (attendance operators) |
| `POST /api/attendance/face-record` | commit attendance for recognized people (dedup + cooldown + session resolve) | operator |
| `GET /api/attendance/reports` | student attendance report (filters: date, section, status) | role-gated |
| `GET /api/attendance/employee-reports` | employee daily report | role-gated |
| `GET /api/attendance/unassigned` | scan_logs where `no_active_class` | role-gated |
| `GET /api/attendance/scan-logs` | failed/unknown logs | role-gated |
| `POST /api/attendance/manual-correction` | edit a mark / check-in-out | admin |
| `GET /api/attendance/export` | CSV via existing `src/lib/csv.ts` | role-gated |

Multipart image uploads use a route handler (not a server action) to dodge the
1 MB server-action body limit — same reasoning as `api/backup/restore/route.ts`.
Recognize/record can be JSON (base64 frame) but set `export const maxDuration`.

---

## 6. Service layer (`app/src/lib/face/*`, `app/src/lib/attendance/*`)

Plain async functions over `sql` tagged templates (mirrors `src/lib/backup.ts`).

- `src/lib/face/engine.ts` — `embed(imageBytes): Promise<DetectedFace[]>` (calls sidecar,
  reads `FACE_ENGINE_URL` + `FACE_ENGINE_TOKEN`). Throws typed `NoFaceError`,
  `MultiFaceError` for the registration messages.
- `src/lib/face/profiles.ts` — `registerFace`, `reRecordFace`, `deactivateFace`,
  `matchEmbedding(vec)` → pgvector cosine search returning best person + score.
- `src/lib/face/quality.ts` — min size / blur / brightness / pose gates (reads
  `app_settings.face.*`), returns reject reason for scan_logs.
- `src/lib/attendance/session-resolver.ts` — **the student "active class now" logic** (§9).
- `src/lib/attendance/record.ts` — `recordStudent(...)`, `recordEmployee(...)` with all
  dedup rules (§8). Returns a per-person status enum used by the UI.
- `src/lib/attendance/cooldown.ts` — server-side per-person cooldown check against
  recent `attendance_scan_logs`/marks (defends even if frontend cache is bypassed).
- `src/lib/attendance/reports.ts` — report queries + CSV shaping.
- `src/lib/settings.ts` (new tiny helper) — typed getters over `app_settings`.

Server actions for the admin/correction forms go in
`app/src/lib/actions/attendance.ts` and `app/src/lib/actions/face.ts`
(`'use server'`, `requireRole`, `revalidatePath`, `audit` — exactly like
`src/lib/actions/schedule.ts`).

---

## 7. Recognition → attendance flow (per recognized person)

```
embedding ─► matchEmbedding() ─► best (person, score)
   score < face.match_threshold ──► log scan_logs(unknown|low_confidence) ─► UI "Unknown"
   score ≥ threshold:
      cooldown active? ──► status "Already recorded (cooldown)" (no write)
      person_type = student:
         resolveActiveSession(student, now)
            found ──► get-or-create class_sessions(section, today)
                      insert attendance_marks on conflict do nothing
                        inserted? present/late (vs start_time + late_minutes)
                        conflict?  "Already recorded"
            none  ──► log scan_logs(no_active_class) ─► UI "No active class"
      person_type = employee:
         upsert employee_attendance(employee, today):
            no row         ──► set check_in_time            ─► "Checked in"
            check_in only  ──► set check_out_time           ─► "Checked out"
            both present   ──► "Already completed"
```

Every branch writes an `attendance_scan_logs` row (recognized/duplicate/etc.) for
the admin review screens. No images are persisted anywhere in this path.

---

## 8. Duplicate prevention (three layers)

1. **DB constraints (authoritative):** `attendance_marks (session_id, student_id)`
   unique + `employee_attendance (employee_id, attendance_date)` unique. Inserts use
   `on conflict do nothing` / upsert so concurrent frames can't double-write.
2. **Server cooldown:** `face.cooldown_seconds` (default 45 s) — `record.ts` ignores a
   repeat for the same person within the window (returns "already recorded").
3. **Frontend cache:** `recognized_person_cache` Map in the Face Attendance client
   component holds `{personKey: lastSentAt}` and skips re-POSTing during cooldown —
   reduces load but is **not** trusted for correctness.

---

## 9. Student "active session" resolver (the no-manual-class core)

Important domain fact: **classes run Saturday & Sunday only**; schedule is stored
monthly in `schedule_assignments` (day_of_week `'Sat'/'Sun'`, `time_slot` text like
`'7:45-9:45'`, `'10-12'`, `'1-3'`, `'3:15-5:15'`), each tied to a `section_id`.

`resolveActiveSession(studentId, now)`:
1. `dow = now` is Sat/Sun? If not → `no_active_class`.
2. `month = date_trunc('month', now)`; map `now`'s time into the matching `time_slot`
   (parse the slot text ranges; allow a grace window so arrivals near start still match).
3. Find `schedule_assignments` for (month, dow, slot) whose `section_id` is one the
   student is enrolled in (`enrolments.status='Active'`, date range covers today).
4. If exactly one → that section. If several → pick by enrolment; if still ambiguous,
   log and surface for manual correction. If none → `no_active_class`.
5. `getOrCreateSession(section_id, today)` → `class_sessions` row (unique per day),
   carry `start_time` (from the slot) for late calculation.
6. `status = scan_time ≤ start_time + late_minutes ? 'present' : 'late'`.

This lives in `session-resolver.ts` with unit tests for the slot parsing (pure fn,
testable like `parse-timetable.ts`).

---

## 10. Frontend (`app/src/app/(app)/...` + `app/src/components/*`)

New `(app)` pages (server components for data + a client component for the camera),
styled with the existing `card` / `table` / `btn-*` / `badge-*` classes and
`PageHeader`, `Pagination`, `SearchInput` components.

| Route | Page | Notes |
|---|---|---|
| `(app)/attendance/record-face` | **Record Face** | admin-only; pick student/employee (reuse `student-combobox` pattern), upload or webcam capture, calls `POST /api/face-profiles`; shows "No face detected." / "Multiple faces detected…" |
| `(app)/attendance/scan` | **Face Attendance** | live `<video>` + periodic frame capture client component |
| `(app)/attendance/reports` | Student Attendance Reports | filters + CSV export |
| `(app)/attendance/employee-reports` | Employee Attendance Reports | daily check-in/out |
| `(app)/attendance/unassigned` | Unassigned / No-active-class | from scan_logs |
| `(app)/attendance/scan-logs` | Failed / Unknown Scan Logs | admin review |
| `(app)/attendance/corrections` | Manual Correction | edit marks / check-in-out |

New client components in `app/src/components/`:
- `face-capture.tsx` — getUserMedia, snapshot to canvas → base64 (used by Record Face).
- `face-attendance-scanner.tsx` — opens camera, captures a frame every ~2–3 s (not every
  frame), POSTs to `/recognize`, renders detected faces with name / type / confidence /
  status badge, maintains `recognized_person_cache`, shows loading + success/error states,
  separates "Unknown" faces.

**Sidebar:** add one group to `NAV` in `src/components/sidebar.tsx`, e.g. an
**"Attendance"** entry (icon `ScanFace` / `Camera` from lucide) linking to
`/attendance/scan`, with the sub-pages reachable from an in-page tab/header (mirrors how
`settings` hosts `audit`/`users`). Keeps the flat NAV from getting too long.

---

## 11. Security & privacy (maps to existing patterns)

- **No images stored, ever** — frames live only in memory in the route + sidecar and
  are discarded after embedding. Nothing written to disk, blob storage, or logs.
- **Registration = admin only** (`requireRole(WRITE_ADMIN)`); reports role-gated like
  the rest of the app; all face/attendance mutations write `audit_log` via `audit()`.
- **Validate uploads**: JPEG/PNG only, max ~5 MB, decode-guard before forwarding.
- **Rate-limit `/recognize`** — reuse the `login_attempts`-style approach (a small
  `face.cooldown` + per-IP throttle table or in-memory limiter) so the camera endpoint
  can't be hammered.
- **Sidecar auth**: `Authorization: Bearer FACE_ENGINE_TOKEN`; only the Next.js server
  calls it (never the browser). Run sidecar on private networking if possible.
- **Embeddings**: stored in Neon (TLS at rest/in transit). Optional app-level
  encryption deferred — embeddings are not reversible to a photo but are biometric
  data; treat the table as sensitive and keep it owner/admin-readable only.
- Failed/unknown scans logged **without any image** (just score + reason).

---

## 12. Accuracy & quality

- InsightFace `buffalo_l` (RetinaFace detect + ArcFace 512-d embed), embeddings
  L2-normalized; match via pgvector cosine.
- **Configurable threshold** `face.match_threshold` (start 0.45, tune 0.45–0.60) in
  `app_settings`; reject below it (→ low_confidence/unknown).
- **Quality gates** before accepting a face: min bbox px, blur (Laplacian var),
  brightness, and pose/`det_score` — failures logged with reason, not recorded.
- **Liveness / anti-spoofing**: out of scope for v1; leave a hook in the sidecar
  response (`quality`) and a `face.require_liveness` setting to enable later.

---

## 13. Config / env vars

Add to `app/.env.example` and Vercel:
- `FACE_ENGINE_URL` — sidecar base URL.
- `FACE_ENGINE_TOKEN` — shared bearer for the sidecar.

Tunables live in `app_settings` (`face.match_threshold`, `face.late_minutes`,
`face.cooldown_seconds`, `face.min_face_px`) and are editable from Settings — no redeploy.

---

## 14. File checklist (new files; nothing existing rewritten)

**DB**
- `app/migration-neon/08_face.sql`
- edit `app/migration-neon/06_backup.sql` (add face_profiles / employee_attendance to lists)

**Sidecar**
- `face-engine/{main.py,requirements.txt,Dockerfile,README.md}`

**Server lib**
- `app/src/lib/face/{engine,profiles,quality}.ts`
- `app/src/lib/attendance/{session-resolver,record,cooldown,reports}.ts`
- `app/src/lib/settings.ts`
- `app/src/lib/actions/{face,attendance}.ts`

**API routes**
- `app/src/app/api/face-profiles/route.ts` + `app/src/app/api/face-profiles/[id]/route.ts`
- `app/src/app/api/face-recognition/recognize/route.ts`
- `app/src/app/api/attendance/{face-record,reports,employee-reports,unassigned,scan-logs,manual-correction,export}/route.ts`

**Pages**
- `app/src/app/(app)/attendance/{record-face,scan,reports,employee-reports,unassigned,scan-logs,corrections}/page.tsx`

**Components**
- `app/src/components/{face-capture,face-attendance-scanner}.tsx`
- edit `app/src/components/sidebar.tsx` (add Attendance nav)

**Deps**
- `app/package.json`: none required server-side (uses `fetch` + `pgvector` via raw SQL).
  Optional: a typed pgvector helper. Webcam uses native `getUserMedia` (no lib).
- `face-engine/requirements.txt`: insightface, onnxruntime, fastapi, uvicorn, pillow, numpy.

---

## 15. Phased delivery

1. **DB + sidecar**: `08_face.sql` applied to Neon; face-engine deployed; `/embed` smoke-tested.
2. **Registration**: `face/engine.ts` + `face/profiles.ts` + `POST/PUT/DELETE /api/face-profiles` + Record Face page. Verify embeddings land, no images stored, single/multi/no-face messages.
3. **Recognition (read-only)**: `/recognize` + Face Attendance scanner UI showing matches + confidence, **no writes** yet. Tune threshold.
4. **Attendance writes**: session-resolver + record + dedup/cooldown + `/face-record`. Verify duplicates blocked (DB + cooldown), late logic, employee check-in/out, no-active-class logging.
5. **Reports & corrections**: report pages, scan-logs, unassigned, manual correction, CSV export.
6. **Hardening**: rate-limit, quality gates tuning, audit coverage, docs + README update.

---

## 16. Open questions

- §1 decision: Python sidecar vs in-browser WASM, and sidecar host.
- Should `face_profiles` be included in backups (recommend yes) and scan_logs excluded (recommend yes)?
- Confirm classes are strictly Sat/Sun — affects the resolver's grace windows.
- Multiple faces/embeddings per person (different angles) for better recall — support
  now via several active rows, or one-per-person for v1? (plan assumes one active; easy to relax).
- Which roles operate the attendance camera (admin only, or also accounts/front-desk)?
