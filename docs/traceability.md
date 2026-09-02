# Matriz De Trazabilidad

Esta matriz relaciona cada requisito de `specs/001-web-mvp.md`,
`specs/002-ai-event-capture.md` y `specs/003-habits-and-recurring-tasks.md`
con su implementación y verificación. `Automatizado` significa que existe una
prueba local ejecutada; `Estático` significa que se verificó mediante código,
migración, CLI o documentación; `Pendiente` requiere un entorno o autorización
que todavía no está disponible; `Planificado` todavía no tiene implementación.

## Requisitos Funcionales

| Requisito | Implementación | Verificación | Estado |
| --- | --- | --- | --- |
| RF-01 | `authService`, `sessionStore`, `AuthPage` | `authService.test.ts`, `sessionStore.test.ts`; login E2E autenticado pendiente | Parcial |
| RF-02 | `routes.tsx`, `ProtectedRoute`, `ProtectedLayout`, `AuthPage` | `public-routes.spec.ts`, `sessionStore.test.ts`, `errors.test.ts`; recorrido E2E autenticado pendiente | Parcial |
| RF-03 | Servicios con `owner_id`, migración y RLS | Tests de servicios; políticas InsForge verificadas por CLI; prueba runtime de hábitos con dos cuentas aprobada | Parcial |
| RF-04 | `SubjectForm`, `subjectService`, validación | `SubjectForm.test.tsx`, `validation.test.ts`, `domainServices.test.ts` | Automatizado |
| RF-05 | `SubjectForm`, `catalogStore`, `subjectService` | `SubjectForm.test.tsx`, `catalogStore.test.ts`, `domainServices.test.ts` | Automatizado |
| RF-06 | Errores de asociación, triggers y eliminación protegida | `errors.test.ts`, `catalogStore.test.ts`, migración revisada | Automatizado + estático |
| RF-07 | `PersonalGroupForm`, `personalGroupService` | `PersonalGroupForm.test.tsx`, `validation.test.ts`, `domainServices.test.ts` | Automatizado |
| RF-08 | `PersonalGroupsPage`, `catalogStore`, `personalGroupService` | `PersonalGroupForm.test.tsx`, `catalogStore.test.ts` | Automatizado |
| RF-09 | Errores de asociación, triggers y eliminación protegida | `errors.test.ts`, `catalogStore.test.ts`, migración revisada | Automatizado + estático |
| RF-10 | `EventForm`, `eventService` y relaciones académicas | `EventForm.test.tsx`, `validation.test.ts`, `domainServices.test.ts` | Automatizado |
| RF-11 | `EventForm`, `eventService` y relaciones personales | `EventForm.test.tsx`, `validation.test.ts` | Automatizado |
| RF-12 | Fechas de duración, todo el día y mapper FullCalendar | `EventForm.test.tsx`, `dateUtils.test.ts`, `calendarEventMapper.test.ts` | Automatizado |
| RF-13 | Validación de rangos inclusivos | `validation.test.ts`, `EventForm.test.tsx` | Automatizado |
| RF-14 | Edición completa y validación combinada | `eventService.ts`, `domainServices.test.ts`, `EventForm.test.tsx` | Automatizado |
| RF-15 | `EventDetail`, `ConfirmDialog`, `calendarStore` | Confirmación en `EventDetail.test.tsx`; prueba de servicio real pendiente | Parcial |
| RF-16 | Estados explícitos, detalle y mapper | `calendarEventMapper.test.ts`, `EventDetail.test.tsx`, `calendarStore.test.ts` | Automatizado |
| RF-17 | `CalendarPage` y navegación de Agenda | `CalendarPage.test.tsx`, `AgendaView.test.tsx`; navegación E2E autenticada pendiente | Parcial |
| RF-18 | `AgendaView` y `listUpcomingEvents` | `AgendaView.test.tsx`, `domainServices.test.ts` | Automatizado |
| RF-19 | FullCalendar `dayGridMonth` | Configuración revisada; prueba de navegador autenticada pendiente | Parcial |
| RF-20 | FullCalendar `timeGridWeek` | Configuración revisada; prueba de navegador autenticada pendiente | Parcial |
| RF-21 | FullCalendar `timeGridDay` | Configuración revisada; prueba de navegador autenticada pendiente | Parcial |
| RF-22 | `eventFilters` y barra de búsqueda | `eventFilters.test.ts`, `CalendarPage.test.tsx` | Automatizado |
| RF-23 | Filtros por categoría y rango | `eventFilters.test.ts`, `CalendarFiltersPanel.test.tsx`, `CalendarPage.test.tsx` | Automatizado |
| RF-24 | `clearFilters` y estado compartido | `CalendarPage.test.tsx`, `calendarStore.test.ts` | Automatizado |
| RF-25 | `NoteEditor`, `noteService`, `noteStore` | `NoteEditor.test.tsx`, `noteStore.test.ts`, `validation.test.ts`, `domainServices.test.ts` | Automatizado |
| RF-26 | `MarkdownRenderer` y vista previa | `MarkdownRenderer.test.tsx`, `NoteEditor.test.tsx` | Automatizado |
| RF-27 | `rehype-sanitize` y enlaces seguros | `MarkdownRenderer.test.tsx` | Automatizado |
| RF-28 | `AppError`, estados de stores y feedback de formularios | `errors.test.ts`, tests de stores y componentes | Automatizado |

