// Parser for the school's 2D "Class schedule Template" CSV (room blocks of 4
// rows — Class Name / Subject / MT / CT — across 4 time-slot × Sat/Sun columns).
// Pure + isomorphic: used to preview client-side and re-validate server-side.

export type ParsedClass = {
  room: string;
  day: 'Sat' | 'Sun';
  time_slot: string;
  level: string;
  online: boolean;
  subject: string;
  mt: string;
  ct: string;
  class_label: string;
};

// Minimal RFC-4180 CSV parser (handles quoted fields, embedded commas/newlines).
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  row.push(field);
  rows.push(row);
  return rows;
}

const SLOTS = ['7:45-9:45', '10-12', '1-3', '3:15-5:15'];

const clean = (v: string | undefined) => (v ?? '').replace(/\s+/g, ' ').trim();

// Level label like "Nursery (10-12)" or "KEY Online (10-12)" → { level, online }.
function parseLevelLabel(label: string): { level: string; online: boolean } | null {
  const t = clean(label);
  if (!t) return null;
  const online = /online/i.test(t);
  const level = t.replace(/\(.*?\)/g, '').replace(/online/i, '').replace(/\s+/g, ' ').trim();
  if (!level) return null;
  return { level, online };
}

export function parseTimetable(rows: string[][]): ParsedClass[] {
  const out: ParsedClass[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (clean(rows[i][1]).toLowerCase() !== 'class name') continue;
    const classRow = rows[i];
    // Find the matching Subject / MT / CT rows within the next few lines.
    let subjectRow: string[] = [], mtRow: string[] = [], ctRow: string[] = [];
    for (let j = i + 1; j < Math.min(i + 6, rows.length); j++) {
      const tag = clean(rows[j][1]).toLowerCase();
      if (tag === 'subject') subjectRow = rows[j];
      else if (tag === 'mt') mtRow = rows[j];
      else if (tag === 'ct') ctRow = rows[j];
      else if (tag === 'class name') break;
    }
    const room = clean(classRow[0]);

    for (let slot = 0; slot < 4; slot++) {
      for (let day = 0; day < 2; day++) {
        const col = 2 + slot * 2 + day;
        const parsed = parseLevelLabel(classRow[col]);
        if (!parsed) continue;
        out.push({
          room,
          day: day === 0 ? 'Sat' : 'Sun',
          time_slot: SLOTS[slot],
          level: parsed.level,
          online: parsed.online,
          subject: clean(subjectRow[col]),
          mt: clean(mtRow[col]),
          ct: clean(ctRow[col]),
          class_label: clean(classRow[col]),
        });
      }
    }
  }
  return out;
}
