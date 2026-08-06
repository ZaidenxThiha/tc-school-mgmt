#!/usr/bin/env node
/**
 * Sync all ledger data from `2026 Thazin&Cherry Finance/All Months Income Statement/`.
 *
 *   cd app && export $(grep -v '^#' .env.local | xargs) && node ../etl/sync_income_statements.mjs
 *
 * Income Statement workbooks (Jan–May): General + Office Expense line items,
 * plus K Pay / guide totals from General Expense Summary when missing in detail.
 * Balance sheets (Jun–Jul): Summary tab ESL cash + K Pay totals.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const postgres = require('../app/node_modules/postgres');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIN = path.join(__dirname, '..', '2026 Thazin&Cherry Finance/All Months Income Statement');
const INCOME_ACCOUNT = 'Student Fees (lumped)';

const FILE_MAP = [
  ['2026-01', 'January Income Statement.xlsx', 'income'],
  ['2026-02', 'February Income Statement.xlsx', 'income'],
  ['2026-03', 'March Income Statement.xlsx', 'income'],
  ['2026-04', 'April Income Statement.xlsx', 'income'],
  ['2026-05', 'May Income Statement.xlsx', 'income'],
  ['2026-06', 'June Students & Income Balance Sheet.xlsx', 'balance'],
  ['2026-07', 'July Students & Income Balance Sheet.xlsx', 'balance'],
];

const CANON = [
  ['esl class fee', 'Student Fees (lumped)'],
  ['summer program fee', 'Summer Program Fee'],
  ['other income', 'Other Income'],
  ['esl teacher salary', 'ESL Teacher Salary'],
  ['teacher salary', 'ESL Teacher Salary'],
  ['admin teacher salary', 'Admin Teacher Salary'],
  ['admin salary', 'Admin Salary'],
  ['teaching supply', 'Teaching Supply'],
  ['office expense', 'Office Expense'],
  ['monthly operating expense', 'Monthly Operating Expense'],
  ['monthly operation expense', 'Monthly Operating Expense'],
  ['monthly opreation expense', 'Monthly Operating Expense'],
  ['initial capital & major operating costs', 'Initial Capital & Major Operating Costs'],
  ['one-time minor expense', 'One-time Minor Expense'],
  ['one time minor expense', 'One-time Minor Expense'],
  ['one-time capital & large operational expense', 'One-time Capital & Large Operational Expense'],
  ['one time capital & large operational expense', 'One-time Capital & Large Operational Expense'],
  ['capital expenditure', 'One-time Capital & Large Operational Expense'],
  ['internet & communication expense', 'Internet & Communication Expense'],
  ['drinking water', 'Drinking Water'],
  ['delivery & transportation', 'Delivery & Transportation'],
  ['office stationery', 'Office Stationery'],
  ['printing expense', 'Office Stationery'],
  ['government tax', 'Government Tax'],
  ['goverment tax', 'Government Tax'],
  ['event', 'Event'],
  ['personal expense', 'Personal Expense'],
  ['special case', 'Special Case'],
  ['miscellaneous expense', 'Other Expense'],
  ['other expense', 'Other Expense'],
];

function lookupAccount(name) {
  if (!name) return null;
  const s = String(name).trim().toLowerCase();
  for (const [needle, group] of CANON) {
    if (s.includes(needle)) return group;
  }
  return null;
}

function toIntMoney(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number' && !Number.isNaN(v)) return Math.trunc(v);
  const s = String(v).replace(/,/g, '').replace(/MMK|ks/gi, '').trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function monthEnd(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function parseDate(v, fallbackTag) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (v == null || v === '') {
    if (fallbackTag) return `${fallbackTag}-01`;
    return null;
  }
  const s = String(v).trim();
  for (const fmt of [
    /^(\d{4})-(\d{2})-(\d{2})$/,
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
  ]) {
    const m = s.match(fmt);
    if (m) {
      if (fmt.source.startsWith('^(\\d{4})')) return `${m[1]}-${m[2]}-${m[3]}`;
      return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
    }
  }
  return null;
}

function findHeaderRow(rows, kind) {
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const r = rows[i] || [];
    const cells = r.map((c) => (c == null ? '' : String(c).toLowerCase()));
    if (cells.includes('date') && cells.some((c) => c.includes('description'))) {
      const idx = (label) => cells.findIndex((c) => c.replace(/\s+/g, ' ').includes(label));
      if (kind === 'general') {
        return {
          start: i + 1,
          date: idx('date'),
          desc: idx('description'),
          chart: cells.findIndex((c) => c.includes('chart')) >= 0 ? cells.findIndex((c) => c.includes('chart')) : idx('account name'),
          incomeCash: cells.findIndex((c) => c.includes('income') && c.includes('cash')),
          incomeKpay: cells.findIndex((c) => c.includes('income') && (c.includes('k pay') || c.includes('kpay'))),
          outcomeCash: cells.findIndex((c) => (c.includes('outcome') || c.includes('expense')) && c.includes('cash') && !c.includes('income')),
          outcomeKpay: cells.findIndex((c) => (c.includes('outcome') || c.includes('expense')) && (c.includes('k pay') || c.includes('kpay'))),
        };
      }
      return {
        start: i + 1,
        date: idx('date'),
        desc: idx('description'),
        income: cells.findIndex((c) => c === 'income' || (c.includes('income') && !c.includes('cash') && !c.includes('k pay'))),
        account: idx('account name'),
        qty: idx('qty'),
        price: idx('price'),
        amount: idx('amount'),
      };
    }
  }
  return null;
}

function parseIncomeStatement(tag, filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const fileName = path.basename(filePath);
  const out = [];

  if (wb.SheetNames.includes('General Expense')) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['General Expense'], { header: 1, defval: null });
    const hdr = findHeaderRow(rows, 'general');
    if (!hdr) throw new Error(`${fileName}: General Expense header not found`);
    for (let i = hdr.start; i < rows.length; i++) {
      const r = rows[i] || [];
      const desc = r[hdr.desc];
      const d = parseDate(r[hdr.date], !r[hdr.date] && desc ? tag : null);
      if (!d && (desc == null || desc === '')) continue;
      if (!d) continue;
      out.push({
        entry_date: d,
        description: desc != null ? String(desc).trim() : null,
        account: lookupAccount(r[hdr.chart]),
        income_cash: toIntMoney(hdr.incomeCash >= 0 ? r[hdr.incomeCash] : 0),
        income_kpay: toIntMoney(hdr.incomeKpay >= 0 ? r[hdr.incomeKpay] : 0),
        expense_cash: toIntMoney(hdr.outcomeCash >= 0 ? r[hdr.outcomeCash] : 0),
        expense_kpay: toIntMoney(hdr.outcomeKpay >= 0 ? r[hdr.outcomeKpay] : 0),
        qty: null,
        unit_price: null,
        source: 'GeneralExpense',
        source_file: fileName,
      });
    }
  }

  if (wb.SheetNames.includes('Office Expense')) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['Office Expense'], { header: 1, defval: null });
    const hdr = findHeaderRow(rows, 'office');
    if (!hdr) throw new Error(`${fileName}: Office Expense header not found`);
    for (let i = hdr.start; i < rows.length; i++) {
      const r = rows[i] || [];
      const desc = r[hdr.desc];
      const d = parseDate(r[hdr.date], !r[hdr.date] && desc ? tag : null);
      if (!d && (desc == null || desc === '')) continue;
      if (!d) continue;
      const qty = hdr.qty >= 0 ? r[hdr.qty] : null;
      out.push({
        entry_date: d,
        description: desc != null ? String(desc).trim() : null,
        account: lookupAccount(r[hdr.account]),
        income_cash: toIntMoney(hdr.income >= 0 ? r[hdr.income] : 0),
        income_kpay: 0,
        expense_cash: toIntMoney(hdr.amount >= 0 ? r[hdr.amount] : 0),
        expense_kpay: 0,
        qty: qty != null && typeof qty === 'number' ? qty : null,
        unit_price: hdr.price >= 0 ? toIntMoney(r[hdr.price]) || null : null,
        source: 'OfficeExpense',
        source_file: fileName,
      });
    }
  }

  return out;
}

/** K Pay / guide totals from General Expense Summary (column 2 = this month). Skips EDU. */
function parseSummaryIncome(filePath, ym) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const fileName = path.basename(filePath);
  if (!wb.SheetNames.includes('General Expense Summary')) return [];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['General Expense Summary'], { header: 1, defval: null });
  const entryDate = monthEnd(ym);
  const out = [];
  for (const r of rows) {
    if (!r?.[0]) continue;
    const label = String(r[0]).trim();
    const ll = label.toLowerCase();
    if (ll.includes('edu')) continue;
    const monthAmt = toIntMoney(r[2]);
    if (monthAmt <= 0) continue;
    if (ll.includes('esl class fee') && (ll.includes('q pay') || ll.includes('kpay'))) {
      out.push(summaryRow(entryDate, `${label} (summary)`, 0, monthAmt, fileName));
    } else if (ll.includes('guide') && ll.includes('fee')) {
      out.push(summaryRow(entryDate, `${label} (summary)`, monthAmt, 0, fileName));
    }
  }
  return out;
}

