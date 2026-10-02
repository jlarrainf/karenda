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
- [x] **Tarea 35: Implementar detalle y acciones de evento** (20-30 min). Añadir apertura por clic, edición, eliminación con confirmación y cambio manual entre `Pendiente` y `Completado`, conservando el rango original al actualizar solo el estado.
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

- [x] **Tarea 94: Crear hábitos asistidos con IA** (20-30 min). Añadir el
  contrato server-side, borradores revisables y guardado mediante el servicio
  de hábitos, manteniendo la validación del formulario existente.
- [x] **Tarea 95: Endurecer rate limits de IA** (20-30 min). Compartir el
  mapeo de `429` entre calendario y hábitos, limitar solicitudes sin reintentos
  automáticos y verificar los mensajes públicos.
- [x] **Tarea 96: Probar IA de hábitos y límites** (20-30 min). Cubrir contrato,
  validación, estados, guardado parcial y respuestas `429` en servicio y UI.
- [x] **Tarea 97: Añadir modos rápido y guiado para hábitos** (20-30 min).
  Definir preguntas serializables, respuestas y flujo de revisión reutilizable
  en web y Android.
- [x] **Tarea 98: Normalizar hábitos cuantitativos** (20-30 min). Corregir
  combinaciones contradictorias de tipo, unidad y meta antes de validar.

- [ ] **Tarea 99: Añadir modo guiado a eventos asistidos** (20-30 min). Definir
  el contrato de preguntas y respuestas, resolver relaciones ambiguas y permitir
  propuestas confirmables de asignaturas y grupos personales.
- [ ] **Tarea 100: Corregir robustez de extracción de eventos IA** (20-30 min).
  Aceptar respuestas JSON equivalentes, conservar relaciones desconocidas para
  revisión y verificar los fallbacks del proveedor.
- [ ] **Tarea 101: Verificar creación guiada de eventos** (20-30 min). Cubrir
  servicio, panel, creación deduplicada de catálogo, guardado parcial,
  typecheck, lint y build.

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

## Fase 16: Aplicación Android Con Capacitor

Estas tareas siguen `specs/005-android-app.md` y deben actualizar también
`docs/ui-design.md`, `plan.md` y `docs/traceability.md` cuando cambie un
contrato o una superficie visible.

- [x] **Tarea 97: Definir el contrato Android** (20-30 min). Crear la spec de
  alcance, estados offline, navegación Atrás, almacenamiento de sesión y
  límites de permisos.
- [x] **Tarea 98: Documentar la dirección UI Android** (20-30 min). Añadir
  barras del sistema, áreas seguras, teclado, enlaces externos y estados de red
  antes de cambiar componentes.
- [x] **Tarea 99: Crear la base Capacitor** (20-30 min). Instalar Capacitor,
  definir `capacitor.config.ts`, mantener `webDir` apuntando al build local y
  generar `android/`.
- [ ] **Tarea 100: Añadir adaptadores de plataforma** (20-30 min). Separar
  conectividad, ciclo de vida, enlaces y portapapeles sin duplicar servicios de
  InsForge.
- [ ] **Tarea 101: Implementar estado offline** (20-30 min). Mostrar el estado
  de conexión en español y bloquear confirmaciones engañosas sin crear caché de
  dominio.
- [ ] **Tarea 102: Preparar sesión segura** (20-30 min). Sustituir la
  persistencia web temporal del refresh token por un puente de almacenamiento
  seguro antes del APK de producción.
- [ ] **Tarea 103: Configurar identidad y build** (20-30 min). Fijar
  `applicationId`, iconos, splash, versión, logs de producción y firma fuera
  del repositorio.
- [ ] **Tarea 104: Verificar Android** (20-30 min). Probar arranque, login,
  rutas, botón Atrás, teclado, rotación, suspensión, red y enlaces en emulador
  y dispositivo real.
- [ ] **Tarea 105: Auditar y empaquetar APK personal** (20-30 min). Ejecutar
  calidad, revisar secretos y generar un APK release instalable sin publicar en
  Google Play.
