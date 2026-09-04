# Seguimiento De Hábitos Y Tareas Recurrentes Web

Estado: implementación local completada, incluida la creación asistida con IA, y las migraciones `20260902120000` y
`20260902130000` promovidas al proyecto principal `karenda`; la prueba RLS entre
cuentas quedó verificada. El E2E autenticado sigue pendiente por falta de
credenciales de prueba.

Esta especificación extiende el MVP web definido en
`specs/001-web-mvp.md`. Solo aplica a Karenda Web. El plugin de KOReader no
mostrará ni modificará hábitos, registros ni tareas recurrentes en esta fase.

## 1. Contexto Y Objetivos

Karenda necesita una forma de registrar comportamientos, objetivos medibles y
tareas que vuelven a aparecer sin convertirlos artificialmente en eventos del
calendario. El módulo debe servir tanto para estudiar asignaturas como para
registrar lectura, episodios vistos, ejercicio u otras actividades personales.

La funcionalidad distinguirá explícitamente:

- **Hábito:** algo que se mide o se intenta mantener en el tiempo. Puede
  evaluarse por ocurrencia o mediante una meta flexible por periodo y puede
  tener estadísticas.
- **Registro de hábito:** una anotación de cumplimiento, omisión o valor
  cuantitativo en una fecha local.
- **Tarea recurrente:** un compromiso que vuelve a tener una próxima fecha hasta
  que se completa. Mantiene estados pendientes o vencidos, pero no participa en
  las estadísticas de hábitos.
- **Proyección de calendario:** una representación visual opcional y de solo
  lectura de un hábito o tarea recurrente en el calendario existente. No es un
  `Event` persistido.

### Objetivos

- Permitir configurar frecuencias comunes rápidamente y reglas personalizadas
  sin exigir sintaxis textual.
- Permitir hábitos booleanos, hábitos con cantidad y hábitos con duración.
- Diferenciar `Pendiente`, `Completado`, `Parcial`, `Omitido` e
  `Incumplido` de acuerdo con la forma de evaluación elegida.
- Mantener un registro histórico corregible sin perder datos al cambiar una
  frecuencia, pausar o archivar un hábito.
- Ofrecer una lista diaria muy rápida y una vista histórica con estadísticas
  comprensibles.
- Permitir asociar opcionalmente un hábito a una asignatura, un grupo personal
  o ninguno de los dos.
- Permitir notas generales y notas diarias en Markdown sin romper el contrato
  actual de notas que consume KOReader.
- Reservar una integración futura para recibir estadísticas de KOReader de
  forma autenticada, idempotente y explícita.
- Mantener InsForge como única fuente de verdad persistente.

### Fuera De Este Alcance Inicial

- Notificaciones, recordatorios por correo, push o del navegador.
- Completar, omitir o reprogramar hábitos desde el calendario.
- Gamificación obligatoria, puntos, castigos, rankings o funciones sociales.
- Catálogo específico de series, anime, libros o medios. Un registro
  cuantitativo y notas Markdown cubrirán esos casos inicialmente.
- Temporizador integrado para estudio o lectura. El modelo podrá admitir
  minutos, pero el temporizador se planificará como una mejora posterior.
- Sincronización de hábitos con KOReader. La compatibilidad futura se prepara
  mediante contratos y metadatos, pero la escritura desde el dispositivo
  requiere una especificación posterior.

## 2. Investigación De Referencia

Se revisaron productos con enfoques distintos para extraer patrones, no para
copiar su interfaz:

- Habitify: lista diaria, vista web de cuadrícula, registro de
  `Completado`/`Omitido`/`Incumplido`, valores parciales, notas de progreso,
  pausa y archivo.
- TickTick: separación entre hábitos, tareas recurrentes, calendario y
  estadísticas.
- Todoist: selector visual de recurrencias, fecha de inicio y término,
  reprogramación de una sola ocurrencia y reglas futuras ocultas hasta que son
  necesarias.
- Way of Life: distinción entre día cumplido, día omitido y día no cumplido,
  notas breves y gráficos de tendencia.
