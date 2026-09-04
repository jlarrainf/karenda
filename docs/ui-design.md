# Dirección UI/UX De Karenda Web

Este documento es la fuente de verdad visual de Karenda Web. Tailwind, el CSS
global y los componentes base deben derivarse de estas decisiones. Si una nueva
interfaz necesita cambiar una decisión durable, primero se actualiza este
documento y luego el código.

## Dirección

Karenda es una herramienta de operación para estudiantes: debe sentirse como
una mesa de estudio tranquila, clara y confiable. La interfaz prioriza la
lectura rápida de fechas, acciones y estados por sobre la ornamentación. El
modo visual es claro y restringido: superficies casi blancas con un matiz verde
neutro, texto oscuro y un solo acento verde petróleo.

La identidad se expresa en la precisión de la jerarquía, el ritmo de espacios y
el uso intencional de los colores de datos. Los colores de las asignaturas deben
resaltar dentro de una base neutra, como en un calendario de productividad, sin
convertir la aplicación en una superficie saturada.

Esta dirección aplica el modo **Operate** y el flujo de Impeccable: definir la
tarea y sus estados antes de elegir la forma, construir con un vocabulario
reutilizable, y revisar cada superficie con `critique`, `audit` y `polish` antes
de considerarla terminada.

### Superficie De Bloqueo En KOReader

La pantalla de bloqueo del plugin no añade una composición visual paralela para
calendario o notas. Cuando una de esas superficies está visible, conserva el
frame actual mediante la semántica nativa `Leave screen as-is`; así la persona
ve exactamente la agenda o nota que dejó abierta, sin una segunda versión que
pueda quedar desactualizada.

Cuando hay un libro abierto y la opción está activa, Karenda usa una composición
propia de widgets nativos: portada de fondo con ajuste proporcional, una tarjeta
principal de identificación y tarjetas tipo post-it con las estadísticas que la
persona haya elegido. El diseño usa únicamente blanco, negro y gris claro, con
bordes finos, una jerarquía tipográfica clara y márgenes seguros para reducir
ghosting y recortes en pantallas pequeñas. No habrá sombras ni transparencias
que dependan de una pantalla a color.
En una pantalla e-ink física, antes de mostrar esta composición se limpia el
framebuffer y se hace un refresco completo de toda la pantalla, para que la
página del libro no quede visible debajo de la portada. Esta limpieza no se
aplica a calendario ni notas, que conservan el frame mediante `Leave screen as-is`.

La configuración permitirá activar o desactivar cada dato de forma independiente:
título, autor, capítulo, progreso del libro y del capítulo, página, páginas
restantes del capítulo y del libro, tiempo total de lectura, tiempo restante del
capítulo y del libro, días de lectura, páginas leídas y ritmo medio por página.
También permitirá elegir la posición vertical del bloque (`arriba`, `centro`,
`abajo`), su alineación horizontal (`izquierda`, `centro`, `derecha`) y la
distribución de tarjetas (`fila` o `cuadrícula`), además del ajuste de la
portada (`proporcional` o `llenar pantalla`). La pantalla se recalculará sin
dejar espacios vacíos cuando se oculten datos o no exista una estimación
disponible.

La vista previa será una superficie temporal separada del salvapantallas real.
Mostrará una indicación visible para cerrarla y responderá a toque y tecla; al
cerrarse restaurará la pantalla y el estado de KOReader sin ejecutar la limpieza
del salvapantallas de bloqueo.

La activación se expone en `Settings > Sleep screen > Wallpaper` como
`Pantalla de bloqueo de Karenda`. Al estar desactivada, el salvapantallas nativo
y cualquier patch externo conservan su comportamiento original.

## Tokens De Tailwind

### Color

Los nombres son semánticos para que los componentes no dependan de valores
hexadecimales concretos.

| Token | Valor | Uso |
| --- | --- | --- |
| `canvas` | `#F5F6F2` | Fondo general de la aplicación |
| `surface` | `#FFFFFF` | Formularios, paneles y contenido elevado |
| `surface-subtle` | `#EDF1ED` | Sidebar, barras auxiliares y estados seleccionados suaves |
| `surface-strong` | `#E2E9E4` | Hover, separadores activos y controles secundarios |
| `ink` | `#1B2522` | Títulos, acciones principales y texto de alta prioridad |
| `ink-muted` | `#5E6B65` | Texto secundario, ayuda y metadatos |
| `ink-subtle` | `#7A8780` | Texto auxiliar; nunca para información esencial |
| `border` | `#D7E0DA` | Bordes y divisores por defecto |
| `border-strong` | `#B7C7BD` | Bordes activos y controles con mayor énfasis |
| `brand` | `#2F625A` | Acción primaria, navegación activa y foco de marca |
| `brand-strong` | `#234B45` | Hover y pressed de la acción primaria |
| `brand-soft` | `#E0EEEA` | Fondo de selección, información y foco suave |
| `focus` | `#16766A` | Anillo de foco visible |
| `danger` | `#A63F3F` | Eliminación y errores |
| `danger-soft` | `#F8E8E6` | Fondo de errores y acciones destructivas |
| `success` | `#28704E` | Confirmaciones y estado completado |
| `success-soft` | `#E5F1E8` | Fondo de confirmaciones |
| `warning` | `#8A5A20` | Advertencias que requieren atención |
| `warning-soft` | `#FAF0DC` | Fondo de advertencias |

