# Contrato De API: Snapshot De Karenda

Estado: contrato público fijado para el MVP. Las funciones están desplegadas en
el proyecto principal de InsForge. La ruta pública sin credenciales ya responde
con el error de autenticación esperado; la integración autenticada todavía no se
declara funcional hasta completar las pruebas de propietario y snapshot.

## 1. Principios

- Karenda Web/InsForge es la fuente de verdad.
- La red usa una proyección JSON independiente, versionada y en snake_case.
- El Kindle es solo lector en el MVP.
- El token es independiente por dispositivo y no es una sesión de navegador.
- La vinculación inicial usa un código numérico temporal de seis dígitos.
- La URL nunca contiene el token.
- Las respuestas deben ser reproducibles para la misma identidad, ventana,
  zona y versión de contrato mientras los datos no cambien.

## 2. Endpoint Lógico

El endpoint lógico se denomina `karenda-koreader-snapshot`.

```http
GET <functions_base_url>/karenda-koreader-snapshot?from=YYYY-MM-DD&to=YYYY-MM-DD&timezone=America%2FSantiago
```

En el proyecto actual, el SDK de InsForge usa como base de funciones
`https://5zz5dxgt.function2.insforge.app`. La función está desplegada y la ruta
requiere un token de dispositivo válido. El fallback técnico
`/functions/karenda-koreader-snapshot` sobre la API base no se usa en este
contrato.

### Método Y Parámetros

| Parámetro | Tipo | Requerido en la petición del plugin | Semántica |
| --- | --- | --- | --- |
| `from` | `YYYY-MM-DD` | Sí, aunque el servidor podrá aplicar el valor por defecto si falta | Inicio inclusivo de la ventana local |
| `to` | `YYYY-MM-DD` | Sí, aunque el servidor podrá aplicar el valor por defecto si falta | Fin exclusivo de la ventana local |
| `timezone` | IANA | Sí, aunque el servidor podrá aplicar `America/Santiago` si falta | Zona solicitada para presentar instantes |

El plugin deberá enviar siempre los tres parámetros después de resolver su
configuración. Si no hay configuración de ventana, calculará `from` como hoy
menos 7 días y `to` como hoy más 180 días usando la zona configurada.

El servidor deberá validar que `from < to`, que `timezone` sea válida y que la
ventana solicitada pueda producir un snapshot de como máximo `1 MiB` de JSON
UTF-8 sin comprimir. Una ventana o conjunto de notas que supere ese límite
deberá producir un error explícito, nunca un recorte silencioso.

### Encabezados

Petición mínima:

```http
Accept: application/json
Authorization: Bearer <device_token>
```

Petición revalidada:

```http
Accept: application/json
Authorization: Bearer <device_token>
If-None-Match: "opaque-etag"
```

La API deberá exigir HTTPS. `device_token` no deberá aparecer en la URL, en
`Referer`, en mensajes, en logs ni en el cuerpo JSON.

## 3. Autenticación De Dispositivo

### Emparejamiento Inicial

La web autenticada solicitará un código de emparejamiento para una etiqueta de
dispositivo:

```http
POST <functions_base_url>/karenda-koreader-device-tokens
Authorization: Bearer <web_access_token>
Content-Type: application/json

{"action":"create_pairing","label":"Kindle de estudio"}
```

La respuesta será:

```json
{
  "pairing_code": "042731",
  "expires_at": "2026-08-30T23:10:00.000Z",
  "message": "El código vence en 10 minutos y solo puede usarse una vez."
}
```

El código tendrá exactamente seis dígitos, vencerá a los 10 minutos, no se
guardará en el plugin y se consumirá de forma atómica. El endpoint limitará los
intentos de canje a 12 por minuto por origen. El backend almacenará únicamente
un HMAC-SHA-256 del código usando un secreto server-only; nunca persistirá el
código en claro.

El plugin canjeará el código sin una sesión web:

```http
POST <functions_base_url>/karenda-koreader-device-tokens
Content-Type: application/json

{"action":"pair","code":"042731"}
```

El canje devolverá el token opaco una sola vez. El plugin lo guardará localmente
como credencial de sincronización y no mostrará ni registrará su valor.

El token será una cadena opaca de alta entropía creada por Karenda Web. El
backend deberá almacenar únicamente una representación no reversible o hash
verificable, además de metadata no secreta:

- `token_id`;
- `owner_id`;
- etiqueta opcional del dispositivo;
- scopes;
- `created_at`;
- `last_used_at` opcional;
- `revoked_at` opcional;
- expiración opcional si se decide habilitarla.

