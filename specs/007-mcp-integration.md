# Integración MCP Multiharness De Karenda

Estado: implementación en `feature/007-mcp-server`. La rama de staging anterior
`karenda-mcp` conserva el primer despliegue, pero su historial diverge del
proyecto principal y no se promoverá. La rama limpia `karenda-mcp-release`
parte del esquema actual de producción; las migraciones OAuth y de controles
están aplicadas y la función MCP está desplegada. Metadata OAuth/recurso,
challenge 401, CORS y registro DCR pasan smoke tests en esa rama. Producción no
se modificó. El preview web está publicado en
`https://5zz5dxgt-h6d.insforge.site` (deployment
`756137ec-93ec-4e56-af1f-163636b306f6`) y sus rutas `/` y `/mcp/consent`
responden 200. El intento E2E de staging se detuvo porque crear una cuenta
sintética respondió 401; no se creó ninguna cuenta. Falta completar OAuth
autenticado desde Codex, pruebas RLS A/B, la matriz E2E de Codex/Claude/OpenCode,
auditoría adversarial y rollback. La cobertura
disponible no debe interpretarse como paridad completa con todas las pantallas
de Karenda.

## 1. Objetivo Y Decisión De Integración

La persona podrá iniciar sesión en Karenda desde el flujo OAuth del cliente
MCP, revisar los permisos y conversar para consultar o modificar operaciones
que ya existen en la web: eventos, asignaturas, grupos personales, notas,
hábitos, registros de hábitos, tareas recurrentes y revisiones Canvas definidas
por sus specs. La interfaz del modelo será agnóstica del harness.

La opción primaria es **un servidor MCP remoto por Streamable HTTP**, alojado
exclusivamente en InsForge. Las instrucciones iniciales por harness están en
`docs/mcp-clients.md`; cada versión de cliente y el flujo OAuth real requieren
validación antes de anunciar compatibilidad estable.

OAuth usará Authorization Code con PKCE S256, consentimiento de Karenda y
tokens MCP de corta duración con scopes. InsForge Auth será la identidad y
sesión de Karenda. El token de InsForge no se entregará al harness ni se usará
como bearer del recurso MCP. El servidor vinculará la concesión al usuario
autenticado y hará cada operación con contexto del propietario y RLS.

InsForge es la única plataforma autorizada para autenticación, backend,
persistencia y hosting. La implementación debe ejecutarse en InsForge Edge
Functions y PostgreSQL. Si el soporte actual no permite el protocolo necesario,
primero se probarán las capacidades disponibles de InsForge. No se añadirá un
servidor de aplicación, proveedor de identidad ni base de datos de producción
externos.

## 2. Referencias Y Precedencia

Esta spec extiende, sin reemplazar, los contratos y límites de:

- specs/001-web-mvp.md: cuenta, catálogos, eventos, calendario y notas.
- specs/002-ai-event-capture.md: preparación y confirmación de eventos asistidos.
- specs/003-habits-and-recurring-tasks.md: hábitos, registros, notas de hábito,
  tareas recurrentes, historial y estadísticas.
- specs/004-koreader-habit-log-ingestion.md: solo contratos ya aprobados; no
  autoriza revelar credenciales del dispositivo.
- specs/006-canvas-sync.md: conexión, sincronización, vínculos y revisión
  unidireccional de Canvas.
- docs/constitution.md, docs/git-workflow.md y docs/ui-design.md.

Si una operación no existe o sus reglas no están claras en la spec de dominio,
se detiene el diseño de esa herramienta hasta actualizar primero dicha spec.
No se inventan estados, campos mutables ni efectos secundarios para completar
una impresión de paridad.

## 3. Alcance Y Límites De Paridad

### Incluido

- Consultar, crear, editar, completar, volver a pendiente y eliminar eventos,
  respetando tipos, fechas, relaciones, estados y validaciones actuales.
- Consultar y administrar asignaturas y grupos personales en las operaciones
  permitidas por su spec, con dependencias y borrado protegido.
- Consultar, crear, editar y eliminar notas de asignatura y grupo personal que
  ya admite la web.
- Consultar y administrar hábitos; pausar, reanudar o archivar; leer y corregir
  registros históricos; administrar notas generales y diarias; consultar
  historial y estadísticas según el contrato actual.
- Consultar y administrar tareas recurrentes, próximas ocurrencias,
  reprogramación, finalización e historial según la spec 003.