- [ ] **Tarea 106: Diseñar la transición a caché de lectura** (20-30 min).
  Documentar una fase posterior con cifrado, `synced_at`, caducidad y limpieza
  por cuenta, sin activarla todavía.
- [x] **Tarea 107: Ajustar el encabezado móvil y la barra de estado** (20-30 min).
  Ocultar el encabezado al desplazarse hacia abajo, mostrarlo al desplazarse
  hacia arriba y mantener una cubierta sólida para el área de la barra de estado.
- [x] **Tarea 108: Refinar el cajón móvil** (20-30 min). Respetar el área segura
  superior y evitar repetir en el cajón las rutas principales ya visibles en el
  encabezado.

## Fase 17: Creación Asistida De Eventos En Android

Estas tareas extienden el contrato compartido de eventos y deben conservar
la paridad entre el build web y los assets empaquetados por Capacitor.

- [x] **Tarea 109: Añadir modo guiado a eventos asistidos** (20-30 min).
  Implementar preguntas de relación, respuestas, `Otro` y propuestas de
  creación de asignaturas o grupos con confirmación explícita.
- [x] **Tarea 110: Endurecer la preparación de borradores** (20-30 min).
  Aceptar relaciones textuales desconocidas sin romper la respuesta y mantener
  el fallback estructurado del servicio server-side.
- [x] **Tarea 111: Verificar eventos asistidos en Android** (20-30 min).
  Ejecutar tests, typecheck, lint, build web y sincronización/build Android.
- [x] **Tarea 124: Empaquetar paridad Canvas en Android** (20-30 min).
  Incluir la ruta Canvas, la revisión con categorías y colores, y la acción de
  sincronización del calendario en los assets locales; hacer que
  `android:build` genere la APK debug y verificar el build Gradle.

## Fase 18: Sincronización Canvas UC

- [x] **Tarea 112: Fijar spec, UI y trazabilidad Canvas**. Documentar alcance,
  contratos, estados, seguridad, pruebas y límites del piloto personal.
- [x] **Tarea 113: Crear esquema Canvas y RLS**. Añadir categoría académica,
  conexiones, credenciales privadas, vínculos, propuestas, ejecuciones,
  restricciones, índices y aislamiento por propietario.
- [x] **Tarea 114: Implementar cliente y normalización Canvas**. Cubrir
  paginación segura, reintentos, clasificación, intervalos, HTML sanitizado,
  candidatos y reconciliación de tres versiones.
- [x] **Tarea 115: Implementar funciones de conexión y sincronización**.
  Validar/cifrar credenciales, preparar cursos y actividades, registrar
  ejecuciones e integrar propuestas IA sin autoridad de escritura.
- [x] **Tarea 116: Implementar decisiones de revisión**. Vincular o crear
  asignaturas y eventos de forma atómica, aplicar cambios confirmados e ignorar
  propuestas sin duplicar identificadores externos.
- [x] **Tarea 117: Implementar servicio, estado y ruta Canvas**. Añadir estado de
  conexión, vencimiento, sincronización manual, mapeo de cursos y bandeja
  responsive en español.
- [x] **Tarea 118: Mostrar procedencia Canvas en eventos**. Exponer categoría,
  fuente y enlace seguro sin cambiar la edición manual existente.
- [x] **Tarea 119: Configurar programador seguro**. Invocar cada hora, resolver
  las 06:00 de Santiago mediante `next_sync_at` y evitar ejecuciones paralelas.
- [ ] **Tarea 120: Verificar y desplegar piloto Canvas**. Ejecutar pruebas de
  dominio, funciones, RLS, UI, E2E, lint, typecheck, build, auditoría de
  secretos y despliegue limitado a la cuenta autorizada. El esquema, las
  funciones, el programador y la web ya están en producción; faltan el E2E
  autenticado y la prueba real con un token nuevo ingresado directamente en la
  interfaz.
