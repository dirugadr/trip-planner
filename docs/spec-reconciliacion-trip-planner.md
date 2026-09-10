# Spec de Reconciliación — Trip Planner

### Metodología SDD aplicada retroactivamente

> Actualizado a partir del repo real (`dirugadr/trip-planner`) y su backlog
> vivo en `docs/historias-de-usuario.md`. Ese archivo es ahora la fuente de
> verdad del proyecto — este documento es solo un resumen de estado + guía
> para seguir con SDD estricto de acá en adelante.

**Stack real:** Node.js + Express (backend), React + Vite (frontend), SQLite local / Turso (libSQL) en producción, Leaflet (mapas, pendiente de uso), deploy 100% en Vercel (frontend + API serverless).

\---

## Cómo leer este documento

* ✅ Implementado y en producción
* 🟡 Parcial
* 🔜 Próximo — pendiente
* 💭 Futuro — sin planificar en detalle

\---

## Épica 1 — Itinerarios ✅ (completa)

Las 13 historias (HU-1.1 a HU-1.13) están implementadas: crear/editar/eliminar viaje, generación y regeneración automática de días, CRUD de actividades, detección de solapamiento horario, reordenamiento manual, actividades tentativas y marcado de completado.

**⚠️ Riesgo si se toca**: sigue siendo la épica más central — `Trip`, `Day` y `Activity` son referenciados por Presupuesto (HU-3.3), Alojamientos (HU-8.5) y en el futuro por Mapa/POIs (HU-2.3). Cualquier cambio de schema acá tiene el radio de impacto más grande del proyecto.

\---

## Épica 2 — Mapa y POIs 🔜 (pendiente, con base de datos ya lista)

|Historia|Estado|
|-|-|
|HU-2.1 Guardar un POI|🔜|
|HU-2.2 Ver POIs en un mapa|🔜|
|HU-2.3 Asociar POIs a una actividad|🔜|
|HU-2.4 Gestionar categorías de POI|💭 (set inicial fijo: atracción, estación, alojamiento, gastronomía, naturaleza, cultura, otro)|
|HU-2.5 Rutas entre POIs|💭|

Tablas ya existentes en el schema: `pois\_saved`, `poi\_categories`, `activity\_pois`, `transport\_modes`, `routes`.

**⚠️ Riesgo si se toca**: bajo — épica aislada, las tablas ya están creadas. `activity\_pois` referencia `activities`, así que la asociación (HU-2.3) es el único punto de contacto con Épica 1.

\---

## Épica 3 — Presupuesto ✅ (completa, salvo multi-moneda)

HU-3.1 a HU-3.4 implementadas: presupuesto total + moneda por viaje, categorías de presupuesto (nombre único, no se puede borrar una con gastos), registro de gastos (con método de pago y asociación opcional a actividad), resumen gastado vs. asignado por categoría.

* HU-3.5 Multi-moneda: 💭 (sin conversión de tipo de cambio todavía).

**⚠️ Riesgo si se toca**: medio — `expenses` ya está vinculada también a Alojamientos (Épica 8) vía `accommodation\_id`. Un cambio ahí impacta ambas épicas.

\---

## Épica 4 — Offline 💭 (sin implementar)

HU-4.1 a HU-4.4 todas en estado futuro. Tabla `sync\_logs` ya existe en el schema; dependencias previstas del frontend: `sql.js`, `localforage` (todavía no instaladas/usadas).

**⚠️ Riesgo si se toca**: alto a futuro — cuando se implemente, hay que respetar el versionado ya pensado en `sync\_logs` en vez de rediseñarlo desde cero.

\---

## Épica 5 — Versión Mobile 💭 (sin planificar en detalle)

React Native, paridad de itinerario + offline. Sin historias de usuario detalladas todavía, solo enunciado general.

**⚠️ Riesgo si se toca**: ninguno inmediato — consumidor nuevo de la API existente.

\---

## Épica 6 — Documentos 💭 (sin implementar)

