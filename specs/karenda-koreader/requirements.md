# Requisitos: Karenda En KOReader

Estado: especificación de producto y comportamiento para el MVP de solo
lectura. La primera vertical del plugin está implementada; la API Edge y la
gestión web de tokens están implementadas, pendientes de integración autenticada.

Fuente de verdad del dominio: Karenda Web en InsForge. El plugin mantiene una
caché local únicamente para lectura offline y nunca modifica eventos ni notas
en este MVP.

## 1. Alcance

El MVP contempla un plugin separado de KOReader que pueda abrirse desde
SimpleUI y mostrar:

- una agenda de eventos académicos y personales;
- notas Markdown asociadas a asignaturas o grupos personales;
- accesos separados a calendario y notas desde la navbar de SimpleUI cuando su
  API pública esté disponible;
- el último snapshot sincronizado cuando no exista conexión;
- una representación contextual en el salvapantallas únicamente cuando la
  vista visible de Karenda esté activa.

El MVP no contempla escritura desde el Kindle, sincronización incremental,
sesiones de navegador, cookies, credenciales de usuario, modificación de
SimpleUI, modificación del parche de Pedro ni una API falsa local en producción.
Los fixtures y mocks locales están permitidos únicamente para probar el cliente
antes de validar el backend real.

## 2. Requisitos Funcionales

### KR-REQ-001: Solo lectura

El plugin deberá consultar y mostrar snapshots. No deberá exponer acciones ni
llamadas que creen, editen, eliminen o cambien el estado de eventos o notas.
Los botones y menús del Kindle no deberán sugerir que esas operaciones están
disponibles.

### KR-REQ-002: Apertura desde SimpleUI

Cuando exista la API pública de Quick Actions de SimpleUI, el plugin deberá
registrar tres acciones externas con IDs estables: `karenda_calendar`, con
etiqueta visible `Calendario`; `karenda_notes`, con etiqueta visible `Notas`; y
`karenda`, con etiqueta visible `Karenda`. Las dos primeras abrirán su
superficie de lectura correspondiente y la tercera abrirá una superficie
unificada con un selector superior para alternar entre calendario y notas. El
texto de errores o estados será español. La entrada de menú `Karenda` seguirá
disponible para vinculación y sincronización.

Si la API no está disponible, el plugin deberá conservar puntos de entrada
públicos propios para abrir el calendario, las notas y la superficie unificada.
Esos puntos de entrada no deberán depender de editar archivos de SimpleUI.

### KR-REQ-003: Token independiente por dispositivo

La vinculación inicial se iniciará desde la web de Karenda. La persona generará
un código numérico de seis dígitos asociado a una etiqueta de dispositivo y lo
introducirá manualmente en la configuración del plugin. El código vencerá en
10 minutos, podrá consumirse una sola vez y no se guardará en el plugin.

El backend emitirá después un token independiente y opaco para ese dispositivo.
El plugin no deberá iniciar sesión ni solicitar correo, contraseña, cookie o
sesión de navegador.

El token deberá ser opaco, pertenecer a un dispositivo concreto y poder
revocarse o regenerarse desde Karenda. El endpoint de gestión web está
implementado; su uso real queda sujeto a pruebas autenticadas.

### KR-REQ-004: Transporte y secreto del token

Toda petición remota deberá utilizar HTTPS y enviar el token exclusivamente en
el encabezado:

```http
Authorization: Bearer <device_token>
```

El token no deberá aparecer en URLs, query strings, nombres de archivos,
logs, stack traces, mensajes de error, diagnósticos ni pantallas después de ser
guardado. Las redirecciones a HTTP deberán rechazarse.

### KR-REQ-005: Scopes

El contrato deberá transportar scopes asociados al token aunque el MVP solo
requiera `read:snapshot`. El scope futuro `write:events` se reserva para una
fase posterior y no habilita ninguna escritura en este MVP.

Un token ausente, inválido, expirado o revocado deberá producir un estado de
autenticación fallida sin revelar el valor recibido. Un token sin
`read:snapshot` deberá producir un estado de permisos insuficientes.

### KR-REQ-006: Configuración local

La configuración del plugin deberá permitir, como mínimo:

- URL HTTPS de la API de snapshot;
- acción para introducir un código de emparejamiento de seis dígitos;
- token de dispositivo emitido internamente después del emparejamiento;
- zona horaria IANA;
- fecha inicial opcional de la ventana;
- fecha final opcional de la ventana;
- intervalo opcional para sincronización automática al reanudar;
- acción manual de sincronización.

