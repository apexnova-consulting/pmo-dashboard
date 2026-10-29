export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map((cell) => csvEscape(cell)).join(',')).join('\r\n');
}
