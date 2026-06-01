# Decisions — locked in 2026-05-07

All nine items resolved. Phase 1 is unblocked.

| # | Question | Your answer | Effect on the build |
|---|---|---|---|
| 1 | EDU School levels | **Remove EDU School** | EDU dropped from `levels`, ETL skips EDU rows, app has no EDU UI |
| 2 | T-shirt inventory | **Track every** in/out | Full `inventory_movements` table; live `v_product_stock` view; auto-decrement on tshirt invoice line paid |
| 3 | Fee changes mid-year | **Yes, support inflation** | `fee_schedule` keeps multiple rows per level with `effective_from` / `effective_to`; UI lets owner add a new price row at any date |
| 4 | Discount rules | **Add discounts** | `discount_types` (sibling, scholarship, staff-child, referral, promo, old-student) + `student_discounts` linking student → discount → effective dates; auto-applied at invoice time |
| 5 | Student photos | **No photos** | `students.photo_path` column removed; no Supabase Storage bucket needed |
| 6 | Teacher pay | **Both — two tabs** | `teacher_payslips` table for per-teacher view + aggregate `ESL Teacher Salary` / `Admin Teacher Salary` ledger lines; Salary page in app shows both as tabs |
| 7 | Receipts | **Implement later** | No receipt feature in v1; revisit in v2 |
| 8 | UI language | **English only** | No i18n setup yet; Myanmar can be added later via next-intl |
| 9 | n8n hosting | **Free tier** | Self-host on Render free or Fly free, or use n8n.cloud free tier; workflows kept lean to fit quotas |

> Later additions noted: responsive style for inflation-driven price changes (UI affordance to update price book), and Myanmar UI language.

## What's next (Phase 1)

1. Run the three setup commands in your regular terminal:
   ```bash
   # Add + authenticate the Supabase MCP server in your MCP client, pointed at:
   #   https://mcp.supabase.com/mcp?project_ref=ugjujibpbasskampuums
   npx skills add supabase/agent-skills
   ```
2. Once authenticated, ask me to **apply the schema** — I'll run `_PLAN/02_schema.sql` against project `ugjujibpbasskampuums` via the Supabase MCP.
3. Then ask me to **start the historical import** — I'll write a Python loader that walks the 33 Excel files using the rules in `_PLAN/03_etl_mapping.md` and pushes everything to Supabase, with the validation gates from `_PLAN/00_MASTER_PLAN.md` §5.4.
4. After that, web app v1 build begins (Phase 2).