- [x] **Tarea 121: Endurecer recursos Canvas y exponer vínculos**. Continuar
  cuando Canvas bloquee una colección secundaria, conservar la ejecución como
  parcial, mostrar cursos vinculados en asignaturas, permitir desvincularlos sin
  borrar eventos y añadir sincronización rápida desde el calendario.
- [x] **Tarea 122: Normalizar texto remoto de Canvas**. Reemplazar unidades
  Unicode aisladas en anuncios y páginas antes de persistir JSON o enviarlas a
  la IA, con una regresión automatizada para evitar nuevos `503`.
- [x] **Tarea 123: Normalizar categorías y extraer anuncios Canvas**. Incorporar
  el catálogo confirmado, abreviaciones, fechas relativas, horas, duraciones,
  ramo de origen y color en la bandeja; aplicar la migración y verificar el
  despliegue real. El piloto autenticado queda como verificación manual del
  usuario porque requiere un token nuevo ingresado en la pantalla segura.

## Fase 19: Plazos De Entrega Atrasada

Rama Git `feature/001-late-delivery-window`, worktree
`C:\Users\juani\Desktop\Programacion\karenda-wt-late-delivery`, base
`f0a2d54`, destino `origin/main`, dependencias ninguna, estado `activa`.
Relación Git/InsForge: `feature/001-late-delivery-window` → proyecto `karenda`
(contexto principal usado solo para consultar el historial y numerar la
migración). Las ramas `karenda-mcp` y `karenda-canvas-fix` ya ocupan los dos
espacios activos; la migración no se aplicará hasta disponer de una rama
compatible y validar su estado.

- [x] **Tarea 125: Definir el contrato y la dirección de interfaz**. Documentar
  días corridos, descripción opcional del descuento, fecha límite derivada,
  nulabilidad y compatibilidad del snapshot.
- [x] **Tarea 126: Implementar configuración y detalle web**. Añadir columnas,
  validación, carga/guardado, cálculo local de la fecha límite y presentación
  accesible en el formulario y el detalle.
- [ ] **Tarea 127: Propagar metadatos al snapshot KOReader**. Actualizar
  proyección, contrato y mapper sin cambiar el número de versión mayor.
- [ ] **Tarea 128: Cubrir criterios y verificar**. Añadir pruebas de validación,
  persistencia, formulario, detalle, fecha local y mapeo Lua; ejecutar las
  comprobaciones pertinentes.
- [ ] **Tarea 129: Validar migración en InsForge**. Reutilizar una rama
  compatible o esperar a que se audite y libere un espacio; aplicar y verificar
  allí sin modificar el proyecto principal.

Evidencia de la Tarea 126: `npm run typecheck`, `npm run lint`,
`npm test -- --run` (179 pruebas aprobadas) y `npm run build` finalizaron con
código 0. El build mostró advertencias de externalización de `crypto` y de
tamaño del bundle.

## Fase 20: Integración MCP Multiharness

La spec rectora es specs/007-mcp-integration.md. La implementación de
`feature/007-mcp-server` se integró mediante PR #17 y se desplegó en el proyecto
principal de InsForge desde `main` (`9eab71b`). El servidor de producción está
disponible y la web/consentimiento usa el deployment
`f54c0480-451e-4ba2-9351-f8e302b0896c`. El despliegue no cierra los gates de
seguridad ni de interoperabilidad; cada tarea conserva evidencia y pendientes
en `docs/traceability.md`.

### Fase 0: Factibilidad Y Contratos De Cobertura

- [ ] **Tarea 130: Inventariar paridad del dominio** (30-45 min). Contrastar
  cada acción visible en las specs 001/002/003/006 con servicios web y
  clasificarla como tool MCP, flujo web requerido o exclusión justificada.
  Reconciliar cualquier trabajo KOReader/estadísticas en curso. Evidencia:
  matriz de cobertura revisada.
