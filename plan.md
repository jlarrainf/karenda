# Plan Técnico De Karenda Web

## 1. Referencias Y Límites

Este plan está subordinado a:

- `specs/001-web-mvp.md`, que define el alcance, el comportamiento y los
  criterios de aceptación del MVP.
- `specs/003-habits-and-recurring-tasks.md`, que define el seguimiento web de
  hábitos, tareas recurrentes, proyecciones de calendario y notas de hábitos.
- `docs/constitution.md`, que exige desarrollo Spec-Anchored, trazabilidad,
  tests y delegación total del backend a InsForge.
- `AGENTS.md`, que define las reglas de idioma, el stack general, el estándar
  futuro de infraestructura y el flujo obligatorio del agente.
- `docs/git-workflow.md`, que define la colaboración por ramas, la publicación
  remota y la integración segura mediante Pull Requests.

No se implementará un backend propio, una base de datos local de producción,
un sistema de autenticación alternativo ni el plugin de KOReader/SimpleUI. El
módulo de hábitos y tareas recurrentes será exclusivo de la web en esta fase.

## 2. Arquitectura General

Karenda Web será una aplicación React de cliente que consumirá InsForge
directamente mediante el SDK oficial. La aplicación se dividirá en cuatro
capas:

1. **Presentación:** componentes React, vistas de calendario, formularios,
   navegación y mensajes en español.
2. **Estado de cliente:** Zustand para sesión, selección temporal de vista,
   búsqueda, filtros, datos cargados y estado de formularios.
3. **Servicios de dominio:** funciones TypeScript que validan entradas,
   convierten contratos y ejecutan operaciones contra InsForge.
4. **InsForge:** autenticación, PostgreSQL, RLS, persistencia, almacenamiento
   necesario, lógica backend y hosting.

Los componentes no deberán llamar directamente al SDK de InsForge. Deberán
usar stores y servicios, de forma que el modelo de datos pueda ser consumido
por el futuro plugin sin depender de React.

El estado almacenado en Zustand será una caché de trabajo y estado de
interfaz. Después de una mutación, la aplicación deberá confirmar el resultado
con InsForge o volver a consultar el rango afectado. InsForge será siempre la
fuente de verdad persistente.

## 3. Estructura De Directorios

La estructura inicial propuesta es:

```text
.
├── agents.md
├── docs/
│   └── constitution.md
├── specs/
│   └── 001-web-mvp.md
├── plan.md
├── tasks.md
├── public/
└── src/
    ├── main.tsx
    ├── app/
    │   ├── App.tsx
    │   ├── routes.tsx
    │   └── providers/
    │       └── AppProviders.tsx
    ├── components/
    │   ├── ui/
    │   ├── layout/
    │   └── feedback/
    ├── features/
    │   ├── auth/
    │   │   └── components/
    │   ├── calendar/
    │   │   └── components/
    │   ├── events/
    │   │   └── components/
    │   ├── subjects/
    │   │   └── components/
    │   ├── personal-groups/
    │   │   └── components/
    │   └── notes/
    │       └── components/
    ├── lib/
    │   ├── insforge/
    │   │   ├── client.ts
    │   │   └── database.types.ts
    │   ├── dates/
    │   ├── markdown/
    │   ├── text/
    │   └── validation/
    ├── services/
    │   ├── authService.ts
    │   ├── subjectService.ts
    │   ├── personalGroupService.ts
    │   ├── eventService.ts
    │   └── noteService.ts
    ├── stores/
    │   ├── sessionStore.ts
    │   ├── calendarStore.ts
    │   ├── catalogStore.ts
    │   └── noteStore.ts
    ├── types/
    │   └── domain.ts
    ├── styles/
    │   └── index.css
    └── test/
        ├── setup.ts
        ├── fixtures/
        └── mocks/
```

### Responsabilidad De Directorios

