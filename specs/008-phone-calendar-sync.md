# Sincronización Con El Calendario Del Teléfono Android

Estado: implementación local actualizada; lint, typecheck, Vitest, JUnit y
build Android aprobados. El 2 de octubre de 2026 se instaló el APK sobre la
app existente del POCO F6 y se abrió la interfaz. Llegó al formulario de inicio
de sesión, que quedó mostrando «Iniciando sesión…»; no continué esa sesión. Los
permisos de calendario siguen denegados y no se modificaron calendarios ni
eventos. La compatibilidad con POCO Calendar, Huawei Health y Watch Fit 5 Pro
sigue pendiente de una prueba física autenticada.

## 1. Objetivo

La app Android de Karenda copiará los eventos académicos y personales de la
cuenta activa a calendarios locales del proveedor de calendario Android. La
copia debe aparecer en las apps del teléfono que lean Calendar Provider, sin
necesitar una cuenta de Google ni un servidor de calendario externo.

Se creará un calendario visible por asignatura y por grupo personal, con el
nombre y color de cada categoría. Así se conservan los grupos que la persona ya
organiza en Karenda y puede activar u ocultar cada calendario desde POCO
Calendar.

## 2. Decisiones Y Límites

- Android Calendar Provider es el destino. Los calendarios usan
  `ACCOUNT_TYPE_LOCAL`; no se sincronizan con un proveedor remoto.
- Karenda es la fuente de verdad. La sincronización es unidireccional y las
  copias de Karenda se escriben como solo lectura para las apps de calendario.
- No se implementa Google Calendar, CalDAV, una función Edge ni una migración
  InsForge en esta tarea. La app consulta los datos ya existentes mediante la
  sesión y RLS de InsForge.
- El alcance son los registros `CalendarEvent` académicos y personales. No se
  exportan notas, borradores de IA ni proyecciones de hábitos/tareas
  recurrentes.
- Al conectar, se piden permisos Android de lectura y escritura del calendario.
  La solicitud ocurre después de una acción explícita de la persona.
- Los identificadores estables de Karenda se guardan en `SYNC_DATA1` del
  proveedor. Al sincronizar se actualizan las filas existentes, se eliminan
  copias cuyo evento ya no existe en Karenda y no se modifican calendarios ni
  eventos ajenos a Karenda.
- El título de la copia conserva primero el título del evento y agrega al final
  ` · ` y la etiqueta de categoría. Para asignaturas se usa la abreviación,
  luego el código y después el nombre como alternativa; para grupos personales
  se usa el nombre del grupo. Los eventos sin asociación válida usan
  `Académico` o `Personal`. La descripción y el lugar se copian como texto. El
  estado pendiente/completado y el formato Markdown no tienen una representación
  equivalente y no se sincronizan como metadatos.
- Para eventos de todo el día, Karenda considera inclusiva la fecha de término;
  Android recibe `DTEND` exclusivo y UTC. Los eventos con hora conservan sus
  instantes. Si un evento puntual no tiene término, la copia ocupa un minuto
  para satisfacer el proveedor.
- No se crean recordatorios automáticos. Karenda todavía no almacena avisos por
  evento, por lo que la sincronización muestra el evento pero no promete una
  alerta del teléfono o del reloj.
- La sincronización se ejecuta al activarla, al guardar cambios en eventos,
  al volver a Karenda y manualmente. Mientras la pantalla de calendario
  permanece abierta, se reintenta cada 15 minutos. Android puede pausar la app
  en segundo plano; con Karenda cerrada, una edición remota se refleja al abrir
  la app nuevamente.
- En navegador web se explica que la conexión directa requiere abrir la app
  Android instalada.

## 3. Requisitos Funcionales

- **RF-PCS-01:** La persona puede conectar Karenda con un calendario local del
  teléfono Android desde el calendario de Karenda.
- **RF-PCS-02:** La app crea calendarios locales separados por asignatura y
  grupo personal, más categorías de respaldo para eventos sin relación válida.
  Cada calendario conserva un nombre y color legibles.
- **RF-PCS-03:** Se sincronizan todos los eventos persistidos de la cuenta
  activa, con título, inicio, término, duración, ubicación y descripción
  cuando existan.
- **RF-PCS-04:** Las fechas de todo el día mantienen el mismo rango civil local
  que Karenda. Las horas concretas mantienen el mismo instante.
- **RF-PCS-05:** La repetición de una sincronización actualiza cada copia en su
  lugar. Un cambio de categoría mueve la copia al calendario nuevo; borrar el
  evento en Karenda elimina solo su copia administrada.
- **RF-PCS-06:** La persona puede sincronizar manualmente, pausar la
  sincronización automática y consultar el último resultado.
- **RF-PCS-07:** La sincronización automática se ejecuta después de cambios
  hechos en Karenda, al volver a la app y cada 15 minutos mientras la pantalla
  de calendario está activa.
- **RF-PCS-08:** Rechazar el permiso no modifica el calendario del teléfono y
  muestra pasos en español para permitirlo desde los ajustes de Android.
- **RF-PCS-09:** La app web explica en español que esta integración requiere
  la app Android.
