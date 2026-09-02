# Diseño: Karenda En KOReader

Estado: diseño aprobado para implementación incremental. El cliente y el plugin
pueden desarrollarse contra fixtures y mocks; las funciones Edge ya están
desplegadas y la sincronización real permanece pendiente de una prueba
autenticada. Este documento describe la frontera y no declara disponibilidad
funcional del plugin.

## 1. Límites De Arquitectura

El plugin vivirá como un paquete independiente, previsto inicialmente en:

```text
koreader-plugin/karenda.koplugin/
```

La aplicación web seguirá en React/TypeScript y no compartirá componentes con
Lua. La frontera pública será un snapshot JSON versionado. El plugin no
consultará directamente las tablas de InsForge ni interpretará el esquema
físico de Postgres.

La web autenticada crea un código numérico de seis dígitos con vencimiento de 10
minutos. KOReader lo envía una sola vez al endpoint de gestión; el backend lo
consume atómicamente y devuelve un token opaco de alta entropía. El código no se
persiste en KOReader ni sustituye la revocación del token emitido.

Capas previstas:

1. `config`: URL, token emitido, zona, ventana e intervalo configurables.
2. `api_client`: transporte HTTPS y lectura de headers.
3. `snapshot_mapper`: proyección snake_case de red a modelos internos Lua.
4. `snapshot_store`: validación, escritura atómica y lectura offline.
5. `context_store`: vista visible de Karenda y nota activa.
6. `ui`: pantallas y widgets nativos para calendario, notas y configuración.
7. `integrations`: Quick Actions, fallback público y wrapper del salvapantallas.

La composición de la acción `Actualizar` y la detección de la navbar inferior se
concentrarán en el módulo reutilizable `surface_navigation`, que solo coordinará
widgets y callbacks del plugin y no conocerá el transporte ni InsForge.

Ninguna capa de UI podrá iniciar una sincronización implícita durante el
salvapantallas.

## 2. Modelos Internos

Los modelos internos usarán nombres camelCase y serán propios del plugin. La
conversión se hará únicamente en `snapshot_mapper`.

```text
Snapshot
  schemaVersion
  snapshotId
  generatedAt
  timezone
  window.from
  window.to
  subjects[]
  personalGroups[]
  events[]
  notes[]

CalendarEvent
  id
  kind
  title
  subjectId
  personalGroupId
  startAt
  endAt
  allDay
  status
  location
  description
  updatedAt

Note
  id
  targetType
  targetId
  title
  contentMarkdown
  updatedAt
```

Los valores de `startAt` y `endAt` mantendrán la distinción de contrato:
RFC 3339 para instantes con hora y `YYYY-MM-DD` para eventos de todo el día.
El mapper no convertirá una fecha de todo el día a un instante UTC.

## 3. Interfaz Del Cliente

La UI y el almacén dependerán de una interfaz conceptual equivalente a:

```text
ApiClient.fetchSnapshot(request, previousEtag)
  -> SnapshotResponse
  -> NotModified
  -> ApiFailure
```

`request` contendrá `url`, `deviceToken`, `from`, `to` y `timezone`. La
implementación HTTP será sustituible por un mock. El token nunca se incluirá en
la representación de errores que cruce hacia la UI o los logs.

Resultados mínimos:

- `SnapshotResponse`: código 200, body validado y ETag opcional/esperado;
- `NotModified`: código 304 y ausencia de body, conservando la caché;
- `ApiFailure`: código, categoría segura y mensaje español sin secretos.

El cliente deberá rechazar una URL que no use HTTPS antes de abrir el socket.
Los redirects deberán validarse para impedir terminar en HTTP o en un host no
configurado, según la política que se fije en la implementación.

## 4. Flujo De Sincronización

1. La persona abre `Sincronizar` o la política explícita de carga inicial.
2. `config` calcula la ventana local y usa `America/Santiago` si no hay una
   preferencia guardada.
3. `api_client` envía `Authorization` y el ETag previo, nunca el token en la
   URL.
