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

/** Material Symbols icon name for a document's file type — used inside a
 * `.msi` span, so this must be a real ligature name, not an emoji. */
export function fileIcon(mime) {
  if (mime === 'application/pdf') return 'picture_as_pdf';
  if (mime?.startsWith('image/')) return 'image';
  if (mime?.includes('word') || mime === 'application/msword') return 'description';
  return 'attach_file';
}