La zona horaria predeterminada será `America/Santiago`. El código solo se usará
para el canje y no deberá persistirse. El token emitido podrá reemplazarse, pero
no deberá mostrarse en claro después de guardarlo. La protección del token en
reposo deberá respetar las capacidades de almacenamiento de KOReader y no podrá
presentarse como cifrado si no existe una decisión o mecanismo real para ello.

### KR-REQ-007: Ventana predeterminada

Cuando la persona no configure una ventana, el cliente deberá solicitar:

- `from`: fecha local de hoy menos 7 días;
- `to`: fecha local de hoy más 180 días.

`from` será inclusivo y `to` exclusivo. El cliente deberá enviar las fechas
calculadas explícitamente para que la sincronización no dependa de la zona
horaria del servidor.

### KR-REQ-008: Ventana y zona configurables

El contrato deberá permitir modificar `from`, `to` y `timezone`. Las fechas de
la ventana serán `YYYY-MM-DD` y la zona será un identificador IANA válido. El
servidor deberá rechazar rangos inválidos o excesivos con un error explícito;
no deberá truncar silenciosamente la solicitud.

### KR-REQ-009: Representación temporal

Los instantes con hora deberán viajar como ISO 8601/RFC 3339 con offset o `Z`.
La zona solicitada formará parte del snapshot y solo definirá la presentación
de instantes. La proyección deberá expresar cada instante con el offset civil de
esa zona para que el cliente offline no dependa de la zona del dispositivo.

Los eventos de todo el día deberán usar `start_at` y, cuando corresponda,
`end_at` como fechas locales `YYYY-MM-DD`, sin convertirlas a UTC. El rango de
todo el día será inclusivo en su fecha final.

### KR-REQ-010: Snapshot completo

Una respuesta válida deberá ser un snapshot completo de la ventana solicitada,
no un conjunto de cambios. Deberá incluir como mínimo:

- `schema_version`;
- `snapshot_id`;
- `generated_at`;
- `timezone`;
- `window`;
- `events`;
- `notes`.

También deberá incluir `subjects` y `personal_groups` para resolver nombres,
abreviaciones y colores de las relaciones referenciadas por eventos y notas.
La proyección pública no deberá exponer `owner_id` ni depender del esquema
físico de InsForge.

### KR-REQ-011: Notas fuera de la ventana

Las notas no deberán filtrarse por la ventana de eventos. El snapshot deberá
incluir los metadatos y el contenido Markdown original de todas las notas
accesibles al token, junto con su destino estable.

El JSON completo, medido en UTF-8 sin comprimir, no podrá superar `1 MiB`
(`1048576` bytes). Si el snapshot supera ese límite, el servidor deberá
devolver `HTTP 413` con `error_code: SNAPSHOT_TOO_LARGE`, sin datos parciales.
La paginación de notas queda fuera del MVP y no se podrá introducir
silenciosamente.

### KR-REQ-012: Validación de snapshot

El cliente deberá validar `schema_version`, `snapshot_id`, `generated_at`,
`timezone`, `window`, arrays y campos requeridos antes de reemplazar la caché.
Un snapshot inválido no deberá destruir el último snapshot válido.

### KR-REQ-013: ETag y revalidación

El cliente deberá enviar `If-None-Match` cuando tenga un ETag asociado a la
misma combinación de URL, ventana, zona y token lógico. La API deberá devolver
`304 Not Modified` sin cuerpo cuando la representación no haya cambiado.

Ante `200 OK`, el cliente deberá guardar el ETag recibido junto con el snapshot.
Ante `304`, deberá conservar el snapshot anterior y actualizar solamente la
información de comprobación necesaria.

### KR-REQ-014: Caché local atómica

El último snapshot válido y su metadata deberán persistirse en el directorio de
datos de KOReader bajo una carpeta propia de Karenda. La escritura deberá ser
atómica: un snapshot nuevo se escribirá a un temporal, se validará y luego se
renombrará. Un corte de energía o una respuesta inválida no deberá dejar una
caché que parezca válida.

### KR-REQ-015: Modo offline

Si no existe conexión, el token es inválido, el endpoint falla o todavía no hay
un snapshot válido, la interfaz deberá conservar el último snapshot disponible
o mostrar un mensaje claro en español. Nunca deberá presentar como sincronizado
un snapshot que no fue validado.

### KR-REQ-016: Agenda nativa

