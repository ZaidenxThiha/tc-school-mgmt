// Allow-list of tables that may be deleted via the generic `deleteRow` action.
// Adding a table here is a deliberate authorization decision.
// Kept in its own (non-'use server') module so the const and types can be
// imported anywhere; Next.js forbids non-async exports from 'use server' files.

export const DELETABLE_TABLES = [
  'absences',
  'employee_payslips',
  'employees',
  'enrolments',
  'event_budget_items',
  'events',
  'fee_schedule',
  'invoice_lines',
  'ledger_entries',
  'payments',
  'products',
  'schedule_assignments',
  'sections',
  'students',
] as const;

export type DeletableTable = (typeof DELETABLE_TABLES)[number];