- `app/` compone la aplicación, rutas protegidas y proveedores globales.
- `components/ui/` contiene controles reutilizables sin lógica de dominio.
- `features/` contiene la interfaz específica de cada capacidad del MVP.
- `lib/` contiene adaptadores técnicos puros, utilidades y configuración.
- `services/` es la única capa de acceso a InsForge desde el frontend.
- `stores/` contiene estado de cliente y resultados de consultas; no reemplaza
  la persistencia de InsForge.
- `types/domain.ts` contiene tipos de contrato independientes de React.
- `test/` contiene configuración, fixtures y mocks compartidos.

Los nombres de archivos, variables, funciones, tipos y comentarios seguirán la
regla de código en inglés. Los textos de interfaz, errores y logs visibles
serán españoles.

## 4. Modelo De Datos En InsForge

### Cuenta Y Aislamiento

InsForge Auth administra las cuentas y sesiones. No se creará una tabla de
usuarios paralela para el MVP. Cada entidad de dominio incluirá `owner_id`,
correspondiente al identificador de la cuenta autenticada.

Todas las tablas de dominio tendrán también `id`, `created_at` y `updated_at`
como metadatos técnicos. Estos campos no alteran el comportamiento visible y
permiten sincronización, ordenamiento y auditoría básica.

Las políticas RLS deberán restringir cada operación a `owner_id` igual al
usuario autenticado. No existirán políticas de lectura o escritura compartida.

### Entidades

| Entidad | Campos de dominio | Relaciones y reglas |
| --- | --- | --- |
| `Subject` | `id`, `owner_id`, `name`, `code`, `abbreviation`, `color` | Una asignatura pertenece a una cuenta y puede tener muchos eventos académicos y notas. `color` usa `#RRGGBB`. |
| `PersonalGroup` | `id`, `owner_id`, `name`, `color` opcional | Un grupo pertenece a una cuenta y puede agrupar eventos personales y notas. Si no tiene color, la UI usa uno neutro. |
| `Event` | `id`, `owner_id`, `kind`, `title`, `subject_id`, `personal_group_id`, `start_at`, `end_at`, `is_all_day`, `status`, `location`, `description` | `kind` es `academic` o `personal`. Un evento académico exige `subject_id` y no usa `personal_group_id`; uno personal no usa `subject_id` y puede usar grupo. |
| `Note` | `id`, `owner_id`, `target_type`, `target_id`, `title`, `content_markdown` | `target_type` es `subject` o `personal_group`; cada nota tiene exactamente un destino y nunca se asocia directamente a un evento. |

### Restricciones De Eventos

- `status` solo acepta `pending` o `completed`.
- `kind` determina qué relación puede tener el evento; no se añadirá una
  categoría obligatoria separada del título.
- `start_at` es obligatorio.
- Cuando `is_all_day` es falso, la interfaz exige hora de inicio.
- Cuando el evento tiene duración o varios días, `end_at` es obligatorio y es
  posterior a `start_at`.
- Los eventos de todo el día deben conservar su fecha local al convertirlos a
  la representación persistida.
- `location` y `description` son nulos cuando no se proporcionan.
- La eliminación de una asignatura o grupo con eventos o notas dependientes se
  bloqueará antes de borrar datos.

### Relaciones Y Consultas

- `Account 1:N Subject`.
- `Account 1:N PersonalGroup`.
- `Account 1:N Event`.
- `Account 1:N Note`.
- `Subject 1:N academic Event`.
- `PersonalGroup 1:N personal Event`.
- `Subject 1:N Note` o `PersonalGroup 1:N Note`, nunca ambos a la vez.

La nota usa un destino polimórfico (`target_type` + `target_id`) para mantener
un contrato simple para consumidores externos. El servicio y las políticas RLS
de InsForge deberán comprobar que el destino existe y pertenece a la misma
cuenta.


Se planifican índices sobre:

- `owner_id` en todas las tablas.
- `events(owner_id, start_at)` para rangos de calendario y agenda.
- `events(owner_id, kind, status)` para filtros frecuentes.
- `events(owner_id, subject_id)` y `events(owner_id, personal_group_id)`.
- `notes(owner_id, target_type, target_id)`.