## Requisitos De Creación Asistida Con IA

| Requisito | Implementación | Verificación | Estado |
| --- | --- | --- | --- |
| RF-IA-01 | `karenda-ai-event-drafts`, validación de bearer y `getCurrentUser` | Inspección de la función desplegada | Estático |
| RF-IA-02 | Contrato de prompt en `aiEventService` y función | `aiEventService.test.ts` | Automatizado |
| RF-IA-03 | Catálogo cargado server-side con cliente autenticado | Inspección de función y RLS del SDK | Estático |
| RF-IA-04 | Fallback secuencial de OpenRouter | Inspección del orden de modelos en la función | Estático |
| RF-IA-05 | Validación de respuesta y banderas de revisión | `aiEventService.test.ts`, `validation.test.ts` | Automatizado |
| RF-IA-06 | `AiEventPromptPanel` y reutilización de `EventForm` | `AiEventPromptPanel.test.tsx` | Automatizado |
| RF-IA-07 | Confirmación y guardado a través de `calendarStore` | `CalendarPage.test.tsx`, `AiEventPromptPanel.test.tsx` | Automatizado |
| RF-IA-08 | Validación existente de `eventInputSchema` | `validation.test.ts`, `AiEventPromptPanel.test.tsx` | Automatizado |
| RF-IA-09 | Resultado total/parcial del guardado múltiple | `AiEventPromptPanel.test.tsx` | Automatizado |
| RF-IA-10 | `OPENROUTER_API_KEY` solo en función server-side | Secreto InsForge, búsqueda estática y bundle de producción | Automatizado + estático |
| RF-IA-11 | Función sin escrituras de prompt/respuesta | Inspección de función desplegada | Estático |
| RF-IA-12 | `CalendarPage` crea grupos confirmados y asocia eventos | `CalendarPage.test.tsx`, `validation.test.ts` | Automatizado |

## Criterios De Aceptación De Creación Asistida

| Criterio | Verificación actual | Estado |
| --- | --- | --- |
| CA-IA-01 a CA-IA-06 | `aiEventService.test.ts`, `validation.test.ts`, `AiEventPromptPanel.test.tsx`, `CalendarPage.test.tsx`; inspección de función | Automatizado + estático |
| CA-IA-07 | Búsqueda estática del secreto y bundle de producción | Automatizado |
| CA-IA-08 | `npm test`, lint, typecheck, build y documentación | Automatizado |

## Requisitos No Funcionales

