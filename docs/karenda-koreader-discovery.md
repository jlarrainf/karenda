# Informe De Descubrimiento: Karenda En KOReader

Estado: Fase 0 completada y decisiones de producto cerradas. Este documento
registra hechos comprobados y riesgos; el contrato canónico está en
`specs/karenda-koreader/api-contract.md`. No implementa el plugin, no modifica
SimpleUI, no modifica los parches de KOReader y no crea recursos en InsForge.

Fecha de inspección: 2026-08-30.

## 1. Alcance Y Restricciones

El objetivo futuro es un plugin Lua nativo para KOReader en un Kindle con
jailbreak. El plugin deberá:

- mostrar calendario y notas desde el home de SimpleUI;
- conservar una caché local para lectura sin conexión;
- sincronizar desde Karenda Web, que seguirá siendo la fuente de verdad;
- mostrar notas Markdown mediante widgets nativos de KOReader;
- integrarse mediante APIs públicas, sin editar archivos de SimpleUI;
- envolver el comportamiento del salvapantallas de forma reversible e
  idempotente, sin hacer red dentro de `Screensaver.show`.

Las reglas del proyecto exigen código, nombres y comentarios en inglés, y
texto visible para la persona usuaria en español. InsForge es el único backend;
no se añadirá un servidor alternativo, una base de datos de producción local ni
un sistema de autenticación paralelo. No se guardarán contraseñas ni tokens en
logs.

## 2. Estado Del Repositorio

### Arquitectura existente

Karenda Web es una aplicación React + TypeScript + Vite. El acceso a InsForge
está encapsulado en servicios y los componentes no consultan el SDK
directamente. Zustand mantiene caché de trabajo y estado de interfaz, pero no
es la fuente persistente.

Rutas protegidas actuales:

- `/calendar`
- `/subjects`
- `/personal-groups`
- `/notes`

La autenticación usa exclusivamente InsForge Auth. El cliente se inicializa
en `src/lib/insforge/client.ts` con `VITE_INSFORGE_URL` y
`VITE_INSFORGE_ANON_KEY`. `src/services/authService.ts` obtiene sesiones y
tokens de acceso mediante las operaciones de Auth, pero no existe todavía una
función para emitir, revocar o administrar un token específico de KOReader.

### Contrato de dominio

La migración `migrations/20260830195621_create-domain-schema.sql` define:

| Entidad | Campos relevantes |
| --- | --- |
| `subjects` | `id`, `owner_id`, `name`, `code`, `abbreviation`, `color`, `created_at`, `updated_at` |
| `personal_groups` | `id`, `owner_id`, `name`, `color`, `created_at`, `updated_at` |
| `events` | `id`, `owner_id`, `kind`, `title`, `subject_id`, `personal_group_id`, `start_at`, `end_at`, `is_all_day`, `status`, `location`, `description`, `created_at`, `updated_at` |
| `notes` | `id`, `owner_id`, `target_type`, `target_id`, `title`, `content_markdown`, `created_at`, `updated_at` |

Valores explícitos:

- `kind`: `academic` o `personal`.
- `status`: `pending` o `completed`.
- `target_type`: `subject` o `personal_group`.
- Un evento académico requiere `subject_id` y no usa `personal_group_id`.
- Un evento personal no usa `subject_id` y puede usar `personal_group_id`.
- Una nota tiene exactamente un destino polimórfico y no se asocia
  directamente a un evento.
- `start_at` es obligatorio; `end_at`, si existe, debe ser posterior.
- Las fechas de todo el día deben conservar la fecha local sin desplazamiento
  visible.

`src/types/domain.ts` expone los mismos contratos en camelCase. Los servicios
traducen entre camelCase y las columnas snake_case de InsForge.

### Fechas Y Markdown

- `src/services/eventService.ts` conserva eventos con hora como ISO y serializa
  eventos de todo el día a medianoche UTC, mientras el dominio los vuelve a
  exponer como fecha `YYYY-MM-DD`.
- `src/lib/dates/dateUtils.ts` permite obtener una fecha en una zona horaria
  IANA, pero el modelo no contiene una zona horaria por cuenta.