Los valores son deliberadamente tintados, no negro o blanco puros. El acento
`brand` no se usa como decoración general: identifica la acción primaria, la
selección actual y el foco. `danger`, `success` y `warning` siempre se
acompañan de texto o un icono accesible.

Los eventos académicos reciben el `color` hexadecimal de su asignatura. Los
eventos personales reciben el color del grupo o un tono neutro. El color se
usa en una marca, fondo tenue o borde de evento, nunca como único portador del
estado.

### Tipografía

Se usará una sola familia sans para que la aplicación se sienta como una
herramienta consistente y no como una página promocional:

```text
"Avenir Next", "Segoe UI", ui-sans-serif, system-ui, sans-serif
```

La escala fija de producto es:

| Rol | Tamaño | Peso | Uso |
| --- | --- | --- | --- |
| `text-xs` | `0.75rem` | 500 | Metadatos y etiquetas auxiliares |
| `text-sm` | `0.875rem` | 500 | Controles y navegación |
| `text-base` | `1rem` | 400 | Texto principal y campos |
| `text-lg` | `1.125rem` | 600 | Títulos de tarjetas o paneles |
| `text-2xl` | `1.5rem` | 700 | Títulos de página |
| `text-3xl` | `1.875rem` | 700 | Encabezados de superficie |

Los encabezados deben usar `text-wrap: balance` cuando corresponda. El texto
prolongado mantiene una medida aproximada de 65–75 caracteres por línea; las
tablas, calendarios y listas pueden ser más densos cuando la tarea lo exige.

### Espaciado, bordes Y Elevación

- La escala de trabajo es `4`, `8`, `12`, `16`, `24`, `32` y `48px`.
- Los controles táctiles tienen una altura mínima de `44px`.
- Los controles usan radio de `8px`; las tarjetas y paneles usan `12px`.
- Las pills se reservan para estados pequeños, no para cada botón o contenedor.
- La profundidad se obtiene con superficie y borde de `1px`; no hay sombras por
  defecto ni tarjetas anidadas.
- Una sombra suave solo puede señalar un overlay o un elemento realmente
  elevado, nunca reemplazar la jerarquía de contenido.

## Estructura Del Layout

### Escritorio

Desde `lg` (`1024px`) la aplicación usa un layout de dos regiones:

- Un sidebar persistente de aproximadamente `248px` con la marca y una
  navegación jerárquica. `Calendario`, `Hábitos` y `Notas` son los tres accesos principales
  y deben verse como un bloque destacado; `Asignaturas`, `Grupos personales` y
  `Dispositivos` viven en secciones secundarias de administración.
- Un área principal flexible con encabezado contextual, contenido y estados de
  carga/error/ vacío.
- El contenido mantiene gutters de `24px` a `32px` y puede crecer hasta
  `1440px` sin forzar líneas demasiado largas.
- El sidebar usa `surface-subtle`, mientras el contenido usa `canvas`; los
  paneles funcionales usan `surface`.
- La navegación activa se distingue por fondo `brand-soft`, texto `brand` y
  `aria-current`, no únicamente por color.

El encabezado principal debe mostrar el nombre de la superficie y las acciones
de mayor frecuencia. La navegación no se oculta detrás de un menú en una
pantalla amplia. El cambio entre `Calendario`, `Hábitos` y `Notas` debe requerir un solo
clic desde cualquier superficie protegida.

### Móvil Y Tablet

Por debajo de `lg`, el sidebar se reemplaza por un encabezado compacto con botón
de menú hamburguesa. El botón abre un cajón lateral mediante un elemento
semántico de diálogo o un patrón equivalente:

- El cajón tiene fondo `surface`, overlay de `canvas` con transparencia y ancho
  limitado para no ocultar toda la pantalla.
- Se puede cerrar con Escape, botón explícito y selección de una ruta.
- El foco permanece dentro del cajón mientras está abierto y vuelve al botón al
  cerrarlo.
- El contenido principal no se desplaza horizontalmente y respeta el área
  segura inferior del dispositivo.
- Debajo del encabezado se mantiene una navegación compacta y visible con
  `Calendario`, `Hábitos` y `Notas`, para que las tres tareas centrales no dependan de abrir
  el cajón. El cajón conserva el resto de las rutas organizadas por secciones.
- En móvil se priorizan navegación, fecha, búsqueda y acción primaria; los
  filtros secundarios pueden abrirse en un panel accesible.