function parseBalanceSheetSummaryIncome(filePath, ym) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const fileName = path.basename(filePath);
  const sheetName = wb.SheetNames.find((s) => s.trim() === 'Summary' || s.includes('Summary'));
  if (!sheetName) throw new Error(`${fileName}: Summary sheet not found`);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null });
  let cash = 0;
  let kpay = 0;
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i] || [];
    const cls = r[0];
    const fee = toIntMoney(r[1]);
    const cashCount = Number(r[3]);
    const kpayCount = Number(r[4]);
    if (!cls || !fee || String(cls).toLowerCase() === 'total') continue;
    if (Number.isFinite(cashCount)) cash += cashCount * fee;
    if (Number.isFinite(kpayCount)) kpay += kpayCount * fee;
  }
  const entryDate = monthEnd(ym);
  const out = [];
  if (cash > 0) out.push(summaryRow(entryDate, 'ESL Class Fee (Cash) — summary', cash, 0, fileName));
  if (kpay > 0) out.push(summaryRow(entryDate, 'ESL Class Fee (Q Pay) — summary', 0, kpay, fileName));
  return out;
}

function summaryRow(entryDate, description, incomeCash, incomeKpay, sourceFile) {
  return {
    entry_date: entryDate,
    description,
    account: INCOME_ACCOUNT,
    income_cash: incomeCash,
    income_kpay: incomeKpay,
    expense_cash: 0,
    expense_kpay: 0,
    qty: null,
    unit_price: null,
    source: 'GeneralExpense',
    source_file: sourceFile,
  };
}

