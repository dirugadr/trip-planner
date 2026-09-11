# Historias de Usuario — Trip Planner

Estado del backlog por épica. La app tiene un único rol, **viajero**: las
personas habilitadas (Épica 7) comparten los mismos datos, no hay dueño por
viaje.

**Leyenda de estado**

| Símbolo | Significado |
|---|---|
| ✅ | Implementado y en producción |
| 🟡 | Parcial (ver nota) |
| 🔜 | Próximo — pendiente de implementar |
| 💭 | Futuro — sin planificar en detalle |

Los criterios de aceptación usan estilo EARS (*el sistema DEBE…*).

---

## Épica 1 — Itinerarios

> Planificar un viaje día por día: crear el viaje, y para cada día una lista de
> actividades con horario y duración.

### HU-1.1 — Crear un viaje ✅
**Como** viajero, **quiero** crear un viaje con nombre y fechas, **para** empezar a planificarlo.

- El sistema DEBE pedir nombre, fecha de inicio y fecha de fin como obligatorios.
- CUANDO la fecha de fin no es posterior a la de inicio, el sistema DEBE rechazar la creación con un error claro.
- AL crear el viaje, el sistema DEBE generar automáticamente un día por cada fecha del rango.
- El sistema DEBE permitir opcionalmente descripción, moneda y presupuesto total.

### HU-1.2 — Ver mis viajes ✅
**Como** viajero, **quiero** ver la lista de mis viajes, **para** elegir cuál abrir.

- El sistema DEBE listar los viajes no eliminados con nombre y rango de fechas.
- El sistema DEBE ordenarlos por fecha de inicio ascendente (el próximo viaje primero).
- CUANDO no hay viajes, el sistema DEBE mostrar un estado vacío con acción para crear uno.

### HU-1.3 — Ver el itinerario de un viaje ✅
**Como** viajero, **quiero** abrir un viaje y ver sus días con las actividades, **para** revisar el plan.

- El sistema DEBE mostrar los días ordenados, cada uno con sus actividades ordenadas por hora.
- El sistema DEBE mostrar la duración total de actividades por día.
- El sistema DEBE mostrar un resumen: cantidad de días, actividades y (si hay) presupuesto y gasto acumulado.

### HU-1.4 — Editar un viaje ✅
**Como** viajero, **quiero** editar nombre, fechas, descripción y presupuesto, **para** ajustar el plan.

- El sistema DEBE validar las fechas igual que en la creación (también en edición).
- CUANDO cambia el rango de fechas, el sistema DEBE ajustar los días. *(ver HU-1.12)*

### HU-1.5 — Eliminar un viaje ✅
**Como** viajero, **quiero** eliminar un viaje, **para** sacar los que ya no necesito.

- El sistema DEBE pedir confirmación.
- El sistema DEBE hacer borrado lógico (soft delete), no físico.

### HU-1.6 — Agregar una actividad ✅
**Como** viajero, **quiero** agregar una actividad a un día, **para** armar el plan de ese día.

- El sistema DEBE pedir título como obligatorio.
- El sistema DEBE permitir hora de inicio, duración, descripción y enlace.
- 🗑️ *(2026-09-11)* Se sacó el campo de texto libre "Lugar" (`location_name`)
  del formulario de actividad — quedaba redundante con la asociación real a
  POIs de HU-2.3 (botón "Lugares", con dirección, coordenadas, mapa y
  recorrido sugerido). La columna sigue en el schema por compatibilidad con
  datos viejos, pero ya no se carga ni se muestra desde la UI. Para anotar
  dónde es una actividad, usar Descripción (nota libre) o asociar un POI.

### HU-1.7 — Editar y eliminar una actividad ✅
**Como** viajero, **quiero** modificar o borrar una actividad, **para** mantener el plan al día.

- El sistema DEBE pedir confirmación antes de eliminar.
- El sistema DEBE hacer borrado lógico.

### HU-1.8 — Aviso de solapamiento horario ✅
**Como** viajero, **quiero** que me avise si dos actividades del mismo día se pisan, **para** corregir el horario.

- CUANDO una actividad con hora y duración se solapa con otra del mismo día, el sistema DEBE avisar y no guardar.
- AL editar una actividad, el sistema NO DEBE considerarla en conflicto consigo misma.

### HU-1.9 — Editar título y notas de un día ✅
**Como** viajero, **quiero** poner un título y notas a cada día (ej. "Día de museos"), **para** organizar mejor.

- El sistema DEBE permitir editar `title` y `notes` de un día (`PUT /api/days/:id`).
- El sistema NO DEBE permitir cambiar la fecha ni el número de día manualmente.

