#!/usr/bin/env node
/**
 * Import everything from `2026 Thazin&Cherry Finance/update data/` into Neon.
 *
 *   cd app && export $(grep -v '^#' .env.local | xargs) && node ../etl/sync_update_data.mjs
 *
 * Files:
 *   - Annual Financial Statement ( 2026 May-2027 April).xlsx → ledger May–Jul
 *   - 2026 ESL Student Monthly Receive.xlsx → student current_status
 *   - All Months Income Summary( ESL).xlsx → (reference only; annual stmt is authoritative)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const postgres = require('../app/node_modules/postgres');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPDATE_DIR = path.join(__dirname, '..', '2026 Thazin&Cherry Finance/update data');
const ANNUAL = 'Annual Financial Statement ( 2026 May-2027 April).xlsx';
const STUDENTS = '2026 ESL Student Monthly Receive.xlsx';
const INCOME_ACCOUNT = 'Student Fees (lumped)';
const SYNC_MONTHS = ['2026-05', '2026-06', '2026-07'];

const CANON = [
  ['esl class fee', 'Student Fees (lumped)'],
  ['exam practice book', 'Book Fee'],
  ['book fee', 'Book Fee'],
  ['teacher salary', 'ESL Teacher Salary'],
  ['admin team salary', 'ESL Teacher Salary'],
  ['management teacher', 'ESL Teacher Salary'],
  ['guide teacher', 'ESL Teacher Salary'],
  ['summer teacher', 'ESL Teacher Salary'],
  ['monthly operating', 'Monthly Operating Expense'],
  ['repair & maintenance', 'Monthly Operating Expense'],
  ['electrical charge', 'Monthly Operating Expense'],
  ['electrical expense', 'Monthly Operating Expense'],
  ['transporation', 'Delivery & Transportation'],
  ['transportation', 'Delivery & Transportation'],
  ['delivery', 'Delivery & Transportation'],
  ['gift & donation', 'Other Expense'],
  ['rent', 'Monthly Operating Expense'],
  ['t-shirt', 'T-Shirt Fee'],
  ['teaching supply', 'Teaching Supply'],
  ['cleaning', 'Monthly Operating Expense'],
  ['personal expense', 'Personal Expense'],
  ['office supplies', 'Office Stationery'],
  ['office stationery', 'Office Stationery'],
  ['printing', 'Office Stationery'],
  ['tax', 'Government Tax'],
  ['goverment tax', 'Government Tax'],
  ['textbook', 'Teaching Supply'],
  ['lanyard', 'ID Card Fee'],
  ['fixed asset', 'One-time Capital & Large Operational Expense'],
  ['capital expenditure', 'One-time Capital & Large Operational Expense'],
  ['expo', 'Other Expense'],
  ['refund', 'Special Case'],
  ['software subscription', 'Monthly Operating Expense'],
  ['event', 'Event'],
  ['drinking water', 'Drinking Water'],
  ['fuel charge', 'Delivery & Transportation'],
  ['phone bill', 'Internet & Communication Expense'],
  ['miscellaneous', 'Other Expense'],
  ['drawing', 'Personal Expense'],
];

function lookupAccount(label, chart) {
  const s = `${label || ''} ${chart || ''}`.toLowerCase();
  for (const [needle, group] of CANON) {
    if (s.includes(needle)) return group;
  }
  return null;
}

function toInt(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number' && !Number.isNaN(v)) return Math.trunc(v);
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/** General Expense sheet: header month is one month before the data month (May data under 2026-04 header). */
function geDataMonth(headerYm) {
  const [y, m] = headerYm.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() + 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthEnd(ym) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0));
  return last.toISOString().slice(0, 10);
}

function parseMonthColumns(headerRow, monthShift = 0) {
  const cols = {};
  headerRow.forEach((v, i) => {
    let ym = null;
    if (v instanceof Date && !Number.isNaN(v.getTime())) ym = v.toISOString().slice(0, 7);
    else if (typeof v === 'string' && /^\d{4}-\d{2}/.test(v)) ym = v.slice(0, 7);
    if (!ym) return;
    if (monthShift) ym = geDataMonth(ym);
    if (SYNC_MONTHS.includes(ym)) cols[i] = ym;
  });
  return cols;
}

