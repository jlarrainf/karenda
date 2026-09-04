# Tareas: Karenda En KOReader

La implementación del cliente puede comenzar con fixtures y mocks después de
fijar el contrato. La caché local y los mocks no sustituyen la validación contra
InsForge, por lo que la sincronización real seguirá pendiente hasta completar las
pruebas autenticadas de backend.

## Fase 0: Descubrimiento

- [x] **KR-T01: Inspeccionar Karenda Web.** Revisar dominio, servicios, fechas,
  Markdown, autenticación, migraciones, RLS y ausencia de API snapshot.
- [x] **KR-T02: Inspeccionar SimpleUI.** Confirmar Quick Actions, invalidación
  de cachés y efecto del registro tardío.
- [x] **KR-T03: Inspeccionar KOReader.** Confirmar PluginLoader, widgets,
  UIManager, eventos, wrappers y ciclo de screensaver.
- [x] **KR-T04: Inspeccionar parches de Pedro.** Documentar comportamiento,
  fallback, riesgos, custom navbar y licencias.
- [x] **KR-T05: Cerrar decisiones de producto.** Registrar solo lectura,
  device token, zona, snapshot completo, ETag, contexto y límites.

## Fase 1: Especificación

- [x] **KR-T06: Redactar requisitos.** Crear `requirements.md` con requisitos
  verificables y dependencias de backend.
- [x] **KR-T07: Redactar diseño.** Crear `design.md` con capas, interfaz,
  caché, widgets, contexto y coexistencia.
- [x] **KR-T08: Redactar contrato.** Crear `api-contract.md` con proyección
  snake_case, auth, ventana, ETag, 304 y errores.
- [x] **KR-T09: Redactar aceptación.** Crear `acceptance.md` y separar tests
  locales, backend real y dispositivo real.
- [x] **KR-T10: Registrar decisiones.** Crear `decisions.md` con decisiones
  cerradas, pendientes y rechazadas.
- [x] **KR-T11: Crear trazabilidad.** Relacionar requisito, implementación
  prevista y prueba en `traceability.md`.

## Fase 2: Backend InsForge

- [x] **KR-T12: Diseñar migración de device tokens.** Definir hash, propietario,
  scopes, revocación, regeneración, timestamps y límites sin almacenar el
  secreto en claro.
- [x] **KR-T13: Diseñar gestión web de tokens.** Crear la especificación e
  interfaz web para generar, listar metadata, revocar y regenerar tokens.
- [x] **KR-T13a: Diseñar e implementar emparejamiento.** Crear códigos de seis
  dígitos con vencimiento, consumo único, rate limit y canje server-only por un
  token de dispositivo; falta la prueba autenticada contra InsForge.
- [x] **KR-T14: Implementar función Edge de snapshot.** Validar Bearer,
  `read:snapshot`, propietario, rango, zona, proyección y errores.
- [x] **KR-T15: Implementar ETag/304.** Calcular representación estable y
  responder 304 sin body cuando corresponda.
- [x] **KR-T16: Definir límite de snapshot.** El límite es `1048576` bytes de
  JSON UTF-8 sin comprimir; el error es `HTTP 413` con
  `error_code: SNAPSHOT_TOO_LARGE`; la paginación queda fuera del MVP.
- [ ] **KR-T17: Probar aislamiento.** Verificar que dos device tokens de
  propietarios distintos no crucen eventos, catálogos ni notas.

## Fase 3: Cliente Del Plugin

- [x] **KR-T18: Crear el paquete `.koplugin`.** Añadir `main.lua`, `_meta.lua`
  y módulos con nombres y comentarios en inglés.
- [x] **KR-T19: Crear interfaz `ApiClient`.** Permitir implementación HTTPS y
  mock intercambiable, sin acoplar UI al transporte.
- [ ] **KR-T20: Crear fixture/mock local.** Cubrir 200, 304, JSON inválido,
  expiración, revocación, scopes, red, HTTPS inseguro y 413.
- [x] **KR-T21: Implementar configuración.** Guardar URL, token emitido, zona y
  ventana sin mostrar ni registrar el token; permitir canjear un código de seis
  dígitos desde KOReader.
- [x] **KR-T22: Implementar mapper.** Convertir snake_case de red a modelos
  internos y preservar fechas all-day como fechas locales.
- [x] **KR-T23: Implementar `snapshot_store`.** Validar versión, referencias,
  tamaño y escritura atómica con conservación del snapshot anterior.
- [x] **KR-T24: Implementar sincronización manual.** Consumir ETag, manejar 304,
  errores y estados españoles sin marcar backend falso como funcional.
- [x] **KR-T24a: Implementar sincronización al reanudar.** Ejecutar la misma
  sincronización solo cuando el intervalo configurado haya vencido, sin
  bloquear la vista ni usar `Screensaver.show`.