- Una memoria de InsForge documenta que la carga inicial de 2026 usa
  `America/Santiago` para eventos con hora.
- `src/features/notes/components/MarkdownRenderer.tsx` usa
  `remark-gfm` y `rehype-sanitize`. El futuro plugin no podrá reutilizar ese
  renderizador React; deberá implementar como mínimo encabezados, énfasis,
  listas, enlaces, citas, bloques de código y tablas como widgets nativos,
  sin interpretar HTML.

## 3. InsForge Y Brecha De API

### Estado comprobado

El proyecto enlazado es `karenda`, con API base
`https://5zz5dxgt.us-east.insforge.app` y project ID
`5930dac6-6cab-43e7-b701-612843379b65`.

La inspección de solo lectura confirmó:

- una migración aplicada: `20260830195621_create-domain-schema`;
- tablas de dominio con datos: `events` (63), `subjects` (4), `notes` (0),
  `personal_groups` (0) en el momento de la consulta;
- funciones Edge desplegadas: ninguna;
- schedules: ninguno;
- vistas y funciones en `database.types.ts`: ninguna aplicación propia.

Las tablas tienen RLS habilitado, privilegios DML para `authenticated`, ningún
privilegio de tabla para `anon` y políticas separadas que comparan
`owner_id` con `auth.uid()`. Triggers adicionales:

- actualización automática de `updated_at`;
- protección contra cambiar `owner_id`;
- validación de relaciones de eventos y destinos de notas;
- bloqueo de eliminación de asignaturas o grupos con notas.

Los servicios actuales (`eventService`, `subjectService`,
`personalGroupService` y `noteService`) ejecutan consultas directas mediante
`insforge.database.from(...)`. No hay una respuesta preparada para un cliente
offline ni un endpoint que devuelva un snapshot de varias entidades.

### Limitaciones actuales

- `updated_at` permite detectar cambios de filas existentes, pero no hay una
  consulta pública de cambios desde un cursor.
- Las eliminaciones son físicas; no existen tombstones ni historial de cambios.
- El endpoint no podría ofrecer sincronización incremental segura sin una nueva
  decisión de backend.
- El frontend no define una preferencia persistida de zona horaria por cuenta.
- El `anonKey` público no basta para leer las tablas protegidas: el cliente
  necesita un token de sesión válido. Nunca debe usarse el `api_key` administrativo
  de `.insforge/project.json` en el Kindle.

### Propuesta Inicial De Contrato, Reemplazada Por La Spec

Las decisiones posteriores al descubrimiento fijaron un token independiente por
dispositivo, una proyección snake_case, un snapshot completo, una ventana
configurable y ETag/304. La propuesta inicial de esta sección se conserva como
trazabilidad histórica, pero queda reemplazada por
`specs/karenda-koreader/api-contract.md`; sus ejemplos no representan una API
desplegada.

La opción mínima compatible con las reglas del proyecto es una función Edge de
InsForge llamada lógicamente `karenda-koreader-snapshot`. La función recibiría
el token de acceso del usuario, crearía un cliente InsForge con ese token,
validaría la identidad y leería las tablas usando las mismas RLS.

Durante la inspección de Fase 0, la ruta física dependía de la URL de funciones
de InsForge y todavía no existía un endpoint desplegado. La implementación actual
usa `https://5zz5dxgt.function2.insforge.app` y mantiene la ruta lógica indicada
en `specs/karenda-koreader/api-contract.md`; esta sección conserva los ejemplos
de la propuesta histórica y no redefine el contrato vigente.

Solicitud propuesta:

```http
POST /karenda-koreader-snapshot
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "from": "2026-08-30",
  "to": "2026-10-01",
  "time_zone": "America/Santiago"
}
```

Semántica propuesta:

- `from` es inclusivo y `to` es exclusivo, ambos como fechas locales
  `YYYY-MM-DD`.
- Se devuelven eventos que comienzan o atraviesan el rango.
- `time_zone` es IANA y solo define la presentación de eventos con hora.
- Las fechas de todo el día permanecen como fechas locales, sin conversión de
  zona.