- Habitica: separación conceptual entre hábitos, tareas diarias y tareas de una
  sola vez; se descarta su gamificación obligatoria para mantener Karenda
  enfocada.

La síntesis adoptada para Karenda es: configuración progresiva, acción diaria
de un clic, estados explícitos, omisión sin castigo, estadísticas por periodo,
archivo reversible y recurrencias visuales con una vista previa legible.

## 3. Historias De Usuario

- **HU-H-01:** Como estudiante, quiero crear un hábito independiente o ligado
  a una asignatura o grupo personal.
- **HU-H-02:** Como usuario, quiero elegir una frecuencia habitual o construir
  una frecuencia personalizada con una explicación en lenguaje natural.
- **HU-H-03:** Como usuario, quiero indicar si mi hábito se cumple por
  ocurrencia o si debo alcanzar una meta acumulada por día, semana o mes.
- **HU-H-04:** Como usuario, quiero registrar un hábito con un clic cuando es
  binario, o introducir una cantidad cuando necesito medirlo.
- **HU-H-05:** Como usuario, quiero que un día pueda quedar pendiente,
  completado, parcial, omitido o incumplido según la configuración del hábito.
- **HU-H-06:** Como usuario, quiero corregir un registro anterior sin perder el
  historial.
- **HU-H-07:** Como usuario, quiero pausar o archivar un hábito sin eliminar su
  historia, notas ni estadísticas.
- **HU-H-08:** Como usuario, quiero ver rachas, cumplimiento y evolución cuando
  las estadísticas estén activadas.
- **HU-H-09:** Como usuario, quiero crear una nota general o una nota asociada
  a una fecha concreta de un hábito.
- **HU-H-10:** Como usuario, quiero decidir si un hábito aparece como
  proyección de solo lectura en determinados días del calendario.
- **HU-H-11:** Como usuario, quiero revisar y administrar los hábitos desde su
  propia sección, sin depender del calendario.
- **HU-H-12:** Como usuario, quiero crear una tarea recurrente que permanezca
  pendiente o vencida hasta que la complete.
- **HU-H-13:** Como usuario, quiero cambiar la regla futura de una recurrencia
  sin reescribir sus registros históricos.
- **HU-H-14:** Como usuario, quiero que un futuro dispositivo pueda enviar
  datos de lectura a un hábito autorizado sin duplicar registros.

## 4. Contratos De Dominio

Los nombres de contrato permanecen en inglés. Las etiquetas, estados y ayudas
visibles permanecen en español.

### Hábito

Un `Habit` tendrá como mínimo:

- `id`, `owner_id`, `created_at`, `updated_at`.
- `name`: nombre libre y obligatorio.
- `description`: opcional.
- `color`: opcional; la interfaz utilizará un color neutro si falta.
- `subject_id`: opcional y perteneciente a la cuenta.
- `personal_group_id`: opcional y perteneciente a la cuenta.
- `tracking_type`: `boolean`, `count` o `duration`.
- `unit`: unidad visible para `count` o `duration`, por ejemplo
  `episodios`, `páginas` o `minutos`; nula para `boolean`.
- `goal_value`: objetivo positivo cuando el tipo no es `boolean` o cuando el
  modo de evaluación es `period_quota`.
- `evaluation_mode`: `scheduled_occurrence` o `period_quota`.
- `miss_policy`: `mark_missed` o `keep_pending`; se aplica principalmente
  a hábitos de ocurrencia programada.
- `schedule`: regla de repetición validada y versionable.
- `start_date`, `end_date`: fechas locales, con término opcional inclusivo.
- `lifecycle_status`: `active`, `paused` o `archived`.
- `stats_enabled`: por defecto `true`.
- `note_policy`: `none`, `general`, `daily` o `both`; por defecto `none`.
- `calendar_enabled`: por defecto `false`.
- `calendar_schedule`: configuración opcional de la proyección visual.

### Regla De Repetición

La UI ofrecerá accesos directos para `Todos los días`, `Días seleccionados`,
`Cada semana`, `Cada mes`, `Cada N días` y `Día N de cada mes`. Todos ellos
se traducirán a una regla explícita, no a texto que el backend deba interpretar.

