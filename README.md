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