- Solicitar propuestas IA de eventos o hábitos y presentar el resultado como
  borrador. Guardar requiere una herramienta de escritura separada y campos
  confirmados; solicitar IA nunca guarda por sí solo.
- Leer el estado Canvas, solicitar una sincronización autorizada, listar
  propuestas y aplicar, vincular o ignorar una propuesta mediante decisiones
  disponibles en la web.
- Mostrar errores de validación y conflictos con instrucciones concretas, sin
  filtrar detalles internos o secretos.

### Fuera De La V1

- Iniciar sesión, cambiar contraseña, recuperar cuenta o administrar factores
  de seguridad desde herramientas MCP. Estas acciones siguen en Karenda/
  InsForge.
- Introducir secretos Canvas, tokens KOReader u otras credenciales mediante el
  modelo. La configuración se hará en la web, que no vuelve a mostrar secretos.
- Escribir en Canvas. Una acción MCP puede aplicar una propuesta dentro de
  Karenda, no modificar datos remotos.
- Crear eventos automáticamente desde IA o sincronización, sin una etapa
  separada de revisión.
- Escribir desde MCP al plugin KOReader, cambiar su snapshot o administrar sus
  credenciales.
- Ejecutar SQL, invocar funciones arbitrarias, leer tablas directamente o
  aceptar nombres de tablas/campos aportados por el modelo.
- Replicar preferencias puramente visuales (tema, vista de calendario, filtros
  temporales locales), salvo que una spec de dominio ya las modele como datos.

La paridad significa paridad de **operaciones del dominio autenticado**, no
reproducción de cada pantalla o control visual. La matriz de cobertura debe
justificar cada exclusión.

## 4. Arquitectura Propuesta

Cliente MCP (Codex / Claude Code / OpenCode) se conecta por Streamable HTTP al
recurso MCP remoto. Para autorizar, abre el navegador en Karenda; la sesión de
InsForge identifica al usuario y la pantalla de consentimiento registra grant,
scopes y cliente. Cada llamada valida bearer, audiencia, grant y scope; el
adaptador invoca los servicios de dominio existentes con un cliente de usuario
InsForge. PostgreSQL y RLS siguen siendo la fuente de verdad.

### Componentes

1. **Recurso MCP remoto:** endpoint Streamable HTTP, negociación MCP, validación
   de origen, bearer, scopes, límites de cuerpo, timeout y respuestas seguras.
   No mantiene estado entre llamadas salvo el estado transitorio del protocolo.
2. **OAuth de Karenda:** metadatos de recurso/autorización, autorización,
   canje de código, refresh y revocación. Reutiliza la sesión InsForge para
   identificar a la persona y guarda grants en InsForge.
3. **Consentimiento web:** informa identidad y dominio del cliente cuando
   estén disponibles, scopes legibles, finalidad, expiración y acciones
   Autorizar/Cancelar.
4. **Adaptador de dominio:** traduce schemas MCP a servicios existentes:
   eventos, notas, asignaturas, grupos, hábitos, tareas recurrentes, Canvas e
   IA. No consulta tablas directamente desde cada tool.
5. **Persistencia:** clientes/grants, scopes, refresh token MCP protegido,
   expiración, revocación y auditoría mínima. RLS impide que una cuenta consulte
   o revoque grants de otra. La concesión conserva cifrado solo el access token
   corto de InsForge y nunca el refresh token de InsForge.
6. **Errores comunes:** códigos MCP estables mapeados desde errores de dominio
   y autenticación, con mensajes españoles accionables y sin stack traces.

### Puerta De Factibilidad InsForge (Fase 0)

Una prueba aislada debe verificar antes de implementar:

- si InsForge Edge Functions puede exponer endpoint MCP, OAuth y paths
  .well-known estándar;
- soporte de Streamable HTTP, headers, streaming/cancelación y SDK MCP en el
  runtime Deno de InsForge;
- límites de tiempo, cuerpo, concurrencia, cold start, secretos y redirects;
- cómo consentir usando sesión InsForge sin exponer token en URL, logs o
  almacenamiento del harness;
- ciclo OAuth real de Codex, Claude Code y OpenCode: metadata de cliente/CIMD,
  redirect de escritorio, renovación y revocación.

La prueba devuelve evidencia y decisión, no crea infraestructura productiva.
Si falta una capacidad, probar primero una composición de funciones/rutas que
InsForge soporte. No migrar a un backend externo sin actualizar y aprobar la
arquitectura. Si InsForge no puede servir el protocolo de forma segura, se
documenta el límite y se consulta antes de una excepción.

