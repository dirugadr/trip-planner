# Trip Planner 🧳

Aplicación web + mobile para planificar viajes, gestionar itinerarios, presupuesto y puntos de interés.

## Stack

- **Backend:** Node.js + Express
- **Frontend:** React + Vite
- **Database:** SQLite / libSQL — archivo local en dev, [Turso](https://turso.tech) en producción
- **Maps:** Leaflet
- **Mobile:** React Native (futuro)

## Estructura del proyecto

```
trip-planner/
├── api/             # Entry point serverless de Vercel (re-exporta la app Express)
├── backend/src/     # API Express + acceso a datos (libSQL)
├── frontend/        # React app (web, Vite)
├── docs/            # Documentación
├── package.json     # Deps del backend + scripts del monorepo
└── vercel.json      # Build del frontend + rewrites
```

## Primeros pasos (local)

```bash
npm install            # deps del backend (raíz)
npm run migrate        # crea las tablas en ./trip-planner.db
npm run dev            # API en http://localhost:3000

# en otra terminal
npm run frontend:dev   # Vite en http://localhost:5173 (proxy /api -> :3000)
```

Sin variables `TURSO_*`, el backend usa un archivo SQLite local (`trip-planner.db`
en la raíz). No hace falta nada más para desarrollar. Ver `.env.example`.

## Deploy — todo en Vercel

Frontend y API se sirven desde **un solo proyecto de Vercel**. La base de datos
es Turso (Vercel no tiene disco persistente).

### 1. Crear la base en Turso

```bash
# instalar la CLI: https://docs.turso.tech/cli/installation
turso auth signup
turso db create trip-planner
turso db show trip-planner --url        # -> TURSO_DATABASE_URL
turso db tokens create trip-planner     # -> TURSO_AUTH_TOKEN
```

### 2. Correr las migraciones contra Turso (una vez)

```bash
# PowerShell
$env:TURSO_DATABASE_URL="libsql://trip-planner-xxx.turso.io"
$env:TURSO_AUTH_TOKEN="..."
npm run migrate
```

### 3. Importar el repo en Vercel

1. [vercel.com/new](https://vercel.com/new) → importar `dirugadr/trip-planner`.
2. **Root Directory:** raíz del repo (dejar como está). `vercel.json` ya define
   el build (`npm run build` → `frontend/dist`) y detecta `api/` como función.
3. **Environment Variables:** agregar `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
   y `NODE_ENV=production`.
4. Deploy.

`vercel.json` reescribe `/api/*` a la función Express y todo lo demás al SPA;
como frontend y API comparten origen no hay nada que configurar de CORS.

## Documentación

- [`docs/historias-de-usuario.md`](docs/historias-de-usuario.md) — Backlog por épica, con criterios de aceptación (EARS)
- `backend/src/db/001_initial_schema.sql` — Modelo de datos

## Épicas

- [x] Épica 1: Itinerarios
- [ ] Épica 2: Mapa y POIs
- [x] Épica 3: Presupuesto
- [ ] Épica 4: Offline
- [ ] Épica 5: Versión Mobile
- [ ] Épica 6: Documentos
- [ ] Épica 7: Seguridad y acceso (login con Google + allowlist)

## License

MIT
