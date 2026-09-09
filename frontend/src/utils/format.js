const dateFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });

export function formatDate(value) {
  if (!value) return '';
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? value : dateFmt.format(d);
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

export function formatMoney(amount, currency = 'USD') {
  if (amount == null) return '';
  try {
    return new Intl.NumberFormat('es', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
