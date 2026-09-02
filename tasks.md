# Tareas De Implementación De Karenda Web

Las tareas no marcadas están pendientes y deben ejecutarse solo después de salir
del Modo Plan. Cada tarea está dimensionada para aproximadamente 20-30 minutos y
debe mantener la trazabilidad con `specs/001-web-mvp.md` y
`docs/constitution.md`.

## Fase 1: Infraestructura Y Base Del Frontend

- [x] **Tarea 1: Configurar y linkear InsForge** (20-30 min). Durante la implementación, usar las skills de InsForge y ejecutar exactamente estos comandos; no ejecutarlos durante el Modo Plan:

   ```text
   npx @insforge/cli login --user-api-key "$INSFORGE_USER_API_KEY"
   npx @insforge/cli link --project-id 5930dac6-6cab-43e7-b701-612843379b65
   ```

   El valor de `INSFORGE_USER_API_KEY` debe mantenerse fuera del repositorio.

- [x] **Tarea 2: Inicializar el frontend React** (20-30 min). Crear la base React + TypeScript + Vite con configuración estricta de TypeScript y una entrada mínima de la aplicación.
- [x] **Tarea 3: Instalar y configurar las dependencias del MVP** (20-30 min). Incorporar Tailwind CSS, Zustand, FullCalendar, React Hook Form, Zod, React Markdown, remark-gfm, sanitización y dependencias de pruebas.
- [x] **Tarea 4: Configurar calidad de código** (20-30 min). Configurar ESLint, formato, chequeo de tipos y scripts de prueba sin introducir nombres o comentarios en español dentro del código.
- [x] **Tarea 5: Crear la configuración del cliente InsForge** (20-30 min). Añadir variables de entorno públicas, `lib/insforge/client.ts` y el manejo de configuración ausente sin incluir secretos administrativos.
- [x] **Tarea 6: Crear el shell de aplicación y las rutas base** (20-30 min). Preparar rutas públicas de autenticación, ruta protegida del calendario y estados de carga/error en español.

## Fase 2: Modelado De Datos En InsForge

- [x] **Tarea 7: Preparar la migración base del dominio** (20-30 min). Definir convenciones de identificadores, propietarios, timestamps y migraciones forward-only conforme al estándar de InsForge.
- [x] **Tarea 8: Crear `subjects` y sus políticas RLS** (20-30 min). Añadir campos, validación del color, índices de propietario y aislamiento por cuenta.
- [x] **Tarea 9: Crear `personal_groups` y sus políticas RLS** (20-30 min). Añadir nombre, color opcional, timestamps, índices y aislamiento por cuenta.
- [x] **Tarea 10: Crear `events` y sus restricciones** (20-30 min). Modelar `kind`, relaciones opcionales, rango temporal, `is_all_day`, `status`, campos opcionales e índices de consulta.
- [x] **Tarea 11: Crear `notes` y sus políticas RLS** (20-30 min). Modelar `target_type`, `target_id`, título y contenido Markdown, validando que cada destino pertenezca a la misma cuenta.
- [x] **Tarea 12: Verificar esquema, relaciones e índices** (20-30 min). Comparar el esquema resultante con la sección de contratos de la spec y corregir cualquier divergencia antes de continuar.
- [x] **Tarea 13: Generar y revisar tipos del esquema** (20-30 min). Generar o actualizar `database.types.ts` y mapearlo a los tipos de dominio independientes de InsForge.

## Fase 3: Autenticación Y Capa De Servicios

- [x] **Tarea 14: Implementar el servicio de sesión** (20-30 min). Encapsular registro, inicio, recuperación de sesión y cierre usando exclusivamente InsForge Auth.
- [x] **Tarea 15: Implementar `sessionStore`** (20-30 min). Mantener estado de sesión, carga y error, y proteger las rutas cuando no exista una sesión válida.
- [x] **Tarea 16: Implementar el servicio de asignaturas** (20-30 min). Añadir operaciones de listar, crear, editar y eliminar con validaciones y errores de dominio.
- [x] **Tarea 17: Implementar el servicio de grupos personales** (20-30 min). Añadir operaciones de listar, crear, editar y eliminar respetando dependencias y aislamiento.
- [x] **Tarea 18: Implementar el servicio de eventos** (20-30 min). Añadir consultas por rango, creación, edición, eliminación y cambio de estado con mapeo de fechas.
- [x] **Tarea 19: Implementar el servicio de notas** (20-30 min). Añadir consulta por destino, creación, edición y eliminación conservando `content_markdown` original.
- [x] **Tarea 20: Crear `catalogStore` y `noteStore`** (20-30 min). Coordinar carga, caché temporal, mutaciones confirmadas y estados de error sin convertir Zustand en persistencia local.
- [x] **Tarea 21: Centralizar validaciones y errores** (20-30 min). Compartir esquemas Zod, validar rangos temporales y traducir errores técnicos a mensajes visibles en español.