- [x] **KR-T24b: Presentar instantes en la zona del snapshot.** Proyectar RFC
  3339 con el offset civil IANA del snapshot antes de ordenar, agrupar, contar y
  presentar en el cliente offline, con tests de offset, cambio de fecha y horario
  de verano.

## Fase 4: UI Y SimpleUI

- [x] **KR-T25: Implementar agenda nativa.** Mostrar modos Agenda, Mes, Semana
  y Día, navegación temporal, eventos, estados, relaciones, rangos y estados
  vacío/offline.
- [x] **KR-T25a: Profesionalizar calendario estático.** Reemplazar el diálogo
  por una superficie completa, separar fecha/rango de metadata, limitar la vista
  previa y verificar geometrías vertical y horizontal.
- [x] **KR-T25b: Rediseñar la Agenda nativa.** Abrir en `Agenda`, añadir el
  selector segmentado persistente para los cuatro modos, agrupar por fechas con
  `HOY`/`MAÑANA` y enfatizar textualmente lo académico pendiente.
- [x] **KR-T25c: Mantener `Hoy` actualizado.** Comprobar el reloj local al
  reanudar y programar el siguiente cambio de día, conservando el cursor manual
  y siguiendo la fecha solo mientras no exista navegación manual.
- [x] **KR-T25d: Mostrar cuenta regresiva.** Derivar los días restantes desde la
  fecha final del evento, cubrir eventos multidiarios, vencidos y completados, y
  recalcularlo junto con `Hoy` sin hacer red.
- [x] **KR-T25e: Ordenar el selector.** Mantener el único selector persistente en
  el orden `Agenda`, `Mes`, `Semana`, `Día` y cubrirlo en el smoke de widgets.
- [x] **KR-T25f: Aligerar iconos de Quick Actions.** Sustituir los SVG rellenos
  por iconos locales lineales de `48x48` y comprobar su forma sin depender del
  dispositivo real.
- [x] **KR-T25g: Navegar y actualizar superficies.** Mantener la navegación común
  `Calendario`/`Notas` en web, abrir las Quick Actions nativas desde caché y
  refrescar mediante `SyncService` conservando la vista anterior ante errores.
- [x] **KR-T25h: Refinar el icono de calendario.** Reemplazar la cuadrícula
  interior por una marca única, manteniendo la silueta lineal monocroma de
  SimpleUI.
- [x] **KR-T26: Implementar notas nativas.** Mostrar destinos, metadata y
  subconjunto Markdown seguro sin HTML ejecutable.
- [x] **KR-T27: Implementar contexto visible.** Mantener `calendar`, `note` y
  `none`, con limpieza al cerrar o cambiar de superficie.
- [x] **KR-T28: Integrar Quick Action.** Registrar temprano, usar APIs públicas
  de invalidación y conservar fallback público.
- [x] **KR-T28a: Conservar el contexto de Quick Actions.** Marcar las acciones
  como overlays in-place asíncronos y cubrir los descriptores y callbacks con un
  smoke. El retorno real al stack subyacente queda pendiente en KR-T36.
- [x] **KR-T26a: Reordenar la lectura de notas.** Abrir en lista/detalle y dejar
  creación, edición y eliminación detrás de `Configurar notas`.
- [x] **KR-T26b: Filtrar notas por asignatura.** Añadir `Todos los ramos` primero,
  una opción por asignatura y mantener grupos personales independientes.
- [x] **KR-T26c: Renderizar fórmulas Markdown.** Añadir matemáticas seguras a la
  web y normalización tipográfica legible al renderer del plugin.
- [x] **KR-T26d: Renderizar Markdown enriquecido en KOReader.** Convertir el
  subconjunto seguro a HTML nativo de `TextViewer`, conservar encabezados,
  énfasis y bloques, y diferenciar variables, exponentes y símbolos matemáticos.
- [x] **KR-T26e: Pulir compatibilidad Markdown en tinta electrónica.** Normalizar
  `\ddagger` a `‡` y añadir margen/padding explícitos a `ol` y `ul` para que sus
  marcadores de listas numeradas no queden recortados.
- [x] **KR-T25i: Estabilizar controles de superficie.** Colocar la cabecera como
  primera fila, ubicar el cierre arriba a la derecha y usar un símbolo de
  actualización compacto inmediatamente a su izquierda, sin duplicar botones de
  Calendario/Notas dentro de la superficie nativa.
- [x] **KR-T25j: Integrar la navbar inferior visible.** Reservar su alto real,
  dejarla pintarse debajo de la superficie y permitir sus gestos mientras
  calendario o notas estén abiertos.
- [x] **KR-T25k: Cerrar al cambiar de navbar.** Diferir el cierre de la superficie
  para conservar la propagación del gesto, omitir el repintado intermedio que
  mostraba Home, mostrar directamente el destino seleccionado y sincronizar el
  indicador temporal de Calendario/Notas con SimpleUI.