async function insertRows(sql, acctByName, rows) {
  if (rows.length === 0) return 0;
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    await sql`
      insert into ledger_entries
        (entry_date, description, account_id, income_cash, income_kpay, expense_cash, expense_kpay, qty, unit_price, source, source_file)
      values ${sql(chunk.map((r) => [
        r.entry_date,
        r.description,
        r.account ? acctByName.get(r.account) ?? null : null,
        r.income_cash,
        r.income_kpay,
        r.expense_cash,
        r.expense_kpay,
        r.qty,
        r.unit_price,
        r.source,
        r.source_file,
      ]))}`;
  }
  return rows.length;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || process.env.TNC_DB_URL;
  if (!dbUrl) throw new Error('Set DATABASE_URL or TNC_DB_URL');

  const sql = postgres(dbUrl, { ssl: 'require', max: 1 });
  const accounts = await sql`select id, group_name from chart_of_accounts`;
  const acctByName = new Map(accounts.map((a) => [a.group_name, a.id]));

  // Remove prior annual-statement import for May–Jul if present
  await sql`delete from ledger_entries where source_file = ${'Annual Financial Statement ( 2026 May-2027 April).xlsx'}`;

  let totalInserted = 0;
  console.log(`Importing from ${FIN}\n`);

  for (const [ym, name, kind] of FILE_MAP) {
    const fp = path.join(FIN, name);
    if (!fs.existsSync(fp)) {
      console.warn(`  skip (missing) ${name}`);
      continue;
    }
    await sql`delete from ledger_entries where source_file = ${name}`;

    let rows;
    if (kind === 'income') {
      const detail = parseIncomeStatement(ym, fp);
      const summary = parseSummaryIncome(fp, ym);
      rows = [...detail, ...summary];
      const n = await insertRows(sql, acctByName, rows);
      console.log(`  ${name}: ${detail.length} lines + ${summary.length} summary → ${n} rows`);
      totalInserted += n;
    } else {
      rows = parseBalanceSheetSummaryIncome(fp, ym);
      const n = await insertRows(sql, acctByName, rows);
      console.log(`  ${name}: ${n} summary income rows`);
      totalInserted += n;
    }
  }

  const pl = await sql`
    select to_char(date_trunc('month', entry_date), 'YYYY-MM') as month,
      sum(income_cash + income_kpay)::bigint as income,
      sum(expense_cash + expense_kpay)::bigint as expense,
      count(*)::int as rows
    from ledger_entries
    where entry_date >= '2026-01-01' and entry_date < '2026-08-01'
    group by 1 order by 1`;

  console.log('\nJan–Jul in database:');
  for (const r of pl) {
    console.log(`  ${r.month}  income ${Number(r.income).toLocaleString()}  expense ${Number(r.expense).toLocaleString()}  (${r.rows} rows)`);
  }
  console.log(`\nDone. ${totalInserted} rows imported.`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