### HU-1.10 — Reordenar actividades dentro de un día ✅
**Como** viajero, **quiero** cambiar el orden de las actividades de un día, **para** ordenarlas cuando no tienen hora fija.

- El sistema DEBE permitir subir o bajar una actividad en la lista de su día (botones ↑/↓).
- El orden manual (`sort_order`) DEBE persistir y usarse como criterio de orden (junto con la hora).

### HU-1.11 — Marcar una actividad como hecha ✅
**Como** viajero, **quiero** tildar actividades completadas, **para** seguir el progreso durante el viaje.

- El sistema DEBE permitir alternar el estado `completed` de una actividad (checkbox).
- El sistema DEBE distinguir visualmente las actividades completadas (tachado + atenuado).

### HU-1.12 — Regenerar días al cambiar las fechas ✅
**Como** viajero, **quiero** que al extender el viaje aparezcan los días nuevos, **para** no crearlos a mano.

- CUANDO se extiende el rango, el sistema DEBE crear los días de las fechas nuevas.
- El sistema DEBE renumerar los días por orden de fecha.
- CUANDO se acorta el rango, el sistema NO DEBE borrar días que tengan actividades (para no perder datos); los días vacíos fuera de rango se eliminan (borrado lógico).

### HU-1.13 — Actividades tentativas ✅
**Como** viajero, **quiero** marcar una actividad como "tentativa", **para** planificar el día sin comprometerme.

- Cada actividad PUEDE marcarse como `tentative` (checkbox en el formulario).
- El sistema DEBE mostrar las actividades tentativas de forma distinta (itálica + "· tentativa").
- Una actividad tentativa NO cuenta para la detección de conflictos de horario
  (ni bloquea, ni es bloqueada).

---

## Épica 2 — Mapa y POIs

> Guardar puntos de interés (lugares), verlos en un mapa, vincularlos al
> itinerario y pedir un recorrido sugerido por IA. Tablas: `pois_saved`,
> `poi_categories`, `activity_pois`, `poi_walk_times` (caché de HU-2.5).
> `transport_modes` / `routes` quedan sin uso (eran para trazado geográfico).

### HU-2.1 — Guardar un POI ✅
**Como** viajero, **quiero** guardar un lugar con nombre, categoría y ubicación, **para** tenerlo a mano.

- El sistema DEBE pedir nombre, categoría y ubicación como obligatorios.
- La categoría DEBE ser una de las 7 predefinidas en `poi_categories`
  (atracción, estación, alojamiento, gastronomía, naturaleza, cultura, otro).
- El sistema DEBE resolver la ubicación con un buscador de direcciones
  (Nominatim/OpenStreetMap), **no** carga manual de lat/lng.
- CUANDO el buscador no encuentra resultados, el sistema DEBE mostrar un
  mensaje claro y no permitir guardar sin una ubicación resuelta.
- El sistema DEBE guardar la dirección resuelta junto con lat/lng.
- El sistema DEBE permitir notas y enlace opcionales.
- Los POI pertenecen a un viaje (`trip_id` obligatorio).
- 🆕 *(2026-09-11)* El sistema DEBE permitir cargar, opcionalmente, una
  **duración estimada de visita** en minutos (`estimated_duration_minutes`,
  entero positivo). Los POI sin dato quedan en `null` — sin valor por
  categoría ni otro default; eso queda para quien consuma el dato (HU-2.6).
  Se carga igual en el alta normal y en la creación inline desde una
  actividad (HU-2.3), porque ambas reusan el mismo `PoiForm`.

### HU-2.1b — Editar y eliminar un POI ✅
**Como** viajero, **quiero** modificar o borrar un POI guardado, **para** mantener la lista actualizada.

- El sistema DEBE permitir editar todos los campos, re-geocodificando si cambia la dirección.
- El sistema DEBE pedir confirmación antes de eliminar.
- El sistema DEBE hacer borrado lógico (mismo patrón que el resto del proyecto).
- CUANDO un POI tiene actividades asociadas (`activity_pois`, HU-2.3), el
  sistema DEBE permitir igual el borrado lógico, sin tocar las asociaciones.

### HU-2.2 — Ver los POIs en un mapa ✅
**Como** viajero, **quiero** ver todos los POIs del viaje en un mapa, **para** entender la geografía del plan.

- El sistema DEBE mostrar los POIs (manuales y generados por alojamiento) en
  una pantalla nueva del viaje (`/trips/:id/mapa`), con Leaflet + tiles de
  OpenStreetMap.
- El sistema DEBE mostrar un marcador por POI, coloreado según su categoría
  (mismo mapeo que la lista, en `utils/poiCategories.js`); los generados por
  alojamiento no se distinguen.
- CUANDO se hace clic en un marcador, el sistema DEBE mostrar los datos del POI
  (nombre, categoría, dirección, notas, enlace) en un popup.
