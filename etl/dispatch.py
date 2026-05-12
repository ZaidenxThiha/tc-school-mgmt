#!/usr/bin/env python3
"""
Dispatch all generated SQL files in etl/sql/ to Supabase via psycopg2.
Reads connection string from env var TNC_DB_URL, falls back to a hardcoded
session-pooler URL for the project ugjujibpbasskampuums.
"""
import os, sys, time, urllib.parse
from pathlib import Path
import psycopg2

ROOT = Path(__file__).resolve().parent.parent
SQL_DIR = ROOT / "etl" / "sql"

PW = urllib.parse.quote_plus(os.environ.get("TNC_DB_PW", "Thihaaung1@"))
DEFAULT_URL = (
    f"postgresql://postgres.ugjujibpbasskampuums:{PW}@"
    f"aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres"
)
URL = os.environ.get("TNC_DB_URL", DEFAULT_URL)

# Dispatch order — dependencies enforced
ORDER = [
    "01_fee_schedule.sql",
    "02_teachers.sql",
    "03_sections.sql",
    "04_section_teachers.sql",
    "05_guardians.sql",
    "06_students.sql",
    "07_enrolments.sql",
    "08_class_sessions.sql",
    # 09 attendance chunks dispatched together below
    "10_kpay_transactions.sql",
    "11_ledger_entries.sql",
    "12_events.sql",
]

def run_file(cur, fp: Path):
    sql = fp.read_text()
    t0 = time.time()
    cur.execute(sql)
    return time.time() - t0

def main():
    conn = psycopg2.connect(URL, connect_timeout=15)
    conn.autocommit = False
    cur = conn.cursor()
    print(f"Connected. Running {len(ORDER)} ordered files + 09 chunks…")
    total = 0.0
    for name in ORDER:
        fp = SQL_DIR / name
        if not fp.exists():
            print(f"  ! missing {name}, skipping")
            continue
        try:
            secs = run_file(cur, fp)
            conn.commit()
            print(f"  ✓ {name}  ({secs:.2f}s)")
            total += secs
        except Exception as e:
            conn.rollback()
            print(f"  ✗ {name}: {type(e).__name__}: {str(e)[:200]}")

    # Attendance chunks
    am_files = sorted(SQL_DIR.glob("09_attendance_marks_*.sql"))
    print(f"\nAttendance: {len(am_files)} chunks")
    am_total = 0.0
    am_ok = 0
    for fp in am_files:
        try:
            secs = run_file(cur, fp)
            conn.commit()
            am_total += secs
            am_ok += 1
            if am_ok % 10 == 0 or am_ok == len(am_files):
                print(f"  …{am_ok}/{len(am_files)} ({am_total:.1f}s)")
        except Exception as e:
            conn.rollback()
            print(f"  ✗ {fp.name}: {str(e)[:200]}")

    cur.close(); conn.close()
    print(f"\nTotal: {total + am_total:.1f}s")

if __name__ == "__main__":
    main()