- [ ] **Tarea 131: Probar InsForge Streamable HTTP** (45-90 min). En entorno
  aislado, verificar runtime Deno, SDK MCP oficial, headers, streaming,
  cancelación, rutas, timeout y límites de Edge Functions. El spike de esta
  tarea se limita al entorno aislado; la publicación posterior a producción se
  registra abajo y se autorizó después del merge PR #17. Evidencia: spike
  reproducible y restricciones documentadas.
  Evidencia parcial: `npm run test:mcp` (22 tests), bundle único en
  `functions/.deploy/karenda-mcp.js`, función activa en la rama limpia
  `karenda-mcp-release`, metadata OAuth/recurso 200, desafío sin bearer 401,
  CORS permitido 204/origen extranjero 403 y registro DCR 201. Las migraciones
  OAuth y de controles están aplicadas. El preview web también está desplegado
  y sus rutas principal/consentimiento responden 200. Después del merge PR #17,
  las migraciones MCP se aplicaron al proyecto principal, se publicó la función
  y se hizo un smoke de producción: metadata/recurso 200, challenge 401, CORS
  permitido 204/origen externo 403 y DCR 201. La web de consentimiento de
  producción ya carga la solicitud OAuth. Falta validar una lectura autenticada
  con la cuenta autorizada y probar cancelación bajo carga.
  Codex completó OAuth y callback. Un primer refresh encontró la sesión vencida;
  se reautorizó con `codex mcp login karenda` y una sesión nueva descubrió las
  herramientas. No se invocaron herramientas que acceden a datos de cuenta.
  El intento E2E de staging se detuvo al recibir 401 al crear una cuenta
  sintética; no se creó ninguna cuenta.
- [ ] **Tarea 132: Probar OAuth con los tres harnesses** (45-90 min). Validar
  descubrimiento de metadata, CIMD/DCR, redirects de escritorio, login, refresh
  y logout/revocación en Codex, Claude Code y OpenCode. Evidencia: tabla de
  versiones/resultado con configuración sin secretos. Estado actual: Codex
  apunta a producción, muestra `enabled OAuth` y descubre las herramientas tras
  reautorizar; no se validó una lectura autenticada. Claude Code y OpenCode aún
  no se configuraron.
- [ ] **Tarea 133: Cerrar decisión de arquitectura** (20-30 min). Elegir SDK,
  metadata de clientes, rutas OAuth, duraciones y límites solo desde evidencia
  de 126-127. Si InsForge no alcanza los requisitos, detenerse y documentar
  opciones dentro de InsForge antes de proponer excepción. Gate: CA-MCP-01.
- [ ] **Tarea 134: Fijar schemas, scopes y errores** (45-60 min). Modelar
  argumentos/respuestas de cada familia de tools, permisos read/write/delete,
  mensajes y tamaños; anotar operaciones no disponibles. Actualizar specs y
  trazabilidad junto con contratos tipados. Evidencia: schema review.

### Fase 1: Datos OAuth Y Servicio De Autorización

- [ ] **Tarea 135: Diseñar migración de grants** (30-45 min). Especificar
  clientes/grants, scopes, expiraciones, refresh token protegido, revocación,
  auditoría mínima, índices, constraints y RLS en InsForge. Evidencia parcial:
  migración revisada y aplicada únicamente en `karenda-mcp-release` (InsForge
  branch id `0ffcef32-51b3-4d71-99d2-e4adc54c51b9`), enlazada con
  `feature/007-mcp-server`; faltan pruebas RLS y del ciclo de vida.
- [ ] **Tarea 136: Implementar autorización con sesión InsForge** (45-75 min).
  Añadir metadata OAuth, PKCE S256, state, validación de redirect y sesión
  Karenda. No aceptar token InsForge como bearer del MCP. Evidencia:
  pruebas OAuth negativas y positivas.
- [ ] **Tarea 137: Implementar emisión y ciclo de tokens** (45-75 min). Emitir
  access token de audiencia MCP, refresh rotativo/reutilización, expiración,
  revocación individual/global y protección contra CSRF/replay. Evidencia:
  suite de lifecycle y revisión de almacenamiento.