La vista de calendario deberá ofrecer, mediante widgets nativos de KOReader, los
modos `Agenda`, `Mes`, `Semana` y `Día`. `Mes` y `Semana` usarán una cuadrícula de
siete columnas con día y cantidad de eventos; `Día` y `Agenda` podrán usar filas
detalladas. Deberá permitir cambiar el periodo con `Anterior`, `Hoy` y
`Siguiente` y mostrar eventos ordenados por fecha y hora, distinguiendo eventos
académicos y personales, estados `pending` y `completed`, eventos de todo el día
y relaciones con asignaturas o grupos cuando existan.

La apertura predeterminada será `Agenda`. La cabecera mostrará un selector
segmentado persistente, en este orden exacto: `Agenda`, `Mes`, `Semana`, `Día`,
con exactamente un modo activo; cambiar de modo no abrirá un diálogo ni hará red.
La superficie será
de pantalla completa y priorizará la consulta estática: periodo y contexto en la
cabecera, contenido principal y navegación secundaria en un pie. Encabezados,
avisos y estados vacíos no se representarán como botones deshabilitados.

`Agenda` agrupará los próximos eventos desde la fecha de referencia. Los grupos
de la fecha local actual y del día siguiente usarán las etiquetas `HOY` y
`MAÑANA`, acompañadas de la fecha completa; los demás grupos mostrarán su fecha
completa. Los eventos académicos `pending` deberán tener un énfasis textual
adicional que indique que requieren estudio o preparación, sin depender del
color. La vista `Agenda` mostrará exclusivamente eventos con estado `pending`;
los eventos `completed` seguirán disponibles en `Mes`, `Semana` y `Día`.

La fecha de `Hoy` se calculará con el reloj local del dispositivo. La vista
deberá comprobar el cambio de fecha al reanudarse KOReader y programar una
comprobación para el siguiente cambio de día mientras permanezca abierta. Si la
persona no navegó manualmente, la referencia de `Agenda` seguirá el nuevo día;
después de una navegación manual, el cursor deberá conservarse. Pulsar `Hoy`
restablecerá el seguimiento automático.

En Mes y Semana, la cuadrícula no incluirá títulos dentro de sus columnas y
mostrará hasta cuatro eventos vigentes del periodo desde la fecha de referencia.
Cada resumen tendrá una región de fecha/rango, una línea de título y otra con
tipo, relación y estado; si quedan eventos, se indicará su cantidad y que están
disponibles en `Agenda`. El cuerpo deberá desplazarse cuando la geometría del
e-reader no permita mostrarlo completo.

El color podrá aportar contexto, pero cada estado y relación deberá tener texto.
Hoy deberá distinguirse también mediante texto o forma, no solo por gris. El
layout se calculará desde la pantalla y tamaños nativos de KOReader, sin depender
de un modelo concreto de Kindle, y los cambios de periodo no deberán hacer red.
El seguimiento del cambio de día solo actualizará la lectura local y no
sincronizará el snapshot.

### KR-REQ-017: Notas nativas

La vista de notas deberá listar destinos y notas del snapshot local y mostrar el
título, fecha de actualización y contenido Markdown sin red. No deberá ejecutar
HTML, scripts, atributos ni enlaces peligrosos.

El subconjunto mínimo será: encabezados, párrafos, énfasis, listas, enlaces,
citas, bloques de código y tablas GFM. Una sintaxis no soportada deberá
degradarse como texto legible, no como ejecución.

### KR-REQ-018: Contexto visible para el salvapantallas

El plugin central deberá mantener un contexto explícito de la vista visible y
publicarlo mediante un puente opcional. El puente no será una dependencia
inversa: si el plugin de pantalla de bloqueo no está instalado, Karenda seguirá
funcionando con su estado interno; si el plugin central no está instalado, el
plugin de pantalla de bloqueo asumirá `none` y no cargará módulos de Karenda ni
consultará InsForge.

- `calendar` cuando la agenda de Karenda esté visible;
- `note` cuando una nota de Karenda esté visible;
- `none` en cualquier otro caso.

La función integrada deberá poder activarse y desactivarse desde el submenú
nativo `Settings > Sleep screen > Wallpaper`, mediante la opción
`Pantalla de bloqueo de lectura`. Estará desactivada por defecto. Cuando esté
desactivada, `Screensaver.show` delegará al comportamiento que KOReader y los
parches instalados ya tengan configurado.

Cuando esté activada, la política del salvapantallas se resolverá en este orden:

