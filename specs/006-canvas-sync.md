# Sincronización Canvas UC → Karenda

Estado: piloto personal. Esta spec define una integración unidireccional y de
solo lectura desde Canvas UC hacia Karenda. No autoriza OAuth multiusuario,
scraping, escritura en Canvas ni creación de eventos sin revisión.

## 1. Objetivo

Karenda permitirá conectar una cuenta personal de Canvas UC, descubrir sus
cursos activos y preparar actividades académicas para revisión. La persona
podrá vincular cada curso con una asignatura y cada elemento con un evento
existente antes de crear datos, evitando duplicados.

La integración usará un token personal de Canvas con vencimiento máximo de
noventa días. Este mecanismo queda restringido a una cuenta piloto; una
apertura multiusuario exigirá OAuth y una Developer Key institucional.

## 2. Alcance

- Cursos activos del periodo vigente.
- Tareas, quizzes, discusiones evaluadas y eventos de calendario asociados a
  esos cursos.
- Anuncios y páginas recientes que mencionen explícitamente una actividad,
  fecha, sala o temario.
- Importación inicial de elementos cuyo vencimiento o término sea hoy o
  posterior. Una tarea futura ya disponible conserva su inicio real aunque sea
  anterior a hoy.
- Ventana inicial de treinta días para anuncios y páginas; después se usa una
  marca incremental con cuarenta y ocho horas de solapamiento.
- Sincronización diaria a las 06:00 de `America/Santiago` y sincronización
  manual.

## 3. Contratos De Dominio

### Actividad Académica

`events.academic_activity_type` es opcional para mantener compatibilidad con
eventos existentes. Sus valores son:

- `assignment`
- `graded_discussion`
- `quiz`
- `oral_assessment`
- `test`
- `exam`
- `other`

La interfaz los presenta como `Tarea`, `Discusión evaluada`, `Quiz`,
`Interrogación`, `Control`, `Examen` y `Otra actividad`. Canvas y reglas
deterministas sugieren el valor, pero la persona lo confirma antes de crear o
vincular un elemento nuevo.

### Conexión

Una conexión contiene `owner_id`, `canvas_base_url`, `auth_mode`, `status`,
`time_zone`, `token_expires_at`, `last_sync_at`, `next_sync_at`,
`content_cursor_at` y metadatos de error no sensibles. Para el piloto:

- `canvas_base_url` es siempre `https://cursos.canvas.uc.cl`;
- `auth_mode` es `personal_access_token`;
- `status` es `connected`, `expired`, `error` o `disabled`;
- solo puede existir una conexión por cuenta.

El token se cifra con AES-GCM antes de persistirse. La tabla de credenciales
vive en `public` por las restricciones de objetos de aplicación de InsForge,
pero no concede ninguna operación a `anon` ni `authenticated`; solo las
funciones que usan el cliente administrativo pueden acceder a ella.

### Vínculos Y Revisión

- `canvas_course_links` relaciona de forma única un curso externo con una
  asignatura propia y conserva la base remota aplicada.
- `canvas_item_links` relaciona de forma única un elemento externo con un
  evento propio y conserva valores remotos y locales aplicados para la
  reconciliación de tres versiones.
- `canvas_review_items` contiene propuestas de tipo `course_mapping`,
  `event_create`, `event_update`, `conflict`, `source_removed` o `undated`.
- Una propuesta usa estado `pending`, `applied` o `ignored` y conserva solo
  campos normalizados, candidatos y evidencia segura.
- `canvas_sync_runs` registra estado, conteos y errores sanitizados de cada
  ejecución.

Los identificadores externos se almacenan como texto para no depender del
tamaño numérico usado por una instalación de Canvas.

## 4. Representación Temporal

