export const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — keep in sync with the backend
export const ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/** Quick client-side check for instant feedback (the server re-validates). */
export function checkFileClient(file) {
  if (!file) return 'Elegí un archivo.';
  if (file.size > MAX_BYTES) return 'El archivo supera el límite de 5 MB.';
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return 'Tipo no permitido. Solo PDF, Word (.doc/.docx) o imágenes (JPG/PNG).';
  }
  return null;
}

export function fileIcon(mime) {
  if (mime === 'application/pdf') return '📄';
  if (mime?.startsWith('image/')) return '🖼️';
  if (mime?.includes('word') || mime === 'application/msword') return '📝';
  return '📎';
}
