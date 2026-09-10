# Seguridad — Trip Planner

Estado a 2026-09-10. Este documento describe el modelo de seguridad de la app,
lo que está protegido, y una revisión con los hallazgos y su estado.

## Modelo de amenaza

- App **privada de un grupo chico y de confianza**. El acceso es "pasa / no
  pasa": login con Google + una allowlist de correos en configuración
  (`ALLOWED_EMAILS_TP`). Sin roles.
- **Datos compartidos**: toda persona habilitada ve y edita *todo*. No hay
  dueño por viaje ni aislamiento entre usuarios. Es una decisión de diseño
  (Épica 7), no un bug — pero implica que el radio de daño de una cuenta
  habilitada comprometida es total.
- Deploy en Vercel: frontend estático + API serverless, **mismo origen**.
- No hay usuarios anónimos: todo `/api/*` (salvo `/api/health` y
  `/api/auth/*`) exige un JWT de sesión válido cuyo correo siga en la
  allowlist, revalidado **en cada request**.

## Protecciones en vigor

**Autenticación / acceso**
- Login con Google Identity Services → el backend verifica el ID token contra
  las JWKS de Google (firma, `aud` = nuestro Client ID, emisor, `exp`,
  `email_verified`).
- Sesión propia: JWT HS256 firmado con `JWT_SECRET_TP`, expiración
  configurable (default 7 días).
- **Fail-closed**: en producción sin `JWT_SECRET_TP` o sin
  `GOOGLE_CLIENT_ID_TP` la API responde 503 y no autentica a nadie. Sin
  `ALLOWED_EMAILS_TP` (o vacío) no entra nadie.
- `requireAuth` revalida la allowlist en **cada** request (revocación al
  siguiente request, no hay que esperar a que expire el token). Desde esta
  revisión, `GET /api/auth/me` también la revalida.

**Cabeceras / transporte** (`helmet()` en la API + `vercel.json` en el sitio)
- CSP: `default-src 'self'`; `script-src` sin `'unsafe-inline'` ni
  `'unsafe-eval'` (solo `'self'` + `accounts.google.com`); `object-src 'none'`;
  `base-uri 'self'`; `frame-ancestors 'none'`.
- `Strict-Transport-Security`, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` restrictiva.
- CORS acotado a un único origen (`CORS_ORIGIN_TP`), nunca `*`.
- `x-powered-by` desactivado.

**Entrada / datos**
- **Valores** siempre parametrizados (`?`), nunca interpolados en el SQL.
- **Identificadores** (nombres de columna) validados contra
  `^[A-Za-z_][A-Za-z0-9_]*$` en `insertOne` / `updateOne` / `findAll`
  (`backend/src/db/database.js`).
- Rutas de update con **whitelist de campos** por modelo — el body del cliente
  nunca se vuelca entero a un `UPDATE`.
- `express.json({ limit: '100kb' })`.
- Rate limiting: 20 req/15 min en `/api/auth/login`, 300 req/min en el resto
  de `/api` (ver "Riesgos aceptados").

**Uploads (Épica 6)**
- Allowlist de tipos: PDF, `.doc`/`.docx`, JPG, PNG — validado por **MIME
  declarado + magic bytes** (`backend/src/lib/fileTypes.js`). SVG **no**
  permitido (vector de XSS).
- Límite de 5 MB, aplicado por `multer` **antes** de subir a Blob.
- `multer.memoryStorage()` — nunca se escribe a disco.
- Vercel Blob en **modo privado**: la descarga pasa por
  `GET /api/documents/:id/download` (detrás de `requireAuth`) que hace
  streaming del archivo. La URL del blob nunca sale del servidor.
- Descargas con `Content-Disposition: attachment` (no se renderizan inline) y
  `filename` codificado (`encodeURIComponent`).

**URLs de usuario**
- Los campos de enlace (`pois_saved.url`, `accommodations.booking_url`,
  `activities.url`) se sanitizan a `http(s):` al escribir
  (`backend/src/lib/url.js`) y otra vez al renderizar
  (`frontend/src/utils/safeUrl.js`).

**Frontend**
- React escapa por defecto; **cero** `dangerouslySetInnerHTML` / `eval` /
  `innerHTML` en el código.
- `rel="noreferrer"` en todos los links externos (implica `noopener`).

**Cadena de build**
- CI (`.github/workflows/ci.yml`): build + `npm audit --omit=dev
  --audit-level=high` en back y front. 0 vulnerabilidades de producción.
- Secretos en archivos gitignored (`.env`, `Trip-Planner-tucso.txt`,
  `google_oauth.txt`, `blob.txt`). El *client secret* de Google no lo usa
  nuestro flujo (GIS ID-token solo necesita el Client ID).

## Revisión de seguridad — 2026-09-10

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| 1 | Inyección SQL por nombre de columna / mass-assignment en `PUT /api/trips/:id` y `PUT /api/activities/:id` (pasaban `req.body` crudo a `Model.update`) | Media | **Corregido** |
| 2 | Los `catch` de cada ruta devolvían `error.message` también en producción (fuga de detalles internos de la DB) | Baja–Media | **Corregido** |
| 3 | URLs `javascript:` / `data:` sin sanitizar en campos de enlace → XSS almacenado (robo del token de `localStorage`) | Baja | **Corregido** |
| 4 | Rate limiting con store en memoria (best-effort en serverless) | Baja | **Aceptado** |
| 5 | Sin aislamiento entre usuarios (todos ven/editan/borran todo) | Baja / Info | **Aceptado** (diseño) |
| 6 | `GET /api/auth/me` no revalidaba la allowlist (usuario revocado seguía "logueado" en el frontend hasta que expiraba el token) | Baja | **Corregido** |
| 7 | Auth token de Turso y token de Vercel Blob compartidos en un chat | Info | **Pendiente** (rotar cuando se pueda) |
| 8 | Token de sesión en `localStorage` (XSS ⇒ robo de token) | Baja | **Mitigado** por #3 + escaping de React + CSP |
| 9 | Sin escaneo de malware en uploads | Baja | **Aceptado** (grupo chico; `attachment` + sin SVG cortan stored-XSS) |

### Detalle de los arreglos

**#1 — Inyección por identificador / mass-assignment**
- `insertOne` / `updateOne` / `findAll` (`db/database.js`) ahora rechazan
  cualquier clave que no sea un identificador SQL simple
  (`assertIdentifiers`). Esto solo corta la inyección; además:
- `Trip.update` y `Activity.update` ahora filtran los campos contra una
  whitelist `EDITABLE` (igual que ya hacían `Poi` / `Expense` /
  `Accommodation` / `Day` / `BudgetCategory`). `id`, timestamps, `version`,
  `deleted_at`, `accommodation_id` quedan fuera del alcance del cliente.
- Verificado: `execute()` de libSQL **no** ejecuta stacked queries
  (`...; DROP TABLE ...` se ignora), pero la manipulación del `UPDATE` sí era
  posible antes de este arreglo.

**#2 — Fuga de mensajes de error**
- Nuevo helper `backend/src/lib/http.js` → `serverError(res, error)`: loguea el
  error completo del lado del servidor y responde `"Error interno del
  servidor"` en producción, o el mensaje real fuera de producción.
