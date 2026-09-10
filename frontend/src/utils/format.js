const dateFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });
const weekdayFmt = new Intl.DateTimeFormat('es', { weekday: 'short' });
const dateTimeFmt = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(value) {
  if (!value) return '';
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? value : dateFmt.format(d);
}

/** "Dom 6 jun 2027" — 3-letter weekday + date, for day headings. */
export function formatDayHeading(value) {
  if (!value) return '';
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  const wd = weekdayFmt.format(d).replace('.', '');
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${dateFmt.format(d)}`;
}

export function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? value : dateTimeFmt.format(d);
}

export function formatDateRange(start, end) {
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function formatDuration(minutes) {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}

export function formatBytes(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatMoney(amount, currency = 'USD') {
  if (amount == null) return '';
  try {
    return new Intl.NumberFormat('es', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
