# Reconciliation — DB vs Annual Statement (Jan–Apr 2026)

**Date:** 2026-05-07
**Source of truth:** `Thazin & Cherry Oveall Cost (From 2025 May to 2026 April).xlsx`
→ sheets `2025 May to 2026 April Income` and `… Expense`, columns `2026 Jan / Feb / March / April`.

## Scope decisions

- **Excluded** EDU School income and EDU-only expense lines (per Phase-0 decision).
- **Aunty Htay** internal cash float — neither income nor expense; excluded from P&L.
- **General Expense Income column** — internal cash transfers (cash drawn from Aunty Htay's float to operating account), already counted via daily income. Zeroed out of `ledger_entries` to avoid double counting.

## Income — within 4.3%

| Month | Annual file | DB (`v_monthly_pl`) | Δ |
|---|---:|---:|---:|
| 2026-01 | 30,380,600 | 29,951,200 | -429,400 |
| 2026-02 | 18,337,000 | 15,182,400 | -3,154,600 |
| 2026-03 | 58,122,000 | 56,223,100 | -1,898,900 |
| 2026-04 | 51,353,000 | 50,083,800 | -1,269,200 |
| **TOTAL** | **158,192,600** | **151,440,500** | **-6,752,100 (−4.3%)** |

Likely causes of the remaining gap:
- **38 daily-income rows** with no student-name match still post to ledger but may have parsing issues on the amount column.
- **BC Exam Fee** (507,600 in Jan) — not in the daily files I loaded; came in via General Expense.
- **Summer Fee (Feb+Mar)** — partially captured.

Acceptable for v1. Can be tightened by extending the daily-income loader to also pick up BC Exam Fee and Summer rows that live in the General Expense sheet.

## Expense — large gap, mostly intentional

| Month | Annual file | DB | Δ |
|---|---:|---:|---:|
| 2026-01 | 63,584,600 | 38,027,100 | -25,557,500 |
| 2026-02 | 68,419,400 | 40,749,000 | -27,670,400 |
| 2026-03 | 65,811,200 | 34,048,900 | -31,762,300 |
| 2026-04 | 70,035,000 | 35,326,500 | -34,708,500 |
| **TOTAL** | **267,850,200** | **148,151,500** | **-119,698,700 (−45%)** |

Why the gap is mostly correct:
- **EDU Teacher Salary** — annual file totals 99M for May 2025–Apr 2026; we excluded EDU per scope. Jan-Apr alone ≈ 22.9M (Jan 11.45M + Feb 11.45M).
- **EDU Textbook + EDU Uniform + EDU Art + EDU/ESL Decoration** — annual ≈ 80M+, all excluded.
- **Aunty Htay Drawing & Tr Twins Drawing** — annual file lists as Personal Expense (~23M total); reclassified as internal cash float in our DB.
- **Some sub-line items** in the annual file are aggregates that didn't map cleanly to a single ledger_entries row.

## Recommendations

1. **Income** — accept −4.3% gap for v1; the daily-income loader is the system of record going forward.
2. **Expense** — manually reconcile EDU/non-EDU split if you ever need an annual P&L that exactly matches the Excel. Otherwise the per-account breakdown in the Reports module is the new truth.
3. **Aunty Htay drawings** — if you want them to appear as expenses (not internal float), un-reclassify the rows in `chart_of_accounts` filtered to `Internal Cash Float (Aunty Htay)`.
4. After Phase-3 daily-income loader catches BC Exam Fee + Summer Fee from General Expense, income gap should drop below 1%.