- Todos los `catch` de rutas que respondían un 500 ahora usan `serverError`.
  Los 400/403/404/503 con mensajes en español pensados para el usuario no
  cambian.

**#3 — URLs peligrosas**
- Backend: `sanitizeHttpUrl` (`lib/url.js`) en `validatePoiPayload`,
  `validateFields` de alojamientos y las rutas de actividades. Una URL que no
  sea `http(s)` devuelve 400.
- Frontend: `safeUrl` (`utils/safeUrl.js`) envuelve todo `href` de dato de
  usuario; si no es `http(s)`, no se renderiza el link.

**#6 — Revocación en `/me`**
- `GET /api/auth/me` ahora hace `isEmailAllowed(user.email)` después de
  verificar el token; si el correo ya no está habilitado, responde 401
  "Acceso revocado".

### Riesgos aceptados (con contexto)

- **Rate limiting best-effort (#4)**: `express-rate-limit` con store en memoria
  se resetea en cada cold start y no se comparte entre instancias de Vercel.
  El login no es por contraseña (verifica un ID token firmado por Google, no
  brute-forceable), así que el riesgo real es abuso/DoS, no credential
  stuffing. Si algún día importa: mover el store a Turso o a Upstash Redis.
- **Sin aislamiento entre usuarios (#5)**: es el modelo pedido. Si el grupo
  crece o se necesita multiusuario real, hace falta `owner_id` por entidad +
  checks de autorización por request.
- **Secretos en chat (#7)**: el token de Turso y el de Vercel Blob se pegaron
  en una conversación. No están en git. Lo prudente es rotarlos
  (`turso db tokens create` / regenerar el token del Blob store en Vercel).

## Guía para cambios futuros

- **Nuevo campo de URL editable por el usuario**: sanitizar con
  `sanitizeHttpUrl` en el backend **y** renderizar con `safeUrl` en el
  frontend.
- **Nueva ruta de update**: nunca pasar `req.body` directo a `Model.update`.
  Construir un `patch` con los campos permitidos, o agregar el campo a la
  whitelist `EDITABLE` del modelo.
- **Nuevo `res.status(500)`**: usar `serverError(res, error)`, no
  `error.message`.
- **Nuevo endpoint bajo `/api`**: va después de `app.use('/api', requireAuth)`
  en `app.js` — no crear rutas públicas nuevas sin una razón explícita.
- Antes de mergear: correr el CI y los scripts de integración; verificar que
  cualquier endpoint nuevo exige JWT.