No se usará una barra inferior para duplicar toda la navegación: el modelo de
datos crecerá con asignaturas, grupos, eventos, hábitos y notas. La navegación compacta
superior solo expone las tres superficies principales y el cajón mantiene la
jerarquía completa en un espacio pequeño.

### Android Empaquetado Con Capacitor

La primera aplicación Android reutilizará la interfaz React compilada dentro de
un runtime de Capacitor. El APK no abrirá la web publicada como una página
remota: cargará los assets incluidos en el paquete y usará InsForge como fuente
de datos.

- El layout móvil existente se mantiene como base; no se añadirá una segunda
  barra inferior mientras las tres áreas principales ya sean accesibles desde
  el encabezado compacto.
- La aplicación respetará las barras de estado y navegación mediante el área
  segura inferior y superior. Se usará la variable corregida que inyecta
  Capacitor (`--safe-area-inset-*`) con `env(safe-area-inset-*)` como respaldo,
  porque algunas versiones de WebView reportan cero en el valor estándar.
  Ningún contenido esencial quedará debajo de un recorte, teclado o barra del
  sistema.
- En el desplazamiento vertical, el encabezado compacto seguirá el gesto con una
  transición continua: se desplazará progresivamente al avanzar hacia abajo y
  volverá progresivamente al retroceder hacia arriba, sin saltos entre estados.
  La zona de la barra de estado conservará siempre un fondo sólido del lienzo
  para que el contenido no se vea detrás de la hora ni de los iconos del sistema.
  Con `prefers-reduced-motion` se desactivará la transición animada.
- El botón Atrás cerrará primero un diálogo, panel de filtros o cajón abierto;
  después volverá a la ruta anterior. No se duplicarán controles nativos y web
  para la misma acción.
- Mientras no exista conexión se mostrará un aviso persistente y discreto en
  español. La versión inicial no presentará datos como actualizados ni
  permitirá confirmar una escritura que no haya sido aceptada por InsForge.
- Los enlaces que salgan de Karenda se abrirán en el navegador del sistema. El
  WebView no permitirá navegación arbitraria a otros sitios.
- La sesión podrá restaurarse en el dispositivo solo mediante almacenamiento
  seguro; `localStorage`, `sessionStorage` y Preferences no cifradas no serán
  la solución definitiva para refresh tokens.
- Las notificaciones, widgets y accesos rápidos son superficies futuras. Cada
  una requerirá una decisión documentada y una prueba de permisos antes de
  incorporarse.

### Jerarquía De Acceso

- `Calendario` es la entrada principal para revisar fechas, crear eventos y
  consultar la Agenda.
- `Hábitos` es la entrada principal para registrar el día, revisar el historial,
  consultar estadísticas y gestionar tareas recurrentes.
- `Notas` es la entrada principal para leer y administrar apuntes Markdown.
- `Asignaturas` y `Grupos personales` son destinos de organización del
  calendario y se presentan como administración secundaria.
- `Dispositivos` es una conexión adicional con KOReader y no debe competir
  visualmente con las tres tareas centrales.
- El estado activo usa `brand-soft`, texto `brand` y `aria-current`; la
  proximidad y el tamaño del bloque también comunican la prioridad, no solo el
  color.

## Componentes Base

### Botones

- **Primario:** fondo `brand`, texto `surface`, altura mínima `44px`, radio de
  `8px`. En hover usa `brand-strong`; en disabled baja contraste y cursor.
- **Secundario:** fondo `surface`, borde `border-strong`, texto `brand`; en hover
  usa `brand-soft`.
- **Silencioso:** sin relleno, texto `ink-muted`; en hover usa `surface-strong`.
- **Destructivo:** usa `danger` y `danger-soft`, requiere confirmación para
  eliminar datos.
- Todos tienen estado hover, focus-visible, active, disabled y loading. El
  foco usa un anillo de `focus` con separación visible.
- Las etiquetas nombran la acción concreta, por ejemplo `Guardar asignatura`,
  `Crear evento` o `Cerrar sesión`.

### Inputs

- Altura mínima de `44px`, fondo `surface`, borde `border` y radio de `8px`.
- Cada campo tiene una etiqueta visible, `name`, `autocomplete` apropiado y
  texto de ayuda cuando la decisión no es obvia.
- Focus-visible cambia el borde a `focus` y muestra anillo; no se elimina el
  outline sin reemplazo.
- Los errores aparecen junto al campo, en español, y se anuncian con una
  región `aria-live` cuando son resultado de una acción.
- Los campos deshabilitados conservan legibilidad y explican por qué no están
  disponibles cuando sea necesario.

### Autenticación Y Verificación

- Registro e inicio de sesión comparten una superficie clara, una acción primaria
  y un enlace visible para cambiar de flujo.
- Si InsForge exige verificación, el estado posterior al registro muestra el
  correo destino, un campo de código de seis dígitos y la acción `Verificar correo`;
  el estado de error permanece junto al campo o a la operación.