La regla deberá poder representar:

- unidad base `day`, `week` o `month`;
- intervalo positivo;
- días de la semana seleccionados, cuando corresponda;
- día del mes entre 1 y 31, cuando corresponda;
- fecha ancla para intervalos como `Cada 3 días`;
- periodo de cuota `day`, `week` o `month` y meta de cantidad cuando
  `evaluation_mode` sea `period_quota`.

La aplicación mostrará una vista previa como `Cada martes y jueves` o
`3 veces por semana`. Una regla mensual para el día 29, 30 o 31 utilizará el
último día disponible del mes cuando ese día no exista, y lo explicará en la
ayuda del formulario.

### Registro De Hábito

Un `HabitLog` tendrá:

- `id`, `owner_id`, `habit_id`, `created_at`, `updated_at`;
- `local_date`: fecha civil en la zona configurada por la cuenta;
- `value`: número positivo o cero para hábitos cuantitativos; `1` para
  cumplimiento binario;
- `status`: `completed`, `partial` o `skipped` cuando existe un registro
  explícito;
- `source`: `manual` en el MVP, reservado para `koreader` en el futuro;
- `external_id`: nulo en el MVP y reservado para deduplicación de integraciones.

Los estados `pending` e `missed` se calcularán contra la regla y la fecha local
cuando no exista un registro explícito. Así no se necesita un proceso nocturno
ni una tarea programada para fabricar filas de incumplimiento.

Reglas de evaluación:

- `boolean` + `scheduled_occurrence`: `value = 1` completa; ausencia en una
  ocurrencia cerrada produce `missed` si `miss_policy = mark_missed`, o
  conserva `pending`/no evaluado si `keep_pending`.
- `count` o `duration` + `scheduled_occurrence`: `value` puede ser parcial;
  alcanzar `goal_value` produce `completed`, un valor menor produce `partial`.
- `period_quota`: varios registros se suman dentro del periodo; el periodo se
  completa al alcanzar la meta y no se marca cada día como incumplido.
- `skipped` excluye la ocurrencia del cumplimiento y no rompe una racha.
- Los registros pasados pueden corregirse desde la vista de historial.

### Notas De Hábitos

Para no cambiar el contrato `notes` del snapshot v1 de KOReader, las notas de
hábitos vivirán en una entidad separada `HabitNote` y reutilizarán el mismo
editor Markdown y el mismo renderizador seguro.

Un `HabitNote` tendrá `id`, `owner_id`, `habit_id`, `entry_date` nullable,
`title`, `content_markdown`, `created_at` y `updated_at`.

- `entry_date = null`: nota general del hábito.
- `entry_date = YYYY-MM-DD`: nota diaria del hábito.

La vista `Notas` combinará visualmente las notas de dominio existentes y las
notas de hábitos, pero los servicios, tablas y contratos externos seguirán
siendo distinguibles.

### Tarea Recurrente

Un `RecurringTask` tendrá:

- `id`, `owner_id`, `created_at`, `updated_at`;
- `title`, `description`, `color` opcional;
- `subject_id` y `personal_group_id` opcionales, como máximo uno no nulo;
- `schedule`, `start_date`, `end_date` opcional;
- `next_due_date`, `due_time` opcional y `duration_minutes` opcional;
- `status`: `active`, `paused` o `archived`;
- `calendar_enabled`, por defecto `false`.

Los cambios futuros de `schedule` se almacenarán en
`recurring_task_schedule_versions` con `effective_from` y `effective_to`. La
edición de la próxima ocurrencia seguirá actualizando `next_due_date`, sin
reescribir esas versiones ni las ocurrencias ya registradas.

Sus ocurrencias se muestran como `Pendiente` o `Vencida` hasta que se
completan. Al completar una ocurrencia se registra el historial y se calcula la
siguiente fecha. Completar una tarea no crea una estadística de hábito.

## 5. Requisitos Funcionales

- **RF-H-01 [EARS: evento]:** Cuando una persona autenticada abra la sección
  `Hábitos`, el sistema deberá mostrar una lista diaria de hábitos activos y las
  tareas recurrentes pendientes o vencidas según la pestaña seleccionada.