function parseAnnualLedger(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const fileName = path.basename(filePath);
  const rows = [];

  // ── General Expense (income + expense summary lines) ──
  const ge = XLSX.utils.sheet_to_json(wb.Sheets['General Expense'], { header: 1, defval: null });
  const geMonthCols = parseMonthColumns(ge[1] || [], 1);
  let section = 'income'; // row 2 is the Income header; data lines follow immediately
  for (let i = 2; i < ge.length; i++) {
    const r = ge[i] || [];
    const label = r[0] != null ? String(r[0]).trim() : '';
    const chart = r[1] != null ? String(r[1]).trim() : '';
    if (!label) continue;
    const ll = label.toLowerCase();
    if (ll === 'expense') { section = 'expense'; continue; }
    if (ll.startsWith('total') || ll === 'profit') continue;

    for (const [col, ym] of Object.entries(geMonthCols)) {
      const amt = toInt(r[+col]);
      if (amt <= 0) continue;
      const entryDate = monthEnd(ym);
      const isKpay = ll.includes('q pay') || ll.includes('kpay') || ll.includes('k pay');
      const isCash = ll.includes('cash') || (!isKpay && section === 'income');
      if (section === 'income') {
        rows.push({
          entry_date: entryDate,
          description: label,
          account: lookupAccount(label, chart) || INCOME_ACCOUNT,
          income_cash: isKpay ? 0 : amt,
          income_kpay: isKpay ? amt : 0,
          expense_cash: 0,
          expense_kpay: 0,
          source: 'GeneralExpense',
          source_file: fileName,
        });
      } else if (section === 'expense') {
        rows.push({
          entry_date: entryDate,
          description: label,
          account: lookupAccount(label, chart),
          income_cash: 0,
          income_kpay: 0,
          expense_cash: isKpay ? 0 : amt,
          expense_kpay: isKpay ? amt : 0,
          source: 'GeneralExpense',
          source_file: fileName,
        });
      }
    }
  }

  // ── Office Expense (by account, header month = data month) ──
  const oe = XLSX.utils.sheet_to_json(wb.Sheets['Office Expense'], { header: 1, defval: null });
  let oeHeader = -1;
  for (let i = 0; i < 10; i++) {
    if (String(oe[i]?.[0] || '').toLowerCase() === 'account name') { oeHeader = i; break; }
  }
  if (oeHeader >= 0) {
    const oeMonthCols = parseMonthColumns(oe[oeHeader] || [], 0);
    for (let i = oeHeader + 1; i < oe.length; i++) {
      const r = oe[i] || [];
      const label = r[0] != null ? String(r[0]).trim() : '';
      if (!label || label.toLowerCase().includes('total')) continue;
      for (const [col, ym] of Object.entries(oeMonthCols)) {
        const amt = toInt(r[+col]);
        if (amt <= 0) continue;
        rows.push({
          entry_date: monthEnd(ym),
          description: label.replace(/\s+/g, ' '),
          account: lookupAccount(label, null),
          income_cash: 0,
          income_kpay: 0,
          expense_cash: amt,
          expense_kpay: 0,
          source: 'OfficeExpense',
          source_file: fileName,
        });
      }
    }
  }

  return rows;
}

const LEVEL_SHEETS = ['Early Childhood', 'Nursery', 'Pre-Starter', 'Starter', 'Mover', 'Flyer', 'KEY', 'PET', 'FCE', 'CAE'];

function normalizeStatus(v) {
  if (v == null || v === '') return null;
  const t = String(v).trim().toLowerCase();
  if (t.includes('active')) return 'Active';
  if (t.includes('break')) return 'Break';
  if (t.includes('left')) return 'Left';
  return 'Active';
}

function normalizeName(v) {
  return String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseStudents(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const out = [];
  for (const sn of LEVEL_SHEETS) {
    if (!wb.SheetNames.includes(sn)) continue;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null });
    let hdr = -1;
    for (let i = 0; i < 12; i++) {
      if (String(rows[i]?.[0] || '').toLowerCase().includes('student id')) { hdr = i; break; }
    }
    if (hdr < 0) continue;
    const h = (rows[hdr] || []).map((x) => String(x || '').trim());
    const mmIdx = h.findIndex((x) => x.includes('Myanmar'));
    const enIdx = h.findIndex((x) => x.includes('English'));
    const julIdx = h.findIndex((x) => x.toLowerCase() === 'july');
    const augIdx = h.findIndex((x) => x.toLowerCase() === 'aug');
    const statusIdx = augIdx >= 0 ? augIdx : julIdx;
    if (statusIdx < 0 || (mmIdx < 0 && enIdx < 0)) continue;
    for (let i = hdr + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const mm = mmIdx >= 0 ? r[mmIdx] : null;
      const en = enIdx >= 0 ? r[enIdx] : null;
      if (!mm && !en) continue;
      const status = normalizeStatus(r[statusIdx]);
      if (!status) continue;
      out.push({ mm, en, status });
    }
  }
  return out;
}