1. contexto `calendar` o `note` y política `Conservar la pantalla actual`:
   reutilizar `Leave screen as-is` sin reconstruir la superficie;
2. libro activo y datos locales disponibles: mostrar el wallpaper de lectura;
3. ningún libro y política `Dejar la pantalla intacta`: usar `Leave screen as-is`;
4. cualquier otro contexto: delegar sin cambios al método anterior.

La política contextual deberá poder cambiarse sin tocar las opciones nativas:
para Calendario y Notas ofrecerá conservar la vista o mostrar el wallpaper del
libro si existe un documento activo; fuera de un libro ofrecerá delegar al
salvapantallas de KOReader o dejar la pantalla intacta. La existencia de
`ReaderUI.document` no ganará por sí sola frente a un contexto visible cuando la
política elegida sea conservarlo.

La existencia de `ReaderUI.document` nunca deberá ganar por sí sola frente al
contexto visible de Karenda. Cuando el contexto sea calendario o nota, la vista
actual deberá quedar intacta en el framebuffer: no se reconstruirá una copia
de la agenda o de la nota.

La personalización deberá mantener fija la identidad del libro y una única fila
de progreso con el porcentaje junto a la barra. Los datos opcionales incluirán
página, páginas y tiempo restantes de capítulo y libro, tiempo leído, días de
lectura, páginas leídas, ritmo medio y progreso del capítulo. Cada dato podrá
mostrarse u ocultarse y su orden se podrá modificar desde la configuración; los
identificadores persistidos serán estables y no dependerán del idioma. También
deberá incluir posición vertical (`top`, `center`, `bottom`), alineación
horizontal (`left`, `center`, `right`), estilo `minimalista` o `tarjetas
clásicas`, y ajuste de portada proporcional o a pantalla completa. El estilo
minimalista será el predeterminado: un único panel compacto, de alto contraste
y sin tarjetas repetidas. Ocultar un dato o no disponer de una estimación no
deberá dejar filas vacías ni espacios reservados.

La configuración deberá ofrecer además una opción para agrupar, cuando ambos
estén visibles y disponibles, las páginas y el tiempo restantes en las líneas
`Capítulo: páginas / tiempo` y `Libro completo: páginas / tiempo`. Al
desactivar esa opción, las cuatro métricas conservarán su representación
independiente y seguirán respetando la visibilidad y el orden configurados. La
cantidad de páginas usará `pág.` en singular y `págs.` en plural.

El submenú deberá ofrecer `Vista previa de pantalla de lectura`. La vista previa deberá usar el libro
activo y la configuración guardada, indicar cómo salir y poder cerrarse mediante
toque o tecla sin alterar el estado del bloqueo real ni dejar una superficie
modal abierta.

### KR-REQ-019: Salvapantallas sin red y con limpieza

El plugin de pantalla de bloqueo no deberá hacer peticiones de red y deberá
funcionar como paquete independiente. En calendario o nota
deberá reutilizar el comportamiento nativo de KOReader equivalente a `Leave
screen as-is`, sin crear un widget visual ni modificar permanentemente la
configuración del usuario. En lectura solo podrá consultar la vista activa y
los datos locales del libro; si la pantalla integrada no puede construirse,
deberá delegar al método anterior.

Al salir de Karenda, cerrar la nota, cerrar el calendario o cambiar a otra
superficie, el plugin central deberá limpiar el contexto que publicó. La composición integrada de libro
deberá conservar portada, progreso, estadísticas, cierre, rotación y gesto de
KOReader. En una pantalla e-ink física, antes de mostrar esa composición se
limpiará el framebuffer y se ejecutará un refresco completo síncrono de toda la
pantalla para eliminar el frame de la página anterior; el emulador SDL omitirá
esa operación específica de hardware. El método anterior se conservará cuando
la función esté desactivada, para FileManager y para cualquier contexto que no
corresponda a Karenda.

La configuración visual y de política se guardará en claves propias de
`G_reader_settings`.
La vista previa podrá consultar portada y estadísticas locales, pero no deberá
activar `Device.screen_saver_mode`, crear `ScreenSaverLockWidget` ni llamar a
`Screensaver:cleanup()`.

### KR-REQ-020: Wrapper coexistente

El plugin de pantalla de bloqueo deberá envolver el método actual `Screensaver.show` con
`util.wrapMethod`, conservar la capacidad `raw_call` y delegar al método
anterior cuando la función esté desactivada, no corresponda a una vista propia
o no pueda construir el wallpaper.
Para activar temporalmente `Leave screen as-is` podrá cambiar los campos de la
instancia de `Screensaver`, restaurándolos siempre al terminar la llamada; no
deberá modificar globalmente `G_reader_settings`, `dofile` ni el parche de
Pedro. El interruptor persistirá únicamente en la clave propia
`karenda_screensaver_enabled`.