| Fuente | Evento propuesto |
| --- | --- |
| Tarea o discusión evaluada | `start_at = unlock_at/available_at` y `end_at = due_at`; sin apertura, `start_at = due_at` y `end_at = null` |
| Quiz, interrogación, control o examen | Usa el inicio y término explícitos; si solo existe `due_at`, crea un hito sin inventar duración |
| Evento de calendario | Conserva inicio, término, día completo, lugar y descripción |
| Elemento sin fecha | Permanece en revisión como `undated` y no crea un evento |

Los elementos de Canvas siempre producen eventos académicos. Los calendarios
personales de Canvas quedan fuera del alcance.

## 5. Requisitos Funcionales

- **RF-C-01 [EARS: evento]:** Cuando una cuenta piloto autenticada envíe un
  token y su vencimiento, la función deberá validar el token contra el perfil de
  Canvas, cifrarlo antes de persistirlo y responder sin incluir el secreto.
- **RF-C-02 [EARS: seguridad]:** Mientras una cuenta no esté incluida en la
  allowlist server-side, las funciones de Canvas deberán responder `403` y no
  llamar a Canvas ni almacenar credenciales.
- **RF-C-03 [EARS: evento]:** Cuando se ejecute una sincronización, el sistema
  deberá cargar cursos activos, colores, planificador, eventos, anuncios y
  páginas mediante solicitudes GET paginadas a Canvas UC.
- **RF-C-04 [EARS: estado]:** Mientras un curso no esté vinculado, sus
  elementos deberán permanecer en revisión y no podrán crear eventos.
- **RF-C-05 [EARS: evento]:** Cuando aparezca un curso nuevo, Karenda deberá
  permitir vincularlo con una asignatura propia o crear una nueva con nombre,
  código, abreviación y color editables.
- **RF-C-06 [EARS: evento]:** Cuando aparezca un elemento nuevo, Karenda deberá
  mostrar antes los eventos propios candidatos de la misma asignatura dentro
  de siete días a cada lado y permitir vincular, crear o ignorar.
- **RF-C-07 [EARS: condición no deseada]:** Si una decisión intenta vincular un
  curso, asignatura, elemento o evento ajeno, el servidor deberá rechazarla y
  no modificar ningún registro.
- **RF-C-08 [EARS: evento]:** Cuando se cree o vincule un elemento, la categoría
  académica sugerida deberá poder confirmarse o corregirse antes de aplicar la
  decisión.
- **RF-C-09 [EARS: estado]:** Mientras un elemento ya vinculado reciba cambios,
  el sistema deberá actualizar automáticamente solo los campos cuyo valor local
  siga igual a la última base aplicada.
- **RF-C-10 [EARS: condición no deseada]:** Si Canvas y Karenda cambiaron el
  mismo campo a valores diferentes, el sistema deberá conservar el valor local
  y crear una propuesta `conflict`.
- **RF-C-11 [EARS: evento]:** Cuando Canvas confirme una entrega o finalización,
  el evento vinculado deberá pasar a `completed`; una lectura posterior nunca
  deberá devolverlo a `pending`.
- **RF-C-12 [EARS: evento]:** Cuando un anuncio o página mencione explícitamente
  una actividad, fecha, sala o temario, la IA deberá devolver una propuesta
  estructurada que la persona confirme antes de modificar un evento.
- **RF-C-13 [EARS: evento]:** Al confirmar información de un anuncio, Karenda
  deberá agregar texto no duplicado a la descripción y reemplazar el lugar si
  existe una sala nueva confirmada.
- **RF-C-14 [EARS: privacidad]:** De anuncios y páginas solo deberá persistirse
  título, fecha, enlace, hash y un extracto sanitizado de hasta 2000 caracteres;
  el cuerpo completo enviado a la IA será transitorio.
- **RF-C-15 [EARS: condición no deseada]:** Si un elemento desaparece, se
  despublica o pierde fecha, Karenda deberá conservar el evento y crear una
  propuesta de revisión; nunca lo eliminará automáticamente.