- [ ] **Tarea 138: Crear consentimiento y conexiones** (45-75 min). Implementar
  vistas en español para cliente, scopes, autorización parcial, cancelar,
  conexiones activas y revocación. Actualizar primero docs/ui-design.md si el
  alcance visual cambia. Evidencia: pruebas de estados, teclado, lector y móvil.
- [ ] **Tarea 139: Verificar gestión de sesiones** (30-45 min). Confirmar
  expiración/revocación, reautorización al cambiar scopes, login desde sesión
  expirada y ausencia de tokens en URLs/DOM/logs. Gate: RF-MCP-01, 21-23 y
  CA-MCP-05/11.

### Fase 2: Transporte MCP Y Controles Comunes

- [ ] **Tarea 140: Implementar endpoint Streamable HTTP** (45-75 min).
  Configurar protocolo/versión, initialize, metadata, respuesta de recurso
  protegido y manejo de Origin/Host/CORS según el spike. Evidencia: suite de
  contrato MCP. Parcial: endpoint activo en staging; metadata, challenge 401,
  CORS permitido/rechazado y DCR 201 verificados; `initialize`, SSE autenticado
  y tools/list con grant válido aún deben probarse con un cliente real.
- [ ] **Tarea 141: Añadir registro de tools y autorización central** (45-60
  min). Registrar schemas cerrados, validar bearer/audience/grant/scope antes
  de ejecutar y convertir errores al contrato común. Evidencia: tests
  insufficient scope, schema y token inválido.
- [ ] **Tarea 142: Añadir límites y auditoría mínima** (30-45 min). Aplicar
  límites por grant/tool, IP para OAuth y transporte, max body/rango/página y
  trazas sin datos sensibles. Contadores atómicos y HMAC de IP están
  implementados y desplegados a la rama InsForge limpia; RPCs de rate limit e
  idempotencia aplicados. Evidencia: tests locales, registro DCR 201 y smoke;
  faltan pruebas de abuso autenticadas y revisión automatizada de logs.
- [ ] **Tarea 143: Añadir paginación, fecha, versión e idempotencia comunes**
  (45-60 min). Implementar utilidades compartidas; control de expected version,
  `idempotencyKey`, zona horaria y cursor. Reclamos persistentes evitan
  duplicados concurrentes y repiten la respuesta por 30 días. Implementación y
  tests locales listos y RPCs aplicadas en staging; falta verificar replay,
  conflictos y concurrencia con grant autenticado real.
  Evidencia: tests de concurrencia y reintento.

### Fase 3: Herramientas De Lectura

- [ ] **Tarea 144: Publicar contexto de cuenta, eventos y catálogos** (30-45
  min). Implementar el contexto mínimo de fecha/zona/idioma y list/get de
  eventos, asignaturas y grupos con filtros, rangos, orden estable y ownership.
  Evidencia: contrato, privacidad, paginación y prueba A/B RLS.
- [ ] **Tarea 145: Publicar lectura de notas** (30-45 min). Exponer lista y
  detalle Markdown con targets permitidos, paginación, límites y truncamiento
  explícito. Evidencia: tests de aislamiento, tamaño y relaciones.
- [ ] **Tarea 146: Publicar lectura de hábitos y tareas recurrentes** (45-60
  min). Incluir definiciones, logs, notas, historial, estadísticas y ocurrencias
  según la spec. Tools de estadísticas e historial de versiones implementadas
  localmente con las funciones compartidas de evaluación; falta verificar la
  lectura con datos de staging y RLS. Evidencia: comparación con servicios web.
- [ ] **Tarea 147: Publicar estado y revisión de Canvas** (30-45 min). Exponer
  estado seguro, propuestas sanitizadas y candidatos requeridos por la web; no
  incluir token ni cuerpos remotos innecesarios. Evidencia: tests de secretos,
  sanitización y ownership.
- [ ] **Tarea 148: Revisar paridad de lectura** (30-45 min). Comparar toda la
  matriz aprobada con tools disponibles, scopes, errores y respuestas. Gate:
  lectura del usuario solo bajo demanda y CA-MCP-03.

### Fase 4: Escrituras De Dominio

