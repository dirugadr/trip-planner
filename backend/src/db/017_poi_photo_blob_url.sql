-- The Vercel Blob store backing this project is configured PRIVATE at the
-- store level (confirmed live: `access: 'public'` on an upload throws
-- "Cannot use public access on a private store" — this isn't something a
-- per-call option can override). A private blob's URL also 403s on a plain
-- unauthenticated fetch, so a manually-uploaded POI photo can't be embedded
-- directly as <img src>. photo_blob_url keeps the real (private) blob URL
-- for server-side streaming only; photo_url becomes the client-facing value
-- — either the real Wikipedia URL (already public) for an automatic photo,
-- or our own GET /api/pois/:id/photo proxy path for a manual one.

ALTER TABLE pois_saved ADD COLUMN photo_blob_url TEXT;