- La pantalla de verificación conserva la opción `Ir a iniciar sesión`, pero no
  presenta la cuenta como activa hasta recibir una respuesta válida de InsForge.

### Tarjetas Y Paneles

- Una tarjeta agrupa contenido relacionado, no cada elemento individual.
- Usa `surface`, borde `border`, radio `12px` y padding de `16px` o `24px`.
- No se anidan tarjetas; la jerarquía se expresa con espacios, encabezados y
  divisores.
- Las listas vacías enseñan la siguiente acción, por ejemplo `Crea tu primera
  asignatura`, en lugar de mostrar un panel sin contexto.
- Los estados de carga usan skeletons o una descripción visible; nunca una
  pantalla vacía sin explicación.

### Formularios De Eventos

- Los formularios de eventos se presentan en un panel `surface` con una sola
  columna de lectura y grupos de fecha/hora en dos columnas desde `sm`.
- El orden de captura es título, relación con asignatura o grupo, inicio, modo
  de todo el día, término, estado, lugar y descripción.
- La etiqueta de cada campo es visible. Los campos obligatorios se identifican
  con texto y no únicamente con color; los errores se muestran junto al campo
  que puede corregirse.
- `Pendiente` y `Completado` se muestran como texto en el selector y en cada
  evento del calendario. El color de asignatura o grupo aporta contexto, pero no
  comunica por sí solo el estado.
- El modo de todo el día conserva fechas locales y oculta los controles de hora
  mientras está activo. La acción primaria usa `Guardar evento` y la secundaria
  `Cancelar`; durante el guardado ambas respetan el estado disabled/loading.

### Creación Asistida Con IA

- El encabezado del calendario añade una acción secundaria `Agregar con IA`,
  ubicada junto a las acciones de creación manual. La acción abre el mismo
  espacio lateral de trabajo y no desplaza ni oculta el calendario en
  escritorio; en móvil se apila como panel accesible.
- El panel comienza con un `textarea` etiquetado `Describe tus eventos`, una
  ayuda breve con un ejemplo de varios eventos y una nota visible: `La
  descripción se procesa de forma temporal para preparar borradores; revisa
  todo antes de guardar.` No se muestra ningún nombre técnico de modelo ni
  secreto.
- El estado de carga conserva el prompt, deshabilita cancelar accidentalmente
  la operación primaria y anuncia `Preparando borradores…` mediante
  `aria-live`. Los estados de error explican la acción siguiente en español y
  no muestran respuestas crudas del proveedor.
- La respuesta se presenta como una lista escaneable de borradores, no como un
  chat. Cada fila muestra título, tipo, relación, fecha u horario, estado y una
  advertencia textual cuando tiene indicadores `review_flags`. El color de la
  relación es solo un acento, nunca el único indicador.
- Cuando la IA no encuentra un grupo personal adecuado, la fila muestra
  `Se propondrá crear el grupo «…» al guardar` como una propuesta revisable.
  Una nota de conjunto enumera los grupos nuevos sin crear ninguno durante la
  generación; si la persona continúa, el segundo paso `Confirmar y guardar`
  deja clara esa creación.
- Cada borrador ofrece `Editar` para reutilizar el formulario de evento y
  `Quitar` para eliminarlo de la vista previa. La acción global `Guardar
  eventos` indica la cantidad y permanece deshabilitada si no quedan
  borradores o si alguno no cumple las validaciones. Si hay grupos nuevos, la
  primera pulsación cambia a `Confirmar y guardar`.
- El guardado requiere confirmación explícita después de la revisión. Un éxito
  muestra cuántos eventos se agregaron; un resultado parcial mantiene visibles
  los borradores pendientes y explica que algunos ya fueron guardados.
- Estados obligatorios: panel inicial, prompt vacío, carga, respuesta vacía,
  borradores con revisión, propuesta de grupo nuevo, confirmación de creación,
  edición de borrador, guardado, éxito total, éxito parcial, error de sesión,
  error de catálogo y error del servicio IA.
- `critique`: la superficie evita la metáfora de conversación y prioriza la
  verificación concreta de fechas y relaciones. `audit`: conserva foco de
  teclado, objetivos táctiles mínimos de `44px`, textos de acción explícitos y
  contraste de `brand`/`surface`. `polish`: usa los paneles y tokens existentes,
  sin gradientes, badges decorativos ni iconos emoji.

### Detalle De Evento

- El clic sobre un evento abre un panel lateral en escritorio y un panel apilado
  en móvil. El panel conserva el calendario visible y ofrece `Cerrar` explícito.
- El detalle muestra tipo, título, relación, fecha u horario, estado, lugar y
  descripción cuando existen. `Pendiente` y `Completado` siempre se muestran
  como texto.
- Las acciones se agrupan al final del panel: `Marcar como ...`, `Editar evento`
  y `Eliminar evento`. Eliminar abre una confirmación accesible y no debe
  presentar éxito hasta recibir respuesta válida de InsForge.

