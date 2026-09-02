# Criterios De Aceptación: Karenda En KOReader

Estado: los criterios separan implementación local de verificación en SimpleUI,
backend y Kindle real. Un fixture local no satisface un criterio que requiera
backend real o Kindle real.

## 1. Producto Y Acceso

### KR-CA-001: Acción de apertura

**Dado** un entorno con la API pública de Quick Actions disponible, **cuando**
se cargue el plugin, **entonces** SimpleUI registrará las acciones externas
`Calendario` (`karenda_calendar`) y `Notas` (`karenda_notes`), que abrirán sus
superficies sin editar archivos de SimpleUI.

Verificación: prueba de integración en SimpleUI real. Estado: implementación
local pendiente de verificación real.

### KR-CA-002: Fallback de apertura

**Dado** un entorno sin Quick Actions, **cuando** el custom navbar u otro
integrador invoque los puntos públicos del plugin, **entonces** podrá abrir
calendario y notas sin depender de métodos heredados no enumerables.

Verificación: prueba Lua con objeto de plugin y mock de navbar. Estado:
pendiente.

### KR-CA-003: Solo lectura

**Dado** el plugin instalado, **cuando** se inspeccionen sus acciones y
peticiones, **entonces** no existirán operaciones de escritura de eventos ni
notas ni controles que las prometan.

Verificación: revisión estática y prueba de requests. Estado: pendiente.

## 2. Token Y Transporte

### KR-CA-004: Configuración del token

**Dado** un token generado desde la web, **cuando** la persona lo pegue y lo
guarde en KOReader, **entonces** podrá usar el plugin sin correo, contraseña,
cookie ni sesión de navegador.

Verificación: prueba de configuración con mock. Estado: pendiente.

### KR-CA-005: Encabezado HTTPS

**Dado** una sincronización, **cuando** el cliente envíe la petición, **entonces**
usará HTTPS y `Authorization: Bearer <device_token>`, sin incluir el token en la
URL o el body.

Verificación: mock HTTP que inspeccione URL, headers y body; prueba negativa para
URL HTTP. Estado: pendiente.

### KR-CA-006: No filtración

**Dado** un error de red, 401, 403 o excepción inesperada, **cuando** se muestre
el estado o se escriba un log, **entonces** el token y el encabezado de
autorización no aparecerán.

Verificación: tests de redacción de errores y logs. Estado: pendiente.

### KR-CA-007: Revocación y scopes

**Dado** un token revocado o sin `read:snapshot`, **cuando** se solicite el
snapshot, **entonces** el plugin conservará la caché previa, mostrará un mensaje
español seguro y no intentará escribir ni renovar credenciales de usuario.

Verificación: integración contra backend real. Estado: pendiente de prueba
autenticada; el endpoint está desplegado.

## 3. Tiempo Y Snapshot

### KR-CA-008: Valores temporales

**Dado** un evento con hora y uno de todo el día, **cuando** se conviertan desde
la red, **entonces** el primero conservará un instante ISO inequívoco y el
segundo conservará `YYYY-MM-DD` sin conversión UTC.

Verificación: fixture y test de mapper. Estado: pendiente.

### KR-CA-009: Ventana predeterminada

**Dado** hoy en `America/Santiago` sin ventana configurada, **cuando** el
cliente prepare una solicitud, **entonces** usará hoy menos 7 días como `from`
y hoy más 180 días como `to`, con `from` inclusivo y `to` exclusivo.

Verificación: test de fechas con reloj controlado. Estado: pendiente.

### KR-CA-010: Ventana configurable

**Dado** una ventana y zona configuradas, **cuando** se sincronice, **entonces**
los parámetros `from`, `to` y `timezone` llegarán al endpoint y aparecerán en
`window` y `timezone` de una respuesta 200.

Verificación: mock de cliente y contrato. Estado: pendiente.

### KR-CA-011: Proyección independiente

**Dado** un snapshot válido, **cuando** se decodifique, **entonces** usará
`schema_version`, `snapshot_id`, `generated_at`, `timezone`, `window`,
`start_at`, `end_at`, `all_day`, `content_markdown` y `updated_at` con nombres
snake_case en red, y modelos internos propios en el plugin.

Verificación: test de mapper y fixture. Estado: pendiente.

### KR-CA-012: Notas completas