Las consultas de calendario solicitarán al menos el rango visible. La agenda
solicitará eventos desde la fecha actual en adelante. La interfaz no deberá
cargar datos de otras cuentas ni asumir que todos los eventos caben en una
consulta ilimitada.

## 5. Decisiones Técnicas Del Frontend

### Stack

- **React:** composición de vistas y componentes interactivos.
- **TypeScript:** contratos de dominio, props, respuestas de InsForge y
  validaciones estáticas.
- **Vite:** desarrollo y build del frontend sin introducir un servidor de
  aplicación propio.
- **Tailwind CSS 3.4 + PostCSS:** estilos utilitarios, responsive design, tokens
  visuales y estados consistentes.
- **FullCalendar:** vistas `dayGridMonth`, `timeGridWeek`, `timeGridDay` y
  `list` para Mes, Semana, Día y Agenda.
- **Zustand:** estado global de cliente y coordinación entre calendario,
  filtros, sesión y datos consultados.
- **InsForge SDK:** autenticación, consultas, mutaciones y sesión persistente.
- **React Markdown + remark-gfm + sanitización:** edición y renderizado seguro
  de notas Markdown.
- **React Hook Form + Zod:** formularios y validación compartida entre UI y
  servicios, sin reemplazar las validaciones de InsForge.

No se utilizará Next.js ni se crearán Route Handlers, Server Actions o API
routes propios, porque el MVP no necesita una capa de servidor adicional y la
constitución exige que el backend sea InsForge.

### Dirección Visual Y Sistema De Diseño

Antes de implementar cualquier interfaz visual, el análisis UI/UX y sus
decisiones se documentarán en `docs/ui-design.md` aplicando las metodologías de
`pbakaus/impeccable`. Ese archivo será la fuente de verdad visual para los
tokens, la configuración de Tailwind, el layout, los componentes, los estados,
el comportamiento responsive y las reglas de accesibilidad. Toda desviación
visual deberá actualizar primero este documento y, si cambia el comportamiento o
el contrato, también la spec correspondiente.

### Estado Global Con Zustand

Se usarán stores pequeños y orientados a responsabilidades:

- `sessionStore`: sesión actual, estado de carga, usuario y cierre de sesión.
- `calendarStore`: vista activa, fecha de referencia, búsqueda, filtros,
  selección de evento y rango visible.
- `catalogStore`: asignaturas, grupos personales y sus estados de carga/error.
- `noteStore`: notas del destino seleccionado, editor y estado de guardado.

Los stores expondrán acciones que llamen a `services/`. No se colocarán
consultas crudas de InsForge dentro de componentes ni se usará Zustand como una
base de datos local. Las mutaciones actualizarán el store solo después de una
respuesta válida o invalidarán el rango/catálogo para volver a consultarlo.

### Acceso A InsForge

`lib/insforge/client.ts` inicializará un único cliente con variables de entorno
del frontend. Los servicios deberán:

1. Recibir datos de dominio validados.
2. Traducirlos a los campos del contrato de InsForge.
3. Ejecutar la operación usando el SDK.
4. Traducir la respuesta a tipos de `types/domain.ts`.
5. Convertir errores técnicos en errores manejables por la UI, cuyos mensajes
   serán españoles.

Las variables públicas necesarias para el cliente se configurarán mediante el
entorno de Vite. Nunca se enviará al navegador una clave administrativa o un
secreto de backend.

### Calendario Y Diseño De Interfaz

- El calendario tendrá una barra de navegación con fecha actual, anterior,
  siguiente y `Hoy`.
- El selector de vistas permitirá Agenda, Mes, Semana y Día.
- La barra de herramientas incorporará búsqueda y filtros sin ocultarlos en
  escritorio; en móvil podrán agruparse en un panel o cajón accesible.
