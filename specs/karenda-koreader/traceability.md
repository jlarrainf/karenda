# Matriz De Trazabilidad: Karenda En KOReader

La matriz separa implementación de verificación real. Las funciones Edge y la
gestión web están desplegadas en el proyecto principal de InsForge, pero los
estados de integración real solo se cierran tras una prueba autenticada y el
dispositivo cuando corresponda.

| Requisito | Implementación prevista | Prueba o verificación | Estado |
| --- | --- | --- | --- |
| KR-REQ-001 | Cliente read-only sin mutaciones ni controles de escritura | Revisión estática y captura de requests | Especificado |
| KR-REQ-002 | Descriptores `karenda_calendar`/`karenda_notes` con métodos públicos de fallback | SimpleUI real + mock de fallback | Implementación local; verificación pendiente |
| KR-REQ-003 | Código web de emparejamiento + token interno por dispositivo + configuración Lua | Canje autenticado por código y prueba de sincronización | Web/backend implementados; integración pendiente |
| KR-REQ-004 | Cliente HTTPS con Bearer solo en header | Test de URL, headers, redirects y logs | Backend implementado; cliente pendiente |
| KR-REQ-005 | Validación de scopes en Edge Function | 401/403 contra backend real | Backend implementado; integración pendiente |
| KR-REQ-006 | Módulo `config`, canje de código y valores predeterminados | Test de configuración, emparejamiento y redacción visual | Pendiente |
| KR-REQ-007 | Cálculo de ventana con reloj/zona controlados | Test `today -7` / `today +180` | Especificado |
| KR-REQ-008 | Query builder y validación de rango IANA | Tests de rangos válidos e inválidos | Especificado |
| KR-REQ-009 | Proyección RFC 3339 versus fecha all-day + offset civil de `snapshot.timezone` antes de agrupar y presentar | Helper de zona con cambio de fecha, offsets equivalentes y transición de horario de verano; smokes de calendario | Proyección implementada y smokes correctos; dispositivo pendiente |
| KR-REQ-010 | Decoder de sobre y arrays de catálogo/eventos/notas | Fixture de snapshot completo | Especificado |
| KR-REQ-011 | API sin filtro temporal para `notes` + guard de 1 MiB | Fixture con notas fuera de ventana y 413 `SNAPSHOT_TOO_LARGE` | Backend implementado; test pendiente |
| KR-REQ-012 | `snapshot_mapper` + validación antes del store | JSON inválido/versiones/referencias | Pendiente |
| KR-REQ-013 | `If-None-Match`, metadata ETag y rama 304 | Mock 200/304 y backend real | Backend implementado; test pendiente |
| KR-REQ-014 | `snapshot_store` temporal + rename atómico | Fallo de escritura/rename | Pendiente |
| KR-REQ-015 | Estados offline y conservación de snapshot previo | Mock sin red y primer arranque | Pendiente |
| KR-REQ-016 | `calendar_view` a pantalla completa con TitleBar, selector persistente en orden Agenda/Mes/Semana/Día, cuerpo desplazable, pie ButtonTable, cuadrícula Mes/Semana, filas Agenda/Día y TextViewer | `calendar_data_spec`, pruebas de agrupación/rollover, `calendar_view_smoke` vertical/horizontal y prueba KOReader/Kindle real | Implementación local y smoke correctos; verificación en dispositivo pendiente |
| KR-REQ-017 | `notes_view` y conversión Markdown segura a HTML nativo de `TextViewer` | Fixture GFM/HTML/enlaces y smokes de notas/Markdown | Implementación local y smokes correctos; dispositivo pendiente |
| KR-REQ-018 | `context_store` con `calendar`, `note`, `none`; interruptor en `Wallpaper`; prioridad `Leave screen as-is`, portada configurable con métricas de lectura y delegación | `screensaver_policy_spec`, `screensaver_config_spec`, `screensaver_integration_smoke`, dispositivo real | Implementación local; verificación en dispositivo pendiente |
| KR-REQ-019 | Screensaver sin red; `Leave screen as-is`; composición propia configurable; preview separada, limpieza de campos temporales y pre-refresco e-ink completo antes del libro | `book_screensaver_smoke`, `screensaver_preview_smoke`, `screensaver_integration_smoke` + ciclo UIManager y pantalla e-ink simulada | Implementación local; verificación en dispositivo pendiente |
| KR-REQ-020 | `util.wrapMethod`, `raw_call`, sentinel singleton y coexistencia sin dependencia de Pedro | `screensaver_integration_smoke` con doble inicialización | Implementación local; coexistencia/dispositivo pendiente |
| KR-REQ-021 | Quick Actions públicas + diagnóstico custom navbar | SimpleUI/Kindle real | Implementación local; diagnóstico real pendiente |
| KR-REQ-022 | Interfaz `ApiClient` y adapter mock | Suite de errores y estados HTTP | Especificado |
| KR-REQ-023 | Flag de disponibilidad solo tras integración real | Checklist de backend/Kindle | Bloqueado por integración real |
| KR-REQ-024 | Catálogo de mensajes/log redaction en español | Revisión estática y tests de errores | Pendiente |
| KR-REQ-025 | Hook de reanudación + intervalo configurable | Reloj controlado, mock y evento de resume | Pendiente |
| KR-REQ-026 | Vistas cache-first y sincronización inicial explícita | Mock local, fixture sin caché y KOReader real | Implementación local; verificación pendiente |
| KR-REQ-027 | `CalendarData.daysRemaining`, etiquetas españolas y presentación en filas/detalle sin red | Tests de fecha final, multidiario, medianoche, vencido, completado y smoke de UI | Implementación local y smoke correctos; verificación en dispositivo pendiente |
| KR-REQ-028 | SVG locales de calendario/notas con contorno monocromo de `48x48` | Inspección estática de assets y SimpleUI/Kindle real | Implementación local correcta; verificación en dispositivo pendiente |
| KR-REQ-029 | Navegación común Calendario/Notas en web, Quick Actions nativas y `Karenda:refreshView` con snapshot completo, caché, ETag, estado visible de actualización, confirmación 200/304 y conservación ante error | Tests web, smoke de superficies, `refresh_view_smoke.lua` y mock 200/304/error | Implementación local y smoke correctos; backend autenticado/dispositivo pendiente |
| KR-REQ-030 | Descriptores SimpleUI in-place asíncronos, indicador temporal y pantallas `UIManager` sobre el stack actual | Test de descriptors, smoke de callbacks/indicador y SimpleUI/KOReader real desde Home/Library/Reader | Implementación local y smokes correctos; restauración real del stack pendiente por dispositivo |
| KR-REQ-031 | `remark-math`/`rehype-katex` en web y Markdown HTML seguro con símbolos, estilos matemáticos, símbolos lógicos con subíndice y `sup`/`sub` en `markdown.lua` | Test web de KaTeX, smokes de Markdown enriquecido, `markdown_spec.lua` y KOReader real | Implementación local y smokes correctos; Busted/dispositivo pendientes |
| KR-REQ-032 | `NotesPage` de lectura con `MarkdownRenderer` y panel explícito de administración | Test de lectura inicial, apertura de configuración y `NoteEditor` | Implementación local y tests correctos; verificación visual real pendiente |
| KR-REQ-033 | `NoteFilter`, consulta de notas de asignaturas y navegación `Todos los ramos` + asignaturas | Tests de service/store/navigation y smoke de `NotesScreen` | Implementación local, tests y smoke correctos; verificación visual real pendiente |
| KR-REQ-034 | Cabecera con cierre arriba a la derecha, refresh compacto inmediatamente a su izquierda y sin fila interna Calendario/Notas | Smoke de geometría, inspección estática de acciones y KOReader real | Implementación local y smoke correctos; verificación visual real pendiente |
| KR-REQ-035 | Navbar inferior visible durante la consulta, cierre diferido sin repintado intermedio al cambiar de acción y gestos delegados al widget subyacente | Smoke con navbar simulada, propagación/cierre/supresión de repintado e indicador, SimpleUI/KOReader real desde Home/Library/Reader | Implementación local y smokes correctos; verificación real bloqueada por dispositivo |
| KR-NFR-001 | Paquete separado `.koplugin` | Inspección del árbol de distribución | Pendiente |
| KR-NFR-002 | InsForge como fuente y store local no autoritativo | Revisión de arquitectura | Especificado |
| KR-NFR-003 | APIs/ciclo de vida nativos de KOReader | Prueba en KOReader fijado/real | Pendiente |
| KR-NFR-004 | Atribuciones y bloqueo de código de licencia desconocida | Revisión legal de distribución | Bloqueado por licencia del parche |
| KR-NFR-005 | Tareas y contrato señalan backend implementado e integración pendiente | Revisión de specs y estado InsForge | Backend desplegado; integración pendiente |

## Dependencias De Cierre

- KR-T17 y las pruebas autenticadas deben cerrar la parte backend antes de
  ejecutar pruebas reales de KR-REQ-003, KR-REQ-005 y KR-REQ-013.
- Un fixture puede verificar el cliente, pero no cambia los estados de
  autenticación, ETag o disponibilidad real.
- La instalación de `2-custom-navbar.lua` y el orden efectivo del parche de
  Pedro solo pueden verificarse en el Kindle/KOReader objetivo.
- La matriz deberá actualizarse en el mismo cambio que cualquier modificación
  de contrato o comportamiento.
