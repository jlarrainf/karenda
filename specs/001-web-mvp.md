# 1. Contexto y Objetivos

Karenda Web es una aplicación web para que un estudiante gestione en un solo
lugar sus compromisos académicos y personales. El MVP debe permitir registrar
asignaturas, eventos universitarios, eventos personales y notas en Markdown,
además de consultar el calendario mediante vistas de agenda, mes, semana y día.

La aplicación utilizará cuentas personales. Cada cuenta tendrá su propio
calendario y sus propios datos; el MVP no contempla compartir eventos ni
calendarios entre cuentas.

## Objetivos Del MVP

- Permitir que el estudiante organice sus asignaturas con nombre, sigla,
  abreviación y color.
- Permitir registrar controles, pruebas, tareas, entregas y otros eventos
  académicos mediante un título libre, sin imponer una categoría adicional.
- Permitir registrar eventos personales y organizarlos opcionalmente en grupos
  o carpetas como `Doctor`, `Psicóloga` o `Cumpleaños`.
- Permitir consultar, buscar y filtrar eventos de forma rápida.
- Permitir asociar notas Markdown a asignaturas o grupos personales y
  visualizarlas renderizadas de forma segura.
- Mantener InsForge como fuente única de autenticación, persistencia, lógica de
  backend y hosting.

## Visión Arquitectónica Futura

Los datos persistidos en InsForge deben exponerse mediante contratos limpios,
estables y explícitos, independientes de los componentes de React y de la
presentación web. Los identificadores, relaciones, estados, fechas y contenido
Markdown deben poder ser consumidos posteriormente por un plugin de KOReader.

En una fase futura, ese plugin podrá mostrar en una página del home de
SimpleUI el calendario y las notas relevantes en un Kindle con jailbreak. El
MVP no implementa el plugin, pero no debe crear contratos que dependan de la
interfaz web o que obliguen al plugin a interpretar datos presentacionales.

# 2. Historias de Usuario

- **HU-01:** Como estudiante, quiero crear una cuenta personal para guardar mi
  calendario de forma privada.
- **HU-02:** Como estudiante, quiero iniciar y cerrar sesión para proteger el
  acceso a mis datos.
- **HU-03:** Como estudiante, quiero registrar un ramo con su nombre, sigla,
  abreviación y color para identificarlo visualmente.
- **HU-04:** Como estudiante, quiero editar o eliminar un ramo para mantener
  actualizado mi periodo académico sin perder datos relacionados por accidente.
- **HU-05:** Como estudiante, quiero crear un evento académico con un título
  como `Interrogación 1`, `Control 3`, `Tarea 2` o `Entrega 5`.
- **HU-06:** Como estudiante, quiero asociar cada evento académico a un ramo
  para saber a qué asignatura corresponde.
- **HU-07:** Como estudiante, quiero indicar la fecha, hora y duración de un
  evento académico para representar tanto una prueba puntual como una tarea de
  varios días.
- **HU-08:** Como estudiante, quiero marcar un evento académico como pendiente
  o completado para saber si ya rendí la prueba o entregué la tarea.
- **HU-09:** Como estudiante, quiero añadir opcionalmente una sala y un
  temario o descripción a un evento académico.
- **HU-10:** Como estudiante, quiero crear eventos personales con información
  temporal, estado, lugar y descripción similar a la de un evento académico.
- **HU-11:** Como estudiante, quiero agrupar eventos personales en carpetas o
  grupos para separar, por ejemplo, citas médicas y cumpleaños.
- **HU-12:** Como estudiante, quiero consultar mis eventos en agenda, mes,
  semana y día para elegir el nivel de detalle que necesito.
- **HU-13:** Como estudiante, quiero buscar eventos y filtrarlos por ramo,
  grupo personal, estado y otros criterios para encontrar rápidamente lo que
  necesito.
- **HU-14:** Como estudiante, quiero crear notas Markdown asociadas a un ramo o
  grupo personal para guardar apuntes relacionados.
- **HU-15:** Como estudiante, quiero ver mis notas Markdown renderizadas para
  leerlas sin tener que interpretar la sintaxis.
- **HU-16:** Como estudiante, quiero que mis datos sean privados y no estén
  disponibles para otras cuentas.

# 3. Requisitos Funcionales (RF)

## Modelo Funcional Y Contratos

Los nombres de campos y valores de contrato se expresan en inglés para
mantener la regla de idioma del proyecto. Las etiquetas y valores mostrados en
la interfaz se expresan en español.