El wrapper deberá instalarse una sola vez aunque KOReader cree instancias del
plugin para FileManager y ReaderUI. Una segunda inicialización no deberá
encadenar wrappers.

### KR-REQ-021: SimpleUI y custom navbar

El plugin deberá comprobar en runtime si están disponibles las APIs públicas de
Quick Actions. Cuando registre una acción después de que SimpleUI haya cargado
los tabs, deberá usar únicamente las invalidaciones públicas disponibles y no
editar la caché internamente.

Deberá comprobar, cuando el entorno lo permita, si está activo
`2-custom-navbar.lua`. Si SimpleUI y ese parche administran la misma barra, el
plugin deberá documentar el conflicto y no modificar ambos sistemas. Los
métodos públicos de fallback deberán seguir disponibles sin depender de la
auto-detección defectuosa de métodos por metatables.

### KR-REQ-022: Cliente detrás de interfaz

El código del plugin deberá depender de una interfaz de cliente, no de una
implementación HTTP concreta. La interfaz deberá permitir inyectar un mock que
devuelva `200`, `304`, respuestas inválidas, expiración, revocación, falta de
scope, errores de red y snapshot demasiado grande.

### KR-REQ-023: Sincronización real explícita

La sincronización real solo podrá marcarse funcional después de una prueba
contra el endpoint real desplegado y autenticado con un token de dispositivo.
Fixtures y mocks locales no podrán presentarse como prueba de disponibilidad del
backend.

### KR-REQ-024: Mensajes y seguridad

Todo texto visible, incluidos estados de sincronización, errores y mensajes del
salvapantallas, deberá estar en español. Los nombres de código, módulos,
funciones y comentarios deberán estar en inglés.

Los logs de diagnóstico deberán omitir tokens, encabezados `Authorization`,
URLs completas con secretos y contenido privado innecesario.

### KR-REQ-025: Sincronización automática al reanudar

El plugin deberá permitir configurar un intervalo de sincronización. Al
reanudar KOReader, si el intervalo está configurado y ha transcurrido desde la
última comprobación, deberá iniciar una sincronización en segundo plano sin
bloquear la apertura de una vista ni hacer red desde `Screensaver.show`.

La sincronización manual siempre estará disponible. Si no se configura un
intervalo, no se ejecutará sincronización automática.

### KR-REQ-026: Apertura de superficies desde la navbar

La acción `karenda_calendar` deberá mostrar primero el snapshot local validado y
ordenar los eventos por fecha y hora. La acción `karenda_notes` deberá mostrar
los destinos y notas del snapshot local y permitir abrir el contenido de una
nota en una vista desplazable. La acción `karenda` deberá abrir la misma
superficie de calendario con un selector superior que permita cambiar a notas
sin navegar a Home, Library ni Reader. Si no existe snapshot local, cualquiera
de las tres acciones podrá iniciar una única sincronización explícita antes de
mostrar la vista.

Ninguna de las tres acciones deberá crear, editar ni eliminar datos, y cerrar la
superficie deberá limpiar el contexto visible de Karenda.

### KR-REQ-027: Cuenta regresiva de eventos

Cada evento pendiente mostrado en una fila detallada de `Agenda`, `Día` o en la
vista previa de `Mes`/`Semana` deberá mostrar una cuenta regresiva calculada sin
red a partir del snapshot local. El detalle desplazable del evento deberá
mostrar la misma información.

La fecha de referencia será la fecha civil actual de la vista. La fecha límite
será `eventEndDate`: para un evento de varios días será la fecha final de
entrega; para un evento de todo el día `endAt` será inclusivo; para un evento
con hora que termina exactamente a medianoche, la fecha ocupada final será el
día anterior. La diferencia se calculará en días calendario, no en horas.

Las etiquetas visibles serán `Hoy`, `Mañana`, `Faltan N días` o `Faltan 1 día`
para fechas futuras, y `Vencido hace N días` o `Vencido hace 1 día` para fechas
pasadas. Los eventos `completed` no mostrarán una cuenta regresiva obsoleta y
conservarán el estado textual `Completado`.

La cuenta regresiva deberá reevaluarse al reanudar KOReader y al cambio local de
día junto con la fecha `Hoy`. No podrá iniciar sincronización ni depender de
color para comunicar la información.