HU-6.1 a HU-6.3: adjuntar, ver/descargar y eliminar documentos. Tabla `documents` ya existe. Decisión de diseño ya tomada: el storage debe ser un blob store (Vercel Blob / S3), **no filesystem**, porque Vercel es efímero.

**⚠️ Riesgo si se toca**: bajo — épica aislada; el único punto de contacto es asociar un documento a un viaje o actividad.

\---

## Épica 7 — Seguridad y acceso ✅ (completa, con hardening)

Esto es lo que corrijo respecto a la versión anterior de este documento: **ya está implementada de punta a punta**, no es un pendiente.

**Cómo funciona:**

* Login con Google Identity Services → ID token.
* El backend verifica el ID token (firma JWKS, `aud`, `email\_verified`) y, si el correo está en `ALLOWED\_EMAILS`, emite un **JWT de sesión propio** (firmado con `JWT\_SECRET`).
* Sin tabla de usuarios ni roles — todos los correos habilitados comparten los mismos datos.
* Fail-closed: sin `ALLOWED\_EMAILS` o `JWT\_SECRET` válidos, la API no sirve nada (503).
* `requireAuth` revalida la allowlist en cada request (revocación inmediata, no hay que esperar a que expire el token).
* Hardening adicional ya hecho: rate limiting (20 req/15min en login, 300 req/min en el resto), `helmet()` + CSP, `express.json({ limit: '100kb' })`, CI con `npm audit`, Express 5, 0 vulnerabilidades de producción.

**⚠️ Riesgo si se toca**: bajo para el resto del sistema — es transversal pero ya estable. El único punto de atención a futuro (ya anotado en el propio backlog): revalidar la allowlist ya está resuelto (HU-7.11), lo que faltaría es más granular (roles, dueño por viaje) si algún día se necesita multiusuario real.

\---

## Épica 8 — Alojamientos ✅ (completa)

No estaba en mi diagnóstico anterior — es una épica nueva y completa:

* HU-8.1 a HU-8.5: alta/edición/baja de alojamientos, pago vinculado como gasto (`accommodation\_id`, con la misma lógica de borrado en cascada lógico), etiqueta de ciudad por día calculada a partir del rango de estadía, y generación automática de actividades de check-in/check-out sincronizadas con los datos del alojamiento.

**⚠️ Riesgo si se toca**: medio — toca tres puntos a la vez (`accommodations`, `expenses`, `activities`), así que es la épica con más interconexión después de Itinerarios.

\---

## Resumen de estado real (corregido)

|Épica|Estado|
|-|-|
|1. Itinerarios|✅|
|2. Mapa y POIs|🔜|
|3. Presupuesto|✅|
|4. Offline|💭|
|5. Mobile|💭|
|6. Documentos|💭|
|7. Seguridad y acceso|✅|
|8. Alojamientos|✅|

\---

## Recomendación de orden (actualizada)

1. **Mapa y POIs (Épica 2)** — es la más aislada de las pendientes y ya tiene tablas listas; buen próximo objetivo con SDD estricto (HU-2.1 → HU-2.2 → HU-2.3).
2. **Documentos (Épica 6)** — también aislada, decisión de storage ya tomada (blob store).
3. **Offline (Épica 4)** — dejar para cuando el modelo de datos esté más cerrado (después de Mapa/POIs), porque el versionado offline tiene que contemplar todas las entidades existentes.
4. **Mobile (Épica 5)** — al final, consume la API ya construida.

## Regla práctica para cada nueva historia de usuario (SDD estricto de acá en adelante)

1. Verificar el estado y los criterios EARS en `docs/historias-de-usuario.md` antes de tocar código — es la fuente de verdad, no este resumen.
2. Si la historia toca una tabla ya usada por una épica ✅ (por ejemplo, `activities` para HU-2.3), revisar primero qué depende de ella (ver "Riesgo si se toca" de cada épica arriba).
3. Implementar en una rama separada.
4. Antes de mergear, correr el CI existente (`.github/workflows/ci.yml`: build + `npm audit`) y verificar que la API protegida (Épica 7) siga exigiendo JWT en los endpoints nuevos.