### Cuenta

La autenticación y la sesión pertenecen a InsForge Auth. La aplicación no crea
un sistema de cuentas alternativo. Cuando la configuración de InsForge exige
verificación, la interfaz solicitará el código enviado al correo antes de abrir
la sesión. Cada registro de dominio debe quedar asociado al identificador de la
cuenta propietaria.

### Asignatura

Una asignatura contiene como mínimo:

- `id`
- `owner_id`
- `name`: nombre completo del ramo.
- `code`: sigla del ramo.
- `abbreviation`: abreviación para espacios reducidos.
- `color`: color en formato hexadecimal `#RRGGBB`.

### Grupo Personal

Un grupo personal contiene como mínimo:

- `id`
- `owner_id`
- `name`
- `color`: opcional; si no existe, la interfaz utiliza un color neutro.

### Evento

Un evento contiene:

- `id`
- `owner_id`
- `kind`: `academic` o `personal`.
- `title`: obligatorio y libre; no se exige un campo de categoría separado.
- `subject_id`: obligatorio cuando `kind` es `academic`; nulo para eventos
  personales.
- `personal_group_id`: opcional cuando `kind` es `personal`; nulo para eventos
  académicos.
- `start_at`: fecha y hora de inicio.
- `end_at`: fecha y hora de término cuando el evento tiene duración; puede ser
  nulo para un evento puntual.
- `is_all_day`: indica si el evento ocupa uno o más días sin una hora concreta.
- `status`: `pending` o `completed`.
- `location`: opcional; representa una sala, dirección o lugar.
- `description`: opcional; contiene el temario o descripción del evento.

La fecha de inicio siempre es obligatoria. La hora de inicio es obligatoria
cuando `is_all_day` es falso. Un evento de varios días o con duración debe
tener `end_at`, y su término debe ser posterior a su inicio. En eventos de todo
el día se conserva la fecha local sin desplazamientos visibles por zona
 horaria; la fecha de término indicada por el usuario se considera incluida en
 el rango ocupado.

El cambio de `status` es manual. La fecha pasada no cambia automáticamente un
evento de `pending` a `completed`.

### Nota Markdown

Una nota contiene:

- `id`
- `owner_id`
- `target_type`: `subject` o `personal_group`.
- `target_id`: identificador de la asignatura o grupo asociado.
- `title`
- `content_markdown`

Cada nota pertenece a exactamente una asignatura o a un grupo personal. Las
notas no se asocian directamente a eventos en este MVP.

## Requisitos

- **RF-01 [EARS: evento]:** Cuando una persona se registre o inicie sesión, el
  sistema deberá delegar la operación a InsForge Auth y, si las credenciales
  son válidas, deberá abrir una sesión individual.
- **RF-02 [EARS: estado]:** Mientras no exista una sesión válida, el sistema
  deberá impedir el acceso a las vistas y datos protegidos del calendario y
  deberá mostrar una interfaz de autenticación en español. Si una sesión
  vigente deja de ser válida mientras se usa una vista protegida, el sistema
  deberá limpiar el estado protegido, redirigir a `/login` y conservar el
  destino solicitado para volver después de autenticarse.
- **RF-03 [EARS: ubicuo]:** El sistema deberá asociar cada asignatura, grupo,
  evento y nota a su cuenta propietaria y deberá consultar, crear, modificar o
  eliminar únicamente registros de esa cuenta.
- **RF-04 [EARS: evento]:** Cuando el usuario cree una asignatura, el sistema
  deberá exigir nombre, sigla, abreviación y color hexadecimal válido antes de
  persistirla en InsForge.
- **RF-05 [EARS: evento]:** Cuando el usuario edite una asignatura, el sistema
  deberá validar los mismos campos obligatorios, persistir los cambios y
  reflejarlos en los eventos y filtros que la utilizan.
- **RF-06 [EARS: condición no deseada]:** Si el usuario intenta eliminar una
  asignatura que tiene eventos o notas asociadas, el sistema deberá impedir la
  eliminación, conservar los datos y explicar en español que primero debe
  resolver esas asociaciones.
- **RF-07 [EARS: evento]:** Cuando el usuario cree un grupo personal, el
  sistema deberá exigir un nombre, permitir un color opcional y persistirlo
  asociado a la cuenta actual.
- **RF-08 [EARS: evento]:** Cuando el usuario edite un grupo personal, el
  sistema deberá actualizar su nombre o color sin modificar las relaciones de
  sus eventos y notas.