## 5. Contrato OAuth Y Sesiones

- Seguir OAuth 2.1 y la especificación de autorización MCP vigente, con
  Authorization Code, PKCE S256, state impredecible y protección CSRF.
- Publicar metadata estándar de autorización y recurso protegido. El recurso,
  audiencia y token deben coincidir exactamente; rechazar tokens para otra API.
- Usar tokens MCP opacos o JWT firmados por Karenda, de corta duración, con
  audiencia MCP, scopes, expiración e identificador de grant. Documentar la
  ventana de revocación y cualquier caché de validación.
- Refresh tokens MCP rotativos, de un solo uso y revocables; almacenar hash
  cuando sea posible. Detectar reutilización e invalidar la familia. No escribir
  tokens, códigos o secretos PKCE en logs/trazas/analítica.
- El grant enlaza con la identidad de InsForge. En cada petición, validar
  grant/usuario y crear el cliente SDK de InsForge en contexto de ese usuario
  para que RLS vuelva a aplicar aislamiento. Ignorar owner_id/user_id aportados
  por argumentos del modelo.
- La concesión conserva solo el access token corto de InsForge cifrado con
  AES-GCM y una clave server-side de InsForge. Nunca conserva el refresh token
  de InsForge, porque competiría con la sesión web y su rotación. Al expirar
  ese access token, el cliente MCP debe reabrir OAuth en Karenda y volver a
  autorizar; el refresh token MCP no renueva la sesión InsForge.
- Preferir CIMD si el SDK de cada cliente y runtime lo soporta. DCR requiere
  decisión del spike y controles de metadata, URL, redirect, abuso y tasa.
  Nunca usar redirects wildcard, implicit grant ni bearer en query string.
- HTTPS obligatorio salvo loopback permitido por OAuth. Validar redirects
  exactos y reglas de loopback/custom URI del cliente.
- Cada tool exige scope server-side; el usuario puede conceder permisos
  parciales. Los scopes no sustituyen las confirmaciones del cliente.
- Revocar desde la web invalida refresh tokens y acceso activo en el plazo
  máximo definido. Cambio de scopes requiere reautorización.
- La web muestra cliente, scopes, fecha de concesión/uso y permite revocar uno
  o todos. Nunca muestra el valor del token.

### Scopes Iniciales

| Scope | Permiso |
| --- | --- |
| profile:read | Identidad mínima y zona horaria Karenda |
| events:read / events:write / events:delete | Eventos |
| notes:read / notes:write / notes:delete | Notas |
| habits:read / habits:write / habits:delete | Hábitos, logs, notas e historial |
| recurring:read / recurring:write | Tareas recurrentes |
| catalogs:read / catalogs:write / catalogs:delete | Asignaturas y grupos |
| canvas:read / canvas:sync / canvas:review | Estado, sync y revisión en Karenda |
| ai:draft | Solicitar borradores IA |

No conceder escritura por defecto si la persona pide solo lectura. Separar
delete de write. Los permisos se validan en cada llamada.

## 6. Superficie De Herramientas MCP

Los nombres son canónicos para planificación. Schemas finales estrictos y
tipados; límites de longitud/tamaño, enums y allowlists. Rechazar campos
desconocidos cuando puedan cambiar la semántica.

### Contexto De Cuenta

| Tool | Operación | Scope | Condición |
| --- | --- | --- | --- |
| profile.get_context | Leer zona horaria, idioma y hora actual del servidor | profile:read | No expone correo, credenciales ni identificadores internos |

### Eventos

| Tool | Operación | Scope | Condición |
| --- | --- | --- | --- |
| events.list / events.get | Lista paginada o detalle por ID | events:read | Intervalo acotado; solo propietario |
| events.create / events.update | Crear o editar campos del dominio | events:write | Relaciones validadas y control de versión |
| events.set_status | Cambiar pending/completed | events:write | Solo transiciones admitidas por spec 001 |
| events.delete | Eliminar evento | events:delete | Destructiva, con destino y confirmación |
| events.prepare_ai_draft | Preparar sugerencias IA | ai:draft | No persiste |
| events.save_ai_draft | Guardar campos revisados | events:write | Llamada separada, revalida como create |

### Catálogos

