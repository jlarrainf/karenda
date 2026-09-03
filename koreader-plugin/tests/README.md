# Pruebas Del Plugin

Las especificaciones `*_spec.lua` usan la interfaz de pruebas de KOReader/Busted
y no se ejecutan con Vitest. Deben ejecutarse desde la raíz del paquete KOReader
con el runtime de KOReader disponible y `karenda.koplugin/` incluido en
`package.path`.

La matriz cubre:

- ventana predeterminada y rangos inválidos;
- conversión snake_case, versión y referencias;
- URL HTTPS, Bearer y ausencia del token en la URL;
- respuestas 200, 304, 401, 403 y 413;
- transporte LuaSocket cuando KOReader no activa Turbo I/O;
- registro público de Quick Actions para calendario y notas;
- cuenta regresiva por fecha final, eventos multidiarios, vencidos y completados;
- presentación de instantes con el offset civil solicitado y cambio de horario;
- orden Agenda/Mes/Semana/Día e iconografía local de Quick Actions;
- Quick Actions de Calendario/Notas y actualización explícita desde la cabecera,
  con caché ante error;
- conversión segura de Markdown a HTML nativo de `TextViewer`, sin ejecutar HTML
  de entrada ni enlaces;
- encabezados, negrita, cursiva, tablas GFM, fórmulas Markdown inline y de bloque,
  exponentes, subíndices, símbolos lógicos con subíndice, flechas parametrizadas y símbolos matemáticos
  normalizados para tinta electrónica;
- Quick Actions declaradas como overlays in-place asíncronos;
- cierre diferido al tocar otra acción de la navbar, sin repintado intermedio, e
  indicador temporal de Calendario/Notas;
- redacción de errores sin secretos.

El fixture `snapshot-valid.json` es la forma canónica de datos para ampliar las
pruebas. `response-malformed.txt` representa una respuesta JSON truncada.

`calendar_view_smoke.lua` muestra y pinta la superficie con widgets reales,
comprueba su tamaño y overflow en geometría vertical y horizontal, verifica
Agenda como apertura, el selector persistente con un único segmento activo,
reconstruye y pinta Agenda, Mes, Semana y Día, comprueba la cabecera con cierre a
la derecha, el filtro de notas con `Todos los ramos` a ancho completo, el rollover
al reanudar sin mover un cursor manual, la cuenta regresiva y la reserva de una
navbar inferior simulada, su propietario como `active_widget` y la propagación de
gestos al `UIManager`, el cierre diferido de calendario/notas al cambiar de acción
sin exponer el Home intermedio y la limpieza al cerrar.
Se ejecuta desde la raíz de KOReader:

```sh
./luajit <karenda>/koreader-plugin/tests/calendar_view_smoke.lua \
  <karenda>/koreader-plugin/karenda.koplugin
```

`refresh_view_smoke.lua` verifica el estado visible `Actualizando calendario y
notas…`, la sustitución de la vista ante `200`/`304`, las notificaciones de
resultado, la conservación de la vista ante error y la protección contra
callbacks de una superficie que ya no está activa. `calendar_view_smoke.lua`
comprueba además que Calendario y Notas solicitan el snapshot completo al usar
su refresh. Se ejecuta con la misma invocación, cambiando el nombre del script.
`sync_service_spec.lua` cubre la persistencia y el ETag del servicio con un
transporte en memoria y requiere el runner Busted del entorno de KOReader.

`markdown_smoke.lua` verifica texto plano, HTML enriquecido, fórmulas inline y de
bloque sin depender de Busted. Se ejecuta pasando la ruta del paquete como único
argumento.

`simpleui_overlay_smoke.lua` verifica que Calendario y Notas se registren como
overlays in-place asíncronos y que el indicador temporal se active/restaure sin
pisar una pestaña seleccionada durante la propagación. La restauración del Home,
Library o Reader queda para la prueba con SimpleUI y KOReader reales.

`screensaver_policy_spec.lua` comprueba la prioridad entre contexto de Karenda,
libro y delegación. `screensaver_config_spec.lua` verifica el interruptor dentro
de `Wallpaper`, la personalización y que no se duplique al reconstruir el menú.
`book_screensaver_smoke.lua` construye la composición real de portada/tarjetas,
comprueba páginas/tiempos restantes y ritmo medio, e incluye el caso sin datos
visibles, con widgets de KOReader.
`screensaver_runtime_smoke.lua` prueba además la composición dentro del
`ScreensaverWidget` real y su cierre.
`screensaver_preview_smoke.lua` pinta la vista previa, verifica que no active el
estado real del salvapantallas ni su limpieza y comprueba que se pueda cerrar.
`screensaver_integration_smoke.lua` prueba el wrapper idempotente, el modo nativo
`Leave screen as-is`, la restauración de los campos temporales, el lock de gesto
y la limpieza anti-ghosting de la rama de libro mediante una pantalla e-ink
simulada (`clear` + `refreshFull` de pantalla completa). El runtime SDL omite
el refresco físico, por lo que la validación final de ghosting debe hacerse en un
Kindle real. Se ejecutan desde la raíz de KOReader:

```sh
./luajit <karenda>/koreader-plugin/tests/screensaver_config_spec.lua \
  <karenda>/koreader-plugin/karenda.koplugin

./luajit <karenda>/koreader-plugin/tests/screensaver_integration_smoke.lua \
  <karenda>/koreader-plugin/karenda.koplugin

./luajit <karenda>/koreader-plugin/tests/book_screensaver_smoke.lua \
  <karenda>/koreader-plugin/karenda.koplugin

./luajit <karenda>/koreader-plugin/tests/screensaver_runtime_smoke.lua \
  <karenda>/koreader-plugin/karenda.koplugin

./luajit <karenda>/koreader-plugin/tests/screensaver_preview_smoke.lua \
  <karenda>/koreader-plugin/karenda.koplugin
```