- Un panel lateral o cajón mostrará asignaturas y grupos con sus colores y
  controles de visibilidad.
- Los eventos académicos usarán el color de su asignatura; los personales
  usarán el color de su grupo o un color neutro.
- El estado se mostrará mediante texto y señal visual adicional, no solo por
  color.
- `eventClick` abrirá el detalle y las acciones de editar, eliminar y cambiar
  estado. La selección de un rango podrá iniciar el formulario con fechas
  precargadas.
- La vista Agenda agrupará eventos próximos por fecha y los ordenará por hora.
- En móvil se priorizará una lectura clara y controles táctiles accesibles sin
  eliminar las capacidades del MVP.

### Notas Markdown

Las notas se editarán como texto Markdown y tendrán una vista de previsualización
renderizada. El renderizador deberá admitir Markdown extendido común, pero
sanitizará HTML, scripts, atributos inseguros y enlaces peligrosos antes de
mostrar el resultado.

El contenido original se conservará en `content_markdown`; el HTML renderizado
será una representación temporal y nunca la fuente de verdad.

## 6. Seguridad, Idioma Y Calidad

- Todas las operaciones de dominio se ejecutarán con la sesión de InsForge y
  quedarán protegidas por RLS.
- Los servicios no confiarán únicamente en filtros del cliente para aislar
  cuentas.
- El cliente no guardará tokens administrativos, credenciales privadas ni
  datos persistentes fuera de InsForge.
- Todo el código, tipos, funciones, variables, lógica y comentarios estará en
  inglés.
- La UI, validaciones, mensajes, confirmaciones y logs visibles estarán en
  español.
- Las fechas con hora usarán ISO 8601 con zona definida o UTC con conversión
  explícita. Las fechas de todo el día se tratarán como fechas locales.
- Tailwind y FullCalendar deberán mantener contraste, foco visible, etiquetas
  accesibles y navegación por teclado.
- Vitest y Testing Library cubrirán lógica y componentes; Playwright cubrirá
  flujos críticos en navegador cuando el entorno de InsForge esté disponible.
- Cada prueba deberá poder relacionarse con un RF, RNF o CA. Si durante la
  implementación cambia el comportamiento, primero se actualizará esta spec y
  luego el código y sus tests.

## 7. Despliegue Y Evolución

El frontend se publicará mediante el hosting/Sites de InsForge conforme al
estándar del proyecto. La configuración de conexión y las tareas de backend se
realizarán con las skills de InsForge cuando se abandone el Modo Plan.

El plugin de KOReader no compartirá componentes con el frontend. Consumirá en
el futuro los contratos de InsForge, por lo que debe poder interpretar de forma
independiente:

- Identificadores estables.
- `kind` y `status` como valores explícitos.
- Relaciones con asignaturas y grupos.
- Rangos temporales y eventos de todo el día.
- Contenido Markdown original de las notas.

No se añadirá ninguna decisión de sincronización con KOReader hasta contar con
una especificación propia para esa fase.

## 8. Trazabilidad De Alto Nivel

| Área de la spec | Componentes del plan | Fases principales de `tasks.md` |
| --- | --- | --- |
| RF-01 a RF-03, CA-01, CA-13, CA-14 | InsForge Auth, `sessionStore`, RLS | Fases 1, 2, 3 y 8 |
| RF-04 a RF-09, CA-02, CA-03 | `Subject`, `PersonalGroup`, stores y servicios de catálogo | Fases 2, 3 y 4 |
| RF-10 a RF-16, CA-04 a CA-06 | `Event`, formularios, validaciones y detalle | Fases 2, 3 y 5 |
| RF-17 a RF-21, CA-07, CA-08 | FullCalendar y navegación | Fase 5 |
| RF-22 a RF-24, CA-09 | `calendarStore`, búsqueda y filtros | Fase 6 |
| RF-25 a RF-27, CA-10, CA-11 | `Note`, editor y renderizador seguro | Fase 7 |
| RF-28, RNF-12 a RNF-20, CA-12, CA-15, CA-16 | feedback, pruebas, accesibilidad y documentación | Fase 1 y Fase 8 |
| RF-H-01 a RF-H-28, CA-H-01 a CA-H-15 | `Habit`, `HabitLog`, `RecurringTask`, `HabitNote`, proyección de calendario y estadísticas | Fases 9 a 15 |