### KR-REQ-028: Iconografía nativa para e-reader

Las acciones `Calendario`, `Notas` y `Karenda` de SimpleUI deberán usar iconos
locales propios del plugin, monocromos, de alto contraste y con trazos ligeros.
Los SVG deberán mantener una caja `48x48`, usar contornos sin rellenos masivos y
seguir siendo legibles en tinta electrónica. El plugin no copiará ni modificará
los archivos de iconos de SimpleUI.

### KR-REQ-029: Navegación y actualización de superficies

La web deberá mostrar un control común con las acciones `Calendario` y `Notas`.
Las acciones nativas separadas no repetirán esa navegación en una fila interna:
cada una se abrirá desde su Quick Action correspondiente y ofrecerá `Actualizar`
en su propia cabecera. La acción `karenda` abrirá una superficie unificada con
un selector superior de `Calendario` y `Notas`, una sola opción activa y la
misma acción de `Actualizar`.

Pulsar `Calendario`, `Notas` o `Karenda` desde la navbar de SimpleUI deberá abrir
la superficie correspondiente usando el snapshot local validado sin red cuando
exista caché. En `Karenda`, cambiar entre las dos opciones usará ese mismo
snapshot local y no hará una petición adicional. Si no existe caché, se podrá
ejecutar la sincronización inicial explícita ya definida. El cambio de superficie
no deberá crear, editar ni eliminar datos.

Pulsar `Actualizar` será siempre una acción explícita de red, incluso cuando
exista caché. Deberá reutilizar `SyncService`, ETag y la validación atómica
existentes. En Calendario o Notas, la petición mostrará el estado no descartable
`Actualizando calendario y notas…`, porque una única respuesta contiene el
snapshot completo de ambos destinos. Ante `200` reconstruirá la superficie
activa y mostrará `Se actualizaron el calendario y las notas.`; ante `304`
reconstruirá la superficie activa y mostrará `El calendario y las notas ya
estaban al día.`. La otra superficie usará esos datos nuevos al abrirse. Ante
error conservará la superficie y el snapshot local visibles, mostrando un
mensaje español seguro. La acción no estará disponible desde `Screensaver.show`
ni expondrá secretos.

### KR-REQ-030: Quick Actions como overlay contextual

Las Quick Actions `karenda_calendar`, `karenda_notes` y `karenda` deberán abrir
sus superficies como overlays in-place sobre la pantalla actualmente visible.
La apertura no deberá navegar a Library, Home ni Reader por sí misma. Al cerrar
la superficie de Karenda, KOReader deberá recuperar la pantalla, documento,
posición y contexto que estaban debajo del overlay. Dentro de la superficie
unificada, alternar entre calendario y notas reemplazará solo el contenido del
overlay, conservará la navbar en `Karenda` y actualizará el contexto visible.

La integración deberá declarar explícitamente la semántica in-place síncrona o
asíncrona que SimpleUI necesite para conservar una vista que sobrevive al
callback de la acción. El fallback público del plugin mantendrá la misma
semántica cuando sea invocado desde una pantalla existente.

### KR-REQ-031: Markdown y fórmulas legibles

La web deberá renderizar Markdown GFM y fórmulas matemáticas inline y de bloque,
incluyendo expresiones como `$O(|d| \\cdot |p|)$` y `$|d|$`, sin mostrar los
delimitadores como texto normal. El HTML de entrada seguirá sanitizándose y no
podrá ejecutar scripts ni protocolos de enlace inseguros.

El plugin deberá conservar la lectura segura offline. Usará el `TextViewer` nativo
en modo HTML para mostrar un fragmento generado por el parser Markdown incluido
en KOReader. Antes de convertirlo retirará HTML de entrada, imágenes y protocolos
de enlace inseguros; no ejecutará HTML proporcionado por la nota ni convertirá
enlaces en acciones interactivas.