- El mapa DEBE encuadrar automáticamente todos los POIs del viaje.
- CUANDO el viaje no tiene POIs, el sistema DEBE mostrar un estado vacío con
  un enlace para agregar el primero.

### HU-2.3 — Asociar POIs a una actividad ✅
**Como** viajero, **quiero** vincular uno o más POIs a una actividad, **para** saber a dónde ir.

- El sistema DEBE permitir asociar uno o más POIs del viaje a una actividad
  desde un selector (`POST /api/activities/:id/pois`), soportando varios POIs
  con orden (`sequence_order`).
- El sistema DEBE mostrar los POIs asociados, en orden, en la ficha de la
  actividad (etiqueta con ícono de categoría) y permitir reordenarlos (↑/↓,
  `PUT .../pois/reorder`).
- El sistema DEBE permitir desasociar un POI sin borrarlo
  (`DELETE .../pois/:poiId`).
- CUANDO se elimina (lógico) un POI o una actividad, el sistema DEBE quitar
  las filas de `activity_pois` correspondientes, sin tocar la otra entidad.
- CUANDO el POI buscado no existe, el sistema DEBE permitir crearlo sin salir
  del flujo (`PoiForm` embebido → `POST .../pois/new`, que crea el POI y la
  asociación en una sola transacción).

### HU-2.4 — Gestionar categorías de POI 💭
**Como** viajero, **quiero** categorías con ícono y color, **para** clasificar los lugares.

- Existe un set inicial (atracción, estación, alojamiento, gastronomía, naturaleza, cultura, otro).
- 💭 Categorías personalizadas.

### HU-2.5 — Recorrido inteligente entre POIs de un día ✅
**Como** viajero, **quiero** que un asistente me sugiera el mejor orden y horarios para visitar los POIs de un día, **para** optimizar el itinerario sin planificarlo a mano.

> Reemplaza el enfoque original de "rutas geográficas dibujadas en el mapa"
> (tablas `routes` / `transport_modes`, que quedan libres) por una sugerencia
> generada con la **API de Claude**.

- El sistema DEBE permitir pedir una sugerencia de recorrido para un día
  (`POST /api/days/:dayId/smart-route`), tomando los POIs asociados a las
  actividades de ese día (primer POI de cada actividad) + sus horarios actuales.
- CUANDO hay menos de 2 actividades con POI, el sistema DEBE informarlo **sin**
  llamar a la API de Claude.
- El sistema DEBE calcular tiempos de caminata entre paradas con OSRM (matriz de
  *distancias* de la red vial → minutos a pie; el server público de OSRM solo
  sirve el perfil auto, por eso se usa la distancia y no su duración) y pasarlos
  como contexto. Si OSRM falla, usa distancia en línea recta (haversine) marcada
  como estimada. Los tiempos calculados se **cachean** en `poi_walk_times`.
- La llamada a Claude usa **tool use forzado** (`propose_day_route`); el backend
  DEBE rechazar (502) cualquier respuesta cuyo conjunto de `activity_id` no
  coincida exacto con el enviado — nunca aplicar una sugerencia parcial.
- La sugerencia se muestra como **propuesta editable** (orden + horarios por
  parada + justificación + resumen), sin tocar la base.
- Aplicar (`POST .../smart-route/apply`) reordena y reprograma las actividades
  del día en una transacción, **reusando** la validación de conflictos de HU-1.8
  (`findScheduleConflicts`); si generaría solapamiento, avisa y no aplica nada.
- Se puede descartar sin escribir nada.
- Requiere `ANTHROPIC_API_KEY_TP`; sin ella el endpoint responde 503.

### HU-2.6 — Armar y aplicar recorridos visuales 💭
**Como** viajero, **quiero** ver y ajustar a mano el recorrido de un día sobre el mapa, **para** planificarlo visualmente.

- 💭 Sin planificar en detalle. Consumiría la duración estimada por POI
  (`estimated_duration_minutes`, ver HU-2.1) para armar la línea de tiempo.

### HU-2.7 — Filtrar POIs por categoría y ciudad ✅
**Como** viajero, **quiero** filtrar los POIs por categoría y/o ciudad, **para** encontrar lugares específicos más rápido en viajes con muchos POIs guardados.

- El sistema DEBE extraer la ciudad de cada POI al geocodificar, con fallback
  `address.city → address.town → address.village → address.municipality → null`
  (extracción **client-side**, sobre la respuesta de Nominatim que `PoiForm`
  ya pedía con `addressdetails=1` desde HU-2.1 — no hizo falta tocar la
  llamada). CUANDO Nominatim no devuelve ninguno, el POI se guarda igual con
  `city` en `null`.