- **RF-H-02 [EARS: estado]:** La navegación protegida deberá mostrar
  `Calendario`, `Hábitos` y `Notas` como destinos principales; asignaturas,
  grupos personales y dispositivos continuarán siendo administración
  secundaria.
- **RF-H-03 [EARS: evento]:** Cuando el usuario cree o edite un hábito, el
  sistema deberá validar nombre, tipo de seguimiento, objetivo, regla,
  fechas y relaciones opcionales antes de persistirlo.
- **RF-H-04 [EARS: evento]:** El sistema deberá permitir que un hábito sea
  independiente, se relacione con una asignatura o se relacione con un grupo
  personal, validando que la relación pertenezca a la cuenta.
- **RF-H-05 [EARS: evento]:** El formulario deberá ofrecer frecuencias comunes
  y una configuración avanzada que genere una vista previa legible de la regla.
- **RF-H-06 [EARS: condición no deseada]:** El sistema deberá rechazar
  intervalos cero o negativos, metas no positivas, días inválidos, fechas
  finales anteriores al inicio y combinaciones de regla incompatibles.
- **RF-H-07 [EARS: evento]:** Cuando el usuario registre un hábito binario, el
  sistema deberá crear o actualizar un registro de cumplimiento para la fecha
  local seleccionada.
- **RF-H-08 [EARS: evento]:** Cuando el usuario registre un hábito de cantidad o
  duración, el sistema deberá permitir introducir un valor, mostrar el avance
  respecto de la meta y conservar la unidad configurada.
- **RF-H-09 [EARS: evento]:** El sistema deberá permitir marcar una ocurrencia
  como omitida y deberá excluirla de la racha y del denominador de cumplimiento.
- **RF-H-10 [EARS: estado]:** El sistema deberá mostrar `Pendiente`,
  `Completado`, `Parcial`, `Omitido` o `Incumplido` según la regla, el
  registro y el cierre de la fecha, siempre con texto además de color.
- **RF-H-11 [EARS: evento]:** Cuando el usuario modifique un registro histórico,
  el sistema deberá recalcular la proyección de estado y las estadísticas
  afectadas sin borrar otros registros.
- **RF-H-12 [EARS: evento]:** El sistema deberá permitir pausar, reanudar y
  archivar un hábito; estas acciones no deberán borrar logs, notas ni
  estadísticas históricas.
- **RF-H-13 [EARS: evento]:** Cuando el usuario cambie una frecuencia o meta,
  el sistema deberá ofrecer aplicarla desde una fecha efectiva futura y deberá
  conservar la interpretación histórica anterior.
- **RF-H-14 [EARS: evento]:** Cuando `stats_enabled` sea verdadero, el sistema
  deberá mostrar al menos racha actual, mejor racha, cumplimiento del periodo,
  total y promedio cuando el tipo de seguimiento lo permita.
- **RF-H-15 [EARS: estado]:** Cuando `stats_enabled` sea falso, el hábito
  deberá seguir pudiendo registrarse y consultarse, pero no deberá aparecer en
  los agregados motivacionales ni exigir una gráfica.
- **RF-H-16 [EARS: evento]:** Cuando `note_policy` sea `general`, `daily` o
  `both`, el sistema deberá permitir crear y editar una nota Markdown general,
  una nota asociada a una fecha del hábito o ambas, respectivamente.
- **RF-H-17 [EARS: condición no deseada]:** Las notas de hábitos deberán
  conservar Markdown original y neutralizar HTML, scripts, atributos y enlaces
  inseguros igual que las notas actuales.
- **RF-H-18 [EARS: evento]:** Cuando el usuario active `calendar_enabled`, el
  sistema deberá permitir configurar si la proyección aparece en los días de
  la regla, todos los días activos o una selección personalizada.
- **RF-H-19 [EARS: estado]:** Las proyecciones de hábitos y tareas recurrentes
  deberán aparecer en el calendario solo cuando estén activadas, ser de solo
  lectura y distinguir su origen de los eventos académicos y personales.
