/**
 * Only let http(s) URLs through to an <a href>. The backend already rejects
 * other schemes on write, but user-entered links are shared data — this is the
 * render-time backstop against `javascript:` / `data:` hrefs (token theft).
 *
 * @returns {string|undefined} the URL if safe, else undefined (renders no link).
 */
export function safeUrl(value) {
  const s = (value ?? '').toString().trim();
  if (!s) return undefined;
  try {
    const u = new URL(s, window.location.origin);
    return u.protocol === 'http:' || u.protocol === 'https:' ? s : undefined;
  } catch {
    return undefined;
  }
}
