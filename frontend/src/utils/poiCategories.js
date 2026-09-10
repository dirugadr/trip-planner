/**
 * Category → colour / emoji mapping shared by the POI list and the trip map,
 * so a marker and its list row always look the same. The API already returns
 * `category_color` / `category_icon` from the `poi_categories` table; these
 * helpers add safe fallbacks and turn the icon name into an emoji.
 */

const DEFAULT_COLOR = '#95A5A6';

const EMOJI_BY_ICON = {
  landmark: '🏛️',
  train: '🚉',
  bed: '🛏️',
  utensils: '🍴',
  leaf: '🌿',
  palette: '🎨',
  circle: '📍',
};

/** A CSS-safe hex colour for the POI's category, or a grey fallback. */
export function categoryColor(poi) {
  const c = poi?.category_color;
  return typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : DEFAULT_COLOR;
}

/** An emoji for the POI's category icon name, or a generic pin. */
export function categoryEmoji(poi) {
  return EMOJI_BY_ICON[poi?.category_icon] || '📍';
}
