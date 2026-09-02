# Estudio De Agenda Para E-Readers

Fecha: 2026-08-31.

## Objetivo

Definir una presentación profesional para dejar la agenda de Karenda abierta
durante periodos prolongados en Kindle, Kobo u otro e-reader con KOReader. La
pantalla debe responder primero a tres preguntas: qué hay que atender hoy, cuál
es el siguiente compromiso y qué requiere preparación académica.

El estudio no cambia el contrato de datos ni convierte el plugin en una
aplicación de escritura. La fuente sigue siendo el snapshot local validado.

## Problemas De La Implementación Anterior

- La raíz era un `ButtonDialog` de aspecto modal y no una superficie de lectura.
- Títulos, días de semana, avisos y estados vacíos eran botones deshabilitados;
  KOReader atenúa esos textos y reduce el contraste de información esencial.
- Cada evento comprimía título, hora, relación y estado en una sola línea
  negrita, sin una jerarquía estable para textos largos.
- Los controles aparecían antes que la información y consumían una parte
  dominante de la primera pantalla.
- La notación `DD [cantidad]` era funcional, pero visualmente ruidosa y no
  diferenciaba localización temporal de detalle de evento.
- La apertura anterior en `Mes` ocultaba los compromisos inmediatos detrás de
  una cuadrícula; la agenda debe ser la entrada rápida y conservar las demás
  vistas en un selector visible.

## Hechos Verificados En KOReader

- `Screen:getWidth()`, `Screen:getHeight()` y `Screen:scaleBySize()` permiten
  construir geometría relativa al dispositivo en vez de identificar modelos.
- `Size` centraliza bordes, padding, alturas y separadores escalados.
- `TextWidget` es de una línea y puede truncar con elipsis; `TextBoxWidget` es el
  widget apropiado para texto de varias líneas.
- `ButtonTable` distribuye columnas de ancho uniforme y agrega padding táctil.
- `ScrollableContainer` puede desplazar contenido manteniendo una cabecera o un
  pie fuera del área desplazable.
- `ui` es el modo de refresco normal para contenido mixto; `fast` corresponde a
  feedback transitorio y `flashui` permite limpiar ghosting al abrir o cerrar
  normalmente una superficie. El cierre que forma parte de una navegación de
  navbar evita el repintado intermedio para no exponer la vista subyacente.
- La propagación de gestos y el recorte correcto requieren conservar
  `show_parent` y exponer el `cropping_widget` al widget raíz.

Estos puntos provienen del código de KOReader fijado por el proyecto en el
commit `28b4f2d8042c182670b7a41916cf7ec7fe357826`.

## Decisiones De Diseño

### Composición

1. La vista raíz ocupa la altura disponible sobre cualquier navbar inferior
   existente y usa fondo blanco, texto negro y separadores oscuros. No se
   presenta como popup.
2. La cabecera muestra `Agenda`, el contexto del periodo y un selector
   segmentado persistente en el orden `Agenda`, `Mes`, `Semana`, `Día`, con un
   único modo activo; la X de cierre se ubica en la esquina superior derecha.
3. La cabecera conserva la X en la esquina superior derecha y el refresh
   inmediatamente a su izquierda. No se añade una fila interna de botones
   `Calendario`/`Notas`; esas entradas permanecen en las Quick Actions externas.
4. `Agenda` es la apertura predeterminada porque responde directamente a los
   compromisos próximos y a lo académico pendiente. `Mes`, `Semana` y `Día`
   continúan disponibles sin diálogo.
5. El cuerpo contiene grupos de fecha y eventos; al cambiar a Mes o Semana
   muestra primero la cuadrícula y luego una vista previa limitada. Los
   controles `Anterior`, `Hoy` y `Siguiente` permanecen en un pie fijo,
   visualmente secundario.
6. El contenido se desplaza cuando no cabe. La geometría deriva del tamaño de
   pantalla actual y no de un modelo de Kindle concreto.
7. Calendario y Notas se abren mediante Quick Actions externas y cada cabecera
   ofrece un símbolo de actualización compacto; la actualización es explícita.
   Si existe una navbar inferior, se deja visible. Sus gestos se delegan al
   widget que está debajo y, después de ejecutar la acción elegida, la superficie
   se cierra en el siguiente ciclo. Ese cierre omite el repintado intermedio de
   la pantalla inferior para no mostrar Home antes del destino.

### Overlay Y Notas

- Las Quick Actions se marcan como in-place asíncronas: la pantalla de Karenda
  se muestra sobre Home, Library o Reader y `UIManager` conserva la superficie
  inferior para restaurarla al cerrar. La superficie no pinta sobre la franja de
  navbar inferior cuando SimpleUI/KOReader la tiene activa. La Quick Action
  activa se marca temporalmente en la navbar y se restaura solo si la navegación
  subyacente no eligió otra pestaña.
- La pantalla de notas abre en lectura. Un selector local comienza con `Todos
  los ramos` y continúa con una opción por asignatura; los grupos personales
  siguen siendo destinos separados.
- El detalle de nota permanece en `TextViewer`, usando su camino HTML nativo con
  un fragmento producido por el parser Markdown de KOReader. El adapter limpia
  HTML, imágenes y enlaces inseguros; las fórmulas se convierten a símbolos,
  cursiva matemática y `sup`/`sub` sin introducir un motor de navegador pesado
  en el lector.

### Cuadrícula

- La semana comienza en lunes y conserva siete columnas.
- Los días externos al mes quedan vacíos para reducir ruido.
- Cada día del periodo usa `día · cantidad`; cuando no hay eventos muestra solo
  el día. Una leyenda breve explica la notación.