Como KOReader no incluye un motor KaTeX/MathJax en el plugin, normalizará las
fórmulas a una notación tipográfica legible para tinta electrónica. La salida
deberá conservar encabezados, negrita, cursiva, listas, citas y código del
subconjunto soportado, y representará variables matemáticas en cursiva mediante
etiquetas generadas, exponentes/subíndices con `sup`/`sub` y comandos comunes
como `\\Sigma`, `\\harpoonup`, `\\vdash`, `\\ddagger`, `\\subseteq`, `\\cup`, `\\cap`,
`\\setminus` y `\\equiv` mediante sus símbolos Unicode. Los símbolos lógicos
con subíndice, como `\\vdash_A`, deberán conservar el símbolo `⊢` y representar
`A` como subíndice. Las flechas parametrizadas como
`\\xrightarrow{a_1}` deberán mostrar la etiqueta sobre la flecha, y las llaves
escapadas como `\\{0, 1\\}` deberán mostrarse como llaves literales. No mostrará
delimitadores `$` ni comandos LaTeX crudos cuando exista una conversión segura.
Una fórmula de bloque con varias flechas deberá conservar su flujo horizontal
cuando quepa en el ancho disponible; la etiqueta elevada no introducirá saltos
de línea entre la flecha y los elementos contiguos.
Los elementos de lista HTML `ol` y `ul` recibirán un margen de `1em` y un padding
interno de `1em` para mantener visibles sus marcadores en el borde izquierdo del
`TextViewer`; este ajuste será local a la lectura Markdown y no cambiará la
geometría del calendario.

### KR-REQ-032: Notas con lectura como vista principal

La vista principal de notas web deberá abrir en modo lectura, mostrando la lista
y el detalle de la nota seleccionada mediante Markdown renderizado. No deberá
mostrar un editor abierto por defecto ni presentar guardar como acción primaria
de la lectura.

Crear, editar y eliminar notas deberán estar detrás de una acción explícita de
configuración o administración de notas. El modo de lectura no modificará notas
ni preparará una mutación silenciosa.

### KR-REQ-033: Filtro de notas por asignatura

La web y el plugin deberán ofrecer una navegación de notas análoga a las vistas
del calendario: una opción `Todos los ramos` en primera posición y una opción
por cada asignatura disponible. `Todos los ramos` mostrará las notas asociadas a
asignaturas; los grupos personales conservarán su acceso independiente. Cambiar
de filtro será local cuando los datos ya estén cargados y no modificará el
snapshot.

### KR-REQ-034: Cabecera nativa estable y actualización compacta

La cabecera propia de cada superficie deberá ser la primera fila y su acción de
cierre deberá aparecer en la esquina superior derecha. El plugin no mostrará una
fila interna de navegación `Calendario`/`Notas`; la acción `Actualizar` estará en
la misma cabecera, inmediatamente a la izquierda de la X, tanto en calendario
como en notas. Deberá usar un símbolo compacto, conservar un objetivo táctil
nativo y no usar la palabra completa como contenido principal del botón.

### KR-REQ-035: Navbar inferior visible durante la consulta

Cuando exista una navbar inferior activa de SimpleUI o del entorno de KOReader,
las superficies de calendario y notas deberán conservarla visible mientras
estén abiertas. La superficie de Karenda deberá reservar el alto real de esa
navbar, no pintarla por encima y dejar que sus gestos y acciones continúen
recibiendo eventos. Si se pulsa otra acción de esa navbar, la superficie deberá
programar su cierre sin consumir el gesto, de modo que el callback subyacente se
ejecute y su destino quede visible. Durante ese cierre por navegación no deberá
solicitarse un repintado intermedio de la vista que queda debajo ni restaurarse
el indicador temporal de Karenda; así no se mostrará Home entre el cierre y el
destino. Al cerrar por cualquier otra causa, el indicador activo de la navbar
deberá restaurarse como antes, salvo que el gesto subyacente ya haya
seleccionado otra pestaña.

Si no existe una navbar inferior activa, la superficie podrá usar toda la altura
disponible sin dibujar una barra alternativa.

### KR-REQ-036: Wallpaper independiente y política contextual

`karenda-screensaver.koplugin` deberá poder instalarse y ejecutarse sin
`karenda.koplugin`. En ese modo solo consultará APIs locales de KOReader y el
libro activo: con un libro mostrará el wallpaper de lectura y sin libro
delegará al método anterior, sin intentar cargar el núcleo, InsForge, el
snapshot, la red ni Quick Actions. `karenda.koplugin` también deberá poder
funcionar sin el wallpaper, manteniendo calendario, notas y sincronización.

Cuando ambos estén instalados, el núcleo publicará el contexto visible mediante
un puente opcional y el wallpaper aplicará sus preferencias propias. La
preferencia de Calendario/Notas podrá ser `preserve` o `book`, y la preferencia
fuera de un libro podrá ser `delegate` o `as_is`; los valores predeterminados
serán `preserve` y `delegate`. El wallpaper deberá tolerar que el puente no
exista, tratar el contexto como `none` y continuar sin error.