- [ ] **Tarea 149: Implementar escritura de eventos** (45-60 min). Crear,
  editar y cambiar estado con validación web, fecha inequívoca, versión
  optimista e idempotencia. Evidencia: tests CRUD/status/fechas y regresiones
  de contrato.
- [ ] **Tarea 150: Implementar escritura de notas y catálogos** (45-60 min).
  Crear/editar/eliminar solo acciones admitidas; validar dependencias y scopes
  distintos. Evidencia: tests de constraints, relaciones y borrado protegido.
- [ ] **Tarea 151: Implementar hábitos y registros** (45-75 min). Crear/editar
  hábitos, ciclo de vida, upsert/delete de logs, notas y estadísticas sin
  perder historial o fecha local. Evidencia: tests de reglas 003.
- [ ] **Tarea 152: Implementar tareas recurrentes** (45-75 min). Administrar
  definición, lifecycle, completar y reprogramar ocurrencias con avance
  idempotente. Exponer delete solo si la web lo permite. Evidencia: pruebas de
  recurrencia y no duplicación.
- [ ] **Tarea 153: Asegurar borrados y conflictos** (45-60 min). Implementar
  scopes delete, resumen de destino, confirmación segura para clientes sin
  confirmación nativa, expected version y fallos de dependencia. Evidencia:
  prueba de que una petición ambigua/obsoleta no borra ni sobrescribe.
- [ ] **Tarea 154: Implementar flujos IA draft/save** (30-45 min). Reutilizar
  servicios de borrador, validar esquemas y mantener generación separada de
  persistencia. Evidencia: prueba negativa donde IA no produce mutación y
  prueba positiva de guardado confirmado.
- [ ] **Tarea 155: Implementar Canvas sync y revisión** (45-60 min). Reutilizar
  función de sync y aplicar/ignorar revisión con scopes destino; pedir
  conexión previa desde la web. No agregar endpoints de escritura a Canvas.
  Evidencia: tests idempotencia, propuestas y límites Canvas.

### Fase 5: Seguridad, Interoperabilidad Y Lanzamiento

- [ ] **Tarea 156: Completar matriz de pruebas de autorización/RLS** (45-75
  min). Ejercitar usuarios A/B, IDs ajenos y relaciones mezcladas en todas las
  familias; scopes read/write/delete separados. Gate: CA-MCP-04/05.
- [ ] **Tarea 157: Ejecutar revisión adversarial MCP/OAuth** (45-75 min).
  Probar redirect manipulation, PKCE/state, audience, SSRF/metadata, Origin,
  DNS rebinding, abuso de límites, inyección, replay, logs y filtraciones.
  Corregir hallazgos antes de piloto. Evidencia: informe con severidad/cierre.
- [ ] **Tarea 158: Ejecutar E2E en tres harnesses** (60-90 min). Instalar desde
  guía limpia, autenticar, leer, editar/completar y revocar en staging para
  Codex, Claude Code y OpenCode; verificar expiración y reconexión. Nunca
  registrar credenciales de usuario. Gate: CA-MCP-02.
- [ ] **Tarea 159: Preparar piloto y rollback** (45-60 min). Ejecutar suites
  acordadas, lint/typecheck/build, auditoría de secretos/dependencias, migración
  dry-run y runbook. Activar feature flag para piloto autorizado y revisar
  métricas antes de ampliar. Evidencia: release checklist y rollback probado.
- [ ] **Tarea 160: Cerrar trazabilidad MCP** (30-45 min). Adjuntar evidencia a
  cada RF-MCP/CA-MCP, actualizar estado y documentar limitaciones conocidas.
  No marcar terminada una familia que carezca de tests, RLS o evidencia E2E
  requerida.
- [x] **Tarea 161: Añadir selección masiva de scopes MCP** (20-30 min).
  Permitir seleccionar todos los scopes presentados y quitar la selección sin
  conceder acceso hasta la acción explícita de autorización. Evidencia:
  `McpConsentPage.test.tsx` (1 prueba pasada), `npm run lint` y `npm run build`
  pasaron; el deployment `aa3902df-7dde-481d-bd56-a12d39cfcf5b` quedó listo en
  producción. Las rutas de consentimiento en ambos dominios responden 200 y el
  bundle publicado contiene las acciones de seleccionar y quitar selección.

