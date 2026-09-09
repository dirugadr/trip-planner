# Trip Planner 🧳

Aplicación web + mobile para planificar viajes, gestionar itinerarios, presupuesto y puntos de interés.

## Stack

- **Backend:** Node.js + Express
- **Frontend:** React + Vite
- **Database:** SQLite (local-first, offline-ready)
- **Maps:** Leaflet
- **Mobile:** React Native (futuro)

## Estructura del proyecto

```
trip-planner/
├── backend/         # Express API + SQLite
├── frontend/        # React app (web)
├── docs/            # Documentación
└── README.md
```

## Primeros pasos

### Backend

```bash
cd backend
npm install
npm run migrate     # Crear BD y tablas
npm run seed        # Datos iniciales (opcional)
npm run dev         # Servidor en puerto 3000
```

### Frontend

```bash
cd frontend
npm install
npm run dev         # Vite dev server en puerto 5173
```

## Deploy

### Frontend — Vercel

El frontend se despliega en Vercel con integración Git.

1. **Importar el repo** en [vercel.com/new](https://vercel.com/new).
2. **Root Directory:** `frontend` (Settings → General, o en la pantalla de import).
   Vercel detecta Vite y usa `npm run build` → `dist` automáticamente.
3. **Conexión con el backend:** `frontend/vercel.json` reescribe `/api/*` hacia
   Railway. Reemplazá `REPLACE_WITH_RAILWAY_URL` por el dominio real del backend
   (sin `https://` duplicado ni barra final), commiteá y Vercel redeploya.
   Así el browser ve todo como mismo-origen y no hace falta configurar CORS.
4. SPA routing (react-router) ya queda resuelto por el rewrite a `/index.html`.

Con el proxy, las llamadas al backend salen desde el servidor de Vercel, así que
no hay preflight de CORS en el browser y `CORS_ORIGIN` en Railway es indiferente.

Alternativa sin proxy: setear `VITE_API_URL` en las env vars de Vercel con la URL
del backend y `CORS_ORIGIN` en Railway con la URL exacta de Vercel
(ver `frontend/.env.example`).

### Backend — Railway

```bash
# Variables de entorno en Railway
NODE_ENV=production
# PORT lo inyecta Railway y el server ya lo respeta
# CORS_ORIGIN sólo hace falta si el frontend pega directo (sin el proxy de vercel.json)
```

> Nota: la BD SQLite vive en el filesystem efímero de Railway — se reinicia en
> cada deploy. Para persistencia real hace falta un volumen o migrar a Postgres.

## Documentación

- `spec.md` — Especificación de requisitos (EARS)
- `modelo-datos.md` — Diseño de base de datos
- `docs/` — Documentos adicionales

## Épicas

- [ ] Épica 1: Itinerarios
- [ ] Épica 2: Mapa y POIs
- [ ] Épica 3: Presupuesto
- [ ] Épica 4: Offline
- [ ] Épica 5: Versión Mobile
- [ ] Épica 6: Documentos

## License

MIT
