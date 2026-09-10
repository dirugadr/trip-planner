# Spec de Reconciliación — Trip Planner
### Metodología SDD aplicada retroactivamente

> Actualizado a partir del repo real (`dirugadr/trip-planner`) y su backlog
> vivo en `docs/historias-de-usuario.md`. Ese archivo es ahora la fuente de
> verdad del proyecto — este documento es solo un resumen de estado + guía
> para seguir con SDD estricto de acá en adelante.

**Stack real:** Node.js + Express (backend), React + Vite (frontend), SQLite local / Turso (libSQL) en producción, Leaflet (mapas) + Nominatim/OpenStreetMap (geocoding, desde el frontend), deploy 100% en Vercel (frontend + API serverless).

---

## Cómo leer este documento

- ✅ Implementado y en producción
- 🟡 Parcial
- 🔜 Próximo — pendiente
- 💭 Futuro — sin planificar en detalle

---

## Épica 1 — Itinerarios ✅ (completa)

Las 13 historias (HU-1.1 a HU-1.13) están implementadas: crear/editar/eliminar viaje, generación y regeneración automática de días, CRUD de actividades, detección de solapamiento horario, reordenamiento manual, actividades tentativas y marcado de completado.

**⚠️ Riesgo si se toca**: sigue siendo la épica más central — `Trip`, `Day` y `Activity` son referenciados por Presupuesto (HU-3.3), Alojamientos (HU-8.5) y ahora también por Mapa/POIs (HU-2.3, pendiente). Cualquier cambio de schema acá tiene el radio de impacto más grande del proyecto.

---

## Épica 2 — Mapa y POIs 🟡 (parcial — guardado de POIs ya en producción)

| Historia | Estado |
|---|---|
| HU-2.1 Guardar un POI | ✅ |
| HU-2.1b Editar y eliminar un POI | ✅ |
| HU-2.2 Ver POIs en un mapa | 🔜 |
| HU-2.3 Asociar POIs a una actividad | 🔜 |
| HU-2.4 Gestionar categorías de POI | 💭 |
| HU-2.5 Rutas entre POIs | 💭 |

**Lo implementado (HU-2.1 / HU-2.1b):**
- CRUD de POIs (`POST/GET/PUT/DELETE` sobre `pois_saved`), categoría limitada a las 7 predefinidas, borrado lógico.
- Ubicación resuelta por geocoding con **Nominatim**, llamado desde el frontend (`utils/geocode.js` + hook `useAddressSearch` + componente `AddressSearchField`), con debounce — no se cargan lat/lng a mano. El navegador manda su propio `User-Agent`/`Referer` (Nominatim rechaza requests sin él).

Tablas del schema aún sin usar: `activity_pois`, `transport_modes`, `routes` (para HU-2.3/2.5).

**⚠️ Riesgo si se toca**: bajo para el resto del sistema — pero ahora que HU-2.1 está en producción, cualquier cambio al CRUD de POIs o al geocoding compartido (`useAddressSearch` / `AddressSearchField`, ver Épica 8) impacta también a Alojamientos (HU-8.6).

---

## Épica 3 — Presupuesto ✅ (completa, salvo multi-moneda)

HU-3.1 a HU-3.4 implementadas: presupuesto total + moneda por viaje, categorías de presupuesto (nombre único, no se puede borrar una con gastos), registro de gastos (con método de pago y asociación opcional a actividad), resumen gastado vs. asignado por categoría.

- HU-3.5 Multi-moneda: 💭 (sin conversión de tipo de cambio todavía).

**⚠️ Riesgo si se toca**: medio — `expenses` ya está vinculada también a Alojamientos (Épica 8) vía `accommodation_id`. Un cambio ahí impacta ambas épicas.

---

## Épica 4 — Offline 💭 (sin implementar)

HU-4.1 a HU-4.4 todas en estado futuro. Tabla `sync_logs` ya existe en el schema; dependencias previstas del frontend: `sql.js`, `localforage` (todavía no instaladas/usadas).

**⚠️ Riesgo si se toca**: alto a futuro — cuando se implemente, hay que respetar el versionado ya pensado en `sync_logs` en vez de rediseñarlo desde cero.

---

## Épica 5 — Versión Mobile 💭 (sin planificar en detalle)

React Native, paridad de itinerario + offline. Sin historias de usuario detalladas todavía, solo enunciado general.

**⚠️ Riesgo si se toca**: ninguno inmediato — consumidor nuevo de la API existente.

---

## Épica 6 — Documentos 💭 (sin implementar)

HU-6.1 a HU-6.3: adjuntar, ver/descargar y eliminar documentos. Tabla `documents` ya existe. Decisión de diseño ya tomada: el storage debe ser un blob store (Vercel Blob / S3), **no filesystem**, porque Vercel es efímero.