### Agenda, Búsqueda Y Filtros

- La Agenda usa una lista de lectura rápida agrupada por fecha. Cada grupo tiene
  un encabezado de fecha, y cada fila muestra título, horario o `Todo el día`,
  relación, color y estado textual.
- La Agenda conserva la barra de navegación con `Anterior`, `Siguiente` y `Hoy`.
  `Hoy` devuelve el inicio de la lista a la fecha local actual; los otros
  controles desplazan el inicio de la lista en pasos de siete días.
- Los botones nativos del toolbar de FullCalendar usan texto e iconos oscuros
  en estado normal y deshabilitado; solo el estado activo usa texto claro sobre
  el fondo de marca.
- El título del periodo del toolbar se centra respecto del ancho completo del
  calendario; en móvil ocupa una fila propia para no competir con los controles.
- En eventos de todo el día, la fecha de término se muestra y se ocupa de forma
  inclusiva, aunque el adaptador visual convierta internamente el límite para
  respetar el contrato de rangos de FullCalendar.
- La búsqueda permanece visible en escritorio junto al botón de filtros. En
  móvil el botón abre un panel accesible que se puede cerrar explícitamente.
- Los filtros se organizan por tipo, asignatura, grupo personal, estado y rango
  de fechas. Varias opciones dentro de una categoría se seleccionan con lógica
  OR; categorías distintas se combinan con lógica AND.
- La barra de resultados muestra cuántos eventos coinciden y ofrece `Limpiar
  filtros` cuando existe una búsqueda o filtro activo. Un resultado vacío explica
  si no hay eventos o si conviene cambiar la búsqueda/filtros.
- Búsqueda, filtros y Agenda comparten el mismo estado del calendario para que
  Mes, Semana, Día y Agenda representen siempre el mismo conjunto visible.

### Notas Markdown

- La pantalla se divide en navegación de filtros y espacio de lectura. La
  navegación muestra primero `Todos los ramos`, después una opción por
  asignatura y conserva `Grupos personales` como destinos independientes.
  Mantiene el filtro seleccionado visible y explica cuando todavía no tiene
  notas.
- El espacio de trabajo abre con una lista de notas y un detalle de lectura
  contiguo. La nota seleccionada se renderiza como Markdown seguro, incluyendo
  fórmulas inline y de bloque; HTML y protocolos de enlace inseguros no se
  ejecutan.
- La lectura es la vista principal y no monta un editor automáticamente. Un
  botón explícito `Configurar notas` abre las acciones `Nueva nota`, `Editar
  nota` y `Eliminar nota`; solo desde ese modo aparece el editor. En móvil las
  regiones se apilan y el detalle conserva prioridad visual sobre la
  administración.
- El editor conserva una columna de captura simple para título y Markdown, con
  un cambio explícito entre `Editar` y `Vista previa`. La vista previa usa el
  mismo ancho de lectura y no ejecuta HTML ni enlaces inseguros.
- La lista distingue título y fecha de actualización. `Nueva nota`, `Editar`
  y `Eliminar nota` tienen nombres explícitos; eliminar siempre requiere una
  confirmación accesible.
- Los estados visibles cubren destino sin selección, destino sin notas, carga,
  guardado, guardado correcto, validación, error de InsForge y contenido vacío.

### Hábitos Y Tareas Recurrentes

- Hábitos es una superficie principal, no una pantalla de administración.
  Su encabezado muestra la fecha activa, Hoy, Nuevo hábito y el acceso a
  Tareas recurrentes.
- La vista Hoy prioriza una lista compacta y accionable. Cada fila muestra
  nombre, relación opcional, meta, progreso y estado textual. Las acciones de
  alta frecuencia aparecen directamente: Completar, Registrar y Omitir.
- El color del hábito es una ayuda de identificación, nunca el único indicador
  de estado. Cada estado usa etiqueta, icono no ambiguo y texto accesible.
- El formulario de alta usa revelación progresiva: primero nombre y relación,
  luego medición y objetivo, después frecuencia, evaluación y opciones
  avanzadas. Los presets de frecuencia aparecen antes de los controles
  personalizados.
- Una línea de resumen siempre explica la regla, por ejemplo Leer: 30 minutos
  cada día o Ver una serie: 3 episodios por semana.
- Las opciones de notas se presentan como una elección sencilla: ninguna,
  nota general, notas diarias o ambas; no se mezcla el editor Markdown con el
  registro rápido del hábito.
- Historial usa una cuadrícula de fechas con celdas legibles y una leyenda
  textual. La selección de una celda abre un panel pequeño para corregir el
  registro, marcar Omitido o añadir una nota diaria.
- Estadísticas ofrece un resumen por hábito y rango, con racha, cumplimiento,
  total, promedio y tendencia según corresponda. No debe mezclar unidades
  distintas en una única métrica engañosa.