| Tool | Operación | Scope | Condición |
| --- | --- | --- | --- |
| subjects.list / subjects.get | Consultar asignaturas | catalogs:read | Solo propietario |
| subjects.create / subjects.update / subjects.delete | Administrar asignaturas | catalogs:write/delete | Constraints y dependencias de spec 001 |
| personal_groups.list / personal_groups.get | Consultar grupos | catalogs:read | Solo propietario |
| personal_groups.create / personal_groups.update / personal_groups.delete | Administrar grupos | catalogs:write/delete | Sin cascadas no aprobadas |

### Notas

| Tool | Operación | Scope | Condición |
| --- | --- | --- | --- |
| notes.list / notes.get | Listar/detallar por tipo y relación | notes:read | Paginado; solo propietario |
| notes.create / notes.update | Crear o editar nota Markdown | notes:write | Target validado y tamaño máximo |
| notes.delete | Borrar nota | notes:delete | Destructiva y confirmable |

Aplica a notas de asignatura y grupo personal admitidas por la web. Las notas
de hábitos se exponen bajo sus herramientas de hábito.

### Hábitos, Registros Y Notas

| Tool | Operación | Scope | Condición |
| --- | --- | --- | --- |
| habits.list / habits.get | Consultar hábito y configuración | habits:read | Paginado y propio |
| habits.create / habits.update | Crear/editar definición y asociación | habits:write | Frecuencia/meta válidas |
| habits.set_lifecycle | Pausar, reanudar, archivar/restaurar si se admite | habits:write | Conserva historial |
| habits.logs.list / habits.logs.get | Consultar registros | habits:read | Fecha local y paginación |

La lectura de registros conserva koreader_link_id como koreaderLinkId nullable para identificar la procedencia de las importaciones. Las escrituras MCP solo crean registros manuales y no aceptan ni modifican el vínculo de KOReader.
| habits.logs.upsert | Crear/corregir registro | habits:write | Estado/valor validados contra hábito |
| habits.logs.delete | Borrar registro | habits:delete | Resumen de fecha/estado/valor actual |
| habits.notes.list / habits.notes.get | Leer nota general o diaria | habits:read | Respeta modelo actual |
| habits.notes.create / habits.notes.update | Crear/editar nota | habits:write | Distingue general y fecha diaria |
| habits.notes.delete | Eliminar nota | habits:delete | Confirmable |
| habits.schedule_versions.list / habits.statistics.get | Leer cambios y estadísticas | habits:read | Misma definición que la web; respeta statsEnabled y limita el rango a 366 días |
| habits.prepare_ai_draft | Proponer un hábito | ai:draft | Solo borrador |
| habits.save_ai_draft | Crear desde campos revisados | habits:write | Escritura explícita separada |

### Tareas Recurrentes

| Tool | Operación | Scope | Condición |
| --- | --- | --- | --- |
| recurring.list / recurring.get | Leer definiciones y estado | recurring:read | Filtros y límites |
| recurring.create / recurring.update | Crear/editar regla | recurring:write | Frecuencia válida según spec 003 |
| recurring.set_lifecycle | Pausar, reanudar, archivar/restaurar | recurring:write | Historial permanece |
| recurring.occurrences.list | Próximas ocurrencias e historial | recurring:read | No confundir proyección con evento |
| recurring.occurrences.complete | Completar ocurrencia | recurring:write | Avance idempotente |
| recurring.occurrences.reschedule | Reprogramar ocurrencia | recurring:write | No reescribe futuras reglas |
| recurring.delete | Excluida: Karenda conserva tareas recurrentes mediante archivo | Sin permiso de borrado físico | Usa recurring.set_lifecycle |

### Canvas

| Tool | Operación | Scope | Condición |
| --- | --- | --- | --- |
| canvas.status | Leer estado/última sincronización sin secreto | canvas:read | Solo metadatos necesarios |
| canvas.sync | Sincronización manual | canvas:sync | Requiere conexión web; idempotente |
| canvas.review.list | Leer propuestas y conflictos | canvas:read | Contenido sanitizado |
| canvas.review.apply / canvas.review.ignore | Aplicar o ignorar dentro de Karenda | canvas:review | Además exige events:write o catalogs:write según efecto |

La conexión Canvas debe iniciarse/configurarse desde la web. No aceptar
credenciales Canvas del modelo y no escribir en Canvas.

### Confirmación Destructiva

Las tools declaran readOnlyHint, destructiveHint e idempotentHint según efecto.
Son anotaciones informativas, no autorización. La tool resume destino, versión
y efecto. El harness debe pedir confirmación para borrados. Si el cliente no
ofrece confirmación, el servidor exigirá confirm=true más resumen/versión que
coincida con el estado leído, o rechazará el borrado. Nunca inferir confirmación
solo del lenguaje del modelo.