- El sistema DEBE permitir filtrar por una o más categorías a la vez
  (chips multi-select) y por una ciudad (de una lista de ciudades presentes
  entre los POIs del viaje, calculada dinámicamente **en el cliente** a
  partir de los POIs ya cargados — sin endpoint nuevo).
- CUANDO se combinan ambos filtros, el sistema DEBE mostrar solo los POIs que
  cumplen las dos condiciones (AND).
- El filtro se aplica igual en la solapa Lugares y en la solapa Mapa, y **se
  mantiene al cambiar entre ellas** — persistido en `sessionStorage` por
  viaje (`usePoiFilters`), ya que son rutas/páginas separadas, no hermanos en
  memoria dentro de un mismo componente.
- El sistema DEBE permitir limpiar los filtros.
- Los alojamientos (HU-8.6) heredan `city` del alojamiento en su POI vinculado.

---

## Épica 3 — Presupuesto

> Controlar cuánto se planea gastar y cuánto se gastó, por categoría.
> Tablas ya existentes: `budget_categories`, `expenses`. `trips` ya tiene `total_budget` y `currency_code`.

### HU-3.1 — Presupuesto total del viaje ✅
**Como** viajero, **quiero** fijar un presupuesto total y la moneda, **para** tener una referencia.

- El sistema permite definir `total_budget` y `currency_code` al crear/editar el viaje.
- El sistema DEBE mostrar el gasto acumulado contra el presupuesto total (barra de progreso + resto).

### HU-3.2 — Categorías de presupuesto ✅
**Como** viajero, **quiero** repartir el presupuesto en categorías (transporte, comida, alojamiento…), **para** un control más fino.

- El sistema DEBE permitir crear categorías con un monto asignado (`POST /api/budget-categories`).
- El nombre de categoría DEBE ser único dentro del viaje.
- El sistema NO DEBE permitir eliminar una categoría que tenga gastos.

### HU-3.3 — Registrar un gasto ✅
**Como** viajero, **quiero** anotar un gasto con monto, categoría y fecha, **para** llevar la cuenta.

- El sistema DEBE pedir monto, moneda, categoría y fecha como obligatorios (la moneda hereda la del viaje).
- El sistema DEBE permitir seleccionar el método de pago: efectivo, tarjeta de crédito, tarjeta de débito, transferencia, billetera digital u otro.
- El sistema DEBE permitir asociar el gasto a una actividad (opcional).
- El sistema DEBE permitir una descripción opcional del gasto.
- 🆕 *(2026-09-11)* El sistema DEBE permitir indicar si un gasto está pagado
  o no (`expenses.is_paid`), al crearlo o editarlo. Un gasto nuevo DEBE
  quedar marcado como **pagado** por defecto (`is_paid` default `true` a
  nivel de columna) — los gastos ya existentes antes de este ajuste quedan
  pagados automáticamente, mismo comportamiento implícito que ya tenían.

### HU-3.4 — Resumen de gastos ✅
**Como** viajero, **quiero** ver gastado vs. asignado por categoría y en total, **para** saber cómo voy.

- El sistema DEBE mostrar, por categoría: asignado, gastado y diferencia (`GET /api/trips/:id/budget`).
- El sistema DEBE marcar las categorías excedidas (rojo + "Excedido").
- 🆕 *(2026-09-11)* El sistema DEBE seguir calculando "Gastado" (y el
  "Resto" disponible contra el presupuesto) como la suma de **todos** los
  gastos, pagados y pendientes — sin cambios respecto al comportamiento
  anterior. El sistema DEBE mostrar además un total "Pendiente" informativo,
  en la misma línea donde se muestra "Gastado", con la suma de los gastos
  no pagados (`is_paid = false`); no participa en el cálculo del disponible.
  Los gastos no pagados se marcan visualmente en el listado con un chip
  "Pendiente".

### HU-3.5 — Multi-moneda 💭
**Como** viajero, **quiero** cargar gastos en distintas monedas y verlos convertidos, **para** un total real.

- 💭 Conversión con tipo de cambio (manual o vía servicio).

---

## Épica 4 — Offline

> Usar la app sin conexión (típico en viaje) y sincronizar al volver.
> Tabla ya existente: `sync_logs`. Deps del frontend: `sql.js`, `localforage`.

### HU-4.1 — Consultar y editar sin conexión 💭
**Como** viajero, **quiero** ver y modificar mi itinerario sin internet, **para** usarlo durante el viaje.

- El sistema DEBE guardar una copia local del viaje abierto.
- El sistema DEBE permitir crear/editar/eliminar días y actividades offline.

### HU-4.2 — Sincronizar al recuperar conexión 💭
**Como** viajero, **quiero** que mis cambios offline suban solos al reconectar, **para** no perder nada.