- **RF-H-20 [EARS: condición no deseada]:** El calendario no deberá ofrecer
  acciones para completar, omitir, editar la recurrencia o eliminar un hábito;
  deberá ofrecer únicamente acceso a `Hábitos`.
- **RF-H-21 [EARS: evento]:** Cuando el usuario cree una tarea recurrente, el
  sistema deberá validar título, regla y fechas, y deberá permitir relaciones
  opcionales con asignaturas o grupos.
- **RF-H-22 [EARS: estado]:** Una tarea recurrente vencida deberá permanecer
  visible como `Vencida` hasta que se complete o se reprograme desde la sección
  de tareas, sin convertirse automáticamente en `Incumplida`.
- **RF-H-23 [EARS: evento]:** Al completar una tarea recurrente, el sistema
  deberá registrar la ocurrencia y calcular la siguiente fecha según la regla,
  sin duplicarla ni modificar el historial previo.
- **RF-H-24 [EARS: evento]:** La edición de una recurrencia deberá distinguir
  entre cambiar la próxima ocurrencia y cambiar la regla futura desde una fecha
  efectiva; nunca deberá reescribir registros históricos sin confirmación.
- **RF-H-25 [EARS: evento]:** La sección deberá permitir buscar y filtrar por
  estado, relación, tipo de seguimiento y estado de archivo sin mezclar por
  defecto hábitos archivados con activos.
- **RF-H-26 [EARS: condición no deseada]:** Si una operación de InsForge falla,
  la interfaz deberá mostrar un error en español, conservar los datos del
  formulario cuando sea posible y no presentar un registro como guardado.
- **RF-H-27 [EARS: ubicuo]:** Toda entidad de hábitos, tareas, logs y notas de
  hábitos deberá quedar asociada a `owner_id` y protegida por RLS en InsForge.
- **RF-H-28 [EARS: evento]:** El sistema no deberá crear notificaciones ni
  solicitar permisos del navegador como parte de esta funcionalidad.

## 6. Requisitos No Funcionales

- **RNF-H-01:** React, TypeScript, Vite, Zustand, React Hook Form y Zod
  continuarán siendo las tecnologías del frontend.
- **RNF-H-02:** InsForge será la única persistencia y el único backend. Zustand
  solo conservará caché temporal, filtros, selección y estados de UI.
- **RNF-H-03:** Las funciones de cálculo de recurrencias, periodos, estados y
  estadísticas deberán ser puras y testeables sin React ni InsForge.
- **RNF-H-04:** Las fechas de hábitos y logs serán fechas locales civiles; no
  deberán desplazarse por conversiones UTC. Los timestamps técnicos sí usarán
  ISO 8601 inequívoco.
- **RNF-H-05:** Las consultas de lista cargarán solo hábitos y logs del rango
  necesario; el historial y las estadísticas usarán consultas acotadas por
  hábito y periodo.
- **RNF-H-06:** Los contratos de calendario usarán un tipo de fuente explícito
  como `event`, `habit_occurrence` o `recurring_task_occurrence`; no se
  inferirá el origen desde el título.
- **RNF-H-07:** Los logs futuros importados deberán admitir `source` y
  `external_id`, y una restricción de unicidad por propietario, origen y
  identificador externo para permitir reintentos idempotentes.
- **RNF-H-08:** La UI será usable con teclado, foco visible, tamaños táctiles
  suficientes y estados textuales. Ningún resultado estadístico dependerá solo
  del color.
- **RNF-H-09:** Todos los requisitos verificables tendrán pruebas Vitest,
  Testing Library o Playwright trazables a esta spec.

## 7. Frontera Futura Con KOReader

La fase actual solo prepara el contrato:

- El plugin existente seguirá recibiendo el snapshot v1 de calendario y notas
  de dominio; las `HabitNote` no se añadirán silenciosamente a ese snapshot.
- Una fase futura podrá añadir `write:habit_logs` como scope separado de
  `read:snapshot` y de `write:events`.
- El usuario deberá vincular explícitamente una métrica de KOReader a un
  hábito, por ejemplo `Lectura` con unidad `minutos` o `páginas`.