| Requisito | Verificación actual | Estado |
| --- | --- | --- |
| RNF-01 | TypeScript, React, Vite y build local | Automatizado |
| RNF-02 | Configuración de FullCalendar en `CalendarPage` | Estático |
| RNF-03 | React Markdown, GFM y sanitización | Tests de Markdown | Automatizado |
| RNF-04 | SDK de InsForge como capa de persistencia | Revisión de arquitectura y código | Estático |
| RNF-05 | Zustand como caché, sin base local de producción | Revisión de stores y dependencias | Estático |
| RNF-06 | No existen rutas backend ni autenticación alternativa | Revisión del árbol y `package.json` | Estático |
| RNF-07 | UUID y contratos en `types/domain.ts` y migración | Revisión de tipos y esquema | Estático |
| RNF-08 | Conversión ISO y límites locales | `dateUtils.test.ts`, `domainServices.test.ts` | Automatizado |
| RNF-09 | Fechas all-day sin desplazamiento visible | `dateUtils.test.ts`, `EventForm.test.tsx` | Automatizado |
| RNF-10 | Nulos, relaciones, estados y destinos explícitos | Tipos, validación y migración | Estático |
| RNF-11 | RLS y privilegios por rol | CLI: políticas, RLS habilitado y sin privilegios `anon`; runtime entre cuentas pendiente | Parcial |
| RNF-12 | Código, nombres y comentarios en inglés | Lint y revisión de código | Automatizado + estático |
| RNF-13 | UI y errores visibles en español | Tests de componentes y E2E público | Automatizado |
| RNF-14 | Mappers conservan títulos, descripciones y Markdown | Servicios y `MarkdownRenderer.test.tsx` | Automatizado |
| RNF-15 | Color acompañado de texto y estado | Mapper, Agenda y detalle | Automatizado + estático |
| RNF-16 | Layout responsive, navegación principal persistente, drawer móvil y E2E desktop/mobile público | `ProtectedLayout.test.tsx`, Playwright público; recorrido autenticado pendiente | Parcial |
| RNF-17 | Foco, teclado, nombres accesibles y estados textuales | `ProtectedLayout.test.tsx`, revisión UI y CSS global | Parcial |
| RNF-18 | `ProtectedLayout`, jerarquía de fecha, vistas, búsqueda y filtros | `ProtectedLayout.test.tsx`, `CalendarPage.test.tsx`, `ui-design.md` | Automatizado + estático |
| RNF-19 | Sanitización Markdown | `MarkdownRenderer.test.tsx` | Automatizado |
| RNF-20 | Cobertura trazable y checks de calidad | Esta matriz, `npm test`, lint, typecheck, build e Impeccable | Parcial |

## Criterios De Aceptación

| Criterio | Verificación actual | Estado |
| --- | --- | --- |
| CA-01 | Auth local, `ProtectedRoute` y redirección pública; credenciales autenticadas pendientes | `authService.test.ts`, `sessionStore.test.ts`, `public-routes.spec.ts`; flujo autenticado pendiente | Parcial |
| CA-02 | Formularios, stores y servicios de catálogo | Automatizado |
| CA-03 | Errores y triggers de asociaciones | Automatizado + estático |
| CA-04 | Formularios y detalle de eventos; flujo browser pendiente | Parcial |
| CA-05 | Validaciones, fechas locales y mapper | Automatizado |
| CA-06 | Estados en detalle, Agenda y calendario | Automatizado |
| CA-07 | Componentes y Agenda; recorrido autenticado pendiente | Parcial |
| CA-08 | Agrupación, orden y estados de Agenda | Automatizado |
| CA-09 | Búsqueda, filtros y limpieza | Automatizado |
| CA-10 | CRUD de notas en stores, servicios y componentes | Automatizado |
| CA-11 | Markdown extendido y sanitización | Automatizado |
| CA-12 | Errores de validación, carga, guardado y eliminación | Automatizado |
| CA-13 | Políticas estáticas verificadas; dos cuentas runtime pendientes | Parcial |
| CA-14 | InsForge SDK y no backend alternativo | Estático |
| CA-15 | Navegación primaria, foco, drawer, tamaños táctiles y E2E público responsive | `ProtectedLayout.test.tsx`, Playwright público; recorrido autenticado pendiente | Parcial |
| CA-16 | Matriz y checks locales; faltan RLS y E2E autenticado de producción | Parcial |
| CA-17 | Revisión de alcance; no hay compartir ni plugin | Estático |

## Seguimiento De Hábitos Y Tareas Recurrentes

La funcionalidad está definida en specs/003-habits-and-recurring-tasks.md.
La implementación local está en `main` y las migraciones de hábitos ya fueron
promovidas al proyecto principal `karenda`; la prueba RLS entre cuentas quedó
verificada en las siete tablas. El E2E autenticado sigue pendiente por falta de
credenciales de prueba.

### Requisitos Funcionales

