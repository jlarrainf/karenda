# Decisiones: Karenda En KOReader

Fecha de cierre de Fase 0: 2026-08-30.

Las decisiones marcadas como `Decidido` son la base del contrato. Las marcadas
como `Pendiente` no deben resolverse inventando comportamiento en el plugin.

## 1. Decisiones Cerradas

| ID | Estado | Decisión | Motivo y consecuencia |
| --- | --- | --- | --- |
| KR-D-001 | Decidido | El MVP del Kindle es solo lectura. | Reduce superficie de riesgo; no habrá mutaciones de eventos ni notas. |
| KR-D-002 | Decidido | Cada dispositivo usa un token independiente emitido al canjear un código de emparejamiento generado desde la web. | No se acoplan cookies, navegador ni credenciales de usuario al Kindle. |
| KR-D-003 | Decidido | El código de seis dígitos se escribe manualmente una vez; después el token emitido se envía como Bearer por HTTPS. | La vinculación inicial es fácil de introducir y el secreto largo no se expone en la UI del Kindle. |
| KR-D-004 | Decidido | El token no aparece en URLs, logs, errores ni pantallas. | Evita filtraciones accidentales durante diagnóstico o uso diario. |
| KR-D-005 | Decidido | El token se puede revocar y regenerar desde Karenda. | Un dispositivo perdido no conserva acceso permanente. |
| KR-D-006 | Decidido | El contrato admite scopes; el MVP exige `read:snapshot` y reserva `write:events`. | Permite evolución sin conceder escritura ahora. |
| KR-D-007 | Decidido | `America/Santiago` es la zona predeterminada y se puede configurar. | Coincide con la carga inicial y permite otros contextos del usuario. |
| KR-D-008 | Decidido | Instantes con hora usan ISO 8601 inequívoco. | Evita ambigüedad de offset entre web, servidor y Kindle. |
| KR-D-009 | Decidido | Todo el día usa fecha local `YYYY-MM-DD`, sin conversión UTC. | Preserva la fecha que la persona introdujo. |
| KR-D-010 | Decidido | El snapshot es completo, con ventana predeterminada de hoy -7 a hoy +180. | Evita la complejidad de sincronización incremental en el MVP. |
| KR-D-011 | Decidido | `from` es inclusivo y `to` exclusivo. | Define una frontera estable para consultas y ETag. |
| KR-D-012 | Decidido | La ventana puede cambiar mediante parámetros. | Permite ajustar datos y tamaño sin cambiar el cliente. |
| KR-D-013 | Decidido | Las notas no se filtran por la ventana y llevan metadata y Markdown. | Las notas deben estar disponibles offline aunque no tengan fecha de evento. |
| KR-D-014 | Decidido | La red usa una proyección independiente versionada con snake_case. | Desacopla el plugin del esquema de InsForge y de React. |
| KR-D-015 | Decidido | El snapshot incluye ETag y soporta `If-None-Match`/304. | Evita descargar contenido privado sin cambios. |
| KR-D-016 | Decidido | El cliente se implementa detrás de una interfaz con fixture/mock. | Permite probar el plugin antes de que exista el backend real. |
| KR-D-017 | Decidido | La sincronización real no se considera funcional hasta probar el endpoint real. | Evita confundir mocks con disponibilidad de producción. |
| KR-D-018 | Decidido | `Screensaver.show` solo aplica la política de Karenda cuando `karenda_screensaver_enabled` está activa: calendario/nota en modo `Leave screen as-is`, libro abierto con pantalla integrada de portada y tarjetas de estado, y luego delegación. | `ReaderUI.document` puede existir aunque la persona navegue en Karenda; además, la función debe ser opt-in y funcionar sin el patch externo. |
| KR-D-019 | Decidido | El salvapantallas nunca hace red y usa solo el último snapshot local. | Protege el flujo de e-ink y mantiene funcionamiento offline. |
| KR-D-020 | Decidido | El libro abierto usa una composición propia de widgets nativos: portada a pantalla completa, tarjeta de identificación, barra de progreso y tarjetas tipo post-it con estadísticas; FileManager y contextos no soportados conservan el método anterior. | Reproduce la intención visual del patch de Pedro sin copiar código y permite mantener el ciclo de vida probado de KOReader. |
| KR-D-021 | Decidido | El wrapper usa `util.wrapMethod`, `raw_call` y una guarda singleton. | Evita reemplazos directos y duplicación por FileManager/ReaderUI. |
| KR-D-022 | Decidido | No se modifica el parche de Pedro ni se cambia globalmente `screensaver_type`. | La integración debe ser aditiva y reversible. |
| KR-D-023 | Decidido | Se usa Quick Actions pública de SimpleUI cuando exista y fallback propio cuando no. | Respeta la API pública sin depender de un único administrador de barra. |
| KR-D-024 | Decidido | Si SimpleUI y `2-custom-navbar.lua` compiten por la barra, se documenta el conflicto y no se modifican ambos. | Evita una integración frágil con dos sistemas que inyectan UI. |
| KR-D-025 | Decidido | Un snapshot de más de `1 MiB` (`1048576` bytes) de JSON UTF-8 sin comprimir produce `HTTP 413` con `error_code: SNAPSHOT_TOO_LARGE`; la paginación queda fuera del MVP. | No se truncan notas ni se oculta una respuesta parcial. |
| KR-D-026 | Decidido | La sincronización automática al reanudar solo ocurre si existe un intervalo configurado y ya venció; sin intervalo, solo hay sincronización manual. | Evita red inesperada y conserva control explícito del usuario. |
| KR-D-027 | Decidido | `public.device_tokens` almacena hash SHA-256, propietario, metadata, scopes y revocación; la gestión web usa `karenda-koreader-device-tokens`. | Separa el secreto del modelo de usuario y permite revocar cada dispositivo. |
| KR-D-028 | Decidido | `karenda-koreader-snapshot` consulta mediante API administrativa server-only y filtra siempre por el propietario del token. | La tabla no queda expuesta directamente al Kindle ni a la web. |
| KR-D-029 | Decidido | ETag y `snapshot_id` se calculan sobre JSON estable sin `generated_at`; el límite es `1048576` bytes. | Permite 304 reproducible y evita respuestas parciales. |
| KR-D-035 | Decidido | La vinculación inicial usa un código numérico de seis dígitos, válido durante 10 minutos y consumible una sola vez; el canje emite el token opaco del dispositivo. | Permite escribir la credencial inicial en un Kindle sin copiar un secreto largo y limita la exposición del código mediante vencimiento, consumo único y rate limit. |
| KR-D-036 | Decidido | La navbar usa dos Quick Actions externas: `karenda_calendar` (`Calendario`) y `karenda_notes` (`Notas`). | Permite acceso directo a cada tarea sin mezclar la agenda con la lectura de notas y conserva la entrada de menú para configuración. |
| KR-D-037 | Decidido | Las vistas son cache-first; solo la primera apertura sin snapshot puede iniciar una sincronización explícita. | Mantiene la lectura offline inmediata y evita red inesperada en aperturas posteriores. |
| KR-D-038 | Decidido | La agenda ofrece modos `Agenda`, `Mes`, `Semana` y `Día`; `Mes` y `Semana` usan una cuadrícula de siete columnas con cursor y navegación `Anterior`/`Hoy`/`Siguiente` dentro del snapshot local. | Se parece al calendario web y conserva una lectura útil en e-ink sin hacer red por cada cambio. |
| KR-D-039 | Decidido | El calendario usa una superficie estática de pantalla completa; el contenido precede a un pie de navegación y los eventos usan filas de fecha/rango más título y metadata. | Una pantalla que permanecerá abierta debe priorizar orientación y próximos compromisos, no parecer un diálogo de botones ni depender de interacción para ser útil. |
| KR-D-040 | Decidido | La apertura predeterminada es `Agenda` y la cabecera mantiene un selector segmentado persistente en el orden `Agenda`, `Mes`, `Semana`, `Día`; solo un modo puede estar activo y cambiarlo no abre un diálogo ni hace red. | La agenda es la respuesta más directa a qué se debe atender o estudiar, mientras las otras vistas siguen disponibles sin ocultarse en una acción secundaria. |
| KR-D-041 | Decidido | `Hoy` usa la fecha local del dispositivo, se comprueba al reanudar y en el siguiente cambio de día, y la referencia sigue automáticamente a la nueva fecha hasta que la persona navega manualmente; `Hoy` restaura ese seguimiento. | Una pantalla abierta no puede quedarse mostrando un día obsoleto, pero la navegación manual debe permanecer estable y no ser sobrescrita por un reloj. |
| KR-D-042 | Decidido | Cada evento pendiente muestra una cuenta regresiva basada en la diferencia de días civiles entre la fecha de referencia y `eventEndDate`; un evento multidiario cuenta hasta su fecha final, un límite horario exacto a medianoche ocupa el día anterior y un evento completado no muestra una cuenta nueva. | La información responde a cuánto falta para atender o entregar algo sin introducir un reloj que consuma batería o sea ambiguo en tinta electrónica. |
| KR-D-043 | Decidido | El selector persistente usa exactamente el orden `Agenda`, `Mes`, `Semana`, `Día`. | La primera opción debe coincidir con la apertura y con la tarea principal de consulta rápida. |
| KR-D-044 | Decidido | Los iconos de calendario y notas serán SVG locales de `48x48`, monocromos, de contorno ligero y sin rellenos masivos; no se copiarán iconos ni archivos de SimpleUI. | Un dibujo lineal conserva el lenguaje visual de SimpleUI y reduce manchas negras en pantallas e-ink pequeñas. |
| KR-D-045 | Decidido | La web mantendrá un control común `Calendario`/`Notas`; el plugin abrirá cada superficie desde su Quick Action y mostrará `Actualizar` en la cabecera. La actualización será siempre manual, con ETag, reemplazando la vista solo con un snapshot validado y conservando la anterior ante error. | La navegación debe ser inmediata offline, mientras la actualización explícita debe poder traer notas recién creadas sin introducir red oculta ni duplicar controles en la pantalla nativa. |
| KR-D-046 | Decidido | El icono de calendario usará una silueta de hoja con cabecera y anillas, más una única marca interior, sin la cuadrícula densa de la versión anterior; mantendrá el trazo negro de `48x48` junto al icono lineal de notas. | La marca interior comunica una fecha accionable con menos ruido y conserva la geometría simple de los iconos de SimpleUI. |
| KR-D-047 | Decidido | Las Quick Actions de Karenda serán `is_in_place = true` y `is_async_in_place = true`; sus pantallas se mostrarán sobre la superficie actual y se cerrarán mediante el stack normal de `UIManager`. | La acción no debe cambiar a Library para abrir una vista ni perder Home, Library o Reader al cerrarse. La marca asíncrona evita que SimpleUI restaure prematuramente su stack mientras la pantalla sigue abierta. |
| KR-D-048 | Decidido | En el plugin, la cabecera propia será la primera fila y `Actualizar` será un botón compacto de icono local inmediatamente a la izquierda de la X; Calendario y Notas no se repetirán como botones internos. La web conservará sus etiquetas textuales en la navegación común. | La cabecera con subtítulo debe conservar una geometría estable y las acciones nativas deben ocupar poco ancho sin perder su objetivo táctil. |
| KR-D-049 | Decidido | La web usará `remark-math` y `rehype-katex` después de sanitizar la entrada Markdown; el plugin mantendrá un adapter HTML seguro sobre el parser nativo de KOReader y convertirá comandos matemáticos comunes a símbolos legibles. | KaTeX ofrece fórmulas reales en navegador, pero incluir un motor matemático en KOReader sería innecesario y pesado para el MVP de tinta electrónica. |
| KR-D-050 | Decidido | Notas abrirá en modo lectura con lista y detalle. Crear, editar y eliminar se expondrán únicamente desde un panel explícito `Configurar notas`; el editor no se montará en la vista inicial. | La tarea frecuente es consultar apuntes; separar administración reduce mutaciones accidentales y mejora la lectura. |
| KR-D-051 | Decidido | `Todos los ramos` será el primer filtro y consultará todas las notas de asignaturas; cada asignatura tendrá su propio filtro. Los grupos personales seguirán disponibles como destinos independientes. | Se conserva la jerarquía académica solicitada sin ocultar la navegación existente de grupos personales ni mezclar ambos tipos en un filtro con nombre ambiguo. |
| KR-D-052 | Decidido | La cabecera propia será la primera fila, con la acción `close` explícita en la esquina superior derecha y `Actualizar` inmediatamente a su izquierda. No habrá una fila interna `Calendario`/`Notas`; esas superficies seguirán siendo Quick Actions externas. Cuando exista una navbar inferior activa, la vista calculará su alto, dejará esa zona sin pintar y permitirá que los gestos lleguen al widget subyacente. | El cierre y la actualización deben encontrarse en el borde esperado, mientras la navegación persistente de SimpleUI no debe desaparecer ni quedar inutilizable al consultar calendario o notas. |
| KR-D-053 | Decidido | Un gesto dirigido a otra acción de la navbar se dejará propagar y cerrará la superficie de Karenda en el siguiente tick. El cierre se marcará como transición de navbar: omitirá el `flashui` de limpieza y la restauración intermedia del indicador de `karenda_calendar` o `karenda_notes`, mientras la API pública `Bottombar.setTempTabActive` seguirá gestionando el indicador en aperturas y cierres normales. | El callback de la navbar debe poder cambiar la pantalla visible antes de retirar el overlay, sin mostrar el Home subyacente entre ambas operaciones ni devolver visualmente el indicador a una pestaña obsoleta. |
| KR-D-054 | Decidido | La activación se añade mediante `Karenda:addToMainMenu` al submenú nativo `Wallpaper`, con un marcador propio para que la reconstrucción del menú no duplique la opción. | El hook público se ejecuta después de cargar el menú nativo y evita reemplazar `_G.dofile` o modificar archivos de KOReader. |
| KR-D-055 | Decidido | La personalización usa claves propias para visibilidad de título, autor, capítulo, progreso de libro/capítulo, páginas y tiempos restantes, tiempo total, días, páginas leídas y ritmo medio, además de posición vertical, alineación horizontal, distribución fila/cuadrícula y ajuste proporcional o completo de portada. | Permite adaptar la densidad y legibilidad al tamaño/orientación de cada Kindle sin cambiar el contrato nativo de `screensaver_type`. |
| KR-D-056 | Decidido | La vista previa se implementa como un `InputContainer` temporal propio, con texto de salida, cierre por toque/tecla y sin `Device.screen_saver_mode`, `ScreenSaverLockWidget` ni `Screensaver:cleanup()`. | Evita que probar el diseño altere el ciclo de bloqueo o deje a la persona atrapada en una vista modal. |
| KR-D-057 | Decidido | El detalle de notas usará `TextViewer` en modo HTML con un fragmento generado por el parser Markdown de KOReader. El adapter eliminará HTML, imágenes y enlaces inseguros de la entrada antes de convertir; solo insertará etiquetas controladas para tablas GFM básicas, cursiva matemática, exponentes, subíndices, símbolos lógicos con subíndice, bloques de fórmula y etiquetas de flechas parametrizadas. Las etiquetas de flecha usarán flujo inline y no contendrán hijos `display: block`, para mantener una fórmula horizontal cuando quepa. | Reutiliza el scroll, selección, paginación y tipografía nativos sin incorporar un navegador ni KaTeX al Kindle, pero conserva la jerarquía visual de Markdown y evita ejecutar contenido del snapshot. |
| KR-D-058 | Decidido | `Actualizar` muestra el estado no descartable `Actualizando calendario y notas…` y, después de reconstruir la superficie activa, una notificación breve distingue entre snapshot nuevo y `304` sin cambios. Una única respuesta actualiza localmente calendario y notas; solo la superficie activa se reconstruye de inmediato. | Hace visible el trabajo de red y evita la ambigüedad sobre el alcance real de la sincronización completa, sin añadir una segunda petición al cambiar de superficie. |
| KR-D-059 | Decidido | La rama de libro limpia el framebuffer y ejecuta un refresco completo síncrono antes de mostrar la portada y las estadísticas; la rama de calendario/notas conserva `Leave screen as-is`. El refresco de hardware se omite únicamente en el emulador SDL. | Evita que la página del libro quede visible o produzca ghosting bajo la pantalla de bloqueo sin alterar la vista que debe conservarse intacta. |