- La futura función de ingesta deberá validar propietario, hábito conectado,
  zona horaria, rango y `external_id`, y aceptar reintentos sin duplicar logs.
- Un snapshot que incluya hábitos o notas de hábitos requerirá una versión de
  contrato posterior y pruebas del plugin; no se modifica el contrato v1 en
  esta tarea. El contrato futuro de ingesta está documentado en
  `specs/004-koreader-habit-log-ingestion.md`, pero no autoriza su
  implementación.

## 8. Criterios De Aceptación

- **CA-H-01:** Una cuenta puede crear un hábito independiente, asociado a una
  asignatura o asociado a un grupo personal.
- **CA-H-02:** Los accesos directos diario, días seleccionados, semanal,
  mensual, cada N días y día del mes generan reglas válidas y una vista previa
  comprensible.
- **CA-H-03:** Un hábito binario, uno de cantidad y uno de duración pueden
  registrar avance y mostrar su estado correcto.
- **CA-H-04:** Un hábito por ocurrencia puede mostrar pendiente, completado,
  omitido o incumplido sin que una omisión rompa la racha.
- **CA-H-05:** Un hábito por cuota puede acumular varios registros y marcar el
  periodo completado al alcanzar la meta, sin exigir cumplimiento diario.
- **CA-H-06:** Corregir un registro histórico actualiza historial y estadísticas
  sin afectar registros ajenos.
- **CA-H-07:** Pausar o archivar conserva logs, notas e historial; reanudar no
  crea ocurrencias durante la pausa.
- **CA-H-08:** Cambiar la regla desde una fecha futura conserva la lectura de
  periodos anteriores.
- **CA-H-09:** Las estadísticas activadas muestran datos coherentes con la
  modalidad del hábito; las desactivadas no aparecen en agregados.
- **CA-H-10:** Existen notas generales y notas diarias Markdown de hábitos,
  renderizadas con la misma sanitización segura del MVP.
- **CA-H-11:** Las proyecciones activadas aparecen en los días configurados del
  calendario, se reconocen como hábitos y no permiten completarlos allí.
- **CA-H-12:** Una tarea recurrente permanece pendiente o vencida hasta su
  gestión en `Hábitos`, y al completarse calcula una próxima ocurrencia única.
- **CA-H-13:** Los filtros, búsquedas, estados vacíos, errores y formularios
  funcionan en español y son utilizables en escritorio, tablet y móvil.
- **CA-H-14:** RLS impide que una cuenta consulte o modifique hábitos, tareas,
  logs o notas de hábitos de otra cuenta.
- **CA-H-15:** La implementación no añade notificaciones, base local de
  producción ni cambios incompatibles al snapshot v1 de KOReader.

## 9. Creación Asistida De Hábitos Con IA

La sección Hábitos ofrecerá una acción opcional equivalente a la creación
asistida de eventos. La IA solo prepara borradores: nunca guarda hábitos ni
puede crear asignaturas o grupos. La persona revisa cada borrador en el
formulario normal y confirma el guardado explícitamente.

### Contrato De Borrador

La función `karenda-ai-habit-drafts` recibe `prompt`, `time_zone` y
`reference_date`, carga server-side el catálogo autenticado y devuelve como
máximo 10 borradores con los campos del contrato `HabitInput`. Las relaciones
solo pueden apuntar a registros del catálogo de la cuenta. Las fechas son
locales y la regla de repetición siempre se devuelve como objeto explícito.

La misma función acepta `mode: "quick" | "guided"`. En modo `quick` devuelve
directamente borradores. En modo `guided`, la primera respuesta devuelve
preguntas estructuradas con `id`, `question`, `options`, `allows_other` y
`optional`; la aplicación presenta una pregunta por vez y envía las respuestas
como `{ question_id, option_id, other_text, no_preference }` para solicitar la
planificación final. Las preguntas no se persisten, tienen un máximo de cinco,
y nunca pueden solicitar secretos ni datos innecesarios.

### Requisitos

- **RF-H-29:** La función rechazará solicitudes sin sesión válida y no llamará
  al proveedor de IA en ese caso.