**Dado** notas creadas en fechas fuera de la ventana de eventos, **cuando** se
reciba un snapshot, **entonces** sus metadatos y contenido Markdown aparecerán
igualmente en `notes`.

Verificación: fixture con fechas fuera de rango. Estado: pendiente.

### KR-CA-013: ETag 304

**Dado** una caché válida y su ETag, **cuando** el servidor confirme que la
representación no cambió, **entonces** responderá 304 y el cliente conservará
exactamente el snapshot anterior sin reemplazarlo.

Verificación: mock de 304 y prueba de integración real. Estado: pendiente; la
parte real requiere un token válido.

### KR-CA-014: Snapshot demasiado grande

**Dado** un snapshot que supera el límite de tamaño, **cuando** se solicite,
**entonces** el backend devolverá `HTTP 413` con
`error_code: SNAPSHOT_TOO_LARGE`, sin datos parciales, y el cliente conservará
la caché previa. El límite será `1 MiB` de JSON UTF-8 sin comprimir y no se
aplicará paginación implícita.

Verificación: mock de 413 y backend real. Estado: pendiente; la parte real
requiere datos de prueba y un token válido.

## 4. Caché Y Offline

### KR-CA-015: Reemplazo atómico

**Dado** un snapshot válido, **cuando** se guarde, **entonces** un corte durante
la escritura no dejará un JSON parcial presentado como válido y el snapshot
anterior seguirá disponible.

Verificación: test del almacén con fallo de rename/escritura. Estado: pendiente.

### KR-CA-016: Lectura sin conexión

**Dado** un snapshot válido y ninguna red, **cuando** se abra Karenda, **entonces**
se mostrará ese snapshot y no se hará una petición automática desde
`Screensaver.show`.

Verificación: mock offline y prueba de salvapantallas. Estado: pendiente.

### KR-CA-017: Primer arranque vacío

**Dado** que no existe snapshot local, **cuando** se abra Karenda offline,
**entonces** se mostrará un estado vacío claro en español sin inventar eventos ni
notas.

Verificación: fixture sin snapshot. Estado: pendiente.

## 5. Vistas Y Markdown

### KR-CA-018: Agenda

**Dado** un snapshot local, **cuando** se abra calendario, **entonces** se
mostrarán eventos ordenados, estados textuales, relaciones, rangos y eventos de
todo el día mediante widgets nativos.

Verificación: prueba de widgets con fixture. Estado: pendiente.

### KR-CA-019: Notas Markdown

**Dado** una nota con encabezado, énfasis, lista, enlace, cita, código y tabla,
**cuando** se abra offline, **entonces** se mostrará de forma legible con
jerarquía de encabezados, negrita y cursiva, sin ejecutar HTML, scripts o
enlaces peligrosos.

Verificación: `markdown_smoke.lua`, `calendar_view_smoke.lua` y test del renderer
Lua. Estado: implementación local y smokes correctos; verificación visual en
dispositivo pendiente.

## 6. Salvapantallas

### KR-CA-020: Prioridad de contexto

**Dado** que existe `ReaderUI.document` pero la vista visible de Karenda es
calendario o nota, **cuando** KOReader llame a `Screensaver.show`, **entonces**
se dejará la pantalla actual intacta mediante la semántica nativa de `Leave
screen as-is`, y no se mostrará el libro cargado, siempre que la pantalla de
bloqueo de Karenda esté activada.

Verificación: prueba con ReaderUI simulado, contexto explícito y delegación al
método nativo. Estado: implementado localmente; falta dispositivo real.

### KR-CA-021: Pantalla integrada de lectura

**Dado** que Karenda no está visible y la persona está leyendo, **cuando** se
muestre el salvapantallas, **entonces** Karenda mostrará una pantalla de libro
de solo lectura con portada a pantalla completa, tarjeta de identificación,
tarjetas tipo post-it con estadísticas y barra de progreso, y conservará el
cierre y gesto nativos.

Verificación: smoke local con widgets simulados y dispositivo real. Estado:
implementado localmente; falta dispositivo real.

### KR-CA-021a: Activación visible

**Dado** que la persona abre `Settings > Sleep screen > Wallpaper`, **cuando**
active o desactive `Pantalla de bloqueo de Karenda`, **entonces** el estado
quedará marcado en ese mismo menú y la siguiente llamada al salvapantallas
respetará la selección sin cambiar las opciones nativas de Wallpaper.

Verificación: `screensaver_config_spec.lua` y KOReader real. Estado:
implementado localmente; falta dispositivo real.