- **RF-09 [EARS: condición no deseada]:** Si el usuario intenta eliminar un
  grupo personal que tiene eventos o notas asociadas, el sistema deberá impedir
  la eliminación, conservar los datos y explicar en español que primero debe
  resolver esas asociaciones.
- **RF-10 [EARS: evento]:** Cuando el usuario cree un evento académico, el
  sistema deberá exigir título, asignatura, fecha de inicio, hora de inicio
  cuando no sea de todo el día y estado, y deberá permitir lugar y descripción
  opcionales.
- **RF-11 [EARS: evento]:** Cuando el usuario cree un evento personal, el
  sistema deberá exigir título, fecha de inicio, hora de inicio cuando no sea de
  todo el día y estado, y deberá permitir grupo personal, lugar y descripción
  opcionales.
- **RF-12 [EARS: evento]:** Cuando el usuario indique que un evento tiene
  duración o abarca varios días, el sistema deberá solicitar una fecha de
  término válida y deberá representarlo en todas las fechas correspondientes.
- **RF-13 [EARS: condición no deseada]:** Si el usuario introduce un término
  anterior o igual al inicio para un evento con duración, el sistema deberá
  rechazar el formulario, indicar el error en español y no persistir el evento.
- **RF-14 [EARS: evento]:** Cuando el usuario edite un evento, el sistema deberá
  validar sus relaciones, fechas y campos obligatorios, persistir los cambios y
  actualizar todas las vistas afectadas.
- **RF-15 [EARS: evento]:** Cuando el usuario solicite eliminar un evento, el
  sistema deberá pedir confirmación explícita y, tras confirmarla, eliminar
  únicamente ese evento de InsForge.
- **RF-16 [EARS: evento]:** Cuando el usuario cambie el estado de un evento, el
  sistema deberá persistir `pending` o `completed` y deberá mostrar una
  diferencia visual y textual entre `Pendiente` y `Completado`.
- **RF-17 [EARS: evento]:** Cuando el usuario abra o cambie la fecha de la
  pantalla de calendario, el sistema deberá ofrecer navegación anterior,
  siguiente y `Hoy`, además de cambiar entre las vistas Agenda, Mes, Semana y
  Día.
- **RF-18 [EARS: estado]:** Mientras la vista Agenda esté activa, el sistema
  deberá mostrar los eventos desde la fecha actual en adelante, ordenados
  cronológicamente y agrupados por fecha, incluyendo título, horario o rango,
  color y estado.
- **RF-19 [EARS: estado]:** Mientras la vista Mes esté activa, el sistema
  deberá mostrar los eventos del mes seleccionado, incluyendo los eventos que
  atraviesen más de un día y aplicando el color de su asignatura o grupo cuando
  corresponda.
- **RF-20 [EARS: estado]:** Mientras la vista Semana esté activa, el sistema
  deberá mostrar una cuadrícula temporal de los siete días de la semana
  seleccionada, junto con los eventos de todo el día y los eventos de varias
  horas o días.
- **RF-21 [EARS: estado]:** Mientras la vista Día esté activa, el sistema
  deberá mostrar los eventos del día seleccionado en orden temporal, junto con
  los eventos de todo el día y los eventos que atraviesen esa fecha.
- **RF-22 [EARS: evento]:** Cuando el usuario escriba una búsqueda, el sistema
  deberá filtrar los eventos visibles mediante coincidencias sin distinguir
  mayúsculas ni acentos en título, descripción, lugar, nombre/sigla/abreviación
  de asignatura y nombre de grupo personal.
- **RF-23 [EARS: evento]:** Cuando el usuario aplique filtros, el sistema
  deberá permitir filtrar por tipo de evento, asignatura, grupo personal,
  estado y rango de fechas; deberá combinar las categorías activas con lógica
  AND y varias opciones de una misma categoría con lógica OR.
- **RF-24 [EARS: evento]:** Cuando el usuario quite la búsqueda o los filtros,
  el sistema deberá restaurar todos los eventos correspondientes al rango de
  la vista actual.
- **RF-25 [EARS: evento]:** Cuando el usuario cree o edite una nota, el sistema
  deberá exigir título, contenido Markdown no vacío y una asignatura o grupo
  personal propio como destino, y deberá guardar el contenido original en
  InsForge.
- **RF-26 [EARS: evento]:** Cuando el usuario abra una nota, el sistema deberá
  mostrar su título y renderizar `content_markdown` con encabezados, párrafos,
  énfasis, listas, enlaces, bloques de código y tablas compatibles con Markdown
  extendido.