- CUANDO vuelve la conexión, el sistema DEBE enviar los cambios pendientes registrados en `sync_logs`.
- El sistema DEBE versionar las entidades para detectar cambios concurrentes.

### HU-4.3 — Resolución de conflictos 💭
**Como** viajero, **quiero** decidir qué versión gana cuando hay un conflicto, **para** no perder cambios importantes.

- CUANDO la versión local y la del servidor divergen, el sistema DEBE marcar el conflicto y pedir resolución.

### HU-4.4 — Indicador de estado 💭
**Como** viajero, **quiero** ver si estoy online/offline y si hay cambios sin sincronizar, **para** saber en qué estado está mi plan.

---

## Épica 5 — Versión Mobile 💭

> App React Native con paridad de funcionalidad del itinerario y modo offline.
> Sin planificación detallada todavía.

- HU-5.1 — Itinerario completo en la app mobile.
- HU-5.2 — Mapa y POIs en mobile.
- HU-5.3 — Offline-first nativo.

---

## Épica 6 — Documentos

> Adjuntar archivos al viaje o a una actividad (reservas, pasajes, vouchers,
> boarding pass, entradas). Tabla `documents` (ya tenía `activity_id`).
> Storage: **Vercel Blob** en modo privado; cada descarga pasa por
> `GET /api/documents/:id/download` (detrás de `requireAuth`) que hace streaming
> del archivo — la URL del blob nunca sale del servidor.

### HU-6.1 — Adjuntar un documento ✅
**Como** viajero, **quiero** subir un archivo a un viaje (y opcionalmente a una actividad), **para** tener la documentación junta.

- El sistema DEBE aceptar solo PDF, Word (.doc/.docx) e imágenes (JPG/PNG),
  validando el **tipo MIME real** (magic bytes), no solo la extensión.
- El sistema DEBE rechazar archivos > 5 MB **antes** de subirlos a Blob.
- El sistema DEBE guardar en `documents`: título, nombre original, tipo MIME,
  tamaño, URL del blob, `trip_id` (obligatorio) y `activity_id` (opcional,
  validado contra el mismo viaje).
- Sin `BLOB_TP_READ_WRITE_TOKEN`, los endpoints de documentos responden 503
  (fail-closed) y el resto de la app sigue funcionando.

### HU-6.2 — Ver y descargar documentos ✅
**Como** viajero, **quiero** abrir o bajar los documentos adjuntos, **para** consultarlos.

- El sistema DEBE listar los documentos del viaje (`GET /api/trips/:id/documents`),
  incluyendo el título de la actividad asociada si corresponde.
- El sistema DEBE permitir descargar cada documento; el archivo se sirve por
  streaming a través de la API autenticada (store privado).

### HU-6.3 — Eliminar un documento ✅
- El sistema DEBE pedir confirmación.
- El sistema DEBE hacer **borrado físico**: elimina la fila de `documents` **y**
  el archivo en Vercel Blob (no tiene sentido guardar un blob huérfano).

### HU-6.4 — Documentos asociados a una actividad 🟡
**Como** viajero, **quiero** adjuntar uno o más documentos a una actividad
(p. ej. los boarding pass de la actividad "Vuelo ..." o las entradas a un museo),
**para** tenerlos a mano en el momento de esa actividad.

- ✅ Una actividad PUEDE tener 0..N documentos asociados (`documents.activity_id`).
- ✅ **Independiente**: la pantalla de Documentos permite elegir, al subir, una
  actividad del viaje a la que asociar el archivo.
- 🔜 **Desde la actividad**: sección para subir/quitar documentos dentro del
  formulario de actividad, sin salir de él.
- 🔜 En la ficha del día, indicar si una actividad tiene documentos adjuntos
  y permitir abrirlos / descargarlos desde ahí.
- 🔜 Eliminar una actividad DEBE borrar sus documentos (fila + blob, como HU-6.3).
  Hoy el documento queda: sigue en el viaje pero sin actividad asociada.

---

## Épica 7 — Seguridad y acceso

> Hoy la app no tiene autenticación: cualquiera con la URL ve y edita todo.
> Objetivo: **pasa / no pasa**. Autenticación con Google, una lista de correos
> habilitados en configuración, sin roles. Todas las personas habilitadas
> comparten los mismos datos (no hay dueño por viaje).

**Decisiones de diseño**

- Login con Google Identity Services (botón "Sign in with Google" → ID token).
- El backend verifica el ID token de Google (firma vía JWKS, `aud` = nuestro
  client id, `email_verified`) y, si el correo está habilitado, emite un **JWT
  de sesión propio** (firmado con `JWT_SECRET`, expiración configurable).