### KR-CA-021b: Personalización visual

**Dado** que la persona abre `Personalizar pantalla de bloqueo`, **cuando**
muestre u oculte cualquiera de las métricas disponibles —incluidos tiempo y
páginas restantes de capítulo/libro— o cambie posición, alineación o
distribución, **entonces** la siguiente pantalla de libro mostrará exactamente
la selección guardada, recalculará el layout sin tarjetas vacías, respetará el
ajuste de portada y conservará la configuración después de reiniciar KOReader.

Verificación: `screensaver_config_spec`, `book_screensaver_smoke` y KOReader
real. Estado: implementado localmente; pendiente de validación en dispositivo.

### KR-CA-021c: Vista previa cerrable

**Dado** que hay un libro abierto, **cuando** la persona pulse `Vista previa`,
**entonces** se mostrará la composición con la configuración actual y una ayuda
visible para salir; un toque o cualquier tecla deberá cerrarla y devolver el
control al menú sin modificar el estado del salvapantallas real.

Verificación: `screensaver_preview_smoke` con cierre por toque y KOReader real.
Estado: implementado localmente; pendiente de validación de tecla y toque en
dispositivo.

### KR-CA-021d: Limpieza anti-ghosting

**Dado** un dispositivo e-ink y un libro abierto, **cuando** se muestre la
pantalla integrada de lectura, **entonces** se limpiará el framebuffer y se
ejecutará un refresco completo de toda la pantalla antes de pintar la portada y
las estadísticas. El modo `Leave screen as-is` de calendario y notas no hará
ese reemplazo visual.

Verificación: `screensaver_integration_smoke` con una pantalla e-ink simulada y
Kindle real, comprobando que el frame de la página anterior no quede visible.
Estado: implementado localmente; pendiente de validación en dispositivo.

### KR-CA-022: Wrapper idempotente

**Dado** que KOReader crea instancias para FileManager y ReaderUI, **cuando**
cada instancia inicialice el plugin, **entonces** `Screensaver.show` tendrá un
solo wrapper de Karenda y `raw_call` seguirá apuntando al método anterior.

Verificación: test de doble inicialización e inspección de cadena. Estado:
implementado localmente.

### KR-CA-023: Limpieza

**Dado** una pantalla de calendario o nota abierta, **cuando** la persona salga
de Karenda, **entonces** el contexto quedará vacío y el siguiente salvapantallas
usará la pantalla integrada solo si existe un libro activo; fuera de un libro
delegará sin cambios.

Verificación: prueba de ciclo UIManager y dispositivo real. Estado:
implementado localmente; falta dispositivo real.

## 7. Integración Y Publicación

### KR-CA-024: Conflicto de barra

**Dado** que está instalado `2-custom-navbar.lua`, **cuando** el plugin se
inicialice, **entonces** detectará o documentará el estado de la barra y no
modificará simultáneamente SimpleUI y el parche.

Verificación: inspección del Kindle real y prueba de instalación. Estado:
bloqueado por ausencia de dispositivo.

### KR-CA-025: Fixture/mock

**Dado** el cliente detrás de una interfaz, **cuando** se ejecuten las pruebas
locales, **entonces** cubrirán 200, 304, JSON inválido, expiración, revocación,
falta de scope, error de red y snapshot demasiado grande sin llamar al backend
real.

Verificación: suite local del plugin. Estado: pendiente.

### KR-CA-026: Sincronización real

**Dado** un endpoint Edge desplegado y un token de dispositivo válido, **cuando**
se realice una sincronización HTTPS en KOReader, **entonces** el resultado podrá
marcarse funcional solo después de validar 200, 304, errores y aislamiento de
cuenta.

Verificación: integración contra InsForge y Kindle real. Estado: pendiente de
prueba autenticada y dispositivo real.

### KR-CA-027: Licencia y alcance

**Dado** el paquete distribuible, **cuando** se revise su contenido, **entonces**
no modificará archivos de SimpleUI o KOReader ni el parche de Pedro, no copiará código de
licencia desconocida y declarará las atribuciones necesarias.

Verificación: revisión estática y lista de distribución. Estado: pendiente.

### KR-CA-028: Sincronización al reanudar

**Dado** un intervalo configurado y una última comprobación suficientemente
antigua, **cuando** KOReader reanude, **entonces** el plugin iniciará una
sincronización automática sin bloquear la vista y conservará la caché anterior
si falla. Si el intervalo no está configurado o no venció, no hará una petición.