El texto completo del token se entregará una sola vez al crear o regenerar el
token. La web no deberá volver a mostrarlo desde un listado. El Kindle lo
recibirá mediante copia manual y lo enviará como Bearer.

El scope requerido para este contrato es `read:snapshot`. Se reserva
`write:events` para una futura versión; tenerlo en metadata no autoriza ninguna
operación de escritura del MVP.

### Operaciones Web Propuestas

La gestión web usa la función Edge lógica
`karenda-koreader-device-tokens`. Requiere el Bearer de la sesión web, no el
token del Kindle, y se invoca siempre mediante InsForge:

```text
GET  <functions_base_url>/karenda-koreader-device-tokens
POST <functions_base_url>/karenda-koreader-device-tokens
```

El POST recibe un body con `action` igual a `create`, `revoke` o `regenerate`.
`create` recibe `label` y `scopes`; `create_pairing` recibe `label`; `pair` recibe
el código de seis dígitos sin sesión web; las otras operaciones reciben
`token_id` y, para regenerar, pueden recibir una nueva etiqueta o scopes. La
creación directa y regeneración devuelven el secreto una sola vez junto con
`token_metadata`; `create_pairing` devuelve solo el código temporal.
`GET` devuelve solo metadata y como máximo 100 dispositivos. Revocar invalida
el token inmediatamente; regenerar revoca el anterior y crea el nuevo de forma
atómica mediante el RPC protegido `rotate_device_token`.

La tabla `public.device_tokens` almacena únicamente el hash SHA-256. El RPC de
rotación solo admite sesiones `authenticated`; las funciones Edge usan la API
administrativa server-only para las operaciones que no exponen la tabla.

### Respuestas De Auth

- `401 Unauthorized`: token ausente, mal formado, inválido, expirado o revocado.
- `401 Unauthorized` con `PAIRING_CODE_INVALID`: código ausente, inválido,
  vencido o ya consumido.
- `403 Forbidden`: token válido pero sin `read:snapshot`.
- `429 Too Many Requests` con `RATE_LIMITED`: se superó el límite de intentos de
  emparejamiento.

Ambas respuestas deberán omitir el token y no distinguir innecesariamente entre
motivos que ayuden a probar secretos. La UI podrá mostrar mensajes españoles
genéricos, por ejemplo `El token de dispositivo no es válido o fue revocado.`.

## 4. Respuesta `200 OK`

Encabezados mínimos:

```http
Content-Type: application/json
ETag: "opaque-etag"
Cache-Control: private, no-cache
```

Body canónico:

```json
{
  "schema_version": 1,
  "snapshot_id": "opaque-snapshot-id",
  "generated_at": "2026-08-30T23:00:00.000Z",
  "timezone": "America/Santiago",
  "window": {
    "from": "2026-08-23",
    "to": "2027-02-26"
  },
  "subjects": [],
  "personal_groups": [],
  "events": [],
  "notes": []
}
```

### Campos Del Sobre

| Campo | Tipo | Regla |
| --- | --- | --- |
| `schema_version` | entero | Versión mayor del contrato; el MVP usa `1` |
| `snapshot_id` | string opaco | Identifica la representación completa; no contiene el token |
| `generated_at` | RFC 3339 | Instante inequívoco en UTC u offset explícito |
| `timezone` | IANA | Zona solicitada y usada para presentar instantes |
| `window.from` | fecha | Inicio inclusivo enviado al servidor |
| `window.to` | fecha | Fin exclusivo enviado al servidor |
| `subjects` | array | Catálogo referenciado por eventos o notas |
| `personal_groups` | array | Catálogo referenciado por eventos o notas |
| `events` | array | Eventos que comienzan o atraviesan la ventana |
| `notes` | array | Todas las notas del propietario del token, sin filtro temporal |

La respuesta no incluirá `owner_id`, datos de otra cuenta ni campos visuales de
React. Los identificadores serán los UUID estables del dominio, pero el
consumidor no dependerá de que el backend mantenga los nombres de tablas.

### Proyección `subjects`

```json
{
  "id": "uuid",
  "name": "Análisis de Datos",
  "code": "DAA",
  "abbreviation": "DAA",
  "color": "#2F625A",
  "updated_at": "2026-08-30T20:00:00.000Z"
}
```

### Proyección `personal_groups`

```json
{
  "id": "uuid",
  "name": "Doctor",
  "color": "#2F625A",
  "updated_at": "2026-08-30T20:00:00.000Z"
}
```

### Proyección `events`