- **RF-PCS-10:** La interfaz aclara que los cambios del teléfono no se importan
  a Karenda y que los recordatorios no se copian porque no existen en el modelo
  de eventos.

## 4. Criterios De Aceptación

- **CA-PCS-01:** Al conectar, Android solicita permiso de calendario y Karenda
  crea calendarios locales visibles, sin pedir acceso a Google Calendar.
- **CA-PCS-02:** Eventos académicos y personales aparecen en el calendario
  local asociado a su asignatura o grupo. El título original aparece primero y
  la etiqueta de categoría al final, por ejemplo `Control 1 · ALG` o
  `Cita médica · Salud`. Los eventos sin asociación usan el calendario de
  respaldo correspondiente y terminan con `Académico` o `Personal`.
- **CA-PCS-03:** Los cambios de título, hora, duración, descripción, lugar o
  categoría actualizan la misma fila local sin duplicar eventos.
- **CA-PCS-04:** Los eventos eliminados en Karenda desaparecen de la copia
  local; una sincronización no borra ni actualiza filas ajenas a Karenda.
- **CA-PCS-05:** Los eventos de todo el día que terminan el día indicado no se
  extienden al día siguiente. Los eventos con hora mantienen la hora local del
  POCO F6.
- **CA-PCS-06:** Un permiso denegado produce un estado recuperable y no deja
  sincronizaciones incompletas presentadas como exitosas.
- **CA-PCS-07:** La sincronización manual, al volver a la app y después de un
  cambio guardado actualiza el estado con cantidad y hora en español.
- **CA-PCS-08:** La pantalla informa claramente que no hay sincronización
  mientras Karenda está cerrada y que no se generan alarmas automáticas.
- **CA-PCS-09:** Los tests cubren mapeo de campos y fechas, categorías,
  deduplicación de IDs locales, borrados obsoletos, errores de permisos, estado
  de conexión, repetición pendiente y mensajes de UI.
- **CA-PCS-10:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`,
  `:app:testDebugUnitTest` y `npm run android:build` pasan. La
  comprobación final de POCO Calendar, Huawei Health y Watch Fit 5 Pro queda
  registrada como prueba física separada.

## 5. Trazabilidad De Implementación

| Requisito | Diseño/contrato | Código previsto | Verificación |
| --- | --- | --- | --- |
| RF-PCS-01, RF-PCS-08 | Permiso Android pedido al conectar | Plugin Capacitor y panel de calendario | Tests del panel, lint y build Android; permiso físico pendiente |
| RF-PCS-02 | Calendario local por categoría | `PhoneCalendarPlugin` | Mapper y JUnit aprobados; proveedor y visualización física pendientes |
| RF-PCS-03 a RF-PCS-05 | Mapeo y clave estable de evento | `phoneCalendarMapper`, `PhoneCalendarEventPlan`, servicio Android | Vitest y JUnit aprobados; prueba de proveedor pendiente |
| RF-PCS-06 a RF-PCS-07 | Activación, manual, cambios y reanudación | Panel de sincronización y servicio | Tests del panel y del servicio |
| RF-PCS-09 a RF-PCS-10 | Límites y estados en español | Panel de sincronización | Tests de UI |
| CA-PCS-01 a CA-PCS-08 | Flujos y límites de plataforma | Plugin Android, servicios y panel | Vitest, typecheck, lint y build Android aprobados; prueba física pendiente |
| CA-PCS-09 a CA-PCS-10 | Suite y cierre de tarea | `PhoneCalendarEventPlanTest`, Vitest, builds y tareas 182–187 | Checks locales aprobados; POCO/reloj pendiente |

## 6. Referencias Técnicas

- Android documenta calendarios locales con `ACCOUNT_TYPE_LOCAL` y operaciones
  de Calendar Provider para aplicaciones: [Calendar Provider overview](https://developer.android.com/identity/providers/calendar-provider?hl=es-419)
  y [CalendarContract.Calendars](https://developer.android.com/reference/android/provider/CalendarContract.Calendars).
- La guía vigente de Huawei para sincronizar el calendario del teléfono con
  Watch Fit 5 Pro debe revisarse al probar el dispositivo; en teléfonos de
  terceros Huawei Health puede limitar la agenda del reloj a los próximos siete
  días y requiere permiso de calendario.

## 7. Registro De Rama

- Rama Git: `feature/008-phone-calendar-sync`.
- Worktree: `C:/Users/juani/Desktop/Programacion/karenda-wt-phone-calendar-sync`.
- Base: `origin/codex/release-all-changes`, commit `cecbcc14b1a509137f83e8277cb0f8d26b94e170`.
- Destino previsto: `codex/release-all-changes`; depende de la app Android de
  `specs/005-android-app.md`.
- Backend InsForge: proyecto principal `karenda`; no se crea rama porque no se
  cambian esquema, funciones ni configuración de backend.
- Estado: automatización lista; validación física pendiente; sin commit ni
  integración. Base de integración `codex/release-all-changes` verificada
  localmente hasta `cecbcc14b1a509137f83e8277cb0f8d26b94e170`.