## Fase 4: UI Base Y Gestión De Catálogos

- [x] **Tarea 22: Redactar `docs/ui-design.md` aplicando los principios de `pbakaus/impeccable`** (20-30 min). Definir la dirección visual, los tokens, el layout, los componentes base, los estados y las reglas responsive antes de escribir código de interfaz.
- [x] **Tarea 23: Crear tokens visuales y estilos Tailwind** (20-30 min). Implementar la dirección visual documentada, incluyendo tipografía, espaciado, estados, colores de calendario y comportamiento responsive base.
- [x] **Tarea 24: Crear el layout responsive protegido** (20-30 min). Implementar encabezado, navegación, panel lateral/escritorio y cajón/móvil con etiquetas en español.
- [x] **Tarea 25: Crear las pantallas de autenticación** (20-30 min). Implementar registro, inicio y cierre de sesión con estados vacíos, carga y errores accesibles.
- [x] **Tarea 26: Crear la gestión de asignaturas** (20-30 min). Implementar listado, formulario, edición y confirmación de eliminación con nombre, sigla, abreviación y color.
- [x] **Tarea 27: Crear la gestión de grupos personales** (20-30 min). Implementar listado, formulario, edición, color opcional y bloqueo de eliminación con dependencias.
- [x] **Tarea 28: Crear componentes reutilizables de formularios** (20-30 min). Añadir campos, mensajes de validación, confirmaciones, estados de guardado y mensajes de error consistentes.

## Fase 5: Calendario Y Eventos

- [x] **Tarea 29: Configurar FullCalendar en español** (20-30 min). Integrar FullCalendar, sus plugins requeridos y la localización de calendario sin conectar todavía todas las mutaciones.
- [x] **Tarea 30: Implementar navegación y selector de vistas** (20-30 min). Añadir fecha actual, anterior, siguiente, `Hoy` y vistas Agenda, Mes, Semana y Día.
- [x] **Tarea 31: Mapear eventos de dominio a FullCalendar** (20-30 min). Mostrar rangos, eventos de todo el día, colores de asignaturas/grupos y estado textual accesible.
- [x] **Tarea 32: Crear el formulario de evento académico** (20-30 min). Implementar título, asignatura, fechas, horas, estado, sala y descripción/temario opcionales.
- [x] **Tarea 33: Crear el formulario de evento personal** (20-30 min). Implementar título, grupo opcional, fechas, horas, estado, lugar y descripción opcionales.
- [x] **Tarea 34: Implementar eventos puntuales, de duración y multidiarios** (20-30 min). Añadir modo de todo el día, validación de término posterior al inicio y conservación de fechas locales.
- [x] **Tarea 35: Implementar detalle y acciones de evento** (20-30 min). Añadir apertura por clic, edición, eliminación con confirmación y cambio manual entre `Pendiente` y `Completado`.
- [x] **Tarea 36: Conectar calendario con datos de InsForge** (20-30 min). Cargar el rango visible, refrescar tras mutaciones y mostrar estados de carga, vacío y error en español.

## Fase 6: Agenda, Búsqueda Y Filtros

- [x] **Tarea 37: Implementar la vista Agenda** (20-30 min). Mostrar eventos desde hoy en adelante, agrupados por fecha, ordenados cronológicamente y con información esencial.
- [x] **Tarea 38: Implementar el estado de búsqueda** (20-30 min). Añadir búsqueda sin distinguir mayúsculas ni acentos en los campos definidos por RF-22.
- [x] **Tarea 39: Implementar controles de filtros** (20-30 min). Añadir filtros por tipo, asignatura, grupo personal, estado y rango de fechas.
- [x] **Tarea 40: Aplicar combinación AND/OR de filtros** (20-30 min). Combinar categorías distintas con AND y múltiples valores de una categoría con OR.
- [x] **Tarea 41: Integrar búsqueda y filtros con todas las vistas** (20-30 min). Sincronizar resultados con Agenda, Mes, Semana y Día, incluyendo limpiar filtros y estados vacíos.

## Fase 7: Notas Markdown

- [x] **Tarea 42: Crear navegación de notas por asignatura y grupo** (20-30 min). Mostrar notas asociadas al destino seleccionado y distinguir destinos sin notas.
- [x] **Tarea 43: Crear editor de notas Markdown** (20-30 min). Implementar título, editor de texto, asociación obligatoria y previsualización opcional.
- [x] **Tarea 44: Crear el renderizador Markdown seguro** (20-30 min). Soportar Markdown común y extendido, sanitizar HTML y bloquear scripts, atributos y enlaces inseguros.
- [x] **Tarea 45: Implementar CRUD de notas** (20-30 min). Conectar creación, edición, lectura y eliminación a InsForge conservando el contenido original.
- [x] **Tarea 46: Añadir estados de notas** (20-30 min). Implementar carga, guardado, errores, nota vacía y confirmación de eliminación con textos españoles.