## Tareas De Integración Canvas Y KOReader De PR #15

Los IDs 162–181 reasignan las tareas 125–144 de la rama de release, para conservar su trazabilidad sin duplicar los IDs 125–161 de main.

- [x] **Tarea 162: Hacer renovable la sesión de Canvas en Android** (20-30 min).
  Usar el flujo móvil de InsForge, restaurar el refresh token desde almacenamiento
  seguro y renovar el access token antes de consultar rutas autenticadas.
- [x] **Tarea 163: Configurar ventana histórica y avisos de sincronización**
  (20-30 min). Permitir 7–365 días por conexión, reiniciar el cursor al cambiar
  el periodo y mostrar avisos parciales en el historial aunque la bandeja esté vacía.
- [ ] **Tarea 164: Validar APK y sesión en dispositivo** (20-30 min). Instalar la
  APK unificada, iniciar sesión con la cuenta Karenda y confirmar que Canvas se
  mantiene disponible tras expirar/renovar la sesión.
- [x] **Tarea 165: Permitir Canvas desde el WebView Android** (20-30 min).
  Añadir `https://localhost` a la allowlist CORS de conexión, sincronización y
  revisión; desplegar las tres funciones y cubrir la regresión en la
  verificación del empaquetado.
- [x] **Tarea 166: Detallar avisos de colecciones Canvas bloqueadas** (20-30 min).
  Identificar permisos, recursos inexistentes y respuestas temporales sin
  exponer detalles remotos, y normalizar nombres de cursos mal formados.
- [x] **Tarea 167: Tratar colecciones Canvas ausentes como opcionales** (15-20 min).
  No marcar como parcial una ejecución cuando Canvas responde `404` para un
  endpoint secundario no habilitado en el curso.
- [x] **Tarea 168: Limitar Canvas a fuentes autorizadas** (20-30 min). No
  consultar endpoints de quizzes que la cuenta piloto no puede leer; extraer
  fechas e indicaciones desde tareas, discusiones, eventos, anuncios y páginas,
  y reconocer un quiz cuando Canvas lo incluye dentro de una tarea.
- [x] **Tarea 169: Permitir iniciar sesión nuevamente desde Android** (20-30 min).
  Limpiar tokens inválidos en memoria y almacenamiento seguro, ofrecer una
  acción accesible desde el error de sesión y conservar la ruta de retorno.
- [x] **Tarea 170: Usar el planificador como respaldo de evaluaciones** (20-30
  min). Extraer tipo, título y fecha de tareas o quizzes visibles en
  `/api/v1/planner/items`, deduplicando los elementos ya recibidos por sus
  colecciones autorizadas y sin consultar APIs de quizzes.
- [x] **Tarea 171: Enriquecer eventos desde anuncios con IA** (20-30 min).
  Pasar contenido HTML sanitizado a un esquema estricto, resolver fechas
  relativas con la fecha de publicación, conservar un resumen de indicaciones
  y usar el título/categoría propuestos al revisar el evento.
- [x] **Tarea 172: Evitar fechas inferidas y filtrar ruido de anuncios** (20-30
  min). No aplicar al evento una fecha derivada solo del día de publicación,
  permitir candidatos sin fecha por título/código y conservar únicamente
  indicaciones académicas relevantes en la descripción.
- [x] **Tarea 173: Limpiar descripciones Canvas previas** (15-20 min). Detectar
  cuando el evento contiene únicamente el extracto anterior de Canvas y
  reemplazarlo, al confirmar la revisión, por el resumen académico filtrado.
### Estadísticas KOReader–Hábitos

- [x] **Tarea 174: Definir el contrato de métricas y vínculos** (20-30 min).
  Documentar páginas, minutos, libros terminados, cartas revisadas, unidades,
  precedencia diaria y backfill en la spec 005.
