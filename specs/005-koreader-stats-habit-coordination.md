# Coordinación De Estadísticas De KOReader Con Hábitos

Estado: implementado localmente; requiere aplicar y verificar la migración y las
funciones Edge en una rama de InsForge antes de considerarse desplegado.

## 1. Objetivo Y Alcance

Karenda recibirá desde el mismo Kindle/KOReader las estadísticas diarias de
páginas leídas, tiempo de lectura, libros terminados y cartas revisadas de Anki,
y las reflejará en hábitos cuantitativos. La fuente persistente seguirá siendo
InsForge. Los meses y años se calcularán a partir de los registros diarios en
Karenda; no se crea una tabla de agregados.

La configuración se realiza en la web. La persona elige un dispositivo con
`write:habit_logs` y, para cada métrica, reutiliza un hábito compatible o crea
uno nuevo indicando nombre, meta, unidad y fecha de inicio. No hay vinculación
automática por coincidencia de nombres.

Quedan fuera del alcance: cambios al snapshot v1, edición de SimpleUI, envío de
notas, AnkiConnect de escritorio, notificaciones externas y datos de libros que
KOReader no pueda confirmar como terminados.

## 2. Métricas Y Unidades

| Clave | Fuente | Tipo Karenda | Unidad canónica enviada | Regla |
| --- | --- | --- | --- | --- |
| `reading_pages` | `statistics.sqlite3` | `count` | `pages` | páginas distintas por día |
| `reading_minutes` | `statistics.sqlite3` | `duration` | `minutes` | suma de duración por día; la UI puede mostrar horas |
| `books_completed` | `statistics.sqlite3` | `count` | `books` | solo libros cuyo total de páginas está confirmado |
| `anki_cards_reviewed` | proveedor opcional de Anki | `count` | `cards` | cartas revisadas por día; proveedor ausente no equivale a cero |

La vinculación conserva `target_unit` y `conversion_factor`. El backend convierte
la observación antes de guardarla en `habit_logs`; por ejemplo, minutos a horas
usa `1/60`.

## 3. Persistencia Y Fuente De Verdad

`koreader_habit_links` relaciona propietario, hábito, dispositivo, métrica,
unidades, zona horaria, estado y última sincronización. Un único vínculo activo
por métrica existe por cuenta. `habit_logs.koreader_link_id` identifica el
vínculo que escribió un registro importado.

Las filas importadas usan `source = koreader`, una fecha civil `YYYY-MM-DD` y
`external_id = <link_id>:<local_date>`. Las filas manuales siguen disponibles.
Para evaluar y sumar un hábito, si hay una fila de KOReader y otra manual en la
misma fecha, prevalece KOReader; si no la hay, prevalece el último registro
manual. Esto evita doble conteo y permite que el registro manual sirva de
respaldo antes de la primera sincronización.

## 4. API Del Dispositivo

La función `karenda-koreader-habit-sync` solo acepta tokens no revocados, no
expirados y con `write:habit_logs`.

`GET` devuelve la configuración activa:

```json
{
  "schema_version": 1,
  "timezone": "America/Santiago",
  "links": [
    {
      "id": "uuid",
      "metric_key": "reading_pages",
      "source_unit": "pages",
      "target_unit": "páginas",
      "conversion_factor": 1,
      "timezone": "America/Santiago",
      "habit_id": "uuid",
      "start_date": "2026-01-01",
      "end_date": null
    }
  ]
}
```

`POST` recibe un lote idempotente:

```json
{
  "schema_version": 1,
  "timezone": "America/Santiago",
  "observations": [
    {
      "link_id": "uuid",
      "local_date": "2026-09-09",
      "value": 42,
      "external_id": "uuid:2026-09-09"
    }
  ]
}
```

El servidor resuelve propietario y hábito desde el vínculo, valida zona,
unidad, rango de fechas, tipo de seguimiento y enteros de métricas de cantidad.
Repetir el mismo día y vínculo actualiza de forma idempotente; cambiar el
identificador externo produce conflicto. Una observación con valor cero elimina
la fila importada de ese día para corregir una fuente que ya no informa
actividad.