**⚠️ Riesgo si se toca**: bajo — épica aislada; el único punto de contacto es asociar un documento a un viaje o actividad.

---

## Épica 7 — Seguridad y acceso ✅ (completa, con hardening)

**Cómo funciona:**
- Login con Google Identity Services → ID token.
- El backend verifica el ID token (firma JWKS, `aud`, `email_verified`) y, si el correo está en `ALLOWED_EMAILS`, emite un **JWT de sesión propio** (firmado con `JWT_SECRET`).
- Sin tabla de usuarios ni roles — todos los correos habilitados comparten los mismos datos.
- Fail-closed: sin `ALLOWED_EMAILS` o `JWT_SECRET` válidos, la API no sirve nada (503).
- `requireAuth` revalida la allowlist en cada request (revocación inmediata, no hay que esperar a que expire el token).
- Hardening adicional ya hecho: rate limiting (20 req/15min en login, 300 req/min en el resto), `helmet()` + CSP, `express.json({ limit: '100kb' })`, CI con `npm audit`, Express 5, 0 vulnerabilidades de producción.
- Revisión de seguridad 2026-09-10: cerrados inyección por nombre de columna /
  mass-assignment, fuga de `error.message` en prod, XSS por URLs `javascript:`,
  y revocación en `/api/auth/me`. Ver [`docs/seguridad.md`](seguridad.md).

**⚠️ Riesgo si se toca**: bajo para el resto del sistema — es transversal pero ya estable.
Reglas al agregar código en [`docs/seguridad.md`](seguridad.md) ("Guía para cambios futuros").

---

## Épica 8 — Alojamientos ✅ (completa, ahora integrada con POIs)

- HU-8.1 a HU-8.5: alta/edición/baja de alojamientos, pago vinculado como gasto (`accommodation_id`), etiqueta de ciudad por día calculada a partir del rango de estadía, y generación automática de actividades de check-in/check-out sincronizadas con los datos del alojamiento.
- **HU-8.6 (nueva) ✅ — POI vinculado al alojamiento**: al crear/editar un alojamiento, el sistema mantiene automáticamente un POI vinculado (`pois_saved.accommodation_id`) con categoría "alojamiento", geocodificado con Nominatim y sincronizado in-place (mismo patrón que las actividades de check-in/check-out). Al eliminar el alojamiento, se borra (lógico) el POI vinculado.

**⚠️ Riesgo si se toca**: medio-alto — es la épica con más interconexión del proyecto: toca `accommodations`, `expenses`, `activities` **y ahora también** `pois_saved`. El geocoding quedó compartido entre el formulario de alojamiento y `PoiForm.jsx` (hook `useAddressSearch` + componente `AddressSearchField`) — un cambio ahí impacta ambas épicas a la vez.

---

## Resumen de estado real (actualizado)

| Épica | Estado |
|---|---|
| 1. Itinerarios | ✅ |
| 2. Mapa y POIs | 🟡 (guardado de POIs ✅, mapa y asociación a actividades 🔜) |
| 3. Presupuesto | ✅ |
| 4. Offline | 💭 |
| 5. Mobile | 💭 |
| 6. Documentos | 💭 |
| 7. Seguridad y acceso | ✅ |
| 8. Alojamientos | ✅ (incluye integración con POIs vía HU-8.6) |

---

## Recomendación de orden (actualizada)

1. **HU-2.2 (Ver POIs en un mapa)** — es el paso natural que sigue, ahora que hay POIs guardados (manuales y de alojamientos) esperando mostrarse. Con Leaflet ya elegido como librería.
2. **HU-2.3 (Asociar POIs a una actividad)** — depende de HU-2.2 para poder elegir POIs visualmente al asociarlos.
3. **Documentos (Épica 6)** — aislada, decisión de storage ya tomada (blob store).
4. **Offline (Épica 4)** — dejar para cuando el modelo de datos esté más cerrado.
5. **Mobile (Épica 5)** — al final, consume la API ya construida.

## Regla práctica para cada nueva historia de usuario (SDD estricto de acá en adelante)

1. Verificar el estado y los criterios EARS en `docs/historias-de-usuario.md` antes de tocar código — es la fuente de verdad, no este resumen.
2. Si la historia toca una tabla o módulo compartido entre épicas (por ejemplo, el geocoding compartido entre POIs y Alojamientos), revisar primero qué depende de él (ver "Riesgo si se toca" de cada épica arriba).
3. Implementar en una rama separada.
4. Antes de mergear, correr el CI existente (`.github/workflows/ci.yml`: build + `npm audit`) y verificar que la API protegida (Épica 7) siga exigiendo JWT en los endpoints nuevos.
