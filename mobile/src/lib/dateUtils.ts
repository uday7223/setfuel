/** Local calendar date as YYYY-MM-DD (for API query params). */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex, 1);
}

export function endOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex + 1, 0);
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function weekdayShort(d: Date): string {
  return WEEKDAY_LABELS[d.getDay()] ?? '';
}

/** Inclusive grid cells for month view (pads leading/trailing blanks). */
export function buildMonthGrid(year: number, monthIndex: number): (Date | null)[][] {
  const first = startOfMonth(year, monthIndex);
  const last = endOfMonth(year, monthIndex);
  const cells: (Date | null)[] = [];

  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let day = 1; day <= last.getDate(); day++) {
    cells.push(new Date(year, monthIndex, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTimeRange(startedAt: string, endedAt?: string): string {
  const start = new Date(startedAt);
  const startLabel = start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (!endedAt) return startLabel;
  const end = new Date(endedAt);
  const endLabel = end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${startLabel} – ${endLabel}`;
}
