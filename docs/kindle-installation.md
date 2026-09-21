# Instalación En Kindle

Estas instrucciones corresponden al plugin de Karenda para KOReader. Requieren
un Kindle con jailbreak y KOReader instalado. La sincronización real y la
coexistencia con SimpleUI todavía deben validarse en el dispositivo objetivo.

## Copia Por USB

1. Cierra KOReader antes de copiar archivos.
2. Conecta el Kindle por USB y abre su almacenamiento.
3. Si quieres calendario, notas y sincronización, copia
   `koreader-plugin/karenda.koplugin/` a:

   ```text
   Kindle/koreader/plugins/karenda.koplugin/
   ```

4. Si quieres el wallpaper de lectura, copia
   `koreader-plugin/karenda-screensaver.koplugin/` a:

   ```text
   Kindle/koreader/plugins/karenda-screensaver.koplugin/
   ```

5. Comprueba que cada paquete que hayas elegido tenga su `_meta.lua` y
   `main.lua` dentro de su carpeta, no en una carpeta adicional anidada.
6. Expulsa el Kindle de forma segura y desconecta el cable.
7. Abre KOReader de nuevo.

Para actualizar, repite la copia sobre la carpeta existente. No borres
`koreader/settings/karenda/`: allí se conserva la configuración y el snapshot
local de Karenda.

## Primer Uso

Si instalaste el núcleo:

1. Abre la entrada `Karenda` del menú de KOReader.
2. En Karenda Web, genera un código de vinculación de seis dígitos.
3. En KOReader, elige `Vincular dispositivo` e introduce el código antes de que
   venza.
4. Elige `Sincronizar ahora`.
5. Abre `Calendario`. Con un snapshot válido, la vista se abre localmente sin
   pedir red.

Si instalaste solo el wallpaper, no necesitas vincular una cuenta: abre un
libro y configura `Pantalla de bloqueo de lectura` desde
`Settings > Sleep screen > Wallpaper`.

Si SimpleUI expone Quick Actions, también pueden aparecer `Calendario` y
`Notas` como acciones independientes. El plugin no requiere ni modifica los
archivos de SimpleUI; si esas acciones no aparecen, usa la entrada `Karenda` y
sus puntos públicos de apertura.

## Comprobación En El Dispositivo

- La pantalla inicial muestra `Agenda` y un selector visible con `Mes`,
  `Semana`, `Agenda` y `Día`.
- Solo un segmento aparece seleccionado y cambiarlo no abre un diálogo.
- Los eventos pendientes académicos muestran `Estudiar` y la asignatura.
- `HOY` y `MAÑANA` aparecen en sus grupos cuando tienen eventos.
- `Anterior`, `Hoy` y `Siguiente` cambian la lectura sin sincronizar.
- Volver cierra la superficie y devuelve el salvapantallas normal.
- Si se bloquea el Kindle dentro de Calendario o Notas, la pantalla se conserva
  tal como estaba mediante la opción nativa `Leave screen as-is` por defecto;
  al bloquearse dentro de un libro se muestra la portada con un panel compacto
  de progreso y estadísticas. En este último caso, antes de pintarla se limpia
  el framebuffer y se ejecuta un refresco completo de e-ink para evitar ghosting
  de la página anterior.
- Después de dejar la vista abierta hasta medianoche, `Hoy` cambia al día real;
  una navegación manual conserva su cursor.

La integración del salvapantallas está incluida en el paquete independiente
`karenda-screensaver.koplugin/`. El calendario y las notas siguen en
`karenda.koplugin/`; puedes instalar ambos o solo uno. El wallpaper funciona sin
Karenda usando únicamente el libro local y, fuera de un libro, delega al
salvapantallas anterior. No es necesario instalar `2-kobo-style-screensaver.lua`
ni ningún patch adicional de Pedro. Para activarlo, abre
`Settings > Sleep screen > Wallpaper` y marca `Pantalla de bloqueo de lectura`;
desmárcala en el mismo lugar para volver al salvapantallas anterior. Si el patch
de Pedro ya está instalado, ninguno de los paquetes modifica sus archivos.

En ese mismo submenú puedes abrir `Personalizar pantalla de bloqueo` para
mostrar u ocultar las métricas, cambiar su orden, elegir el estilo minimalista
o el de tarjetas clásicas, y configurar posición, alineación y ajuste de
portada. Incluye `Leído hoy`, agrupado como páginas y tiempo del día, y el
capítulo se muestra con una tipografía mayor que la del autor. También puedes
decidir si Calendario/Notas conservan la vista actual y qué hacer fuera de un
libro. `Vista previa de pantalla de lectura` muestra el diseño del libro
actual; se cierra tocando la pantalla o pulsando cualquier tecla, sin bloquear
realmente el dispositivo.

No introduzcas el token en URLs, nombres de archivo, logs ni capturas. El token
se guarda localmente y no debe mostrarse después de la vinculación.

## Retirada

1. Cierra KOReader.
2. Elimina `Kindle/koreader/plugins/karenda.koplugin/` y, si está instalado,
   `Kindle/koreader/plugins/karenda-screensaver.koplugin/`.
3. Conserva `Kindle/koreader/settings/karenda/` si quieres mantener la caché
   para una instalación posterior.