La matriz detallada de implementación, pruebas, verificaciones estáticas y
brechas abiertas se mantiene en `docs/traceability.md`.

## 9. Modelo De Hábitos Y Tareas Recurrentes

El módulo tendrá servicios y stores separados de eventService y
calendarStore, aunque el calendario consumirá una proyección común:

- habitService y habitStore gestionarán definiciones, reglas y logs.
- habitRecurrence.ts calculará ocurrencias de forma pura para un rango local.
- habitEvaluation.ts calculará estado, cuotas, rachas y porcentajes sin
  escribir datos.
- recurringTaskService gestionará la próxima ocurrencia y el historial de
  tareas, sin mezclarlas con estadísticas de hábitos.
- habitNoteService usará una tabla propia para no cambiar el snapshot v1 de
  KOReader ni obligar a que el plugin entienda un nuevo target_type.
- calendarDisplayItem será una unión explícita de event,
  habit_occurrence y recurring_task_occurrence; FullCalendar recibirá solo
  elementos derivados y de solo lectura para las dos últimas fuentes.

La persistencia propuesta en InsForge es:

- habits: identidad, relación opcional, tipo de medición, objetivo, política,
  estado, estadísticas y configuración general.
- habit_schedule_versions: regla con fechas efectivas para que cambiar una
  frecuencia no reinterprete el historial.
- habit_logs: valores o estados explícitos por fecha local, incluyendo source y
  external_id reservados para integraciones.
- habit_notes: notas generales o diarias vinculadas a un hábito.
- recurring_tasks: definición, regla, próxima fecha, relaciones y estado.
- recurring_task_occurrences: historial de completados y reprogramaciones.

Todas las tablas tendrán owner_id, RLS, índices por propietario y por
relación/fecha. Las inserciones se harán mediante arrays conforme al estándar de
InsForge. No se añadirá una base de datos local.

### Evaluación Sin Procesos Nocturnos

Las ocurrencias esperadas se calcularán para el rango visible y los estados
pasados se derivarán de la fecha local y los logs. Esto evita depender de un
cron para convertir hábitos en Incumplido. Las tareas recurrentes sí
mantendrán su next_due_date y su historial al completar una ocurrencia.

### Recurrencias Y Cambios

El formulario comenzará con presets y revelará solo los campos necesarios. La
regla se almacenará con estructura explícita y validación Zod/InsForge. Un
cambio de regla se versionará desde una fecha efectiva; cambiar una próxima
fecha de tarea no cambiará automáticamente la regla futura.

## 10. Experiencia De Usuario

La ruta principal será /habits y la navegación protegida expondrá
Calendario, Hábitos y Notas como las tres superficies principales. En móvil las
tres permanecerán visibles en la navegación compacta; dispositivos, asignaturas
y grupos seguirán dentro del cajón secundario.

La pantalla de Hábitos tendrá cuatro vistas:

1. Hoy: lista rápida de hábitos activos esperados en la fecha seleccionada,
   agrupados en pendientes, parciales, completados, omitidos e incumplidos.
2. Historial: cuadrícula por hábito y fecha para revisar o corregir logs.
3. Estadísticas: resumen global opcional y detalle por hábito con filtro de
   rango.
4. Tareas recurrentes: lista separada de pendientes, vencidas, archivadas y
   completadas.

El alta y edición usarán pasos progresivos:

1. nombre, descripción, color y relación opcional;
2. tipo de seguimiento y objetivo;
3. frecuencia rápida o personalizada;
4. evaluación por ocurrencia o cuota y política de omisión/incumplimiento;
5. estadísticas, notas y proyección en calendario.