- La primera versión devuelve un snapshot completo del rango solicitado,
  incluyendo catálogo y notas; el cliente reemplaza la caché de forma atómica.
- No se promete sincronización incremental ni `deleted` hasta que exista un
  historial/tombstone en el backend.

Respuesta propuesta:

```json
{
  "contract_version": 1,
  "generated_at": "2026-08-30T23:00:00.000Z",
  "time_zone": "America/Santiago",
  "range": {
    "from": "2026-08-30",
    "to": "2026-10-01"
  },
  "subjects": [],
  "personal_groups": [],
  "events": [],
  "notes": []
}
```

Los elementos conservarían los identificadores estables, relaciones, estados,
rangos temporales y `content_markdown` original del dominio. La función debería
rechazar rangos excesivos y devolver como mínimo `400` para una solicitud
inválida, `401` para un token ausente o inválido y `5xx` sin datos parciales
cuando InsForge no esté disponible.

Esta propuesta requiere decidir antes de la Fase 1:

1. cómo obtiene y renueva la persona el access token que pegará en KOReader;
2. si el token de sesión de InsForge es suficiente o se necesita una emisión
   específica para dispositivos;
3. la ventana de sincronización inicial y el límite máximo del snapshot;
4. si la zona horaria se toma del dispositivo, de la web o de una preferencia
   persistida;
5. si el contrato público usa snake_case de InsForge o una proyección JSON
   independiente.

No se creó la función ni se ejecutó ningún cambio de backend.

## 4. SimpleUI

Fuente auditada: SimpleUI `2.7.0`, commit
`29dbfdea3298f8d4485faec38fd1691f76e35328`.

### Quick Actions