- **RF-C-16 [EARS: evento]:** Cuando la persona solicite sincronización manual,
  la función deberá crear una ejecución idempotente, impedir otra ejecución
  simultánea y devolver su identificador, estado y conteos.
- **RF-C-17 [EARS: estado]:** Cuando el programador invoque la función cada
  hora, solo deberá sincronizar conexiones vencidas por `next_sync_at` y fijar
  la próxima ejecución a las 06:00 de `America/Santiago`.
- **RF-C-18 [EARS: condición no deseada]:** Ante `429`, el cliente Canvas
  deberá respetar `Retry-After` o aplicar retroceso acotado; ante `401`, deberá
  marcar la conexión como `expired` sin cambiar eventos.
- **RF-C-19 [EARS: estado]:** Siete días antes del vencimiento la interfaz
  deberá advertir la renovación. Reemplazar el token deberá conservar todos los
  vínculos y revisiones.
- **RF-C-20 [EARS: evento]:** Cuando la persona desconecte Canvas, el sistema
  deberá eliminar la credencial cifrada, desactivar la conexión y conservar los
  eventos, asignaturas y vínculos históricos.
- **RF-C-21 [EARS: estado]:** El detalle de un evento vinculado deberá mostrar
  su categoría, la procedencia Canvas y un enlace externo seguro al origen.
- **RF-C-22 [EARS: evento]:** Cuando la persona edite una asignatura vinculada,
  deberá ver los cursos activos de Canvas asociados y podrá desvincular cada
  curso con confirmación; la desvinculación deberá conservar eventos, vínculos
  de elementos y datos históricos, y permitir volver a vincular el curso.
- **RF-C-23 [EARS: estado]:** Cuando exista una conexión Canvas utilizable, el
  encabezado del calendario deberá mostrar una acción `Sincronizar Canvas` que
  inicie la misma ejecución manual de la página Canvas y refresque los eventos
  visibles al terminar.
- **RF-C-24 [EARS: condición no deseada]:** Si Canvas rechaza o no entrega una
  colección secundaria de un curso, la ejecución deberá continuar con los
  recursos disponibles, registrar un aviso sanitizado y finalizar como
  `partial`; los fallos de autenticación, credenciales, base de datos o cursos
  deberán seguir siendo recuperables y explícitos.
- **RF-C-25 [EARS: condición no deseada]:** Si Canvas entrega texto HTML con
  unidades Unicode malformadas, Karenda deberá reemplazar las unidades aisladas
  antes de persistirlas o enviarlas a la IA, sin abortar la sincronización.

## 6. Contratos HTTP

### `karenda-canvas-connection`

- `GET`: devuelve el estado seguro de la conexión o `null`.
- `POST { "action": "connect", "token": "...", "tokenExpiresAt": "ISO" }`.
- `POST { "action": "replace_token", "token": "...", "tokenExpiresAt": "ISO" }`.
- `POST { "action": "disconnect" }`.

### `karenda-canvas-sync`

`POST {}` autenticado devuelve
`{ "runId": "uuid", "status": "completed|partial", "counts": {...} }`.

### `karenda-canvas-review`

`POST` recibe `{ "reviewItemId": "uuid", "decision":
"link_existing|create_subject|create_event|apply_update|ignore", "eventId": "uuid|null",
"overrides": {...} }`.

### `karenda-canvas-scheduled-sync`

`POST` requiere `Authorization: Bearer <CANVAS_SCHEDULE_SECRET>` y no acepta
identificadores de cuenta desde el cuerpo.

Los errores usan `{ "error_code": "...", "message": "..." }` con mensajes
públicos en español y sin token, cuerpo remoto o detalle interno.

## 7. Seguridad Y Calidad

- Las funciones solo realizan `GET` hacia el host fijo de Canvas UC y siguen
  URLs de paginación que mantengan el mismo origen y la ruta `/api/v1/`.