- Hoy usa corchetes, negrita y fondo gris claro. La señal no depende solo del
  tono, por lo que sigue siendo comprensible con bajo contraste.
- La cuadrícula localiza fechas; no intenta introducir títulos de eventos en
  columnas estrechas.

### Eventos

- Cada fila tiene una columna estable de fecha/hora y una columna de contenido.
- El título ocupa la primera línea y puede truncarse con elipsis.
- La segunda línea siempre escribe tipo, relación y estado. El color no porta
  información necesaria.
- Mes y Semana muestran hasta cuatro eventos vigentes del periodo desde la
  fecha de referencia. Si hay más, una línea indica cuántos continúan y remite
  a `Agenda`.
- Agenda agrupa por fecha completa. Las fechas actual y siguiente se rotulan
  `HOY` y `MAÑANA`; los eventos académicos pendientes añaden texto de estudio o
  preparación. Cada evento pendiente añade una cuenta regresiva: `Hoy`,
  `Mañana`, `Faltan N días` o `Vencido hace N días`; los eventos multidiarios
  cuentan hasta su fecha final. Día concentra la fecha elegida. El detalle
  completo continúa en `TextViewer`.

### Tinta Electrónica

- El negro sobre blanco transporta toda la información esencial.
- El gris se reserva para el fondo de hoy o información no esencial; no se usa
  para estados, relaciones ni fechas necesarias.
- No hay sombras, gradientes, animaciones, patrones ni áreas invertidas grandes
  permanentes.
- Los separadores son pocos y usan tamaños nativos de KOReader.
- La apertura y el cierre normal solicitan `flashui`; el cierre que forma parte
  de un cambio de navbar omite el repintado intermedio y deja que el destino
  solicite el refresco apropiado. La navegación y los cambios de modo usan
  `ui`. La pantalla comprueba el siguiente cambio de día sin red y cancela esa
  tarea al cerrar.

## Responsive Y Estados

- En orientación vertical y horizontal se mantiene el mismo orden para evitar
  dos modelos mentales. El ancho de columnas y filas se recalcula desde
  `Screen`; si la altura es insuficiente, solo el cuerpo se desplaza.
- Un periodo parcialmente sincronizado conserva una advertencia de alto
  contraste antes del contenido.
- Fuera de la ventana se muestra un estado explícito, sin cuadrícula inventada.
- Sin eventos se conserva la cuadrícula y aparece un vacío textual útil.
- Títulos largos usan elipsis; metadata extensa no reduce el tamaño tipográfico
  por debajo de la escala nativa definida.

## Extensiones Con Sentido

Estas funciones conectan el calendario web con una consulta útil en Kindle, pero
quedan fuera de esta vertical y requieren su propia spec:

- resumen de la próxima prioridad pendiente;
- filtros locales por tipo, estado, asignatura y grupo;
- edad del snapshot y estado explícito de sincronización/offline;
- modo de estudio con eventos académicos pendientes y notas relacionadas;
- contexto del siguiente compromiso en el salvapantallas cuando la coexistencia
  con KOReader y el parche de Pedro esté validada.

## Verificación Requerida

- Modelo puro: periodo, lunes inicial, conteos multidiarios, agrupación de
  Agenda, etiquetas `HOY`/`MAÑANA`, énfasis académico, selección de los próximos
  cuatro eventos, cantidad restante y cuenta regresiva por fecha final.
- Smoke de widgets: raíz a pantalla completa, título, cuadrícula, filas de dos
  niveles, pie de navegación, cambio de modo en orden Agenda/Mes/Semana/Día y
  apertura de detalle.
- Inspección estática de los SVG lineales de calendario y notas.
- Navegación cruzada, refresh con estado `Actualizando calendario y notas…`,
  confirmación de respuesta nueva, `304` y error conservando la vista anterior;
  la comprobación deberá confirmar que una respuesta actualiza el snapshot de
  calendario y notas aunque solo se reconstruya inmediatamente una superficie.
- KOReader de escritorio: apertura, rotación, scroll, cierre y ausencia de
  desbordes en español.
- Kindle real: contraste, ghosting, tamaño táctil, latencia y lectura a distancia.

## Fuentes

- KOReader `UIManager`:
  https://github.com/koreader/koreader/blob/28b4f2d8042c182670b7a41916cf7ec7fe357826/frontend/ui/uimanager.lua
- KOReader `Size`:
  https://github.com/koreader/koreader/blob/28b4f2d8042c182670b7a41916cf7ec7fe357826/frontend/ui/size.lua
- KOReader `ButtonTable`:
  https://github.com/koreader/koreader/blob/28b4f2d8042c182670b7a41916cf7ec7fe357826/frontend/ui/widget/buttontable.lua
- KOReader `TextWidget`:
  https://github.com/koreader/koreader/blob/28b4f2d8042c182670b7a41916cf7ec7fe357826/frontend/ui/widget/textwidget.lua
- KOReader `TextBoxWidget`:
  https://github.com/koreader/koreader/blob/28b4f2d8042c182670b7a41916cf7ec7fe357826/frontend/ui/widget/textboxwidget.lua
- KOReader `ScrollableContainer`:
  https://github.com/koreader/koreader/blob/28b4f2d8042c182670b7a41916cf7ec7fe357826/frontend/ui/widget/container/scrollablecontainer.lua
- WCAG 2.2, contraste mínimo:
  https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- WCAG 2.2, contraste no textual:
  https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
