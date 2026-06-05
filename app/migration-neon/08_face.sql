-- 08_face.sql — camera-based attendance with InsightFace.
--
-- The Python face-engine sidecar turns an image into a 512-d ArcFace embedding
-- (buffalo_l). This migration stores those embeddings, extends the existing
-- (dormant) student-attendance tables instead of duplicating them, and adds the
-- employee daily check-in/out and scan-log tables. Matching is done in Neon via
-- pgvector cosine distance — no FAISS, no photos ever stored. Applied after
-- 07_security.sql, in numeric order, like every other file here.

create extension if not exists vector;

-- 1) Face embeddings. NO original photo is ever stored — only the vector.
create table if not exists public.face_profiles (
  id                bigserial primary key,
  person_id         integer not null,
  person_type       text not null check (person_type in ('student','employee')),
  embedding         vector(512) not null,
  model_name        text not null default 'buffalo_l',
  embedding_version text not null default 'v1',
  threshold_used    numeric(4,3),
  metadata          jsonb default '{}'::jsonb,
  is_active         boolean not null default true,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- One active face per person (re-record deactivates the old row, inserts a new one).
create unique index if not exists face_profiles_person_active_uniq
  on public.face_profiles (person_type, person_id) where is_active;
create index if not exists face_profiles_lookup_idx
  on public.face_profiles (person_type, person_id);
-- Optional ANN index (exact scan is fine at this scale; enable if it ever grows):
-- create index face_profiles_embedding_idx on public.face_profiles
--   using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- 2) Reuse the existing student attendance tables (attendance_marks + class_sessions).
-- Both already have the keys we need: class_sessions is UNIQUE(section_id, session_date)
-- and attendance_marks' PRIMARY KEY is (session_id, student_id) — that PK is what
-- prevents duplicate student attendance per session (upsert via on conflict).
alter table public.class_sessions  add column if not exists start_time time;

alter table public.attendance_marks add column if not exists scan_time        timestamptz;
alter table public.attendance_marks add column if not exists confidence_score numeric(5,4);
alter table public.attendance_marks add column if not exists source           text default 'manual'; -- face_camera|manual|import
alter table public.attendance_marks add column if not exists subject          text;
-- The existing status CHECK allowed Present/Absent/Leave/Break only; add 'Late'
-- (face attendance distinguishes on-time vs late by the slot start_time).
alter table public.attendance_marks drop constraint if exists attendance_marks_status_check;
alter table public.attendance_marks add constraint attendance_marks_status_check
  check (status = any (array['Present','Absent','Leave','Break','Late']));

-- 3) Employee daily check-in / check-out (the absences table is leave-tracking, not this).
create table if not exists public.employee_attendance (
  id                   bigserial primary key,
  employee_id          integer not null,
  attendance_date      date not null,
  check_in_time        timestamptz,
  check_out_time       timestamptz,
  check_in_confidence  numeric(5,4),
  check_out_confidence numeric(5,4),
  status               text not null default 'present', -- present|incomplete|completed
  device_id            text,
  location             text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create unique index if not exists employee_attendance_emp_date_uniq
  on public.employee_attendance (employee_id, attendance_date);

-- 4) Scan logs (recognized/unknown/low_confidence/duplicate/no_active_class/failed). No photos.
create table if not exists public.attendance_scan_logs (
  id               bigserial primary key,
  person_id        integer,
  person_type      text,
  match_status     text not null,
  confidence_score numeric(5,4),
  reason           text,
  device_id        text,
  location         text,
  scanned_at       timestamptz not null default now(),
  metadata         jsonb default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists scan_logs_time_status_idx
  on public.attendance_scan_logs (scanned_at desc, match_status);

-- 5) Tunables (reuse app_settings key/value; editable from Settings, no redeploy).
insert into public.app_settings(key, value) values
  ('face.match_threshold', '0.45'),  -- cosine-similarity floor to accept a match
  ('face.late_minutes',    '10'),    -- minutes after start_time => 'late'
  ('face.cooldown_seconds','45'),    -- server-side per-person cooldown
  ('face.min_face_px',     '80')     -- min detected-face size to be usable
on conflict (key) do nothing;