## Fase 8: Pruebas, Seguridad Y Cierre Del MVP

- [x] **Tarea 47: Probar validaciones de dominio** (20-30 min). Cubrir campos obligatorios, colores, estados, relaciones académicas/personales y rangos temporales.
- [x] **Tarea 48: Probar stores y servicios** (20-30 min). Verificar llamadas, mapeos, refresco posterior a mutaciones y traducción de errores con mocks controlados.
- [x] **Tarea 49: Probar formularios y componentes** (20-30 min). Cubrir autenticación, catálogos, eventos, filtros, estados accesibles y editor de notas.
- [ ] **Tarea 50: Probar aislamiento entre cuentas** (20-30 min). Ejecutar pruebas de integración contra InsForge para comprobar RLS de asignaturas, grupos, eventos y notas.
- [ ] **Tarea 51: Probar flujos críticos en navegador** (20-30 min). Verificar autenticación, creación de eventos, las cuatro vistas, búsqueda, filtros y notas Markdown.
- [ ] **Tarea 52: Revisar responsive y accesibilidad** (20-30 min). Validar escritorio, tablet, móvil, teclado, foco, nombres accesibles, contraste y estados no dependientes solo del color.
- [ ] **Tarea 53: Ejecutar revisión de trazabilidad Spec-Anchored** (20-30 min). Confirmar que cada RF/RNF/CA tiene implementación y prueba; actualizar la spec si el comportamiento cambió.
- [ ] **Tarea 54: Publicar y ejecutar smoke test en InsForge** (20-30 min). Desplegar el frontend mediante el hosting estándar de InsForge y verificar autenticación, persistencia y rutas protegidas.
- [x] **Tarea 55: Verificar límites del MVP** (20-30 min). Confirmar que no se implementaron compartir eventos, integración externa ni el plugin de KOReader/SimpleUI.


## Fase 9: Contratos Y Motor Puro De Hábitos

- [x] **Tarea 56: Crear tipos de dominio de hábitos** (20-30 min). Definir
  Habit, HabitLog, HabitSchedule, HabitNote, RecurringTask y sus estados sin
  depender de React ni InsForge.
- [x] **Tarea 57: Definir validaciones de configuración** (20-30 min).
  Validar tipos de seguimiento, unidades, objetivos, relaciones, reglas,
  fechas efectivas y políticas de evaluación con Zod.
- [x] **Tarea 58: Implementar generador de recurrencias** (20-30 min).
  Calcular ocurrencias locales para diario, días seleccionados, semanal,
  mensual, cada N días, día del mes y cuotas.
- [x] **Tarea 59: Implementar evaluador de estados** (20-30 min). Derivar
  pendiente, completado, parcial, omitido e incumplido sin procesos nocturnos.
- [x] **Tarea 60: Implementar estadísticas puras** (20-30 min). Calcular
  rachas, cumplimiento, totales, promedios, cuotas y periodos pendientes según
  la modalidad.
- [x] **Tarea 61: Probar el motor de hábitos** (20-30 min). Cubrir zonas,
  meses cortos, fechas efectivas, pausas, omisiones, correcciones y cuotas.

## Fase 10: Persistencia Y Seguridad En InsForge

- [x] **Tarea 62: Crear migración de hábitos y reglas** (20-30 min). Añadir
  habits y habit_schedule_versions con restricciones e índices.
- [x] **Tarea 63: Crear migración de logs y notas de hábitos** (20-30 min).
  Añadir habit_logs y habit_notes, fechas locales, fuentes e idempotencia
  futura.
- [x] **Tarea 64: Crear migración de tareas recurrentes** (20-30 min). Añadir
  recurring_tasks, recurring_task_schedule_versions y recurring_task_occurrences
  con sus reglas de dependencia.
- [x] **Tarea 65: Crear RLS y validaciones de referencias** (20-30 min).
  Aislar propietario, validar asignaturas/grupos y evitar cambios de owner.
- [x] **Tarea 66: Revisar compatibilidad del snapshot v1** (20-30 min).
  Confirmar que las nuevas tablas no alteren el contrato ni la respuesta actual
  de KOReader.
- [x] **Tarea 67: Generar y revisar tipos de esquema** (20-30 min). Actualizar
  database.types.ts y mapearlo a contratos de dominio independientes.

## Fase 11: Servicios Y Estado De Cliente