## 7. Reglas De Contratos Y Mutaciones

- IDs opacos; resolver cada objeto y relación dentro de la cuenta actual.
  Nunca aceptar owner_id como selector de usuario.
- Respetar contratos temporales por dominio. Instantes con hora llevan offset o
  UTC; eventos de día completo y logs usan fecha local. Usar la zona horaria
  configurada en Karenda y devolverla al cliente.
- El servidor no interpreta expresiones como “mañana”. El modelo las convierte
  a una fecha ISO inequívoca usando hora/zona devueltas por
  profile.get_context; si hay ambigüedad, pregunta antes de mutar.
- Listas con cursor opaco, límite máximo servidor-side y orden estable. Rango
  temporal y tamaño de respuesta acotados.
- Toda escritura devuelve ID, campos persistidos, versión/updated_at y
  confirmación de InsForge. No informar éxito antes de persistencia.
- Las ediciones reciben expected_updated_at o versión. Si cambió desde la
  lectura, devolver CONFLICT sin sobrescribir.
- Cada tool que modifica datos exige `idempotencyKey`, un UUID generado para
  esa operación lógica. Karenda limita la clave al grant y a la tool, compara
  un hash canónico de los argumentos y conserva la respuesta 30 días. El mismo
  contenido reproduce la respuesta sin ejecutar otra escritura; cambiar el
  contenido con la misma clave produce conflicto. Si el registro queda en curso
  tras una interrupción, el cliente consulta Karenda antes de reintentar. La
  clave no autoriza la llamada ni reemplaza `expectedUpdatedAt`.
- Mutaciones relacionadas deben ser transaccionales o exponerse como etapas
  explícitas con IDs. No fingir atomicidad en el servidor MCP.
- El borrado respeta referencias y cascadas de la spec. No convertir archivo,
  completado o ignorado en borrado físico.
- Notas/descripciones son texto/Markdown; HTML remoto no se renderiza.
- IA entrega salida validada, no razonamiento interno, prompt de sistema,
  configuración secreta ni datos de otro usuario.

## 8. Seguridad, Privacidad Y Abuso

### Identidad Y Aislamiento

- Derivar identidad del grant validado; cada servicio usa contexto de usuario y
  RLS. Probar IDs ajenos, relaciones cruzadas y owner_id inyectado.
- Verificar pertenencia para eventos, notas, hábitos, grupos, asignaturas y
  revisiones antes de cada mutación.
- Scope por llamada, sin SQL, filesystem, URL fetch, RPC libre ni nombre de
  función elegido por el modelo.

### Secretos Y Datos

- No registrar tokens, claves InsForge, Canvas/KOReader, Authorization, códigos
  OAuth o secretos PKCE.
- Proteger refresh tokens y credenciales con almacenamiento/cifrado aprobado en
  InsForge; no exponer secretos en bundles frontend.
- Logs mínimos: grant/client/user seudónimos, tool, resultado, latencia y
  correlación; no cuerpos completos ni notas.
- Definir retención, borrado de grants y auditoría mínima. Ofrecer revocación
  individual y global.
- Política CSP/CORS/Origin/Host limita el recurso y reduce DNS rebinding. La
  validación de cliente/metadata previene SSRF; no descargar URLs arbitrarias.

### Operación

- Límite fijo por minuto: 300 solicitudes MCP por IP antes de autenticar y 300
  por grant después de autenticar, 120 llamadas de lectura por grant/tool, 30
  llamadas que mutan por grant/tool, 20 registros DCR por IP y 60 solicitudes
  por IP en cada ruta OAuth. Las direcciones se
  toman del elemento final de `X-Forwarded-For`, que CloudFront agrega al llegar
  a InsForge; solo se persiste un HMAC con la clave server-side. Si falta una
  dirección válida, las solicitudes sin autenticación comparten el bucket
  `unknown-client` para esa ruta.
- Mantener los límites de página, intervalo, caracteres, frecuencia y coste IA.
- Propagar timeout/cancelación. Si una función larga supera límite de runtime,
  usar jobs asíncronos ya soportados por InsForge y un ID consultable.
- Reintentar solo fallos transitorios idempotentes. Nunca repetir create/delete
  sin clave idempotente y control de versión.
- Errores no enumeran usuarios o recursos ajenos. Dependencias se auditan y
  fijan a versión MCP aprobada.

## 9. Errores Y Respuestas