- [x] **KR-T25l: Señalizar actualización completa.** Mostrar el estado de carga
  `Actualizando calendario y notas…`, confirmar `200`/`304` con una notificación
  breve y cubrir que ambas superficies comparten el snapshot sincronizado.
- [ ] **KR-T29: Diagnosticar custom navbar.** Detectar instalación de
  `2-custom-navbar.lua`, documentar conflicto y no modificar administradores.

## Fase 5: Salvapantallas

- [x] **KR-T30: Implementar wrapper idempotente.** Usar `util.wrapMethod`,
  `raw_call`, singleton y no modificar el parche de Pedro.
- [x] **KR-T31: Resolver prioridad de contexto.** La política respeta el
  interruptor propio; con la función activa, calendario/nota usan `Leave
  screen as-is`, el libro abierto usa la pantalla integrada y el resto delega,
  sin consultar solo `ReaderUI.document`.
- [x] **KR-T32: Integrar pantalla de libro.** Construir una portada a pantalla
  completa con tarjeta de identificación, barra de progreso y tarjetas tipo
  post-it de estadísticas usando widgets nativos; respetar cierre, rotación y
  gesto nativos; calendario y notas no crean una copia visual.
- [x] **KR-T33: Limpiar contexto.** Verificar la restauración del estado de la
  instancia y la limpieza existente al salir de calendario/notas.
- [x] **KR-T33a: Exponer la activación.** Añadir el interruptor persistente al
  submenú nativo `Settings > Sleep screen > Wallpaper`, protegerlo contra
  duplicados y probar el estado activado/desactivado.
- [x] **KR-T33b: Personalizar la composición.** Añadir visibilidad por dato
  (incluidas páginas y tiempos restantes de capítulo/libro), posición vertical,
  alineación horizontal, distribución fila/cuadrícula y ajuste de portada;
  recalcular el layout sin tarjetas o espacios vacíos.
- [x] **KR-T33c: Añadir vista previa segura.** Mostrar la composición actual con
  ayuda visible y cierre por toque/tecla sin alterar el estado del screensaver.
- [x] **KR-T33d: Limpiar el frame anterior al bloquear un libro.** Seguir la
  secuencia nativa de KOReader en e-ink físico (`clear` + `refreshFull` de toda
  la pantalla) antes de mostrar la composición de portada y estadísticas, sin
  tocar la ruta `Leave screen as-is` de calendario/notas.

## Fase 6: Verificación

- [ ] **KR-T34: Ejecutar suite local.** Probar mapper, API mock, ETag, cache,
  errores, Markdown, UI y doble inicialización.
- [ ] **KR-T35: Ejecutar backend real.** Probar token válido, revocado, scopes,
  200, 304, 401, 403, 413 con `SNAPSHOT_TOO_LARGE` y aislamiento.
- [ ] **KR-T36: Probar KOReader real.** Verificar instalación, FileManager,
  ReaderUI, UIManager, gesto, refresco y limpieza.
- [ ] **KR-T37: Probar SimpleUI real.** Verificar Quick Action, registro tardío,
  cachés y presencia de `2-custom-navbar.lua`.
- [ ] **KR-T38: Revisar licencias.** Resolver licencia del parche y preparar
  atribuciones antes de distribuir.
- [ ] **KR-T39: Cerrar trazabilidad.** Actualizar estados de requisitos,
  aceptación, tests y backend sin declarar funcional lo que no esté probado.

## Regla De Bloqueo

KR-T18 a KR-T24a y KR-T30 a KR-T33 pueden implementarse y probarse contra
fixtures o el runtime local sin afirmar disponibilidad real. La sincronización
real requiere que el contrato de `api-contract.md` permanezca sincronizado y
que el backend esté desplegado para probarla.

## Backlog Sugerido Fuera Del MVP

Estas ideas tienen sentido para la relación entre la web y el lector, pero no se
implementan sin una spec propia:

- **Resumen de próxima prioridad:** una franja local con el siguiente evento
  pendiente y su cuenta regresiva, reutilizando el snapshot existente.
- **Filtros locales:** mostrar solo académico, personal, pendiente, asignatura o
  grupo, sin nuevas peticiones ni cambios en el contrato.
- **Salud de sincronización:** edad del snapshot, última comprobación y aviso
  explícito de modo offline para no confundir caché con datos actuales.
- **Modo estudio:** una vista de los próximos eventos académicos que requieren
  preparación, enlazada con las notas ya disponibles offline.
- **Contexto de salvapantallas:** mostrar el siguiente compromiso o una nota
  seleccionada cuando la coexistencia con KOReader y el parche de Pedro esté
  validada.