- [x] **Tarea 68: Implementar habitService** (20-30 min). Añadir CRUD,
  consulta por rango, registro/corrección de logs y acciones de pausa/archivo.
- [x] **Tarea 69: Implementar habitNoteService** (20-30 min). Añadir CRUD de
  notas generales y diarias reutilizando el editor seguro.
- [x] **Tarea 70: Implementar recurringTaskService** (20-30 min). Añadir CRUD,
  completar, reprogramar y calcular la próxima ocurrencia.
- [x] **Tarea 71: Crear habitStore** (20-30 min). Coordinar fecha, lista,
  historial, mutaciones confirmadas, filtros y errores sin persistencia local.
- [x] **Tarea 72: Crear recurringTaskStore** (20-30 min). Coordinar pestaña,
  vencimientos, historial y mutaciones confirmadas.
- [x] **Tarea 73: Probar servicios y stores** (20-30 min). Cubrir mapeos,
  refresco posterior, errores, aislamiento de relaciones y estados de carga.

## Fase 12: Superficie Web De Hábitos

- [x] **Tarea 74: Añadir ruta y navegación de Hábitos** (20-30 min). Integrar
  /habits como destino principal de escritorio y móvil.
- [x] **Tarea 75: Implementar vista Hoy** (20-30 min). Crear lista rápida,
  agrupación por estado y controles binarios o cuantitativos.
- [x] **Tarea 76: Implementar formulario progresivo** (20-30 min). Crear
  configuración por pasos, presets, campos avanzados y resumen legible.
- [x] **Tarea 77: Implementar historial** (20-30 min). Crear cuadrícula de
  fechas, revisión, corrección, eliminación y navegación por periodo.
- [x] **Tarea 78: Implementar estadísticas** (20-30 min). Mostrar métricas por
  hábito y resumen filtrable, ocultando agregados desactivados.
- [x] **Tarea 79: Implementar pausa, archivo y edición futura** (20-30 min).
  Conservar historia y pedir fecha efectiva cuando cambie la regla.
- [x] **Tarea 80: Probar componentes de hábitos** (20-30 min). Cubrir
  formularios, estados, accesibilidad, notas contextuales y responsive.

## Fase 13: Notas Y Tareas Recurrentes

- [x] **Tarea 81: Integrar notas generales y diarias** (20-30 min). Mostrar el
  vínculo con hábitos desde Hábitos y filtrar notas de hábitos desde Notas.
- [x] **Tarea 82: Implementar lista de tareas recurrentes** (20-30 min).
  Separar pendientes, vencidas, archivadas y completadas.
- [x] **Tarea 83: Implementar edición de recurrencias** (20-30 min). Diferenciar
  próxima ocurrencia, nueva regla futura y conservación del historial.
- [x] **Tarea 84: Probar notas y tareas recurrentes** (20-30 min). Cubrir
  Markdown, estados, reprogramación, duplicados y errores de InsForge.

## Fase 14: Proyección De Calendario

- [x] **Tarea 85: Crear proyección de calendario** (20-30 min). Convertir
  hábitos y tareas activados en elementos FullCalendar de solo lectura.
- [x] **Tarea 86: Añadir configuración de visibilidad** (20-30 min). Permitir
  regla del hábito, todos los días activos o selección personalizada.
- [x] **Tarea 87: Integrar detalle de solo lectura** (20-30 min). Distinguir
  origen, relación y estado, y ofrecer navegación a Hábitos.
- [x] **Tarea 88: Probar convivencia con eventos** (20-30 min). Verificar
  colores, filtros, rangos visibles, estados y ausencia de acciones de
  cumplimiento desde el calendario.

## Fase 15: Verificación Y Evolución

- [ ] **Tarea 89: Probar flujos críticos en navegador** (20-30 min).
  Verificar creación, registro, historial, estadísticas, notas, tareas y
  proyección de calendario.
- [ ] **Tarea 90: Revisar responsive y accesibilidad** (20-30 min). Validar
  lista diaria, formularios progresivos, cuadrícula histórica, teclado, foco y
  etiquetas.
- [x] **Tarea 91: Probar aislamiento entre cuentas** (20-30 min). Ejecutar
  pruebas de integración para hábitos, logs, notas y tareas mediante RLS;
  verificado en siete tablas con dos cuentas, acceso anónimo bloqueado,
  escrituras cruzadas bloqueadas y limpieza de datos temporales.
- [x] **Tarea 92: Ejecutar trazabilidad y calidad** (20-30 min). Actualizar
  spec, UI, matriz, tests, typecheck, lint y build en el mismo cambio.
- [x] **Tarea 93: Documentar ingesta futura de KOReader** (20-30 min).
  Redactar una spec posterior para el scope write:habit_logs, vinculación,
  agregación local e idempotencia; no modificar el plugin en esta fase.