| Código lógico | Uso | Acción |
| --- | --- | --- |
| UNAUTHENTICATED | Token ausente, vencido o revocado | Reconectar desde el cliente |
| INSUFFICIENT_SCOPE | Falta permiso | Reautorizar con scope indicado |
| INVALID_ARGUMENT | Schema, fecha o rango inválido | Corregir argumentos |
| NOT_FOUND | Recurso no disponible para esta cuenta | Volver a consultar |
| CONFLICT | Versión cambió o estado incompatible | Leer versión actual |
| DEPENDENCY_CONFLICT | Borrado bloqueado por referencias | Resolver en Karenda |
| RATE_LIMITED | Límite temporal | Reintentar luego |
| UPSTREAM_UNAVAILABLE | InsForge/Canvas/IA no disponible | Reintentar acción segura |
| INTERNAL | Fallo inesperado | Mostrar correlación, nunca stack |

Las respuestas indican éxito/parcialidad y datos estructurados. El texto español
describe acción, valores relevantes y próxima acción. Sync parcial no aparece
como éxito completo.

## 10. Consentimiento Y Gestión Web

La sección de conexiones reutiliza dirección visual, componentes y patrones
Operate de Karenda:

- pantalla OAuth en español con cliente, scopes individualizados, finalidad,
  duración y Autorizar/Cancelar;
- scopes mínimos y autorización parcial cuando el cliente/runtime lo permite;
- lista de conexiones con cliente, scopes, fecha de alta y último uso, más
  Revocar acceso; botón para revocar todos;
- confirmación de revocación y aviso de pérdida inmediata de acceso;
- estados loading, autorizado, cancelado, expirado, revocado, error y rate
  limit, sin revelar secretos;
- teclado, foco visible, lector de pantalla, contraste y versión móvil; la
  explicación de permisos no queda escondida en texto secundario.

La sección correspondiente de docs/ui-design.md se actualiza antes de cualquier
cambio UI.

## 11. Requisitos Y Criterios De Aceptación

Están planificados y requieren evidencia al implementar.

- **RF-MCP-01 [evento]:** OAuth autentica mediante InsForge, valida PKCE/state y
  pide consentimiento antes del grant.
- **RF-MCP-02 [seguridad]:** Token, audiencia, expiración, grant y scope se
  validan en servidor antes de operar.
- **RF-MCP-03 [privacidad]:** Solicitudes no autorizadas no reciben datos ni
  inician lógica de dominio.
- **RF-MCP-04 [seguridad]:** Identidad deriva del grant; owner_id/user_id
  aportados no cambian el usuario y RLS vuelve a filtrar.
- **RF-MCP-05 [evento]:** Lista/detalle de eventos respeta ownership, filtros,
  intervalos y paginación de spec 001.
- **RF-MCP-06 [evento]:** Crear/editar evento comparte reglas, fechas,
  relaciones y validaciones web.
- **RF-MCP-07 [estado]:** Cambiar estado solo permite transiciones de spec 001
  y devuelve el estado persistido.
- **RF-MCP-08 [seguridad]:** Borrado sin scope, confirmación o ownership se
  rechaza y conserva el evento.
- **RF-MCP-09 [evento]:** Catálogos respetan constraints y dependencias web.
- **RF-MCP-10 [evento]:** Notas respetan target, Markdown, tamaño y ownership.
- **RF-MCP-11 [evento]:** Hábitos conservan frecuencia, meta, asociación y
  ciclo de vida de spec 003.
- **RF-MCP-12 [evento]:** Logs validan estado/valor contra hábito y fecha local.
- **RF-MCP-13 [estado]:** Notas, historia y estadísticas coinciden con la web.
- **RF-MCP-14 [evento]:** Tareas recurrentes conservan frecuencia, ocurrencia,
  pausa, archivo e historial.
- **RF-MCP-15 [seguridad]:** No se elimina una tarea si la web solo permite
  archivarla.
- **RF-MCP-16 [privacidad]:** IA devuelve borrador; solo una tool de guardado
  separada persiste campos revisados.
- **RF-MCP-17 [evento]:** Canvas permite status/sync/revisión dentro de Karenda,
  pero no acepta secreto del modelo ni escribe a Canvas.
- **RF-MCP-18 [seguridad]:** ID o relación de otra cuenta se rechaza sin
  revelar sus datos.
- **RF-MCP-19 [consistencia]:** Versión obsoleta devuelve conflicto sin
  sobrescribir.
