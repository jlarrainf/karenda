# Ingesta Futura De Registros De Hábitos Desde KOReader

Estado: contrato futuro documentado; no implementado en esta fase.

## 1. Objetivo Y Alcance

Esta spec define cómo una instalación autorizada de KOReader podrá enviar
mediciones a un hábito de Karenda. No añade todavía funciones, permisos,
endpoints ni cambios al plugin existente.

El alcance futuro incluye:

- vincular explícitamente una métrica de lectura con un hábito;
- autenticar la escritura con un scope separado de la lectura del snapshot;
- validar propietario, fecha civil, zona horaria y valor;
- aceptar reintentos idempotentes mediante `external_id`;
- mantener la agregación y las estadísticas en Karenda Web.

Quedan fuera la creación automática de hábitos, el envío de notas, las
notificaciones, la escritura en el snapshot v1 y cualquier vinculación
implícita basada solo en el nombre del hábito.

## 2. Historias De Usuario

- **HU-K-01:** Como usuario, quiero vincular una métrica de KOReader con un
  hábito concreto y revisar esa vinculación antes de habilitar escrituras.
- **HU-K-02:** Como dispositivo autorizado, quiero enviar una medición con una
  fecha local estable para que Karenda la evalúe sin desplazamientos de zona.
- **HU-K-03:** Como cliente que reintenta una solicitud, quiero que el mismo
  `external_id` no cree registros duplicados.
- **HU-K-04:** Como usuario, quiero revocar el permiso de escritura sin perder
  los registros ya importados.

## 3. Contrato De Vinculación

La vinculación futura deberá ser una entidad propia, asociada a un propietario,
un dispositivo y un hábito. Como mínimo conservará:

- `id`, `owner_id`, `habit_id` y `device_token_id`;
- `metric_key`, por ejemplo `reading_minutes` o `pages_read`;
- `source_unit`, para documentar la unidad enviada por KOReader;
- `timezone`, con un identificador IANA explícito;
- `status`: `active`, `paused` o `revoked`;
- `created_at`, `updated_at` y `revoked_at` opcional.

Una vinculación solo podrá activarse si el hábito pertenece al mismo
`owner_id`, el tipo de seguimiento admite el valor y la unidad está definida.
Revocar una vinculación no deberá eliminar el hábito ni sus logs históricos.

## 4. Escritura Futura

La escritura usará un scope independiente, `write:habit_logs`, y nunca deberá
aceptarse con un token que solo tenga `read:snapshot` o `write:events`.

El payload lógico de una medición será:

```json
{
  "link_id": "uuid",
  "local_date": "YYYY-MM-DD",
  "value": 42,
  "external_id": "koreader-device-event-id",
  "timezone": "America/Santiago"
}
```

El servidor resolverá el `habit_id` mediante la vinculación autorizada y
persistirá un `HabitLog` con `source = "koreader"`. No se aceptará que el
cliente elija `owner_id`, cambie el propietario del hábito o escriba un estado
fuera de la política de evaluación del hábito.

## 5. Validación E Idempotencia

- `local_date` deberá ser una fecha civil válida y se interpretará en la zona
  horaria de la vinculación, sin convertirla primero a UTC.
- `timezone` deberá coincidir con la configuración autorizada o la solicitud
  deberá rechazarse; no se inferirá silenciosamente desde el servidor.
- `value` deberá ser finito, no negativo y compatible con `count` o `duration`.
- Los hábitos booleanos no recibirán métricas cuantitativas.
- `external_id` será obligatorio para toda medición importada.
- La unicidad será `(owner_id, source, external_id)`.
- Repetir una solicitud con el mismo identificador y el mismo contenido deberá
  devolver el log existente sin duplicarlo.
- Repetirlo con contenido diferente deberá devolver un conflicto y no modificar
  el registro original.

La agregación de varias mediciones del mismo periodo seguirá siendo una
responsabilidad del evaluador de Karenda Web; KOReader solo enviará mediciones
atómicas y no calculará rachas ni porcentajes.

## 6. Seguridad Y Respuesta

El flujo futuro deberá comprobar, en este orden:

1. token válido, no revocado y con `write:habit_logs`;
2. vinculación activa perteneciente al propietario del token;
3. hábito perteneciente al mismo propietario;
4. fecha, zona, unidad, valor e `external_id` válidos;
5. inserción idempotente dentro de una transacción.

Las respuestas no deberán revelar si un hábito de otra cuenta existe. La
revocación deberá invalidar nuevas escrituras, pero no alterar los datos
históricos. Los errores deberán ser estables y no incluir secretos ni tokens.

## 7. Compatibilidad Y Migración

- `read:snapshot` seguirá siendo de solo lectura y el snapshot v1 no cambiará.
- `write:events` no adquirirá permisos sobre hábitos.
- `HabitLog.source` y `external_id` actuales ya preparan la persistencia para
  reintentos; la vinculación será el control adicional de autorización.
- La primera versión deberá desplegar tablas, políticas RLS, función de
  ingesta y pruebas antes de cambiar el plugin.
- La activación deberá ser gradual: vinculación creada, prueba de escritura,
  observación de duplicados y recién después uso continuo.

## 8. Criterios De Aceptación Futuros

- **CA-K-01:** Una cuenta solo puede vincular sus hábitos con sus dispositivos.
- **CA-K-02:** Un token sin `write:habit_logs` no puede crear ni modificar logs
  de hábitos.
- **CA-K-03:** Una fecha civil enviada con una zona autorizada conserva el día
  esperado en Karenda.
- **CA-K-04:** Reintentar el mismo `external_id` no crea duplicados y cambiar su
  contenido devuelve conflicto.
- **CA-K-05:** Revocar la vinculación bloquea nuevas escrituras y conserva el
  historial.
- **CA-K-06:** El snapshot v1, `write:events` y el plugin no cambian hasta que
  exista una versión aprobada de esta spec y sus pruebas de integración.

## 9. Verificación Requerida

Antes de implementar este contrato deberán existir pruebas unitarias de
validación e idempotencia, pruebas RLS con dos cuentas, pruebas de integración
de la función y una prueba controlada desde KOReader. Esta spec no autoriza
ninguna de esas escrituras todavía.