4. `snapshot_mapper` valida y convierte el body snake_case.
5. `snapshot_store` comprueba referencias, rangos, fechas y versión.
6. El snapshot válido se escribe a un temporal y se renombra de forma atómica.
7. La UI invalida su lectura local y muestra el resultado en español. En una
   actualización manual desde Calendario o Notas, mantiene un estado visible
   `Actualizando calendario y notas…` y, tras reconstruir la superficie activa,
   muestra una notificación breve de éxito o de `304` sin cambios.
8. Una respuesta 304 conserva el snapshot y no ejecuta un reemplazo destructivo.

Un error de red o de validación conserva el snapshot anterior. Un primer
arranque sin snapshot muestra un estado vacío explícito, no datos inventados.

El cliente no debe reintentar indefinidamente. La política exacta de reintento
y backoff queda para la implementación, pero no podrá ocultar un 401, 403 o
413 como un error de red genérico.

### Sincronización Al Reanudar

`config` tendrá un intervalo opcional. Cuando KOReader reanude, el plugin
comparará el reloj local con `last_checked_at`. Si el intervalo configurado ya
transcurrió, iniciará el mismo flujo de sincronización manual en segundo plano.
La vista actual podrá seguir abriéndose con la caché.

Sin intervalo configurado, la reanudación no hará red. En ningún caso esta ruta
compartirá código que ejecute peticiones desde `Screensaver.show`.

## 5. Almacenamiento Local

La carpeta propuesta es:

```text
DataStorage:getSettingsDir() .. "/karenda"
```

Archivos previstos, sujetos a la API concreta de `DataStorage`:

- configuración y token del dispositivo;
- snapshot JSON validado;
- metadata de ETag, ventana, zona y fecha de comprobación;
- archivo temporal de escritura atómica.

El almacén no será una base de datos de producción ni contendrá una segunda
fuente de verdad. La estrategia no deberá afirmar cifrado del token si KOReader
no ofrece un mecanismo real. El token no se imprimirá al usuario después de
guardarlo y los errores solo podrán referirse a su estado, nunca a su valor.

## 6. Widgets Y Navegación

La interfaz usará `Widget`, `WidgetContainer`, `InputContainer` y
`UIManager`. Se definirán estados nativos para:

- carga local;
- snapshot disponible;
- sin snapshot;
- sincronización correcta;
- no modificado (`304`);
- token inválido o revocado;
- falta de scope;
- error de red;
- snapshot demasiado grande;
- contenido Markdown parcialmente no soportado.

La agenda deberá priorizar lectura e-ink: una fecha por bloque, título, rango o
`Todo el día`, relación, estado textual y descripción cuando sea útil. Las
notas deberán ofrecer lista de destinos, selección de nota y lectura lineal.
Los enlaces serán texto seguro; no se abrirá HTML embebido.

La configuración ofrecerá un campo de código de seis dígitos y una acción de
emparejamiento. El código se descartará después del canje; el token emitido
quedará oculto después de guardarse. Las confirmaciones y errores serán
españoles.

## 7. Contexto Visible

`context_store` será la fuente única del contexto de Karenda y no inferirá la
vista a partir de `ReaderUI.document`.

Estados:

- `calendar`: la pantalla de agenda de Karenda está visible;
- `note`: la pantalla de nota está visible, con `noteId` local;
- `none`: Karenda no controla la superficie visible.

La apertura de una pantalla establece el estado. `UIManager:close`, la acción
de volver, el cambio a otra vista y cualquier salida de Karenda lo limpian. El
estado debe ser compartido entre instancias del plugin mediante un módulo
singleton, no mediante una segunda instalación del wrapper por instancia.

## 8. Wrapper Del Salvapantallas

La integración se instalará sobre el método actual con
`util.wrapMethod`. El estado del wrapper se mantendrá en un módulo singleton:

- un marcador de instalación evita duplicados;
- la referencia al wrapper permite inspección y reversión durante pruebas;
- `raw_call` conserva el método anterior;
- la clave propia `karenda_screensaver_enabled` controla la activación desde
  `Settings > Sleep screen > Wallpaper`;
- no se escribe `G_reader_settings["screensaver_type"]`;
- no se reemplaza globalmente `_G.dofile`.

Orden de decisión dentro de `Screensaver.show`:

1. leer la activación propia y `context_store`;
2. si la función está desactivada, invocar `raw_call` sin cambios;
3. si es `calendar` o `note`, delegar al método anterior con los campos de la
   instancia forzados temporalmente a `disable` y sin mensaje; esta es la ruta
   nativa de `Leave screen as-is` y no crea un widget visual;
4. si el UI activo contiene un libro y no está excluido del salvapantallas,
   construir el widget integrado con portada completa y tarjetas de estadísticas;
5. si no es Karenda, invocar el método anterior sin cambios.

El libro se representa mediante widgets nativos de KOReader: `ImageWidget` para
la portada escalada a pantalla completa, `FrameContainer` para la tarjeta de
identificación y las tarjetas tipo post-it, y `ProgressWidget` para el avance.
La composición no reutiliza código del parche externo. La integración comparte
el ciclo de vida de `ScreenSaverWidget` y `ScreenSaverLockWidget`, por lo que
conserva toque, tecla, retraso, gesto, rotación y limpieza nativos. Si el widget
no puede crearse, se llama a `raw_call` como fallback.

Las claves visuales propias permiten mostrar u ocultar título, autor, capítulo,
progreso del libro y capítulo, página, páginas restantes, tiempo total y tiempo
restante de capítulo/libro, días de lectura, páginas leídas y ritmo medio por
página. También controlan la posición vertical, la alineación horizontal, la
distribución fila/cuadrícula y si la portada conserva su proporción o llena la
pantalla. El constructor recalcula el grupo después de filtrar los datos, de
modo que no quedan tarjetas vacías ni espacios reservados cuando falta una
estimación.

La vista previa se monta en un `InputContainer` temporal separado del flujo de
bloqueo. Usa el libro y las opciones actuales, muestra una ayuda de salida y
registra toque y cualquier tecla para cerrarse. No cambia
`Device.screen_saver_mode`, no crea `ScreenSaverLockWidget` y no llama a
`Screensaver:cleanup()`.

El plugin no copia ni modifica el widget o el patch de Pedro. Si el patch
externo sigue instalado, el wrapper de Karenda queda por encima para el libro y
la rama `disable` permite que el patch externo delegue al método nativo en
calendario/notas. No es una dependencia de Karenda.

La coexistencia exacta con el reemplazo directo de Pedro, incluido el orden de
carga de `2-kobo-style-screensaver.lua`, debe probarse en KOReader real. Si el
parche reemplaza el método después de instalar el wrapper, no se declarará
compatibilidad sin una prueba que confirme la cadena efectiva.

## 9. SimpleUI Y Custom Navbar

La integración preferida será la API pública de Quick Actions:

- registrar temprano los descriptores externos `karenda_calendar` y
  `karenda_notes`, con etiquetas `Calendario` y `Notas`;
- usar `QA.isRegistered` antes de registrar o reemplazar;
- invalidar la caché mediante APIs públicas cuando sea necesario;
- no tocar `sui_config.lua`, `main.lua` ni archivos de SimpleUI.

Como fallback, el plugin expondrá métodos públicos de instancia para abrir
calendario y notas. Se preferirán funciones asignadas al objeto cuando el
custom navbar necesite descubrirlas con `pairs`, sin confiar en métodos heredados
por metatable.

La presencia instalada de `2-custom-navbar.lua` no puede inferirse desde este
repositorio web. El diagnóstico del plugin deberá identificarla cuando el
entorno lo permita. Si SimpleUI y el parche intentan administrar la misma barra
inferior, Karenda registrará el conflicto y conservará su navegación propia sin
modificar ninguno de los dos administradores.

### Vistas Nativas De Calendario Y Notas

Las superficies se separarán en módulos `calendar_view` y `notes_view`. Ambas
recibirán un snapshot ya validado y no consultarán InsForge directamente.

