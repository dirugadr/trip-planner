/**
 * Keep only http(s) URLs. User-entered links are rendered as <a href> in the
 * frontend, so `javascript:` / `data:` values would be an XSS vector — reject
 * them at write time here, and again at render time on the client.
 *
 * @returns {string|null} the trimmed URL if it's http/https, else null.
 */
export function sanitizeHttpUrl(value) {
  const s = (value ?? '').toString().trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? s : null;
  } catch {
    return null;
  }
}

export default sanitizeHttpUrl;
