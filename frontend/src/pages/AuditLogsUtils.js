// Minimal CSV helpers for Audit Logs export.

export function csvEscape(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export function toCsv(rows, fields) {
  const header = fields.join(',');
  const body = rows
    .map((row) => fields.map((f) => csvEscape(row?.[f])).join(','))
    .join('\n');
  return [header, body].join('\n');
}