La pantalla de libro usará por defecto un único panel minimalista de alto
contraste. La identidad y la barra de progreso con porcentaje adyacente serán
estructurales; las métricas opcionales se seleccionarán y ordenarán con
identificadores estables, omitiendo sin huecos las que no estén disponibles.
La alternativa de tarjetas clásicas será explícita y no cambiará la política
de contexto.

## 3. Requisitos No Funcionales

### KR-NFR-001: Separación

La distribución deberá contener dos paquetes `.koplugin` independientes:
`karenda.koplugin` para calendario, notas y contexto, y
`karenda-screensaver.koplugin` para el wallpaper de lectura. El segundo no
deberá importar módulos del primero ni compartir componentes React con la web.
La integración entre ambos se realizará mediante un puente Lua opcional y
widgets nativos de KOReader.

### KR-NFR-002: Fuente de verdad

InsForge seguirá siendo la fuente de verdad persistente. La caché local será
reemplazable y de solo lectura para el MVP.

### KR-NFR-003: Compatibilidad

La integración deberá respetar el ciclo de vida de `PluginLoader`,
`WidgetContainer`, `InputContainer` y `UIManager`, y deberá poder convivir con
el salvapantallas de KOReader y el parche de Pedro sin editar sus archivos.

### KR-NFR-004: Licencias

No se copiará código del parche de Pedro mientras su licencia siga sin estar
confirmada. Las licencias de KOReader y SimpleUI, y cualquier atribución
requerida, deberán conservarse en la distribución del plugin.

### KR-NFR-005: Backend e integración real visibles

La implementación del backend, su despliegue y las pruebas de integración real
deberán quedar visibles en las tareas. Los fixtures locales no podrán sustituir
una prueba autenticada contra InsForge.

## 4. Fuera Del Alcance

- crear o editar eventos y notas desde el Kindle;
- sincronización incremental, cursores, tombstones o historial de cambios;
- paginación de notas;
- cookies, sesiones de navegador o credenciales de usuario;
- usar el `anonKey` o una clave administrativa como token de dispositivo;
- red durante `Screensaver.show`;
- modificar archivos de SimpleUI o KOReader, cambiar globalmente `screensaver_type`,
  `_G.dofile` o el parche de Pedro;
- compartir datos entre cuentas o dispositivos sin un token propio;
- afirmar que la sincronización real funciona antes de probar el endpoint real.

## 5. Dependencias Pendientes

- Backend InsForge para generar, listar metadatos, revocar y regenerar tokens
  y emitir códigos de emparejamiento de un solo uso (implementado; falta prueba
  autenticada).
- Persistencia segura del hash de token, scopes, propietario, estado y fechas
  (implementada; falta prueba de aislamiento).
- Función Edge para validar tokens y servir la proyección (implementada; falta
  prueba autenticada).
- Límite explícito de `1 MiB` y respuesta `HTTP 413` con
  `SNAPSHOT_TOO_LARGE`, sin datos parciales (implementado; falta prueba).
- Kindle/KOReader real para comprobar instalación, ciclo de vida, gesto,
  SimpleUI, `2-custom-navbar.lua` y coexistencia con el parche de Pedro.

## 6. Estadísticas De Hábitos

### KR-REQ-037: Ingesta diaria desde KOReader

El plugin deberá leer `statistics.sqlite3` sin modificarla y enviar páginas
distintas, minutos de lectura y libros confirmados como terminados. La métrica
de Anki será opcional: si su proveedor no existe, no se enviarán ceros.

### KR-REQ-038: Coordinación con hábitos

La web deberá permitir elegir un hábito cuantitativo compatible o crear uno con
nombre, meta, unidad y fecha de inicio antes de activar cada vínculo. Karenda
calculará periodos diarios, mensuales y anuales a partir de `habit_logs`.

### KR-REQ-039: Sincronización resistente

La primera ejecución cubrirá el año civil actual; las siguientes, hoy y los
siete días anteriores. KOReader reintentará lotes pendientes tras una pérdida
de red y ejecutará la comprobación al reanudar con el dispositivo despierto.
Un error de estadísticas no impedirá abrir ni actualizar calendario y notas.

### KR-REQ-040: Precedencia y privacidad

Un registro importado sustituirá como fuente canónica al manual del mismo día
sin borrar el historial manual. El token no aparecerá en URLs, logs, snapshot ni
cola local, y `write:habit_logs` no concederá permisos sobre eventos.