- **RF-MCP-20 [consistencia]:** Reintento con misma clave idempotente no crea
  duplicados; argumentos diferentes con esa clave fallan y una operación en
  curso no se ejecuta por segunda vez. La respuesta se conserva 30 días.
- **RF-MCP-21 [estado]:** Token vencido/revocado impide tools y refresh.
- **RF-MCP-22 [evento]:** Revocar en web bloquea el acceso MCP dentro de la
  ventana comprometida y actualiza la lista.
- **RF-MCP-23 [accesibilidad]:** Autorizar/revocar sirve con teclado, lector y
  móvil.
- **RF-MCP-24 [compatibilidad]:** Codex, Claude Code y OpenCode completan login,
  discovery, lectura, escritura y revocación con endpoint común.
- **RF-MCP-25 [transparencia]:** Errores españoles accionables sin stack,
  secretos ni datos ajenos.
- **RF-MCP-26 [operación]:** Límites de rango, tasa, página y tamaño producen
  error seguro y no reducen aislamiento.
- **RF-MCP-27 [transparencia]:** Cuando se solicite contexto de cuenta, Karenda
  devuelve únicamente idioma, zona horaria y hora actual necesarios para
  interpretar fechas conversacionales, sin identificadores internos ni correo.
- **RF-MCP-28 [consentimiento]:** La persona puede seleccionar todos los scopes
  solicitados que aparecen en la pantalla o quitar la selección completa. La
  acción masiva incluye scopes sensibles y solo modifica la selección; el grant
  requiere una acción separada de autorización.

### Criterios De Aceptación Del Proyecto

- **CA-MCP-01:** Spike demuestra transporte, OAuth, consentimiento InsForge y
  SDK/runtime con evidencia reproducible.
- **CA-MCP-02:** Matriz de tres harnesses cubre configuración, OAuth, lectura,
  escritura segura y revocación, sin secretos manuales.
- **CA-MCP-03:** Toda acción de dominio de la web enlaza a tool o exclusión
  justificada.
- **CA-MCP-04:** Pruebas con usuarios A/B cubren todas las familias, IDs y
  relaciones cruzadas.
- **CA-MCP-05:** Tests separan scopes read/write/delete y prueban PKCE, state,
  redirect, audiencia, expiración, rotación y revocación.
- **CA-MCP-06:** Schemas son estrictos e incluyen límites, paginación,
  idempotencia y versión optimista.
- **CA-MCP-07:** IA, Canvas y lecturas no escriben efectos no declarados;
  borradores requieren guardado separado.
- **CA-MCP-08:** Logs, respuestas y bundles no contienen secretos ni datos
  ajenos.
- **CA-MCP-09:** Unitarias, integración, RLS, protocolo, UI, accesibilidad y
  E2E tienen evidencia repetible.
- **CA-MCP-10:** Runbook demuestra despliegue/rollback sin borrado inesperado.
- **CA-MCP-11:** Consentimiento y revocación se entienden y usan en escritorio
  y móvil.
- **CA-MCP-12:** En consentimiento, seleccionar todos marca exactamente los
  permisos visibles solicitados, incluso los sensibles; una selección parcial
  se completa y una selección total se puede quitar. La acción no autoriza por
  sí sola; el grant requiere pulsar `Autorizar Karenda`.

## 12. Verificación De Implementación

Durante la implementación local, los helpers y el SDK se verifican con
`npm run test:mcp`. Al completar el servidor, cada criterio se enlaza a
evidencia en docs/traceability.md:

1. Unitarias: schemas, scopes, fechas, errores, paginación, idempotencia,
   versiones y conversión de dominio.
2. Contrato MCP: initialize, tools/list, tools/call, errores, paginación,
   límites, negociación y Streamable HTTP.
3. OAuth: PKCE, state/CSRF, audiencia, cliente/redirect, emisión, refresh,
   rotación/reutilización, revocación, expiración y scopes parciales.
4. Seguridad/RLS: dos usuarios, IDs ajenos, relaciones cruzadas, owner_id
   inyectado, token de otra audiencia, scope insuficiente, SSRF/Origin, logs,
   tasa y tamaño.
5. Dominio: eventos, catálogos, notas, hábitos, recurrencias, IA draft/save y
   Canvas reutilizan servicios y resultados web.
6. UI: consentimiento, autorización parcial, cancelación, lista, revocación,
   errores, teclado, lector de pantalla y móvil.
7. E2E staging: instalación limpia en tres harnesses; no automatizar ni
   registrar credenciales personales.