- La lista de habilitados vive en `ALLOWED_EMAILS` (variable de entorno, correos
  separados por coma). Sin tabla de usuarios, sin panel de admin.
- Fail-closed: sin `ALLOWED_EMAILS` o sin `JWT_SECRET` válido, nadie entra.

### HU-7.1 — Iniciar sesión con Google ✅
**Como** persona habilitada, **quiero** entrar con mi cuenta de Google, **para** no crear otra contraseña.

- El sistema DEBE mostrar "Iniciar sesión con Google" en una pantalla de login.
- El backend DEBE verificar el ID token de Google (firma + `aud` + `email_verified`).
- CUANDO el correo está en `ALLOWED_EMAILS`, el sistema DEBE crear la sesión y dar acceso.
- CUANDO el correo NO está habilitado, el sistema DEBE negar el acceso con un mensaje claro y NO crear sesión.

### HU-7.2 — Lista de correos habilitados ✅
**Como** dueño de la instancia, **quiero** definir qué cuentas pueden entrar, **para** controlar el acceso sin tocar código.

- El sistema DEBE leer `ALLOWED_EMAILS` (env var, correos separados por coma), comparando sin distinguir mayúsculas ni espacios.
- CUANDO `ALLOWED_EMAILS` está vacía o ausente, el sistema DEBE negar todo acceso (fail-closed).

### HU-7.3 — Sesión persistente ✅
**Como** usuario, **quiero** seguir logueado entre visitas, **para** no autenticarme cada vez.

- AL iniciar sesión, el backend DEBE emitir un JWT de sesión propio (expiración `JWT_EXPIRES_IN`, default 7 días).
- El frontend DEBE guardar el token y adjuntarlo como `Authorization: Bearer` en cada request.
- AL abrir la app, el sistema DEBE restaurar la sesión si el token sigue vigente (`GET /api/auth/me`).

### HU-7.4 — Cerrar sesión ✅
**Como** usuario, **quiero** poder salir, **para** dejar el equipo seguro.

- El sistema DEBE ofrecer "Cerrar sesión": borra el token local y vuelve al login.

### HU-7.5 — API protegida ✅
**Como** dueño, **quiero** que la API no responda a nadie sin sesión, **para** que los datos no queden expuestos.

- Todos los endpoints bajo `/api` (excepto `/api/auth/login`, `/api/auth/me` y `/api/health`) DEBEN requerir un JWT de sesión válido.
- CUANDO el token falta, expiró o es inválido, el sistema DEBE responder 401.
- CUANDO el frontend recibe 401, DEBE limpiar la sesión y mandar al login.

### HU-7.6 — Revocar acceso ✅
**Como** dueño, **quiero** poder sacarle el acceso a alguien, **para** responder a bajas o incidentes.

- CUANDO quito un correo de `ALLOWED_EMAILS`, el sistema DEBE negar el acceso en el próximo login.
- `requireAuth` **y** `GET /api/auth/me` revalidan la allowlist en cada request,
  así que quitar un correo corta el acceso al siguiente request, sin esperar a
  que expire el token *(ver HU-7.11)*.

### HU-7.7 — No arrancar inseguro ✅
**Como** dueño, **quiero** que la app se niegue a correr mal configurada, **para** no exponerme por un descuido.

- En producción, el sistema DEBE requerir `JWT_SECRET_TP` y negarse a autenticar con el valor de ejemplo (responde 503).
- `GOOGLE_CLIENT_ID_TP` y `ALLOWED_EMAILS_TP` DEBEN venir de config, nunca hardcodeados.
- `.env.example` DEBE documentar `GOOGLE_CLIENT_ID_TP`, `ALLOWED_EMAILS_TP`, `JWT_SECRET_TP`.

### Hardening general ✅

- **HU-7.8 ✅** — Rate limiting: 20 req/15 min en `/api/auth/login`, 300 req/min
  en el resto de `/api` (store en memoria — best-effort en serverless).
- **HU-7.9 ✅** — `helmet()` en la API; headers de seguridad + CSP en el sitio
  estático vía `vercel.json` (`X-Frame-Options: DENY`, HSTS, `nosniff`,
  `Referrer-Policy`, CSP que habilita GIS de Google). CORS ya restringido a un
  origen (no wildcard); en Vercel front y API comparten origen.
- **HU-7.10 ✅** — `express.json({ limit: '100kb' })`; workflow de CI
  (`.github/workflows/ci.yml`) que buildea y corre `npm audit --omit=dev
  --audit-level=high` en back y front. De paso: `uuid` reemplazado por
  `crypto.randomUUID()` (una dependencia menos), Express 4 → 5 y `npm audit fix`
  → 0 vulnerabilidades de producción.