## 5. Configuración Web

La función `karenda-koreader-habit-links` expone métricas, dispositivos y
vínculos para la cuenta autenticada. Su RPC de configuración crea el hábito y
su primera versión de regla diaria cuando se solicita un vínculo nuevo. La
meta se exige antes de habilitar la importación. Un hábito existente debe ser
cuantitativo y compatible con la métrica.

La página Dispositivos permite incluir `write:habit_logs` al crear el código de
emparejamiento y regenerar un token de solo lectura para habilitar estadísticas.
Revocar el token o pausar el vínculo detiene futuras escrituras sin borrar el
historial.

## 6. Comportamiento Del Plugin

El plugin lee la base oficial `statistics.sqlite3` de KOReader sin modificarla.
La lectura diaria agrupa páginas distintas y duración por día civil local. Los
libros terminados se cuentan una sola vez al detectar por primera vez que las
páginas distintas leídas alcanzan el total del libro.

El proveedor de Anki es opcional y se carga mediante un adaptador con la forma
`getDailyStats(from_date, to_date, timezone)`. Si todavía no existe, la
sincronización de lectura continúa y la métrica de Anki queda pendiente sin
enviar ceros.

La primera sincronización cubre desde el 1 de enero del año civil actual hasta
hoy, recortada al inicio y fin de cada hábito. Las siguientes cubren hoy y los
siete días anteriores para aceptar correcciones tardías. Al reanudar KOReader,
si el dispositivo está despierto y hay conexión, se intenta la sincronización
en segundo plano. Los lotes pendientes se conservan en una cola local atómica
sin títulos, tokens ni contenido de libros y se reintentan posteriormente. Un
fallo de estadísticas no oculta ni invalida el snapshot de calendario y notas.

## 7. Seguridad Y Privacidad

El token solo viaja en la cabecera `Authorization: Bearer`; nunca se incorpora
a URLs, logs, snapshots ni la cola local. El scope de hábitos es independiente
de `read:snapshot` y `write:events`. RLS mantiene la lectura web por propietario
y la escritura directa autenticada limitada a registros manuales; la escritura
importada solo la realiza la ruta autorizada del dispositivo.

## 8. Criterios De Aceptación

- **CA-SH-01:** Un Kindle con solo `read:snapshot` recibe `403` al intentar
  sincronizar hábitos.
- **CA-SH-02:** La configuración permite reutilizar un hábito compatible o crear
  uno nuevo con meta explícita, y rechaza hábitos booleanos.
- **CA-SH-03:** Una observación diaria válida crea un único `habit_log` con
  `source = koreader`, vínculo, conversión y estado derivados.
- **CA-SH-04:** Repetir una observación no duplica; modificar su valor actualiza;
  cambiar su identificador produce conflicto.
- **CA-SH-05:** La evaluación y el total diario/mensual/anual no suman una fila
  manual y una importada del mismo día.
- **CA-SH-06:** KOReader hace backfill del año actual la primera vez, usa una
  ventana de siete días después y conserva lotes cuando no hay red.
- **CA-SH-07:** La ausencia del proveedor de Anki no crea ceros ni impide enviar
  páginas, tiempo o libros disponibles.
- **CA-SH-08:** Revocar token o vínculo bloquea escrituras futuras y conserva
  registros históricos.
- **CA-SH-09:** Ningún cambio escribe en archivos de SimpleUI ni en el snapshot
  v1.

## 9. Verificación

La verificación local requerida es `npm run typecheck`, `npm test -- --run`,
`npm run lint` y `npm run build`, más los specs Lua con el runtime de KOReader.
Antes de publicar la integración se debe aplicar la migración en una rama de
InsForge, revisar RLS y ejecutar una prueba autenticada con dos cuentas y un
token de dispositivo.
