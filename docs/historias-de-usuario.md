# Historias de Usuario — Trip Planner

Estado del backlog por épica. La app es de un solo usuario (sin autenticación),
así que el rol es siempre **viajero**.

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
- El sistema DEBE permitir hora de inicio, duración, lugar, descripción y enlace.

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

---

## Épica 2 — Mapa y POIs

> Guardar puntos de interés (lugares), verlos en un mapa y vincularlos al itinerario.
> Tablas ya existentes: `pois_saved`, `poi_categories`, `activity_pois`, `transport_modes`, `routes`.

### HU-2.1 — Guardar un POI 🔜
**Como** viajero, **quiero** guardar un lugar con nombre, categoría y coordenadas, **para** tenerlo a mano.

- El sistema DEBE pedir nombre, categoría y ubicación (lat/lng) como obligatorios.
- El sistema DEBE permitir dirección, notas y enlace.
- Los POI pertenecen a un viaje.

### HU-2.2 — Ver los POIs en un mapa 🔜
**Como** viajero, **quiero** ver todos los POIs del viaje en un mapa, **para** entender la geografía del plan.

- El sistema DEBE mostrar un marcador por POI, coloreado según su categoría.
- CUANDO se hace clic en un marcador, el sistema DEBE mostrar los datos del POI.

### HU-2.3 — Asociar POIs a una actividad 🔜
**Como** viajero, **quiero** vincular uno o más POIs a una actividad, **para** saber a dónde ir.

- El sistema DEBE permitir asociar POIs a una actividad con un orden (`sequence_order`).
- El sistema DEBE mostrar los POIs asociados en el detalle de la actividad.

### HU-2.4 — Gestionar categorías de POI 💭
**Como** viajero, **quiero** categorías con ícono y color, **para** clasificar los lugares.

- Existe un set inicial (atracción, estación, alojamiento, gastronomía, naturaleza, cultura, otro).
- 💭 Categorías personalizadas.

### HU-2.5 — Rutas entre POIs 💭
**Como** viajero, **quiero** definir cómo me muevo entre dos POIs de un día y cuánto tarda, **para** estimar tiempos.

- El sistema DEBE permitir crear una ruta entre dos POIs con modo de transporte y duración estimada.
- 💭 Cálculo automático de duración con un servicio externo.

---

## Épica 3 — Presupuesto

> Controlar cuánto se planea gastar y cuánto se gastó, por categoría.
> Tablas ya existentes: `budget_categories`, `expenses`. `trips` ya tiene `total_budget` y `currency_code`.

### HU-3.1 — Presupuesto total del viaje 🟡
**Como** viajero, **quiero** fijar un presupuesto total y la moneda, **para** tener una referencia.

- ✅ El sistema permite definir `total_budget` y `currency_code` al crear/editar el viaje.
- 🔜 El sistema DEBE mostrar el gasto acumulado contra el presupuesto total.

### HU-3.2 — Categorías de presupuesto 🔜
**Como** viajero, **quiero** repartir el presupuesto en categorías (transporte, comida, alojamiento…), **para** un control más fino.

- El sistema DEBE permitir crear categorías con un monto asignado.
- El nombre de categoría DEBE ser único dentro del viaje.

### HU-3.3 — Registrar un gasto 🔜
**Como** viajero, **quiero** anotar un gasto con monto, categoría y fecha, **para** llevar la cuenta.

- El sistema DEBE pedir monto, moneda, categoría y fecha.
- El sistema DEBE permitir asociar el gasto a una actividad (opcional).

### HU-3.4 — Resumen de gastos 🔜
**Como** viajero, **quiero** ver gastado vs. asignado por categoría y en total, **para** saber cómo voy.

- El sistema DEBE mostrar, por categoría: asignado, gastado y diferencia.
- El sistema DEBE marcar las categorías excedidas.

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

> Adjuntar archivos al viaje o a una actividad (reservas, pasajes, vouchers).
> Tabla ya existente: `documents`.

### HU-6.1 — Adjuntar un documento 💭
**Como** viajero, **quiero** subir un archivo a un viaje o actividad, **para** tener la documentación junta.

- El sistema DEBE guardar título, nombre de archivo, tipo y tamaño.
- El almacenamiento del archivo DEBE ser un blob store (Vercel Blob / S3), no el filesystem (Vercel es efímero).

### HU-6.2 — Ver y descargar documentos 💭
**Como** viajero, **quiero** abrir o bajar los documentos adjuntos, **para** consultarlos.

### HU-6.3 — Eliminar un documento 💭
- El sistema DEBE hacer borrado lógico y, aparte, limpiar el blob.