- **HU-7.11 ✅** — `requireAuth` revalida la allowlist en cada request: sacar un
  correo de `ALLOWED_EMAILS_TP` corta el acceso al próximo request (no hay que
  esperar a que expire el token).

### Revisión de seguridad (2026-09-10) ✅

Corregidos: inyección SQL por nombre de columna / mass-assignment en
`PUT /api/trips` y `PUT /api/activities` (whitelist de campos + validación de
identificadores en `db/database.js`); fuga de `error.message` en producción
(helper `serverError`); URLs `javascript:`/`data:` en campos de enlace
(sanitización back + front); `GET /api/auth/me` ahora revalida la allowlist.
Detalle completo, protecciones y riesgos aceptados en
[`docs/seguridad.md`](seguridad.md).

---

## Épica 8 — Alojamientos

> Registrar dónde se duerme en cada viaje. CRUD de alojamientos, cada uno con
> su rango de estadía; el pago se anota como un gasto vinculado (Épica 3). Los
> días del itinerario muestran una etiqueta con la ciudad correspondiente,
> calculada a partir de las fechas de entrada/salida.

**Decisiones de diseño**

- Tabla nueva `accommodations` (1 viaje → N alojamientos, borrado lógico).
- `check_in` / `check_out` se guardan como fecha + hora (`YYYY-MM-DDTHH:MM`).
- El pago es una sección opcional dentro del formulario del alojamiento
  (monto + categoría de presupuesto + método de pago). Al guardar, crea /
  actualiza un `expenses` con `accommodation_id` apuntando al alojamiento;
  la moneda hereda la del viaje y la fecha del gasto = fecha de check-in.
- Eliminar un alojamiento hace borrado lógico del alojamiento **y** de su
  gasto vinculado.
- La ciudad de un día = la de todo alojamiento cuyo rango `[check_in, check_out]`
  (por fecha) contiene ese día. Normalmente una; en un día de transición
  (se deja uno y se entra en otro) son dos.
- Cada alojamiento con dirección resuelta mantiene un POI vinculado en el mapa
  (HU-8.6), con el mismo patrón que el gasto y las actividades de check-in/out.

### HU-8.1 — Alta de alojamiento ✅
**Como** viajero, **quiero** cargar un alojamiento con sus datos, **para** tener todo junto.

- El sistema DEBE pedir como obligatorios: nombre, fecha y hora de entrada,
  fecha y hora de salida, dirección y ciudad.
- El sistema DEBE permitir opcionalmente: teléfono, email, link a la plataforma
  donde se contrató.
- CUANDO la salida no es posterior a la entrada, el sistema DEBE rechazar con
  un error claro.

### HU-8.2 — Listar / editar / eliminar alojamientos ✅
**Como** viajero, **quiero** ver y mantener los alojamientos del viaje, **para** que reflejen la realidad.

- El sistema DEBE listar los alojamientos del viaje ordenados por fecha de entrada.
- El sistema DEBE permitir editar todos los campos y eliminar (borrado lógico, con confirmación).

### HU-8.3 — Registrar el pago del alojamiento ✅
**Como** viajero, **quiero** anotar cuánto pagué por un alojamiento, **para** que impacte en el presupuesto.

- El formulario del alojamiento DEBE tener una sección "Pago" opcional: monto,
  categoría de presupuesto y método de pago.
- CUANDO se completa el monto, el sistema DEBE crear/actualizar un gasto
  vinculado (`accommodation_id`), con moneda del viaje y fecha = check-in.
- CUANDO se borra el monto, el sistema DEBE borrar (lógico) el gasto vinculado.
- AL eliminar el alojamiento, el sistema DEBE borrar (lógico) su gasto vinculado.
- El gasto vinculado DEBE aparecer en la vista de Presupuesto como cualquier otro.

### HU-8.4 — Etiqueta de ciudad en los días ✅
**Como** viajero, **quiero** ver en cada día del itinerario en qué ciudad estoy, **para** entender de un vistazo cómo se mueve el viaje.

- El sistema DEBE mostrar, en la tarjeta de cada día, la ciudad del alojamiento
  cuyo rango de fechas contiene ese día.
- CUANDO un día está cubierto por dos alojamientos (se deja uno y se entra en
  otro), el sistema DEBE mostrar ambas ciudades (ej. "Kioto → Osaka").
- CUANDO ningún alojamiento cubre el día, la tarjeta NO muestra etiqueta de ciudad.

### HU-8.5 — Actividades de check-in / check-out ✅
**Como** viajero, **quiero** ver el check-in y el check-out como actividades en el itinerario, **para** no olvidarme de esos momentos.

- AL crear o editar un alojamiento, el sistema DEBE mantener dos actividades
  vinculadas: "Check-in en {nombre}" el día de la entrada (con su hora) y
  "Check-out en {nombre}" el día de la salida.