## 2. Decisiones Pendientes

| ID | Estado | Pendiente | Bloquea |
| --- | --- | --- | --- |
| KR-D-030 | Pendiente técnico | Protección del token en reposo dentro de las capacidades de KOReader. | Diseño final del archivo de configuración. |
| KR-D-031 | Pendiente de dispositivo | Presencia instalada de `2-custom-navbar.lua`. | Verificación de conflicto y fallback real. |
| KR-D-032 | Pendiente de dispositivo | Orden efectivo entre el plugin y `2-kobo-style-screensaver.lua`. | Compatibilidad comprobada del wrapper. |
| KR-D-033 | Pendiente de dispositivo | Semántica de gesto, refresco y cierre en Kindle real. | Aceptación final del salvapantallas. |
| KR-D-034 | Pendiente legal | Licencia del repositorio `Koreader.patches`. | Copiar o reutilizar cualquier código del parche. |

## 3. Decisiones Rechazadas

- Usar cookies o la sesión del navegador dentro de KOReader.
- Pedir correo, contraseña o credenciales de usuario en el Kindle.
- Usar `anonKey` como autorización de datos privados.
- Usar el `api_key` administrativo de InsForge en el plugin.
- Poner el token en query strings, URLs, logs o diagnósticos.
- Hacer red desde `Screensaver.show`.
- Inferir el contexto por la existencia de `ReaderUI.document`.
- Modificar `2-kobo-style-screensaver.lua` o `2-custom-navbar.lua`.
- Reemplazar globalmente `screensaver_type` o `_G.dofile`.
- Tratar una fixture local como endpoint real.
- Añadir sincronización incremental en el MVP.
- Truncar o paginar notas sin una decisión y contrato separados.

## 4. Referencias Fijadas

- `docs/karenda-koreader-discovery.md` contiene la investigación de Fase 0.
- SimpleUI: commit `29dbfdea3298f8d4485faec38fd1691f76e35328`.
- KOReader: commit `28b4f2d8042c182670b7a41916cf7ec7fe357826`.
- Parches de Pedro: commit `683f4f3b4baee75b7a4ba914f80917084dbafde8`.
- InsForge: proyecto `5930dac6-6cab-43e7-b701-612843379b65`.