- `calendar_view` construirá una superficie nativa de pantalla completa sobre
  `InputContainer`. La primera fila será una `TitleBar` que mostrará el contexto,
  el periodo, un botón compacto local de refresh inmediatamente a la izquierda
  de la X y ningún botón interno `Calendario`/`Notas`. Debajo habrá un
  `ButtonTable` segmentado persistente en el orden `Agenda`, `Mes`, `Semana`,
  `Día`, con exactamente un modo activo. La superficie activa quedará marcada
  por texto y fondo, pero no deshabilitada.
  El cuerpo desplazable contendrá cuadrícula y eventos; un `ButtonTable` fijo
  contendrá `Anterior`/`Hoy`/`Siguiente`. La apertura usará `Agenda`. `Mes` y
  `Semana` mostrarán una cuadrícula de siete columnas con día y cantidad de
  eventos; `Agenda` y `Día` mostrarán filas detalladas. Tocar una celda cambiará
  a `Día` y tocar un resumen abrirá un `TextViewer` para el detalle, con relación,
  tipo, estado, fecha u horario, lugar y descripción cuando existan.
- El calendario compondrá encabezados con `TextWidget`, texto de varias líneas
  con `TextBoxWidget`, dimensiones de `Screen`/`Size` y separadores nativos. Los
  elementos informativos no serán botones deshabilitados. La fila de evento
  separará fecha/rango de título y metadata para mantener legibilidad en
  pantallas estrechas.
- `calendar_data` resolverá periodos, desplazamientos, días de semana y eventos
  que atraviesen los límites de un periodo, además de seleccionar una vista
  previa limitada de próximos eventos sin mutar el snapshot.
- La agenda agrupará por fecha completa y marcará `HOY`/`MAÑANA` mediante texto.
  Los eventos académicos pendientes incluirán una señal textual de preparación.
- Cada evento pendiente mostrará una cuenta regresiva derivada de su fecha final:
  `Hoy`, `Mañana`, `Faltan N días` o `Vencido hace N días`. Los eventos que
  abarcan varios días usarán la fecha final como entrega y los completados no
  mostrarán una cuenta obsoleta.
- `calendar_view` mantendrá una referencia de cursor y un indicador de
  seguimiento automático. Una navegación manual lo desactivará; `Hoy` lo
  reactivará. Mientras la superficie esté abierta, una comprobación local al
  siguiente cambio de día y otra al reanudar podrán reconstruir la lectura sin
  iniciar sincronización.
- `notes_view` construirá una pantalla raíz propia con una `TitleBar` primero,
  incluyendo `Actualizar` junto a la X, un selector de asignaturas con `Todos
  los ramos` en primera posición y un `Menu` desplazable con destinos y notas
  ordenados de forma estable. El selector filtrará localmente el snapshot y los
  grupos personales continuarán siendo destinos independientes. El detalle usará
  `TextViewer` en modo HTML con un fragmento generado por el parser Markdown de
  KOReader. El adapter retirará etiquetas HTML, imágenes y enlaces inseguros
  antes de convertir; los enlaces seguros se conservarán como texto visible, no
  como acciones. Se conservarán encabezados, énfasis, listas, citas y código del
  subconjunto soportado, incluyendo tablas GFM básicas. Las fórmulas se
  normalizarán a símbolos legibles y generarán cursiva matemática, `sup`, `sub` y
  etiquetas de flechas parametrizadas sin introducir KaTeX/MathJax.
- Un snapshot existente se mostrará sin red. Cuando falte, `main.lua` podrá
  mostrar un estado de carga mientras ejecuta la sincronización manual inicial.
- La vista raíz activa se guardará en la instancia del plugin para que al cerrar
  se limpie el contexto solo si todavía pertenece a esa superficie. Las dos
  acciones de SimpleUI serán overlays in-place asíncronos: se mostrarán sobre la
  pantalla actual y el cierre dejará que `UIManager` restaure la pantalla que
  estaba debajo. El indicador activo se marcará temporalmente con la API pública
  de la navbar y se restaurará al cerrar, excepto cuando una acción subyacente ya
  haya cambiado la pestaña. Un gesto en la franja inferior marcará una transición,
  programará el cierre para el siguiente tick y continuará propagándose a la
  navbar. Durante ese cierre se omitirán el `flashui` y la restauración del
  indicador temporal, evitando que el Home subyacente se pinte como estado
  intermedio antes del destino.
- Si SimpleUI no está instalado o no expone Quick Actions, `openCalendar` y
  `openNotes` continuarán siendo métodos públicos de la instancia.

