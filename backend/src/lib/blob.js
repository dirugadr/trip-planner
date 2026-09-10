import { put, get, del } from '@vercel/blob';
import config from '../config/index.js';

const token = () => config.blob.token;

/** Upload a buffer to the private Blob store. Returns the stored blob info. */
export function uploadBlob(pathname, buffer, contentType) {
  return put(pathname, buffer, {
    access: 'private',
    token: token(),
    contentType,
    addRandomSuffix: true,
  });
}

/** Open a read stream for a stored blob (private). Returns { stream, blob } or null. */
export async function streamBlob(url) {
  const res = await get(url, { access: 'private', token: token() });
  if (!res || res.statusCode !== 200) return null;
  return { stream: res.stream, blob: res.blob };
}

/** Delete a blob by URL. Swallows "already gone". */
export async function deleteBlob(url) {
  try {
    await del(url, { token: token() });
  } catch (err) {
    // A missing blob is fine — we're deleting anyway.
    if (err?.name !== 'BlobNotFoundError') throw err;
  }
}