Verificación: test con reloj controlado, mock de cliente y evento de reanudación.
Estado: pendiente.

### KR-CA-029: Apertura cache-first

**Dado** un snapshot local validado, **cuando** se toque `Calendario` o `Notas`
desde la navbar, **entonces** se abrirá la vista correspondiente sin petición de
red y se conservará la navegación de solo lectura.

Verificación: fixture local y mock de transporte. Estado: pendiente.

### KR-CA-030: Apertura inicial sin caché

**Dado** que no existe snapshot local, **cuando** se toque una acción de Karenda,
**entonces** podrá ejecutarse una única sincronización inicial y se mostrará la
vista o un estado vacío claro en español si falla.

Verificación: mock configurado y sin token. Estado: pendiente.

### KR-CA-031: Modos de agenda

**Dado** un snapshot local con eventos en fechas distintas, **cuando** se abra
`Calendario`, **entonces** se podrán seleccionar `Agenda`, `Mes`, `Semana` y
`Día`, en ese orden, mediante un selector segmentado persistente con exactamente
un modo activo. La apertura será `Agenda`; `Mes` y `Semana` mostrarán una
cuadrícula de siete columnas y `Agenda` y `Día` mostrarán los eventos
correspondientes mediante widgets nativos, sin abrir un diálogo para cambiar de
vista.

Verificación: fixture con eventos y prueba de widgets. Estado: selector y smoke
locales correctos; verificación en Kindle real pendiente.

### KR-CA-032: Navegación temporal

**Dado** un modo de calendario activo, **cuando** se toque `Anterior`, `Hoy` o
`Siguiente`, **entonces** cambiará el periodo visible sin petición de red,
conservará el orden de eventos y mostrará un estado explícito al salir de la
ventana sincronizada. Si la pantalla permanece abierta hasta el siguiente día,
`Hoy` se actualizará con la fecha local real; una agenda que no fue navegada
manualmente seguirá esa nueva fecha y una que sí fue navegada conservará su
cursor. Al reanudar KOReader se comprobará la misma condición.

Verificación: test de periodos con reloj controlado y prueba de UI. Estado:
rollover, cursor manual y navegación locales correctos; verificación en Kindle
real pendiente.

### KR-CA-033: Lectura estática en e-reader

**Dado** un snapshot local y cualquier geometría soportada por KOReader,
**cuando** se abra `Calendario`, **entonces** aparecerá `Agenda` a pantalla
completa con el selector segmentado, próximos eventos agrupados por fecha,
énfasis textual para eventos académicos pendientes e indicación textual de hoy.
Los títulos, avisos y vacíos conservarán alto contraste y no serán botones
deshabilitados.

**Dado** un título o relación extensa, **cuando** se construya una fila,
**entonces** fecha/rango, título, tipo, relación y estado conservarán regiones y
líneas diferenciadas sin reducirse a una cadena única. Si existen más de cuatro
eventos vigentes, se indicará la cantidad restante y podrán consultarse en
`Agenda`.

Verificación: test del modelo de vista previa y agrupación, smoke de widgets con
geometrías vertical y horizontal, KOReader de escritorio y contraste/ghosting en
Kindle real. Estado: implementación local y smoke vertical/horizontal correctos;
verificación en Kindle real pendiente.

### KR-CA-034: Zona horaria en la presentación

**Dado** un instante RFC 3339 con `Z` u offset y una zona distinta en
`snapshot.timezone`, **cuando** el calendario agrupe, ordene y muestre el evento,
**entonces** usará la fecha y hora civil de la zona del snapshot. `Hoy` deberá
derivarse de la misma zona; un límite final exacto a medianoche no ocupará el día
siguiente.

Verificación: fixture con cambio de fecha, offsets equivalentes y transición de
horario de verano para `America/Santiago`. Estado: pendiente; el mapper conserva
los instantes, pero la capa temporal Lua todavía usa sus componentes literales y
la zona del dispositivo.

### KR-CA-035: Cuenta regresiva de entrega

**Dado** un snapshot local con eventos pendientes simples y de varios días,
**cuando** se muestre `Agenda`, `Día` o una vista previa de `Mes`/`Semana`,
**entonces** cada fila y su detalle mostrarán `Hoy`, `Mañana`, `Faltan N días`,
`Faltan 1 día` o el texto de vencimiento correspondiente. Un evento de varios
días contará hasta `endAt`, un todo el día tratará su fecha final como inclusiva
y un evento completado no mostrará una cuenta regresiva obsoleta.

