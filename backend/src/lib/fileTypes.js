/**
 * Allowed document types for Épica 6 uploads, checked by BOTH the declared MIME
 * type and the file's magic bytes — a renamed file whose content doesn't match
 * is rejected.
 */

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

// mime -> label (for error messages) and the magic-byte families it may have.
const ALLOWED = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpeg'],
  'image/png': ['png'],
  'application/msword': ['ole'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['zip'],
};

export const ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,.doc,.docx';
export const ALLOWED_LABEL = 'PDF, Word (.doc/.docx) o imágenes (JPG/PNG)';

function magicFamily(buf) {
  if (!buf || buf.length < 4) return null;
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'pdf'; // %PDF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07)) return 'zip'; // PK..
  if (buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) return 'ole'; // OLE2 (.doc)
  return null;
}

/**
 * @returns {string|null} an error message, or null if the file is acceptable.
 */
export function checkFile(mimetype, buffer, sizeBytes) {
  if (sizeBytes > MAX_FILE_BYTES) {
    return `El archivo supera el límite de 5 MB.`;
  }
  const families = ALLOWED[mimetype];
  if (!families) {
    return `Tipo de archivo no permitido. Solo se aceptan ${ALLOWED_LABEL}.`;
  }
  const family = magicFamily(buffer);
  if (!family || !families.includes(family)) {
    return `El contenido del archivo no coincide con su tipo declarado.`;
  }
  return null;
}
