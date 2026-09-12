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

/** "09:00" + 150 -> "11:30". Returns '' if start_time/duration is missing. */
export function formatEndTime(startTime, durationMinutes) {
  const m = /^(\d{1,2}):(\d{2})$/.exec((startTime ?? '').toString().trim());
  if (!m || !durationMinutes) return '';
  const total = (Number(m[1]) * 60 + Number(m[2]) + durationMinutes) % (24 * 60);
  const h = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** "Lun 14" — short weekday + day number, for the itinerary's day pills. */
export function formatShortDay(value) {
  if (!value) return '';
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  const wd = weekdayFmt.format(d).replace('.', '');
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${d.getDate()}`;
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