- [x] **Tarea 175: Implementar persistencia y seguridad de estadísticas**
  (20-30 min). Añadir vínculos, `koreader_link_id`, scope de escritura, RPC,
  RLS y funciones Edge idempotentes.
- [x] **Tarea 176: Integrar configuración web** (20-30 min). Permitir
  seleccionar dispositivo, reutilizar hábitos compatibles o crear hábitos con
  meta explícita, y pausar vínculos.
- [x] **Tarea 177: Integrar estadísticas en Hábitos** (20-30 min). Mostrar
  datos diarios y totales día/mes/año con precedencia de KOReader y estado de
  última sincronización.
- [x] **Tarea 178: Implementar sincronización del plugin** (20-30 min). Leer
  SQLite, adaptar Anki opcionalmente, enviar lotes, guardar cola offline y
  sincronizar al reanudar sin tocar SimpleUI ni el snapshot.
- [x] **Tarea 179: Añadir pruebas unitarias y trazabilidad** (20-30 min).
  Cubrir precedencia, suma, formato, documentación y checks web.
- [ ] **Tarea 180: Verificar backend en InsForge** (20-30 min). Aplicar la
  migración en una rama, validar políticas, desplegar funciones y ejecutar
  pruebas autenticadas de scope, RLS, idempotencia y aislamiento.
- [ ] **Tarea 181: Verificar KOReader real** (20-30 min). Ejecutar specs Lua
  con el runtime de KOReader y probar backfill, red ausente, Anki disponible y
  dispositivo real.

## Fase 20: Calendario Local Del Teléfono

La especificación de esta integración está en
`specs/008-phone-calendar-sync.md`. El destino es la rama de integración
`codex/release-all-changes`; no requiere cambios en InsForge.

- [x] **Tarea 182: Definir la integración nativa y la UI** (20–30 min).
  Registrar en spec, UI y trazabilidad el uso de Calendar Provider local,
  categorías separadas, permisos y límites de sincronización.
- [x] **Tarea 183: Implementar el plugin de calendario Android** (45–60 min).
  Pedir permisos al conectar, crear un calendario local por categoría,
  conservar IDs estables y actualizar/eliminar solo copias de Karenda; cubrir
  la planificación de upsert y deduplicación con pruebas JUnit.
- [x] **Tarea 184: Mapear y cargar eventos de Karenda** (30–45 min).
  Añadir lectura paginada, conversiones de fechas/all-day, color y título
  original seguido por la categoría (por ejemplo, `Control 1 · ALG`),
  manteniendo la consulta bajo RLS del usuario.
- [x] **Tarea 185: Añadir sincronización automática y panel** (30–45 min).
  Sincronizar al conectar, al guardar, al reanudar, cada quince minutos en
  primer plano y con una acción manual; explicar permisos y límites.
- [x] **Tarea 186: Añadir pruebas y verificar builds** (30–45 min).
  Probar mapeo, refrescos en curso, deduplicación, borrados, permiso denegado,
  estado UI e intervalo. En la rama combinada pasaron `npm run lint`,
  `npm run typecheck`, `npm test` (60 archivos, 223 pruebas),
  `npm run test:mcp` (25 pruebas), el typecheck Deno de Edge Functions,
  `:app:testDebugUnitTest --rerun-tasks` y `npm run android:build`, el 2 de
  octubre de 2026.
- [ ] **Tarea 187: Validar POCO Calendar y Watch Fit 5 Pro** (20–30 min).
  Instalar APK en POCO F6, conectar, comprobar calendarios por grupo, cambios,
  eliminación, Huawei Health y agenda del reloj; registrar cualquier límite de
  ROM/versión. `adb install -r` se completó y la app abrió en el POCO F6, pero
  quedó en el formulario de inicio de sesión mostrando «Iniciando sesión…».
  No se concedieron permisos de calendario ni se tocaron eventos; la prueba del
  proveedor local, Huawei Health y el reloj sigue pendiente.