- **RF-27 [EARS: condición no deseada]:** Si el contenido Markdown contiene
  HTML ejecutable, scripts o atributos inseguros, el sistema deberá
  neutralizarlos antes de mostrarlos y deberá conservar el texto seguro de la
  nota.
- **RF-28 [EARS: condición no deseada]:** Si una operación de InsForge falla,
  el sistema deberá mostrar un mensaje de error en español, no deberá informar
  un éxito falso y deberá conservar los datos introducidos siempre que sea
  posible.

# 4. Requisitos No Funcionales (RNF)

## Arquitectura Y Stack

- **RNF-01:** El frontend deberá implementarse con React, TypeScript y Vite.
- **RNF-02:** Las vistas de calendario deberán implementarse con FullCalendar,
  utilizando sus capacidades para vista mensual, cuadrícula temporal semanal y
  diaria, y lista tipo agenda.
- **RNF-03:** El renderizado de notas deberá utilizar una solución de Markdown
  para React compatible con Markdown extendido y sanitización de contenido.
- **RNF-04:** La autenticación, base de datos, autorización, persistencia,
  almacenamiento necesario, lógica de backend y hosting deberán delegarse
  exclusivamente a InsForge.
- **RNF-05:** El cliente podrá mantener estado transitorio de interfaz y una
  caché temporal de consulta, pero InsForge deberá ser la fuente de verdad del
  estado persistente. No se permitirá una base de datos local de producción.
- **RNF-06:** La aplicación no deberá introducir un backend propio, rutas de
  servidor independientes, un sistema de autenticación alternativo ni un
  proveedor de hosting separado del estándar de InsForge.

## Contratos Y Datos

- **RNF-07:** Los identificadores y relaciones de las entidades deberán ser
  estables y no deberán depender del DOM, de rutas visuales ni de nombres de
  componentes de React.
- **RNF-08:** Las fechas con hora deberán persistirse en formato ISO 8601 con
  información de zona horaria o en UTC con una conversión definida. La interfaz
  deberá mostrarlas en español y respetar la zona horaria local del usuario.
- **RNF-09:** Las fechas de eventos de todo el día deberán conservar su valor de
  fecha local sin desplazamientos producidos por la conversión horaria.
- **RNF-10:** Los contratos deberán distinguir explícitamente valores nulos,
  eventos académicos y personales, eventos de todo el día, estados y destinos
  de notas para que un consumidor futuro no tenga que inferirlos desde textos
  visibles.
- **RNF-11:** Las políticas de autorización de InsForge deberán impedir que una
  cuenta lea, modifique o elimine datos de otra cuenta.

## Idioma Y Presentación

- **RNF-12:** Todo el código, incluidos nombres de variables, funciones,
  lógica, tipos y comentarios, deberá escribirse en inglés.
- **RNF-13:** Toda la interfaz, etiqueta, validación, mensaje de error,
  confirmación, notificación y log visible para el usuario deberá estar
  estrictamente en español.
- **RNF-14:** Los títulos, descripciones y notas escritos por el usuario se
  conservarán sin traducción ni modificación automática.
- **RNF-15:** Los colores de asignaturas y grupos deberán mantenerse visibles en
  las vistas de calendario y deberán acompañarse de texto o estado cuando sea
  necesario para no depender únicamente del color.

## Usabilidad, Seguridad Y Calidad

- **RNF-16:** La interfaz deberá ser responsive y usable en escritorio, tablet y
  móvil. Las vistas y controles no deberán requerir una interacción exclusiva
  de un puntero preciso.
- **RNF-17:** Los controles principales deberán ser accesibles mediante teclado,
  tener nombres accesibles y mantener contraste suficiente; los estados no
  deberán comunicarse únicamente mediante color.
- **RNF-18:** La navegación del calendario deberá conservar una jerarquía clara:
  fecha actual y navegación, selector de vista, búsqueda/filtros y contenido
  de eventos. La navegación global deberá presentar `Calendario` y `Notas` como
  sus dos destinos principales, dejando asignaturas, grupos personales y
  dispositivos como administración secundaria. En pantallas pequeñas, los dos
  destinos principales deberán permanecer visibles sin abrir el cajón; los
  controles podrán reorganizarse sin perder su función.
- **RNF-19:** El contenido Markdown deberá sanitizarse antes del renderizado para
  impedir ejecución de scripts, HTML peligroso o enlaces inseguros.