- El token, la clave de cifrado, el secreto del programador, la clave
  administrativa y OpenRouter permanecen server-side.
- Cada tabla pública legible aplica RLS por `owner_id = auth.uid()` y cada
  relación se vuelve a validar en servidor.
- El contenido HTML remoto se sanitiza y se trata como datos no confiables. La
  IA no recibe herramientas ni autoridad de escritura y su salida se valida
  antes de crear una propuesta. Las cadenas se normalizan a Unicode bien
  formado antes de persistirlas en JSON.
- La UI y sus mensajes son españoles; código, tipos, funciones y comentarios
  son ingleses.

## 8. Fuera Del Alcance

- Escrituras, entregas, comentarios o cambios de estado en Canvas.
- OAuth, Developer Keys o conexión de otras cuentas durante el piloto.
- iCal, MCP local, extensión, scraping o base de datos local.
- Eliminación automática de eventos y notificación por correo o push.
- Importación de calendarios personales de Canvas o archivos adjuntos.

## 8.1 Relación De Ramas Del Piloto

- Rama Git: `feature/006-canvas-sync`, basada en `origin/main`.
- Rama InsForge de esquema: `karenda-canvas-sync`.
- La rama InsForge contiene las migraciones, funciones, secretos versionados y
  programador de prueba. La promoción al proyecto padre debe ocurrir únicamente
  junto con la integración revisada de la rama Git.
- Promoción ejecutada el 4 de septiembre de 2026 después de integrar el PR #2
  con CI exitoso; el proyecto padre cuenta con respaldo previo a la migración.

## 9. Criterios De Aceptación

- **CA-C-01:** Una cuenta piloto puede conectar y reemplazar un token sin que
  el secreto aparezca en respuestas, tablas legibles, logs o bundle.
- **CA-C-02:** Una cuenta no autorizada y una sesión anónima no pueden usar las
  funciones ni leer filas de otra cuenta.
- **CA-C-03:** La primera sincronización prepara cursos y actividades desde hoy,
  no crea eventos y muestra candidatos existentes antes de cada decisión.
- **CA-C-04:** Vincular o crear una asignatura desbloquea sus actividades sin
  duplicar el curso ni el ramo.
- **CA-C-05:** Tareas, evaluaciones, eventos y elementos sin fecha respetan la
  representación temporal definida en esta spec.
- **CA-C-06:** Los cambios no conflictivos se aplican a elementos vinculados y
  los cambios concurrentes generan conflictos sin sobrescribir datos locales.
- **CA-C-07:** Entregas completadas son monotónicas y elementos retirados nunca
  eliminan eventos.
- **CA-C-08:** Anuncios y páginas solo producen propuestas confirmables y no
  persisten su cuerpo completo.
- **CA-C-09:** El vencimiento, `401`, `429`, ejecuciones concurrentes y fallos de
  IA tienen estados españoles, recuperables y sin éxito falso.
- **CA-C-10:** La ruta Canvas funciona en web y en el frontend empaquetado de
  Android, con teclado, foco visible, objetivos táctiles y layout responsive.
- **CA-C-11:** La edición de una asignatura identifica sus cursos Canvas
  vinculados, permite desvincularlos con confirmación y conserva sus eventos.
- **CA-C-12:** El calendario ofrece `Sincronizar Canvas` solo cuando la
  conexión está disponible y muestra el resultado sin perder los eventos
  visibles.
- **CA-C-13:** Un recurso secundario bloqueado por Canvas deja una ejecución
  parcial con aviso y no impide procesar cursos o colecciones restantes.
- **CA-C-14:** Migración, RLS, funciones, tests, lint, typecheck, build y E2E
  quedan verificados y trazados antes del despliegue piloto.
- **CA-C-15:** Un anuncio o página con un sustituto Unicode aislado no provoca
  `503`, queda sanitizado y permite completar la ejecución o dejarla en `partial`.
