/**
 * Budget categories are free text (no icon field in the schema, unlike POI
 * categories) — this is a purely decorative best-guess from common keywords,
 * matching the msi icon language used elsewhere. Never affects behavior or
 * data; a miss just falls back to a generic icon.
 */
const KEYWORDS = [
  [/gastronom|comida|restaur|almuerzo|cena/i, 'restaurant'],
  [/alojam|hotel|hostal/i, 'hotel'],
  [/transport|bus|tren|metro|taxi|uber|vuelo|avion|avión/i, 'directions_bus'],
  [/entrada|ticket|museo|atracci/i, 'confirmation_number'],
  [/compra|souvenir|shopping/i, 'shopping_bag'],
  [/seguro/i, 'health_and_safety'],
];

export function budgetCategoryIcon(name) {
  const match = KEYWORDS.find(([re]) => re.test(name || ''));
  return match ? match[1] : 'payments';
}
