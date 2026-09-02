# Instalación En Kindle

Estas instrucciones corresponden al plugin de Karenda para KOReader. Requieren
un Kindle con jailbreak y KOReader instalado. La sincronización real y la
coexistencia con SimpleUI todavía deben validarse en el dispositivo objetivo.

## Copia Por USB

1. Cierra KOReader antes de copiar archivos.
2. Conecta el Kindle por USB y abre su almacenamiento.
3. Copia la carpeta completa `koreader-plugin/karenda.koplugin/` a:

   ```text
   Kindle/koreader/plugins/karenda.koplugin/
   ```

4. Comprueba que `_meta.lua`, `main.lua`, `calendar_view.lua` y `icons/` estén
   dentro de esa carpeta, no en una carpeta adicional anidada.
5. Expulsa el Kindle de forma segura y desconecta el cable.
6. Abre KOReader de nuevo.

Para actualizar, repite la copia sobre la carpeta existente. No borres
`koreader/settings/karenda/`: allí se conserva la configuración y el snapshot
local de Karenda.

## Primer Uso

1. Abre la entrada `Karenda` del menú de KOReader.
2. En Karenda Web, genera un código de vinculación de seis dígitos.
3. En KOReader, elige `Vincular dispositivo` e introduce el código antes de que
   venza.
4. Elige `Sincronizar ahora`.
5. Abre `Calendario`. Con un snapshot válido, la vista se abre localmente sin
   pedir red.

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
  tal como estaba mediante la opción nativa `Leave screen as-is`; al bloquearse
  dentro de un libro se muestra la portada a pantalla completa con tarjetas tipo
  post-it de progreso y estadísticas mediante la integración de Karenda.
- Después de dejar la vista abierta hasta medianoche, `Hoy` cambia al día real;
  una navegación manual conserva su cursor.

La integración del salvapantallas está incluida en `karenda.koplugin/`. No es
necesario instalar `2-kobo-style-screensaver.lua` ni ningún patch adicional de
Pedro. Para activarla, abre `Settings > Sleep screen > Wallpaper` y marca
`Pantalla de bloqueo de Karenda`; desmárcala en el mismo lugar para volver al
salvapantallas anterior. Si el patch de Pedro ya está instalado, Karenda no lo
modifica: mientras la opción esté desactivada, ese patch conserva su
comportamiento.

En ese mismo submenú puedes abrir `Personalizar pantalla de bloqueo` para
mostrar u ocultar título, autor, capítulo, progreso del libro/capítulo, página,
páginas y tiempos restantes de capítulo/libro, tiempo total, días, páginas
leídas y ritmo medio. También puedes elegir posición, alineación, distribución
y ajuste de portada.
`Vista previa de Karenda` muestra el diseño del libro actual; se cierra tocando
la pantalla o pulsando cualquier tecla, sin bloquear realmente el dispositivo.

No introduzcas el token en URLs, nombres de archivo, logs ni capturas. El token
se guarda localmente y no debe mostrarse después de la vinculación.

## Retirada

1. Cierra KOReader.
2. Elimina `Kindle/koreader/plugins/karenda.koplugin/`.
3. Conserva `Kindle/koreader/settings/karenda/` si quieres mantener la caché
   para una instalación posterior.