- Las tareas recurrentes viven en una pestaña separada de la superficie
  Hábitos. Sus filas distinguen Pendiente, Vencida y Completada, y no muestran
  indicadores de racha.
- Editar una tarea modifica sus datos y su próxima ocurrencia; `Cambiar regla
  futura` abre un flujo separado con fecha efectiva y conserva la regla y el
  historial anteriores.
- Pausar y archivar son acciones reversibles y deben explicar que el historial
  se conserva. Una confirmación solo será necesaria cuando la acción pueda
  ocultar información activa.
- Las proyecciones del calendario usan una tonalidad secundaria y una etiqueta
  de origen como Hábito o Tarea recurrente. El detalle es de solo lectura y
  ofrece Abrir en Hábitos; no muestra controles de cumplimiento.
- En móvil, Calendario, Hábitos y Notas permanecen visibles sin abrir el cajón.
  Los filtros, la configuración avanzada y las estadísticas detalladas se
  abren en paneles accesibles sin desplazar horizontalmente.
- Los estados requeridos son vacío inicial, sin hábitos para hoy, carga, error,
  guardado, guardado parcial, registro corregido, historial vacío, estadística
  desactivada y hábito archivado.
- La vista de hábitos tendrá filtros visibles por estado, tipo de seguimiento,
  relación y archivado; los hábitos archivados estarán excluidos inicialmente.
  La edición de una regla futura se abrirá como un flujo separado con fecha
  efectiva y confirmará que los periodos anteriores no se reescriben.
- Las notas de hábitos podrán consultarse también desde `Notas`, pero su
  edición seguirá siendo contextual dentro de `Hábitos`.

#### Decisiones de implementación de la primera entrega

- La ruta `/habits` usará un selector segmentado con `Hoy`, `Historial`,
  `Estadísticas` y `Tareas recurrentes`. El estado activo se anunciará con
  texto y `aria-current`; el cambio de vista no cambiará la fecha seleccionada.
- `Hoy` mantendrá la fecha civil elegida en la cabecera con `Anterior`, `Hoy` y
  `Siguiente`. La lista se agrupará por estado y cada fila conservará una acción
  principal visible, con controles adicionales en un menú accesible.
- El alta y edición se mostrarán en un diálogo con pasos numerados, un resumen
  persistente de la configuración y validación por paso. Los campos de notas y
  la proyección de calendario se revelarán solo al activar sus políticas.
- Historial y estadísticas usarán paneles desplazables verticalmente sin
  depender del desplazamiento horizontal. Las celdas de historial incluirán
  nombre de estado, no solo color, y el detalle de una celda conservará foco.
- Los estados de carga, error, guardado y vacío ocuparán la misma región de
  contenido para evitar saltos de layout. Los errores conservarán los datos del
  formulario y usarán mensajes en español.
- En móvil, `Calendario`, `Hábitos` y `Notas` permanecerán en la navegación
  compacta. Los filtros y detalles se abrirán en paneles accesibles; los
  objetivos táctiles serán de al menos 44 px y el foco será siempre visible.

### Dispositivos KOReader

- La superficie vivirá en `/devices` y conservará la jerarquía de página de las
  demás áreas: encabezado con `Dispositivos`, una explicación breve y una acción
  primaria `Conectar dispositivo`.
- El formulario de alta será un panel único con el nombre visible del dispositivo
  y una ayuda explícita: la web genera un código numérico de seis dígitos para
  escribirlo en KOReader. El código vence en diez minutos y solo se puede usar
  una vez; no se pedirá correo, contraseña ni sesión adicional.
- Después de crear o regenerar, un panel de advertencia mostrará el token solo en
  memoria durante esa operación, con `Copiar token` y `Ocultar token`; esta ruta
  queda reservada para regeneración explícita. El alta normal mostrará un panel
  de emparejamiento con el código grande, su vencimiento y la instrucción para
  introducirlo en `Karenda > Vincular dispositivo` dentro de KOReader.
- El listado mostrará una fila por dispositivo con etiqueta, estado textual
  `Activo` o `Revocado`, fecha de creación, último uso y scopes. Las acciones
  `Regenerar token` y `Revocar token` serán explícitas; revocar o regenerar pedirá
  confirmación accesible.
- En escritorio el formulario de alta y el listado compartirán el área principal
  en una composición de dos columnas cuando haya espacio. En móvil se apilarán,
  manteniendo la acción primaria y el panel del código dentro del flujo vertical.
- Los estados cubrirán carga inicial, lista vacía con siguiente acción, código
  recién creado, copia confirmada, código vencido, error de sesión, error de
  backend y revocación correcta. Los mensajes serán españoles y no incluirán
  secretos en errores.

### Superficies Nativas De KOReader

- La navbar de SimpleUI añadirá dos Quick Actions externas estables:
  `Calendario` para la agenda y `Notas` para la lectura de notas. El plugin no
  editará la configuración ni los archivos de SimpleUI; la persona decidirá
  cuáles tabs conservar mediante la configuración normal de SimpleUI.