- Editar el alojamiento (nombre, fechas, horas) DEBE actualizar esas actividades
  en su lugar, sin duplicarlas.
- AL eliminar el alojamiento, el sistema DEBE borrar (lógico) esas actividades.
- CUANDO la fecha de entrada/salida cae fuera del rango del viaje (no hay día),
  esa actividad se omite.
- El itinerario DEBE marcar estas actividades como generadas por el alojamiento.

### HU-8.6 — POI vinculado al alojamiento ✅
**Como** viajero, **quiero** que mi alojamiento aparezca automáticamente como POI en el mapa, **para** verlo junto con el resto de los lugares sin cargarlo dos veces.

- AL crear o editar un alojamiento, el sistema DEBE mantener un POI vinculado
  (`pois_saved.accommodation_id`) con categoría "alojamiento", nombre = nombre
  del alojamiento y ubicación = la que resuelve el buscador de direcciones del
  formulario (mismo mecanismo Nominatim que HU-2.1).
- Editar el nombre o la dirección DEBE actualizar el POI en su lugar, sin
  duplicarlo; si no se resolvió una ubicación, el alojamiento se guarda igual
  pero sin POI.
- AL eliminar el alojamiento, el sistema DEBE borrar (lógico) el POI vinculado.
- El POI vinculado aparece en `GET /api/trips/:id/pois` como cualquier otro,
  marcado "generado por el alojamiento"; en la pantalla de Lugares su nombre y
  ubicación son de solo lectura (solo se editan notas y enlace) y no se puede
  borrar desde ahí.
- 🆕 *(2026-09-11)* AL resolver la dirección del alojamiento por geocoding y el
  campo Ciudad estar vacío, el sistema DEBE completarlo automáticamente con la
  ciudad extraída (`city → town → village → municipality`), sin sobrescribir un
  valor ya cargado por el viajero; sigue siendo editable antes de guardar.

## Épica 9 — Links de interés

> Épica nueva y aislada: no depende de ninguna otra épica ni la bloquea. Tres
> tablas nuevas (`interest_links`, `tags`, `interest_link_tags`), único punto
> de contacto con el resto del esquema es `trip_id`. No se asocia a días,
> actividades ni POIs — es una lista simple de referencias (foros, redes,
> webs), sin geolocalización ni planificación temporal.

### HU-9.1 — Guardar un link de interés ✅
**Como** viajero, **quiero** guardar un link con un título y tags, **para** tener a mano publicaciones útiles que encontré en foros, redes o webs.

- El sistema DEBE pedir link (URL) y título/nota corta como obligatorios; el
  link se valida con el mismo saneo http(s) que POIs/alojamientos/actividades
  (`sanitizeHttpUrl` — rechaza `javascript:`/`data:`).
- El sistema DEBE permitir agregar uno o más tags a cada link (opcional).
- El sistema DEBE sugerir tags ya usados en el mismo viaje mediante
  autocompletar, sin impedir cargar un tag nuevo.
- Los tags se normalizan (trim + minúsculas) y son únicos por viaje
  (`UNIQUE(trip_id, name)`) — "Comida" y "comida" resuelven al mismo tag, no
  se duplican.
- Los links pertenecen a un viaje (`trip_id` obligatorio).

### HU-9.2 — Ver, editar y eliminar links ✅
**Como** viajero, **quiero** ver, editar y eliminar mis links guardados, **para** mantener la lista organizada.

- El sistema DEBE listar los links del viaje, mostrando título y tags.
- El sistema DEBE permitir editar título, link y tags (reemplaza el conjunto
  de tags completo, misma resolución find-or-create que al crear).
- El sistema DEBE pedir confirmación antes de eliminar.
- El sistema DEBE hacer borrado lógico (`deleted_at`, mismo patrón del resto
  del proyecto). Los tags de un link eliminado **persisten** para reuso
  futuro, aunque ningún link los use en ese momento.

### HU-9.3 — Buscar por tag ✅
**Como** viajero, **quiero** buscar links por tag, **para** encontrar rápido lo que guardé sobre un tema puntual.

- El sistema DEBE permitir filtrar la lista de links por uno o más tags
  (chips multi-select, mismo estilo visual que los filtros de POIs de
  HU-2.7).
- CUANDO se seleccionan varios tags, el sistema DEBE mostrar los links que
  tengan **al menos uno** de los tags seleccionados (OR, no AND) — verificado
  con test.
- El sistema DEBE permitir limpiar el filtro para volver a ver todos los
  links.
- Filtrado **client-side**: los links y tags del viaje ya están cargados de
  entrada, no hace falta otro request por cada cambio de filtro (mismo
  criterio que HU-2.7 para ciudades).