async function insertLedger(sql, acctByName, rows) {
  if (rows.length === 0) return 0;
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    await sql`
      insert into ledger_entries
        (entry_date, description, account_id, income_cash, income_kpay, expense_cash, expense_kpay, source, source_file)
      values ${sql(chunk.map((r) => [
        r.entry_date,
        r.description,
        r.account ? acctByName.get(r.account) ?? null : null,
        r.income_cash,
        r.income_kpay,
        r.expense_cash,
        r.expense_kpay,
        r.source,
        r.source_file,
      ]))}`;
  }
  return rows.length;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || process.env.TNC_DB_URL;
  if (!dbUrl) throw new Error('Set DATABASE_URL or TNC_DB_URL');

  const annualPath = path.join(UPDATE_DIR, ANNUAL);
  const studentsPath = path.join(UPDATE_DIR, STUDENTS);
  if (!fs.existsSync(annualPath)) throw new Error(`Missing ${annualPath}`);
  if (!fs.existsSync(studentsPath)) throw new Error(`Missing ${studentsPath}`);

  const sql = postgres(dbUrl, { ssl: 'require', max: 1 });
  const accounts = await sql`select id, group_name from chart_of_accounts`;
  const acctByName = new Map(accounts.map((a) => [a.group_name, a.id]));

  // ── Ledger: replace May–Jul ──
  console.log('Ledger (May–Jul)…');
  const del = await sql`
    delete from ledger_entries
    where entry_date >= '2026-05-01' and entry_date < '2026-08-01'`;
  console.log(`  deleted ${del.count} old rows`);

  const ledgerRows = parseAnnualLedger(annualPath);
  const nLedger = await insertLedger(sql, acctByName, ledgerRows);
  console.log(`  inserted ${nLedger} rows from ${ANNUAL}`);

  const pl = await sql`
    select to_char(date_trunc('month', entry_date), 'YYYY-MM') as month,
      sum(income_cash)::bigint as cash,
      sum(income_kpay)::bigint as kpay,
      sum(income_cash + income_kpay)::bigint as income,
      sum(expense_cash + expense_kpay)::bigint as expense,
      count(*)::int as rows
    from ledger_entries
    where entry_date >= '2026-05-01' and entry_date < '2026-08-01'
    group by 1 order by 1`;
  console.log('\n  May–Jul totals:');
  for (const r of pl) {
    console.log(`    ${r.month}  income ${Number(r.income).toLocaleString()} (cash ${Number(r.cash).toLocaleString()}, kpay ${Number(r.kpay).toLocaleString()})  expense ${Number(r.expense).toLocaleString()}  (${r.rows} rows)`);
  }

  // ── Students: update current_status from latest month column ──
  console.log('\nStudents…');
  const parsed = parseStudents(studentsPath);
  const dbStudents = await sql`select id, english_name, myanmar_name, current_status from students`;
  const byEn = new Map();
  const byMm = new Map();
  for (const s of dbStudents) {
    if (s.english_name) byEn.set(normalizeName(s.english_name), s);
    if (s.myanmar_name) byMm.set(normalizeName(s.myanmar_name), s);
  }

  let updated = 0;
  let unchanged = 0;
  let unmatched = 0;
  for (const row of parsed) {
    const match =
      (row.en && byEn.get(normalizeName(row.en))) ||
      (row.mm && byMm.get(normalizeName(row.mm)));
    if (!match) { unmatched++; continue; }
    if (match.current_status === row.status) { unchanged++; continue; }
    await sql`
      update students
      set current_status = ${row.status}, updated_at = now()
      where id = ${match.id}`;
    updated++;
  }
  console.log(`  parsed ${parsed.length} from Excel`);
  console.log(`  updated ${updated}, unchanged ${unchanged}, unmatched ${unmatched}`);

  const statusCounts = await sql`
    select current_status, count(*)::int as n from students group by 1 order by 1`;
  console.log('  status breakdown:', statusCounts.map((r) => `${r.current_status}: ${r.n}`).join(', '));

  console.log('\nDone.');
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