- El calendario y las notas usarán widgets nativos a pantalla completa, con alto
  contraste, tipografía del dispositivo y separación por líneas. No se copiarán
  tokens visuales de Tailwind ni se introducirán colores que no pueda representar
  bien una pantalla e-ink.
- La agenda ofrecerá las vistas `Agenda`, `Mes`, `Semana` y `Día`, en ese orden.
  Abrirá en `Agenda` y el encabezado mantendrá un selector segmentado persistente
  con un único modo activo. También mostrará el periodo activo y controles
  explícitos `Anterior`, `Hoy` y `Siguiente`; cambiar de modo o periodo no hará
  red mientras exista snapshot local.
- La web conservará una navegación común con `Calendario` y `Notas`. En el
  plugin, cada superficie se abrirá desde su Quick Action y no repetirá esos
  botones dentro de la pantalla; `Actualizar` será siempre una acción explícita
  de fetch y vivirá en la cabecera nativa.
- Las vistas `Mes` y `Semana` conservarán una cuadrícula de siete columnas: cada
  celda mostrará el número de día y la cantidad de eventos con una notación
  compacta, destacará `Hoy` mediante texto y fondo, y permitirá abrir ese día.
  Los días exteriores al mes quedarán vacíos. Debajo se mostrarán resúmenes
  tocables sin saturar las celdas estrechas del dispositivo.
- La vista `Día` concentrará una fecha y `Agenda` listará los próximos eventos
  desde el cursor, agrupados por fecha completa. Las secciones de la fecha actual
  y del día siguiente escribirán `HOY` y `MAÑANA`; los eventos académicos
  pendientes añadirán una indicación textual de preparación o estudio. Cada
  evento abrirá un detalle desplazable sin acciones de escritura.
- Los horarios de eventos se presentarán usando el offset civil de la zona del
  snapshot, no la zona configurada por el sistema del lector; así una hora creada
  como 17:30 conservará 17:30 en el Kindle.
- Las notas se agruparán por asignatura o grupo personal. La lista mostrará
  título y actualización; el detalle mostrará Markdown seguro con títulos y
  subtítulos escalonados, negrita, cursiva y fórmulas renderizadas. Las variables
  matemáticas se distinguirán de los operadores y los exponentes/subíndices no
  se mostrarán como caret o guion bajo crudos; símbolos lógicos como `⊢` conservarán
  sus subíndices. Las etiquetas de flecha se elevarán sin convertir sus elementos
  contiguos en bloques, para que una fórmula de bloque permanezca en una línea
  cuando quepa en la pantalla. La navegación de filtros usará una jerarquía de ancho completo:
  `Todos los ramos` será la acción académica principal, las asignaturas se
  distribuirán en filas legibles y los grupos personales conservarán una sección
  independiente.
- La cabecera propia será la primera fila y tendrá la X de cierre en la esquina
  superior derecha. El botón compacto de actualización estará inmediatamente a
  su izquierda, en la misma cabecera, tanto en calendario como en notas aunque
  cambie el subtítulo. El símbolo tendrá un nombre accesible o ayuda equivalente
  cuando la plataforma lo permita; la acción seguirá conservando un objetivo
  táctil nativo.
- Cuando SimpleUI o KOReader ya dibuje una navbar inferior, la superficie
  reservará su alto real y dejará esa franja visible. Los gestos dirigidos a otra
  acción no se consumirán: primero llegará el callback de la navbar y después se
  cerrará la superficie en el siguiente ciclo. Ese cierre se tratará como una
  transición de navegación: no solicitará un repintado intermedio de la vista
  que queda debajo ni restaurará durante ese instante el indicador temporal de
  Karenda, para que el destino seleccionado se pinte directamente sin mostrar
  Home entre ambas vistas. Mientras la superficie esté abierta, su Quick Action
  marcará el indicador activo de Calendario o Notas; una navegación posterior
  conservará su propia selección.
- Cada fila de evento pendiente mostrará una cuenta regresiva breve. La fecha
  final de un evento multidiario será su fecha de entrega; se usarán `Hoy`,
  `Mañana`, `Faltan N días` y `Vencido hace N días`. Un evento completado
  conservará `Completado` sin una cuenta obsoleta.
- Los iconos de Quick Actions serán locales, monocromos y lineales en una caja
  `48x48`. El calendario usará un marco con anillas y las notas una hoja con
  pliegue y líneas, evitando masas rellenas, color y detalles ilegibles.
- Una vista con snapshot local se abrirá inmediatamente y no hará red implícita.
  Si no existe caché, la primera apertura podrá ejecutar una sincronización
  explícita y después mostrar la vista o un estado vacío claro.
- Al tocar `Actualizar` desde Calendario o Notas se mostrará el estado no
  descartable `Actualizando calendario y notas…`. La respuesta actualiza el
  snapshot completo de ambos destinos; después se reconstruirá la vista activa
  y se mostrará una notificación breve indicando si se recibieron datos nuevos o
  si el snapshot ya estaba al día (`304`).