Los iconos locales de las acciones serán SVG de `48x48`, negros, de contorno y
con `stroke-width` ligero. La forma será simple para conservar legibilidad al
reducirse en la navbar: calendario con marco, anillas y una única marca interior;
notas con hoja y líneas. No se reutilizarán archivos de SimpleUI ni se dependerá
de color.

El calendario pedirá `flashui` al abrir y cerrar normalmente la superficie
completa y `ui` para cambios normales. El cierre que forma parte de un cambio de
navbar omitirá ese repintado intermedio y dejará que el destino lo solicite. La
geometría se reconstruirá después de una rotación; el único trabajo programado
será la comprobación local del cambio de día y se cancelará al cerrar la
superficie. No habrá identificación de modelos de dispositivo ni sincronización
implícita.

### Actualización Explícita

`Actualizar` llamará a la sincronización manual aun cuando haya caché. Una
respuesta `200` guardará el snapshot completo de calendario y notas, cerrará el
estado `Actualizando calendario y notas…`, reconstruirá la vista activa y
mostrará una confirmación breve. Una `304` conservará el contenido validado,
reconstruirá la vista activa y mostrará que ambos destinos ya estaban al día; la
otra superficie utilizará el snapshot conservado al abrirse. Un error cerrará el
indicador de carga y dejará intacta la superficie anterior, junto con un mensaje
español que indique que se mantienen los datos locales.

## 10. Backend Y Responsabilidad

El endpoint lógico `karenda-koreader-snapshot` está desplegado en InsForge. La
función Edge debe:

- validar el token independiente y su scope `read:snapshot`;
- resolver el propietario del token;
- limitar la consulta a ese propietario;
- construir la proyección pública independiente;
- calcular ETag y responder 304;
- rechazar snapshots demasiado grandes sin devolver partes.

La web deberá gestionar códigos de emparejamiento, creación, listado de
metadatos, revocación y regeneración de tokens sin revelar tokens anteriores. Las
claves administrativas de InsForge serán server-only y nunca llegarán a la web
pública ni al Kindle.

## 11. Pruebas Previstas

Antes de probar un endpoint real se crearán fixtures locales para:

- snapshot completo con eventos académicos, personales, todo el día y notas;
- 304 con ETag igual;
- 200 con ETag nuevo;
- JSON inválido o versión no soportada;
- token expirado, revocado, ausente y sin scope;
- error de red, HTTPS inválido y redirect inseguro;
- snapshot demasiado grande;
- reanudación sin intervalo y con intervalo vencido;
- nota Markdown con HTML o enlace inseguro;
- dos instancias del plugin intentando instalar el wrapper;
- limpieza de contexto y delegación al salvapantallas anterior;
- cuenta regresiva para eventos simples, multidiarios, vencidos y completados;
- orden exacto del selector e inspección estática de los SVG de Quick Actions;
- navegación entre calendario y notas, refresh exitoso, `304` y error con caché.
- Quick Actions in-place abiertas desde Home, Library y Reader, con cierre que
  conserva la pantalla subyacente;
- fórmulas inline y de bloque en la web, y normalización segura de símbolos
  matemáticos en el renderer Lua, incluyendo encabezados, énfasis, exponentes,
  subíndices y símbolos de conjuntos;
- lectura inicial de notas, apertura explícita de configuración y filtros con
  `Todos los ramos` seguido de cada asignatura;
- posición estable del control común y botón compacto de refresh.

Las pruebas del cliente usarán un mock inyectado en `ApiClient`. La prueba de
sincronización real será separada y no se marcará como satisfecha con fixtures.

## 12. Compatibilidad Y Licencias

Referencias fijadas en el informe de descubrimiento:

- SimpleUI: commit `29dbfdea3298f8d4485faec38fd1691f76e35328`, licencia MIT.
- KOReader: commit `28b4f2d8042c182670b7a41916cf7ec7fe357826`, licencia AGPL v3.
- Parche de Pedro: commit `683f4f3b4baee75b7a4ba914f80917084dbafde8`, licencia no
  confirmada.

El plugin no modificará ni copiará directamente el parche de Pedro hasta
resolver la licencia y validar la coexistencia.