**Dado** que la fecha local cambió mientras la vista estaba abierta o KOReader
se reanudó, **cuando** se actualice la superficie, **entonces** los textos de
cuenta regresiva se recalcularán sin sincronizar ni hacer red.

Verificación: tests de diferencia de fechas, evento multidiario, medianoche,
vencido y completado; smoke de filas y detalle. Estado: implementación local y
smoke correctos; verificación en Kindle real pendiente.

### KR-CA-036: Orden e iconos de Quick Actions

**Dado** el plugin instalado, **cuando** se inspeccione la superficie y sus
descriptores de SimpleUI, **entonces** el selector aparecerá como `Agenda`,
`Mes`, `Semana`, `Día` y `Calendario`/`Notas` usarán SVG locales `48x48` de
contorno monocromo, sin editar ni copiar archivos de SimpleUI.

Verificación: smoke del selector e inspección estática de SVG. Estado:
implementación local correcta; verificación en Kindle real pendiente.

### KR-CA-037: Navegación y refresh

**Dado** un snapshot local visible en `Calendario` o `Notas`, **cuando** se
toque la Quick Action correspondiente, **entonces** se abrirá esa superficie
desde la caché sin petición de red y mantendrá el modo de solo lectura. La web
conservará su navegación común entre ambas superficies.

**Dado** cualquier superficie visible, **cuando** se toque `Actualizar`,
**entonces** se mostrará un estado de carga y se ejecutará una sincronización
explícita con el texto `Actualizando calendario y notas…`. Ante `200` la vista
activa mostrará el snapshot validado, incluyendo notas nuevas, y una notificación
indicará que se actualizaron el calendario y las notas; ante `304` una
notificación indicará que ya estaban al día. La otra superficie recibirá el mismo
snapshot completo al abrirse. Ante error la vista anterior permanecerá visible y
se indicará que se conservan los datos locales.

Verificación: smoke de acciones de cabecera, `refresh_view_smoke.lua`,
`sync_service_spec.lua` y prueba de caché para `200`, `304` y error. Estado:
implementación local correcta; backend autenticado y Kindle real pendientes.

### KR-CA-038: Icono de calendario refinado

**Dado** el asset de calendario, **cuando** se inspeccione o se renderice en la
navbar, **entonces** tendrá una hoja lineal con cabecera, anillas y una única
marca interior, sin una cuadrícula negra densa, y conservará caja `48x48` y
contraste monocromo.

Verificación: XML/SVG estático, smoke de carga de assets y Kindle real. Estado:
implementación local correcta; validación en Kindle pendiente.

### KR-CA-039: Quick Actions conservan el contexto

**Dado** que la persona está en Home, Library o Reader, **cuando** toca
`Calendario` o `Notas` desde una Quick Action, **entonces** la superficie de
Karenda aparecerá sobre la pantalla actual sin navegar primero a Library.

**Dado** un overlay de Karenda abierto, **cuando** se cierre con el botón o el
gesto nativo de volver, **entonces** reaparecerán la pantalla y el contexto que
estaban debajo, sin perder documento, posición ni página.

Verificación: descriptors con flags in-place, smoke de callbacks y
SimpleUI/KOReader real. Estado: implementación local y smoke correctos; la
prueba real de restauración del stack requiere dispositivo.

### KR-CA-040: Fórmulas Markdown

**Dado** contenido Markdown con `$O(|d| \\cdot |p|)$`, `$|d|$` y una fórmula de
bloque, **cuando** se muestre en la web, **entonces** se renderizarán como
fórmulas matemáticas y no como delimitadores o comandos crudos. HTML ejecutable
y enlaces inseguros continuarán ausentes o neutralizados.

**Dado** el mismo contenido en el plugin offline, **cuando** se abra el detalle,
**entonces** se mostrará una representación legible como `O(|d| · |p|)`, con
variables matemáticas diferenciadas, exponentes/subíndices tipográficos y
símbolos como `Σ`, `⊆`, `∪`, `∩`, `∖` y `≡`, sin delimitadores `$` ni comandos
LaTeX comunes sin convertir. Una expresión como `\rho: p_0
\xrightarrow{a_1} p_1` mostrará `a₁` sobre la flecha, y `\Sigma = \{0, 1\}`
mostrará las llaves literales.