Fuente: [`features/sui_quickactions.lua`](https://github.com/doctorhetfield-cmd/simpleui.koplugin/blob/29dbfdea3298f8d4485faec38fd1691f76e35328/features/sui_quickactions.lua#L979-L1032).

APIs confirmadas:

- `QA.register(descriptor)`: exige `id` y `execute`, registra y reemplaza el
  descriptor anterior con el mismo ID. No devuelve valor.
- `QA.unregister(id)`: elimina acciones externas, pero no built-ins. No devuelve
  valor.
- `QA.isRegistered(id)`: devuelve si el ID está en el registro.
- `QA.allIds()`: devuelve directamente la tabla interna de IDs; no es una copia.
- `QA.invalidateCustomQACache()`: limpia la caché de Quick Actions custom.
- `Config.invalidateTabsCache()`: limpia la caché de tabs.
- `Bottombar.setTempTabActive(plugin, action_id, active, prev_action)`: actualiza
  temporalmente el indicador de una acción en las barras visibles y permite
  restaurar la acción anterior al cerrar una superficie.

Campos disponibles para un descriptor: `id`, `label`, `icon`, `get_icon`,
`get_label`, `is_active`, `is_in_place`, `is_async_in_place`, `execute` y
`browsemeta_mode`.

### Registro Tardío

`sui_config.lua` memoiza `loadTabConfig()`. Si una acción o pantalla no estaba
registrada cuando se cargaron los tabs, queda fuera de la lista en memoria;
`QA.register()` no invalida esa caché automáticamente.

SimpleUI registra sus Custom Screens antes de cargar la barra en
`main.lua:98-120`. Un plugin que necesite aparecer en la barra deberá registrar
su acción suficientemente temprano o llamar la invalidación pública apropiada
y provocar una reconstrucción controlada. Al borrar una Custom Screen,
SimpleUI llama `QA.unregister()` pero no `Config.invalidateTabsCache()`, por lo
que puede quedar un ID muerto hasta reiniciar.

El plugin no debe editar `main.lua`, `sui_config.lua` ni otros archivos de
SimpleUI. La integración prevista es un descriptor público y un flujo propio
de pantalla.

## 5. KOReader

Fuente auditada: commit `28b4f2d8042c182670b7a41916cf7ec7fe357826` del repositorio
oficial de KOReader.

### Carga De Plugins

Fuente: [`frontend/pluginloader.lua`](https://github.com/koreader/koreader/blob/28b4f2d8042c182670b7a41916cf7ec7fe357826/frontend/pluginloader.lua#L174-L291).

- Busca directorios terminados en `.koplugin` dentro de `plugins/`,
  `extra_plugin_paths` y, cuando corresponde, `<data_dir>/plugins/`.
- Ejecuta `main.lua` con `dofile()` y combina `_meta.lua` cuando existe.
- Ordena primero los proveedores.
- `createPluginInstance(plugin, attr)` llama `plugin.new(plugin, attr)` dentro
  de `pcall` y devuelve `true, instance` o `nil, error`.
- `loadPlugins()` mantiene cachés de plugins habilitados y deshabilitados.
- `finalize()` vacía `loaded_plugins`; no llama automáticamente a
  `stopPlugin()`.

Los parches `2-*` se cargan mediante `userpatch.lua` en prioridad `late` y en
orden alfanumérico. El plugin debe ser independiente de un orden accidental
entre parches.

### Widgets, Eventos Y UIManager

Fuentes auditadas:

- [`eventlistener.lua`](https://github.com/koreader/koreader/blob/28b4f2d8042c182670b7a41916cf7ec7fe357826/frontend/ui/widget/eventlistener.lua#L10-L39)
- [`widget.lua`](https://github.com/koreader/koreader/blob/28b4f2d8042c182670b7a41916cf7ec7fe357826/frontend/ui/widget/widget.lua#L15-L47)
- [`widgetcontainer.lua`](https://github.com/koreader/koreader/blob/28b4f2d8042c182670b7a41916cf7ec7fe357826/frontend/ui/widget/container/widgetcontainer.lua#L80-L117)
- [`inputcontainer.lua`](https://github.com/koreader/koreader/blob/28b4f2d8042c182670b7a41916cf7ec7fe357826/frontend/ui/widget/container/inputcontainer.lua#L144-L181)
- [`uimanager.lua`](https://github.com/koreader/koreader/blob/28b4f2d8042c182670b7a41916cf7ec7fe357826/frontend/ui/uimanager.lua#L194-L346)

Hechos relevantes:

- `EventListener:handleEvent(event)` busca `event.handler`, normalmente
  `on<EventName>`.
- `Widget` hereda de `EventListener`; su creación ejecuta `_init()` y luego
  `init()`.
- `WidgetContainer:propagateEvent(event)` recorre hijos y detiene la
  propagación cuando uno devuelve `true`.
- `InputContainer` registra zonas táctiles por ID y procesa primero zonas y
  luego `ges_events`.
- `UIManager:show(...)` inserta el widget, marca dirty y envía `Show`.
- `UIManager:close(...)` envía `FlushSettings` y `CloseWidget`, retira el
  widget y refresca los widgets descubiertos.
- `UIManager:sendEvent(event)` baja desde el widget superior y se detiene ante
  el primer `true`; los toasts no detienen la propagación.

### Wrappers

Fuente: [`frontend/util.lua`](https://github.com/koreader/koreader/blob/28b4f2d8042c182670b7a41916cf7ec7fe357826/frontend/util.lua#L1550-L1632).

`util.wrapMethod(target_table, target_field_name, new_func, before_callback)`
devuelve un wrapper con `revert()`, `raw_call(...)` y
`raw_method_call(...)`. Este es el mecanismo adecuado para envolver métodos sin
perder el comportamiento anterior. El plugin no debe depender de reemplazos
directos ni asumir que es el único consumidor del método.

### Salvapantallas Nativo

Fuentes auditadas:

- [`screensaver.lua`](https://github.com/koreader/koreader/blob/28b4f2d8042c182670b7a41916cf7ec7fe357826/frontend/ui/screensaver.lua#L346-L448)
- [`screensaverwidget.lua`](https://github.com/koreader/koreader/blob/28b4f2d8042c182670b7a41916cf7ec7fe357826/frontend/ui/widget/screensaverwidget.lua#L40-L79)
- [`screensaverlockwidget.lua`](https://github.com/koreader/koreader/blob/28b4f2d8042c182670b7a41916cf7ec7fe357826/frontend/ui/widget/screensaverlockwidget.lua#L17-L89)

El flujo nativo obtiene `ReaderUI.instance` o `FileManager.instance`, resuelve
portada, imagen, progreso y estado, activa `Device.screen_saver_mode`, maneja
rotación y refresco completo, y usa `ScreenSaverLockWidget` cuando
`screensaver_delay == "gesture"`. `ScreenSaverWidget` acepta toque o tecla
para cerrar.

Las rutas de instancia comprobadas son:

- `frontend/apps/reader/readerui.lua`;
- `frontend/apps/filemanager/filemanager.lua`.

## 6. Parche De Pedro Y Custom Navbar

Fuente: commit `683f4f3b4baee75b7a4ba914f80917084dbafde8` de
`PedroMachado1/Koreader.patches`.

### `2-kobo-style-screensaver.lua`

En `:1056-1111`, el parche:

- guarda `orig_screensaver_show`;
- reemplaza directamente `Screensaver.show`;
- solo construye su widget cuando `self.screensaver_type == "kobo_style"`;
- llama al método original en otros casos o cuando no puede construir el
  widget;
- en el camino Kobo no devuelve valor;
- crea `ScreenSaverWidget`, no `ScreenSaverLockWidget`.

Riesgos comprobados:

1. Cuando no hay datos visibles, llama al original dejando
   `self.screensaver_type == "kobo_style"`. KOReader no tiene una rama nativa
   para ese valor, por lo que el fallback puede terminar sin widget visible.
2. Al usar solo `ScreenSaverWidget`, un toque puede cerrar directamente el
   salvapantallas aunque la configuración nativa requiera un gesto.
3. El reemplazo directo no tiene marcador de instalación ni reversión; recargar
   el parche puede encadenar wrappers.
4. El parche también reemplaza globalmente `_G.dofile` entre `:1117-1403`.
5. El valor de configuración se guarda como
   `G_reader_settings["screensaver_type"]`, mientras el wrapper consulta
   `self.screensaver_type`; esa relación requiere validación en runtime.

El plugin de Karenda no copia esos defectos. La implementación integrada usa
`util.wrapMethod`, conserva `raw_call`, respeta el modo de gesto y mantiene una
guarda de instalación idempotente. La función es opt-in desde
`Settings > Sleep screen > Wallpaper`; en calendario y notas delega
temporalmente al retorno nativo de `screensaver_type == "disable"`, que es el
mecanismo de `Leave screen as-is`; en lectura usa una composición propia con
portada completa, tarjeta de libro y tarjetas tipo post-it de estadísticas. La
misma sección ofrece `Personalizar pantalla de bloqueo` para elegir cada dato de
lectura —incluidos páginas y tiempos restantes de capítulo/libro—, posición,
alineación, distribución y ajuste de portada, además de `Vista previa de
Karenda`, que se cierra por toque o tecla sin activar el ciclo real de bloqueo.
En las superficies de calendario y notas, un toque en otra acción de la navbar
se propaga primero al widget de SimpleUI y el cierre posterior omite el
repintado intermedio y la restauración del indicador temporal, evitando mostrar
Home antes del destino.
El patch de Pedro no es una dependencia ni se modifica.

### `2-custom-navbar.lua`

El parche inyecta tabs y acciones en FileManager, pero no es un contrato público
de KOReader. Se comprobaron estos problemas:

- descubre métodos de instancias con `pairs(val)`, aunque los métodos de clase
  viven en metatables y normalmente no se enumeran;
- ejecuta eventos de Dispatcher directamente en vez de usar
  `Dispatcher:execute()`, por lo que acciones con argumentos o categorías
  configurables pueden fallar;
- invoca métodos de plugins sin `pcall` y puede llamar handlers que requieren
  argumentos;
- asigna `dialog` sin `local` en el selector OPDS;
- algunos wrappers no preservan el retorno original;
- dependencias como Rakuyomi, QuickRSS, Z-Lib, Anna's Archive y AppStore no
  están presentes en el commit de KOReader auditado.

Por estas razones, Karenda no dependerá del descubrimiento automático de
métodos de ese parche. La acción de SimpleUI y la navegación propia del plugin
serán los puntos de entrada soportados.

## 7. Licencias Y Reproducibilidad

- SimpleUI: MIT, archivo `LICENSE` en el commit auditado.
- KOReader: GNU AGPL v3, archivo `COPYING` en el commit auditado.
- `Koreader.patches`: no contiene `LICENSE`, `COPYING`, SPDX ni copyright
  identificable en el árbol auditado; su licencia no está confirmada.
- El README del repositorio de parches enlaza revisiones distintas en algunos
  casos, por lo que sus instrucciones no son reproducibles estrictamente desde
  `683f4f3b4baee75b7a4ba914f80917084dbafde8`.

La implementación no copiará código del parche sin resolver antes la licencia
y conservará la atribución exigida por las licencias aplicables.

## 8. Riesgos Y Trabajo Pendiente Tras El Cierre

| Tema | Estado | Trabajo pendiente |
| --- | --- | --- |
| API de snapshot | No existe; contrato especificado | Implementar y desplegar la función Edge mediante InsForge |
| Token | No existe flujo de dispositivo; contrato especificado | Implementar hash, scopes, revocación y regeneración desde la web |
| Eliminaciones | Borrado físico | Mantener snapshots completos; paginación/tombstones quedan fuera del MVP |
| Zona horaria | `America/Santiago` predeterminada y configurable; la proyección devuelve el offset civil del snapshot | Validar el horario presentado en KOReader/Kindle real |
| Registro SimpleUI | API confirmada, caché sensible al momento | Registrar temprano y probar invalidación pública |
| Salvapantallas | Interruptor y personalización en `Wallpaper`, preview cerrable, wrapper integrado, `Leave screen as-is` y portada con tarjetas de estadísticas especificados e implementados | Probar coexistencia sin modificar el parche |
| Markdown en e-ink | Subconjunto seguro con `TextViewer` HTML nativo implementado | Validar contraste y ghosting en KOReader/Kindle real |
| Licencia del parche | No confirmada | No reutilizar código hasta resolverla |
| Validación en dispositivo | No disponible en esta fase | Probar en KOReader/Kindle real antes de publicar |

## 9. Siguiente Fase

Los smokes del plugin ya se ejecutan con el runtime fijado de KOReader; la
siguiente acción es validar el ciclo completo en el Kindle objetivo. La
integración del salvapantallas y el renderer Markdown enriquecido ya están dentro
de `karenda.koplugin/`: no requiere instalar el patch de Pedro, no hace red desde
`Screensaver.show` y deja pendiente solo la verificación de refresco, gesto,
tipografía, SimpleUI y coexistencia en hardware real.

## 10. Evidencia Y Comandos

La inspección local cubrió `agents.md`, `docs/constitution.md`, la spec web, el
plan, las tareas, la migración, los tipos, servicios, stores, rutas,
configuración y pruebas existentes. La inspección de InsForge fue de solo
lectura mediante:

```text
npx -y @insforge/cli memory list --json
npx -y @insforge/cli memory recall "Karenda calendar timezone labels" --json
npx -y @insforge/cli memory recall "polymorphic note target validation" --json
npx -y @insforge/cli current --json
npx -y @insforge/cli metadata --json
npx -y @insforge/cli db migrations list --json
npx -y @insforge/cli db tables --json
npx -y @insforge/cli db query <catalog queries> --json
npx -y @insforge/cli functions list --json
npx -y @insforge/cli schedules list --json
```

No se ejecutaron `login`, `link`, migraciones, despliegues, creación de
funciones ni cambios de datos. El directorio de trabajo no es un repositorio
Git, por lo que no hay un diff Git que consultar. La validación local posterior
al documento fue:

- `npx prettier --check docs/karenda-koreader-discovery.md`: correcto.
- `npm run typecheck`: correcto.
- `npm run lint`: correcto.
- `npm test`: 24 archivos y 73 tests correctos.
- `npm run build`: correcto. Vite mostró únicamente una advertencia de módulo
  `crypto` externalizado y otra por un chunk mayor a 500 kB.

El intento previo `npm test -- --runInBand` no ejecutó tests porque esa opción
no existe en Vitest. No se hicieron pruebas en un Kindle ni en KOReader real.