El formulario mostrará una frase de resumen de la configuración antes de
guardar. Los valores iniciales serán: hábito binario, seguimiento por
ocurrencia, estadísticas activadas, sin proyección de calendario y sin nota
asociada.

La acción diaria debe requerir una interacción corta:

- binario: Completar u Omitir;
- cantidad/duración: campo de valor con unidad y avance;
- histórico: selector de fecha y menú explícito para corregir, quitar o añadir
  nota;
- tarea recurrente: Completar, Reprogramar y Archivar desde su propia sección.

El calendario podrá mostrar proyecciones con color y etiqueta Hábito o
Tarea recurrente. Al abrir una proyección, el detalle ofrecerá Abrir en
Hábitos, pero no acciones de cumplimiento ni edición.

## 11. Estadísticas Y Reglas De Lectura

Las estadísticas se calcularán según la modalidad y no con una fórmula única:

- hábitos diarios por ocurrencia: racha de días o de ocurrencias completadas;
- hábitos con días seleccionados: racha sobre ocurrencias programadas;
- cuotas semanales/mensuales: racha de periodos que alcanzan la meta;
- cantidad/duración: total, promedio, meta alcanzada y progreso parcial;
- Omitido: no rompe la racha y no reduce el porcentaje;
- Incumplido: rompe la racha y cuenta como periodo no logrado;
- Pendiente: no entra al denominador mientras el periodo siga abierto.

Se evitará un agregado global que mezcle minutos, episodios y casillas como si
fueran la misma unidad. El resumen general usará proporciones de objetivos
cumplidos y permitirá filtrar por relación o periodo.

## 12. Evolución Con KOReader

La web no solicitará todavía permisos de dispositivo ni sincronizará hábitos.
La compatibilidad futura se preservará mediante:

- source = manual | koreader en logs;
- external_id para reintentos idempotentes;
- un futuro scope write:habit_logs, separado de read:snapshot;
- una conexión explícita entre un dispositivo, un hábito y una métrica como
  minutos o páginas;
- una futura versión del snapshot si se decide mostrar hábitos en KOReader.

El plugin actual seguirá siendo solo lector del snapshot v1 y no se modificará
como parte de esta fase.

## 13. Verificación Del Módulo

Antes de implementar UI se actualizará docs/ui-design.md. Antes de migrar se
validarán contratos, RLS y restricciones. La implementación se dividirá en:

- funciones puras de recurrencia, periodos y estados;
- migración InsForge y servicios;
- stores y lista diaria;
- formulario progresivo de hábitos;
- historial, notas y estadísticas;
- tareas recurrentes;
- proyección de calendario;
- pruebas E2E, accesibilidad, RLS y trazabilidad.

Cada incremento actualizará esta spec, tasks.md y docs/traceability.md en el
mismo cambio.

## 14. Aplicación Android

La aplicación Android se mantendrá en `android/` dentro del mismo repositorio y
se construirá con Capacitor desde los assets locales del build de Vite. No se
usará una TWA ni se cargará una URL remota en producción. Web y Android
compartirán servicios, validaciones, contratos y funciones de InsForge; Android
añadirá únicamente adaptadores para ciclo de vida, enlaces, conectividad y
almacenamiento seguro de sesión.

La primera versión será online-first y no añadirá una base de datos local. La
interfaz informará la falta de conexión y no mostrará escrituras como exitosas
sin confirmación de InsForge. Una caché cifrada de solo lectura será una fase
posterior con especificación propia, expiración, limpieza por cuenta y etiqueta
de antigüedad. Notificaciones, widgets y accesos rápidos también requerirán
specs independientes.

El trabajo se dividirá en: contrato Android y decisiones de UI; spike de
Capacitor; shell y build nativo; adaptadores de sesión y plataforma; prueba
funcional en emulador y dispositivo real; APK personal firmado; y auditoría de
secretos, navegación, permisos, accesibilidad y trazabilidad.
