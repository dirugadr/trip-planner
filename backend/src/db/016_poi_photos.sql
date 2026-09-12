-- Foto por lugar (POI): automática por proximidad geográfica (Wikipedia/
-- Wikimedia, ver lib/photoLookup.js) o subida a mano (mismo storage que
-- Documentos, Vercel Blob). photo_source distingue cuál es para no pisar
-- una foto manual con un resultado automático al reeditar la dirección.

ALTER TABLE pois_saved ADD COLUMN photo_url TEXT;
ALTER TABLE pois_saved ADD COLUMN photo_source TEXT; -- 'auto_wikipedia' | 'manual'