- **RF-H-30:** El prompt aceptará entre 1 y 4000 caracteres; la salida estará
  limitada a 10 hábitos, campos acotados y tokens de respuesta controlados.
- **RF-H-31:** Una respuesta HTTP fallida, agotada o inválida probará los
  modelos de respaldo secuencialmente, sin exponer detalles del proveedor.
- **RF-H-32:** La función aplicará un límite de 5 solicitudes por usuario cada
  10 minutos antes de llamar al proveedor. El cliente traducirá cualquier
  respuesta `429` de hábitos o calendario al mensaje español estable de límite
  temporal y no reintentará automáticamente.
- **RF-H-33:** La UI mostrará borradores para revisar, editar o quitar y
  bloqueará el guardado si algún borrador no cumple `habitInputSchema`.
- **RF-H-34:** La confirmación persistirá cada borrador mediante
  `habitService.create`; un resultado parcial conservará los borradores que
  fallaron y nunca mostrará éxito total falso.
- **RF-H-35:** La clave del proveedor, el prompt y la respuesta no se
  persistirán ni aparecerán en el navegador, mensajes o logs.
- **RF-H-36:** El switch de creación de Hábitos permitirá cambiar entre modo
  rápido y modo guiado antes de enviar el prompt.
- **RF-H-37:** El modo guiado mostrará preguntas estructuradas, una por vez,
  con alternativas, `Otro` con texto libre y `No me importa`; no permitirá
  enviar una respuesta sin seleccionar una alternativa o indicar una opción
  válida.
- **RF-H-38:** Las respuestas guiadas se enviarán en una segunda solicitud y
  producirán borradores usando el mismo contrato y validación del modo rápido.
- **RF-H-39:** Si el modelo devuelve `boolean` junto a unidad o meta
  cuantitativa, el servidor normalizará la combinación a `duration` o `count`
  cuando sea inequívoca; nunca se rechazará solo por esa contradicción.
- **RF-H-40:** El contrato guiado será independiente de React y expondrá solo
  datos serializables para que Android pueda reutilizarlo sin cambios.

### Criterios De Aceptación

- **CA-H-16:** Un prompt como “leer 20 páginas de lunes a viernes” produce un
  borrador revisable con tipo, meta, unidad y regla comprensibles.
- **CA-H-17:** El borrador puede editarse en el formulario normal y guardarse
  solo tras confirmación explícita.
- **CA-H-18:** Al alcanzar el límite, calendario y hábitos muestran el mismo
  aviso en español, permanecen sin reintentos automáticos y permiten volver a
  intentarlo después del periodo indicado.
- **CA-H-19:** Los fallos parciales conservan para revisión los hábitos no
  guardados y comunican cuántos sí se crearon.
- **CA-H-20:** “Estudiar 1 hora al día” genera un hábito de duración diaria
  revisable, sin error de unidad booleana.
- **CA-H-21:** El modo guiado permite completar preguntas con una alternativa,
  texto libre o “No me importa” y luego genera el borrador.
- **CA-H-22:** Cambiar a modo rápido no muestra preguntas y cambiar a modo
  guiado no genera hábitos hasta terminar la ronda de preguntas.

## 10. Referencias De Investigación

- [Habitify: registro de hábitos en web y escritorio](https://intercom.help/habitify-app/en/articles/11203298-track-progress-of-habits-on-website-desktop-app)
- [Habitify: progreso y estadísticas en web](https://intercom.help/habitify-app/en/articles/14717723-progress-screen-the-good-habits-report-on-website-desktop)
- [Habitify: pausa, omisión y archivo](https://intercom.help/habitify-app/en/articles/11597864-how-to-pause-or-cut-off-your-habits)
- [TickTick: hábitos, calendario y estadísticas](https://ticktick.com/features)
- [Todoist: reglas visuales de tareas recurrentes](https://www.todoist.com/help/todoist/features/introduction-to-recurring-dates-YUYVJJAV)
- [Habitica: separación entre hábitos y tareas](https://habitica.com/static/home)
- [Way of Life: metas, omisiones y tendencias](https://wayoflifeapp.com/goalsetting/)