- **RNF-20:** Cada requisito funcional verificable deberá tener casos de prueba
  trazables a su identificador RF. La implementación no se considerará lista
  si fallan las pruebas, el chequeo de tipos o las verificaciones de calidad
  definidas para el proyecto.

# 5. Fuera del Alcance (Out of Scope)

- Compartir eventos, asignaturas, grupos, notas o calendarios entre cuentas.
- Colaboración, invitaciones, permisos delegados y calendarios públicos.
- La implementación real del plugin de KOReader para Kindle.
- La creación de la página del home de SimpleUI y su mecanismo de sincronización
  con Karenda Web.
- Notificaciones por correo, push, alarmas o recordatorios automáticos.
- Eventos recurrentes o reglas de repetición.
- Importación o exportación a formatos ICS, CSV u otros calendarios externos.
- Modo offline, sincronización local persistente y una PWA completa.
- Integración con calendarios de Google, Apple, Outlook o proveedores
  universitarios.
- Adjuntos de archivos en eventos o notas.
- Editor visual WYSIWYG; las notas se crean y editan como Markdown y se
  visualizan renderizadas.
- Administración de usuarios, roles administrativos o un panel multiusuario.

# 6. Criterios de Aceptación

La funcionalidad se considerará terminada únicamente cuando se cumplan todos
los criterios siguientes:

- **CA-01:** Una persona puede registrarse, iniciar sesión y cerrar sesión; una
  sesión no autenticada no puede consultar el calendario protegido y, si la
  sesión expira durante una vista protegida, la aplicación vuelve a `/login`
  conservando el destino solicitado.
- **CA-02:** Una cuenta puede crear, editar y consultar asignaturas con nombre,
  sigla, abreviación y color; los cambios se reflejan en el calendario y en los
  filtros.
- **CA-03:** El sistema impide eliminar una asignatura o grupo que tenga
  eventos o notas asociadas y explica el motivo sin borrar información.
- **CA-04:** Una cuenta puede crear eventos académicos y personales con los
  campos obligatorios definidos, y puede editar o eliminar cada evento con
  validación y confirmación.
- **CA-05:** Los eventos puntuales, de duración, de varios días y de todo el
  día se guardan y se muestran en sus fechas correctas; los rangos inválidos
  son rechazados antes de persistirse.
- **CA-06:** El usuario puede cambiar manualmente un evento entre `Pendiente` y
  `Completado`, y el estado es visible tanto en el detalle como en las vistas.
- **CA-07:** Agenda, Mes, Semana y Día muestran los eventos correctos del rango
  seleccionado; la navegación anterior, siguiente y `Hoy` funciona en todas
  las vistas.
- **CA-08:** La vista Agenda muestra los eventos próximos ordenados por fecha y
  los agrupa de forma legible; las vistas de calendario muestran los colores y
  estados sin ocultar eventos de varios días.
- **CA-09:** La búsqueda encuentra eventos por los campos definidos sin
  distinguir mayúsculas ni acentos, y los filtros por asignatura, grupo, tipo,
  estado y fechas se pueden combinar y limpiar.
- **CA-10:** Una cuenta puede crear, editar, leer y eliminar notas Markdown
  asociadas a una asignatura o grupo personal, pero no asociadas directamente a
  un evento.
- **CA-11:** Las notas muestran correctamente Markdown común y extendido, y
  ningún HTML o script peligroso se ejecuta al visualizarlas.
- **CA-12:** Los errores de validación, carga, guardado y eliminación se
  muestran en español y no generan confirmaciones de éxito falsas.
- **CA-13:** Las pruebas verifican el aislamiento entre dos cuentas: ninguna
  cuenta puede consultar o modificar datos creados por la otra.
- **CA-14:** La persistencia de autenticación y dominio utiliza InsForge como
  única fuente de verdad; no existen bases de datos locales de producción ni
  servicios backend alternativos.
- **CA-15:** La interfaz es usable en escritorio y móvil, `Calendario` y
  `Notas` son accesibles como destinos principales en un solo paso, los
  controles principales son navegables por teclado y los estados no dependen
  solamente del color.
- **CA-16:** Todos los RF tienen pruebas o verificaciones trazables, el chequeo
  de tipos y las comprobaciones de calidad del proyecto pasan correctamente, y
  la documentación permanece sincronizada con el comportamiento implementado.
- **CA-17:** No se incluye en el MVP ninguna funcionalidad de compartir eventos
  entre cuentas ni código de implementación del plugin de KOReader/SimpleUI.