```json
{
  "id": "uuid",
  "kind": "academic",
  "title": "Control 3",
  "subject_id": "uuid",
  "personal_group_id": null,
  "start_at": "2026-09-04T09:00:00-04:00",
  "end_at": "2026-09-04T11:00:00-04:00",
  "all_day": false,
  "status": "pending",
  "location": "Sala 204",
  "description": "Temario del control",
  "updated_at": "2026-08-30T20:00:00.000Z"
}
```

Reglas:

- `kind` es `academic` o `personal`.
- `status` es `pending` o `completed`.
- `subject_id` es obligatorio para `academic` y nulo para `personal`.
- `personal_group_id` puede ser nulo en eventos personales.
- `start_at` y `end_at` de eventos con hora son RFC 3339 inequívocos. La
  proyección los expresará con el offset vigente en `timezone`, sin cambiar el
  instante representado, para que el cliente pueda mostrar la hora civil sin
  depender de la configuración horaria del dispositivo.
- Cuando `all_day` es `true`, `start_at` y `end_at` son fechas locales
  `YYYY-MM-DD`; `end_at` es inclusivo.
- `location` y `description` pueden ser `null`.
- Los eventos que atraviesan la ventana se incluyen aunque comiencen antes de
  `window.from`.

### Proyección `notes`

```json
{
  "id": "uuid",
  "target_type": "subject",
  "target_id": "uuid",
  "title": "Repaso",
  "content_markdown": "# Unidad 1\n\nContenido de la nota.",
  "updated_at": "2026-08-30T20:00:00.000Z"
}
```

Reglas:

- `target_type` es `subject` o `personal_group`.
- `target_id` debe resolverse dentro del mismo snapshot.
- `content_markdown` conserva el Markdown original y no es HTML ejecutable.
- Las notas se incluyen independientemente de `window.from` y `window.to`.

## 5. ETag Y `304 Not Modified`

El ETag deberá representar, para el propietario, la versión de schema, la
ventana, la zona y el contenido estable actual. No deberá derivarse de un token
en claro ni incluir información secreta. `generated_at` no formará parte del
material que se hashea: si cambia únicamente ese metadato, el ETag deberá
permanecer igual.

Para que la revalidación sea coherente, el backend deberá tratar
`generated_at` como metadata del snapshot estable mientras el contenido no
cambie, o responder 304 cuando el único cambio sea ese campo.

Si `If-None-Match` coincide con la representación vigente, la API responderá:

```http
HTTP/1.1 304 Not Modified
ETag: "opaque-etag"
```

La respuesta 304 no tendrá body. El cliente conservará el snapshot, su
`snapshot_id` y su contenido de notas. Si cambia cualquiera de los datos,
ventana, zona efectiva o `schema_version`, la API devolverá 200 con un ETag
nuevo.

## 6. Errores

Envelope propuesto, sin secretos:

```json
{
  "error_code": "SNAPSHOT_TOO_LARGE",
  "message": "El snapshot supera el límite permitido de 1 MiB."
}
```

| HTTP | `error_code` | Semántica |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | Fechas, zona, versión o rango inválidos |
| 401 | `UNAUTHORIZED` | Token ausente, inválido, expirado o revocado |
| 403 | `INSUFFICIENT_SCOPE` | Falta `read:snapshot` |
| 413 | `SNAPSHOT_TOO_LARGE` | El JSON UTF-8 sin comprimir supera `1048576` bytes |
| 429 | `RATE_LIMITED` | Se superó el límite de peticiones |
| 500/502/503 | `BACKEND_UNAVAILABLE` | Error de backend sin datos parciales |
| 500 | `INVALID_SNAPSHOT` | El backend no pudo construir una respuesta válida |

El límite de tamaño es `1 MiB` (`1048576` bytes) de JSON UTF-8 sin comprimir.
Un 413 será explícito y terminal para esa petición; el plugin no deberá recortar
notas ni marcar una respuesta parcial como snapshot válido. La paginación queda
fuera del MVP y requiere una especificación futura independiente.

## 7. Estado Actual Del Backend

La inspección de InsForge y la implementación desplegada confirman:

- la función Edge `karenda-koreader-snapshot` está activa en el proyecto principal;
- la función Edge `karenda-koreader-device-tokens` gestiona metadata y secretos;
- la tabla de tokens y el RPC de rotación existen en el proyecto principal;
- ETag, 304 y el límite 1 MiB están implementados en código, pendientes de
  pruebas autenticadas de integración;
- las tablas actuales usan RLS por `owner_id` y borrado físico;
- las solicitudes sin credenciales a ambas funciones devuelven `401` sin revelar
  secretos.

Este contrato no declara sincronización funcional hasta probar la ruta real con
un token válido, 200/304/401/403/413 y aislamiento entre propietarios.