- Cada superficie definirá los estados de caché disponible, carga inicial, sin
  datos, error de sincronización y contenido vacío. Los mensajes serán españoles
  y no expondrán el token.
- La vista visible actualizará el contexto singleton de Karenda (`calendar`,
  `note` o `none`). Al cerrar la superficie se limpiará el contexto; el
  salvapantallas no podrá iniciar sincronizaciones.

#### Agenda Para E-Readers

- El caso principal es dejar la pantalla abierta para consulta. La apertura
  predeterminada será `Agenda`, centrada en la fecha local real del dispositivo,
  y no un diálogo modal ni una lista de controles.
- La jerarquía será: periodo y selector segmentado en cabecera, grupos de fecha y
  eventos, y al final navegación secundaria. Los controles de periodo se
  mantendrán en un pie fijo para que el contenido domine la primera pantalla.
- Los encabezados, avisos y vacíos serán widgets de texto, nunca botones
  deshabilitados. Toda información esencial usará negro sobre blanco; el gris se
  reservará para el fondo de `Hoy` y metadata no esencial.
- Las filas de evento tendrán dos regiones: fecha/rango y contenido. El título
  ocupará la primera línea; la segunda escribirá tipo, relación y estado. Mes y
  Semana mostrarán hasta cuatro próximos eventos del periodo y señalarán cuántos
  continúan en `Agenda`. Agenda separará `HOY`, `MAÑANA` y el resto de fechas
  completas; una señal textual adicional marcará lo académico pendiente.
- La semana empezará en lunes. La leyenda `día · eventos` explicará el conteo de
  la cuadrícula, y hoy añadirá corchetes para no depender solo del tono.
- El selector segmentado usará una sola fila, cuatro etiquetas cortas y fondo
  gris claro más negrita para el modo activo, en el orden `Agenda`, `Mes`,
  `Semana`, `Día`. La selección será visible sin depender exclusivamente del
  contraste de gris.
- El layout usará `Screen`, `Size`, `TitleBar`, `ButtonTable`,
  `ScrollableContainer`, `TextWidget` y `TextBoxWidget`. Se recalculará al cambiar
  geometría y mantendrá el mismo orden en vertical y horizontal; el cuerpo será
  desplazable cuando la altura no alcance.
- La apertura y el cierre normal solicitarán `flashui` para limpiar ghosting;
  el cierre que forma parte de un cambio de navbar omitirá el repintado
  intermedio y dejará que el destino solicite el refresco apropiado. La
  navegación normal usará `ui` y el feedback táctil nativo podrá usar `fast`.
  Mientras la vista esté abierta solo se programará una comprobación local del
  siguiente cambio de día, cancelada al cerrar.
- El análisis y sus fuentes están en
  `docs/koreader-static-calendar-study.md`.

### Creación Asistida De Hábitos

- La acción `Agregar con IA` vivirá junto a `Nuevo hábito` en la cabecera de
  Hábitos y abrirá un panel con la misma jerarquía que `AiEventPromptPanel`:
  explicación breve, textarea de máximo 4000 caracteres, cancelar y preparar
  borradores.
- La revisión reutilizará `HabitForm` para conservar sus cinco pasos, resumen
  de regla, relaciones y validación. La lista de borradores mostrará nombre,
  tipo, meta, frecuencia y fecha de inicio, con acciones `Editar` y `Quitar`.
- Los estados serán inicial, carga no descartable, respuesta vacía, revisión,
  guardado, éxito parcial, error de sesión, error de catálogo, error de modelo
  y límite temporal. El estado de límite usará el mismo aviso español que
  Calendario y no ofrecerá reintento automático.
- La confirmación será explícita y el panel conservará los borradores que no
  se hayan podido guardar. En móvil los botones se apilarán; en escritorio la
  acción primaria permanecerá al final del flujo y los mensajes usarán
  `aria-live`.

## Estados Y Calidad

Cada superficie interactiva debe definir default, hover, focus, active,
disabled, loading, error y empty. La revisión aplica estas preguntas de
Impeccable antes de cerrar una tarea:

1. `shape`: ¿la jerarquía resuelve la tarea principal y sus estados?
2. `critique`: ¿la interfaz es clara, escaneable y reconocible sin adornos?
3. `audit`: ¿los nombres, focos, contrastes, tamaños táctiles y breakpoints son
   accesibles?
4. `polish`: ¿los tokens y componentes se mantienen consistentes sin caer en
   tarjetas, gradientes, glassmorphism, tipografía decorativa o animaciones sin
   propósito?

Las transiciones se limitan a cambios de estado y duran aproximadamente
`150–250ms`, respetando `prefers-reduced-motion`. No se usarán gradientes,
glassmorphism, iconos emoji, texto gris sobre superficies de color, radios
excesivos ni valores visuales aislados sin documentar.