8. Preproducción: lint, typecheck, build, dry-run migraciones, auditoría de
   dependencias/secretos, RLS, funciones, E2E y rollback.

## 13. Despliegue Y Rollback

- Lanzamiento progresivo detrás de feature flag server-side para cuentas que
  consientan.
- Migración compatible para clientes/grants/auditoría mínima: RLS,
  constraints, índices, expiración y revocación. Sin lectura pública/runtime
  de credenciales.
- Fijar versión de protocolo/SDK; cambios aditivos primero. Renombrar o quitar
  tools requiere deprecación.
- Desplegar funciones y metadata, aplicar migración compatible, activar flag
  en piloto, observar métricas seguras y ampliar por etapas.
- Rollback desactiva autorizaciones/calls nuevas, conserva datos de dominio y
  mantiene revocaciones. No borra grants/datos por defecto. Revocación masiva
  requiere decisión explícita.
- Runbook de emergencia: apagar endpoint, rotar firma, invalidar tokens,
  investigar fuga y restaurar acceso de forma segura.

## 14. Fases Y Gates

1. **Factibilidad:** inventario web; spike InsForge, OAuth y protocolo; prueba
   con tres harnesses; CIMD/DCR y streaming decididos. Gate: viable dentro de
   InsForge.
2. **Contratos:** schemas, scopes, clientes/grants, auditoría, errores,
   idempotencia; actualización de specs y trazabilidad.
3. **OAuth y conexiones:** consentir, emitir/renovar/revocar; sesión InsForge;
   pantalla española.
4. **Servidor MCP mínimo:** endpoint, metadata, auth guard, descubrimiento,
   logs mínimos y límites; activar primero lectura.
5. **Lectura:** eventos, catálogos, notas, hábitos, recurrentes y Canvas.
6. **Escritura:** CRUD, status, logs, ocurrencias y catálogos con scopes,
   versión, idempotencia y confirmación.
7. **Avanzado:** IA draft/save, Canvas sync/review, trabajos asíncronos si
   InsForge lo requiere.
8. **Seguridad e interoperabilidad:** auditoría, staging, pruebas de tres
   harnesses, piloto, runbook y revisión de expansión.

No se cruza una fase sin su gate. No se comienza la capa de tools hasta que
Fase 0 demuestre que InsForge puede ofrecer OAuth y transporte de forma segura.

## 15. Riesgos Y Decisiones Pendientes

| Riesgo | Mitigación/gate |
| --- | --- |
| InsForge limita paths .well-known, streaming, redirects o duración | Spike aislado y límites documentados antes de código |
| InsForge Auth no es servidor OAuth para MCP | Definir endpoints de grant dentro de InsForge con identidad InsForge; sin reemplazarla |
| SDK MCP incompatible con Deno | Spike SDK oficial, versión fijada y pruebas de interoperabilidad |
| CIMD/DCR/redirects difieren por harness | Matriz versionada; guías por cliente con fallback permitido |
| El modelo repite o interpreta mal escritura | Preview, confirmación, idempotencia, versión optimista y scopes |
| Drift entre web y MCP | Reusar servicios existentes y gatear release por matriz de cobertura |
| Eventos/notas contienen datos personales | Acceso bajo demanda, paginación, scopes y respuestas mínimas |
| Sync/IA son lentos o cobran | Jobs idempotentes, límites y consulta de resultado |
| Grants amplían superficie de ataque | Threat model, RLS, rotación, límites y logging mínimo |

La fase 0 decidirá SDK/runtime, CIMD frente a DCR, duración exacta de tokens,
callback por cliente, límites y el estado de los cambios KOReader/estadísticas
que puedan existir en ramas locales. Reconciliar specs antes de ampliar tools.

## 16. Fuentes Técnicas

- MCP transportes y Streamable HTTP:
  https://modelcontextprotocol.io/specification/2026-07-28/basic/transports
- MCP autorización HTTP/OAuth:
  https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
- Seguridad MCP:
  https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices
- MCP remoto y OAuth en Codex:
  https://developers.openai.com/codex/mcp
- MCP HTTP y OAuth en Claude Code:
  https://code.claude.com/docs/en/mcp
- MCP remoto y OAuth en OpenCode:
  https://opencode.ai/v2/docs/mcp-servers
- InsForge:
  https://docs.insforge.dev/

Las capacidades y versiones de producto son temporales y se verificarán de
nuevo al fijar SDK, runtime y versiones mínimas de los harnesses.