Verificación: test de `MarkdownRenderer`, smoke enriquecido de `markdown.lua` y
`calendar_view_smoke.lua`; KOReader real para contraste/ghosting. Estado:
implementación local y smokes correctos; dispositivo real pendiente.

### KR-CA-041: Notas de lectura y administración explícita

**Dado** que existe un catálogo o snapshot de notas, **cuando** se abra la
superficie web, **entonces** se mostrará una lista y un detalle de lectura, sin
editor abierto ni acción de guardado primaria.

**Dado** que la persona pulsa `Configurar notas`, **cuando** el modo de
administración se abra, **entonces** podrá crear, editar o eliminar mediante
acciones explícitas y el editor solo aparecerá dentro de ese modo.

Verificación: tests de `NotesPage` y `NoteEditor`. Estado: implementación local y
tests correctos; verificación visual real pendiente.

### KR-CA-042: Filtro por ramos

**Dado** un catálogo con varias asignaturas y notas, **cuando** se abra la
navegación de notas, **entonces** la primera opción será `Todos los ramos`,
seguida por una opción por cada asignatura. Seleccionar el primer filtro mostrará
las notas de asignaturas y seleccionar una asignatura mostrará solo sus notas.
Los grupos personales continuarán accesibles por separado.

Verificación: tests de navegación web, store y smoke de `NotesScreen`. Estado:
implementación local, tests y smoke correctos; verificación visual real
pendiente.

### KR-CA-043: Acciones de cabecera estables

**Dado** calendario con subtítulo y notas sin el mismo subtítulo, **cuando** se
construyan ambas superficies, **entonces** la cabecera propia aparecerá primero,
su X estará arriba a la derecha y `Actualizar` quedará inmediatamente a su
izquierda en la misma cabecera. No aparecerán botones internos `Calendario` ni
`Notas`; la actualización será compacta, usará un símbolo y mantendrá su acción
explícita de sincronización.

Verificación: smoke de geometría y revisión estática del botón. Estado:
implementación local y smoke correctos; verificación visual real pendiente.

### KR-CA-044: Navbar inferior conservada

**Dado** que existe una navbar inferior activa bajo la superficie actual,
**cuando** se abra calendario o notas, **entonces** la navbar seguirá visible
debajo de Karenda y sus acciones continuarán siendo táctiles.

**Dado** calendario o notas abiertos, **cuando** se pulse la X de la cabecera,
**entonces** la superficie se cerrará y se conservará el contexto que estaba
debajo.

Verificación: smoke con navbar simulada, prueba de propagación de gestos y
SimpleUI/KOReader real. Estado: implementación local y smoke correctos; el
dispositivo real sigue pendiente.

### KR-CA-045: Cambio de navbar desde una superficie

**Dado** calendario o notas abiertos sobre Home, Library o Reader, **cuando** se
toque otra acción de la navbar, **entonces** el gesto llegará al widget
subyacente, la superficie de Karenda se cerrará en el siguiente ciclo y quedará
visible el destino que se seleccionó sin mostrar Home como estado intermedio. El
cierre no deberá solicitar un repintado de la vista inferior antes de que la
navegación termine ni dejar el destino debajo de una superficie antigua.

**Dado** que se abre calendario o notas desde una acción de Karenda, **entonces**
el indicador activo de la navbar marcará la acción correspondiente mientras la
superficie esté visible. Si se selecciona otra pestaña antes del cierre diferido,
el desmontaje conservará ese nuevo indicador en lugar de restaurar la pestaña
anterior.

Verificación: smoke de propagación y supresión de repintado, mock de
`setTempTabActive` y SimpleUI/KOReader real desde Home, Library y Reader. Estado:
implementación local y smokes correctos; el dispositivo real sigue pendiente.

## 8. Puerta De Salida

El MVP no podrá declararse listo mientras alguno de estos puntos siga abierto:

- pruebas autenticadas del endpoint real de snapshot y gestión de tokens;
- 200/304/401/403/413 probados contra backend real;
- aislamiento del propietario del token no verificado;
- coexistencia del wrapper con el parche de Pedro no probada;
- instalación de SimpleUI y `2-custom-navbar.lua` no inspeccionada en el Kindle;
- tests del cliente, caché, Markdown, filtros de notas y estados offline
  ausentes.