| Requisito | Implementación prevista | Verificación prevista | Estado |
| --- | --- | --- | --- |
| RF-H-01 a RF-H-02 | Ruta /habits, ProtectedLayout y navegación primaria | Typecheck, tests locales; E2E responsive pendiente | Parcial |
| RF-H-03 a RF-H-06 | HabitForm, habitValidation y habitService | Tests de formulario y Zod | Automatizado |
| RF-H-07 a RF-H-11 | HabitRow, habitEvaluation y habitStore | Tests del evaluador y formulario; E2E pendiente | Parcial |
| RF-H-12 a RF-H-15 | Ciclo de vida, reglas versionadas y estadísticas | Tests puros y revisión de código | Automatizado + estático |
| RF-H-16 a RF-H-17 | HabitNotesPanel, HabitNotesLibrary, habitService y Markdown seguro | Test contextual de carga, render seguro y eliminación; E2E pendiente | Parcial |
| RF-H-18 a RF-H-20 | CalendarDisplayItem y proyección FullCalendar/Agenda | Tests de rango, visibilidad y solo lectura | Automatizado + parcial |
| RF-H-21 a RF-H-24 | RecurringTaskForm, recurring_task_schedule_versions, habitService y recurringTaskStore | Tests de servicio, store y formulario; RLS runtime aprobada; E2E pendiente | Automatizado + parcial |
| RF-H-25 a RF-H-28 | Filtros, feedback, RLS y ausencia de permisos de notificación | Tests locales, migración revisada y RLS runtime; E2E pendiente | Parcial |

### Requisitos No Funcionales

| Requisito | Implementación prevista | Verificación prevista | Estado |
| --- | --- | --- | --- |
| RNF-H-01 a RNF-H-03 | React/Vite/Zustand, servicios puros y validaciones | Typecheck, lint y Vitest | Automatizado |
| RNF-H-04 a RNF-H-07 | Fechas civiles, proyección explícita, fuentes e idempotencia | Tests de fechas, contratos y migración revisada | Automatizado + estático |
| RNF-H-08 a RNF-H-09 | Componentes accesibles y matriz actualizada | Auditoría estática y Testing Library; E2E pendiente | Parcial |

### Criterios De Aceptación

| Criterio | Verificación prevista | Estado |
| --- | --- | --- |
| CA-H-01 a CA-H-03 | Formulario, relaciones, recurrencias y tres tipos de seguimiento | Tests de formulario/validación y typecheck | Automatizado |
| CA-H-04 a CA-H-08 | Evaluador puro, historial, pausas y versiones de regla | Tests de recurrencia/evaluación y revisión de flujo | Automatizado + parcial |
| CA-H-09 a CA-H-11 | Estadísticas, notas y proyección de calendario | Tests de motor/proyección; UI autenticada pendiente | Automatizado + parcial |
| CA-H-12 a CA-H-13 | Flujos de tareas, filtros, errores y responsive | Tests locales, lint y build; E2E pendiente | Parcial |
| CA-H-14 a CA-H-15 | Integración RLS, revisión de snapshot v1 y alcance web-only | SQL revisado, snapshot sin cambios y RLS runtime en siete tablas; E2E pendiente | Parcial |

### Brechas Y Riesgos A Vigilar

- Definir durante la migración si las reglas versionadas usarán columnas
  explícitas, un payload discriminado validado o una combinación de ambos.
- Evitar que la proyección de cuotas sin días fijos sugiera una obligación diaria
  falsa; la UI deberá distinguir meta de periodo y ocurrencia programada.
- Mantener HabitNote separado de notes mientras el snapshot v1 de KOReader solo
  admita notas de asignaturas y grupos personales.
- Probar meses con menos días, cambios de zona horaria, pausas y correcciones
  históricas antes de construir gráficas.
- No planificar todavía una escritura desde KOReader hasta fijar un contrato
  posterior de scope, vinculación e idempotencia.
- La migración se validó en una rama aislada limpia y se promovió al proyecto
  principal mediante dry-run sin conflictos y merge transaccional; el segundo
  paso `20260902130000` activa RLS en la tabla de versiones de tareas que quedó
  fuera del primer paso.

- La ingesta futura de KOReader quedó especificada en
  specs/004-koreader-habit-log-ingestion.md; no se implementó ni se modificó el
  plugin o el snapshot v1.

## Gaps De Cierre

- Mantener la prueba RLS runtime como smoke de regresión cuando cambie el
  esquema de hábitos.
- Completar el flujo E2E autenticado con creación, búsqueda, filtros y notas.
- Evidencia actual de navegador: el login público pasa en escritorio y móvil;
  los escenarios autenticados se omiten sin credenciales de prueba y el
  redirect protegido se omite cuando InsForge no está disponible en el entorno.
- Completar el smoke test autenticado de producción; el frontend ya está
  publicado en `https://5zz5dxgt.insforge.site` y el smoke test público pasa en
  escritorio y móvil.
- Resolver la revisión de credenciales documentadas antes de considerar el MVP
  listo para publicar; la clave de usuario expuesta previamente ya fue retirada
  de `agents.md` y `tasks.md`, pero debe rotarse desde InsForge.
