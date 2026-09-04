# Creación Asistida De Eventos Con IA

## 1. Contexto Y Alcance

La aplicación ofrecerá una acción opcional para describir uno o más eventos
en lenguaje natural. Una función de InsForge enviará el prompt a OpenRouter,
interpretará la respuesta en un contrato estructurado y devolverá borradores
para que la persona los revise antes de guardarlos.

La IA no reemplaza el formulario manual ni guarda eventos por sí sola. El modo
rápido intenta preparar los borradores directamente. El modo guiado puede
devolver preguntas serializables cuando una relación académica o personal no es
clara; las respuestas se envían a una segunda generación para mejorar la
precisión. Una asignatura o grupo personal nuevo solo puede crearse mediante
los servicios de dominio existentes después de una confirmación explícita de la
persona.

## 2. Historias De Usuario

- **HU-IA-01:** Como estudiante, quiero escribir varios compromisos en un solo
  prompt para recibir borradores de eventos sin completar cada formulario desde
  cero.
- **HU-IA-02:** Como estudiante, quiero revisar y corregir los borradores antes
  de guardarlos para no depender de una interpretación automática ciega.
- **HU-IA-03:** Como estudiante, quiero que los eventos asistidos usen mis
  asignaturas y grupos existentes, o propongan una asignatura o grupo personal
  nuevo cuando no exista uno adecuado, sin exponer la clave de OpenRouter al
  navegador.
- **HU-IA-04:** Como estudiante, quiero elegir entre una creación rápida y una
  creación guiada que me pregunte por las relaciones ambiguas, incluyendo una
  alternativa `Otro` para escribir mi propia respuesta.

## 3. Requisitos Funcionales

### Contrato De Borrador

Cada borrador conserva el contrato de evento existente, con `subject_id` y
`personal_group_id` como identificadores de catálogo. Durante la revisión,
`subject_id` puede ser nulo para indicar una relación que falta; el guardado
debe bloquearse hasta corregir un evento académico incompleto.

La respuesta incluye `review_flags`, cuyos valores permitidos son:
`missing_subject`, `unknown_subject`, `unknown_personal_group`, `missing_time`,
`ambiguous_date`, `guessed_date`, `uncertain_duration`, `invalid_status` y
`new_personal_group`. La interfaz traduce estos indicadores a mensajes
españoles estables y no presenta como certeza una inferencia marcada para
revisión.

Un borrador académico puede incluir `new_subject_name` y un borrador personal
puede incluir `new_personal_group_name` cuando no se pueda asociar a un registro
existente. El nombre se muestra como una propuesta; solo la confirmación de
guardado puede crear cada registro, una sola vez, y asociar los borradores que
lo utilicen. La creación asistida de una asignatura usa el nombre propuesto y
valores derivados para código y abreviación, que la persona podrá editar luego
desde el catálogo.

El modo guiado devuelve como máximo cinco preguntas. Cada pregunta tiene un
identificador estable, texto en español, opciones con identificadores estables,
`allows_other` y `optional`. Cada respuesta conserva `question_id`, `option_id`,
`other_text` y `no_preference`; el contrato no depende de componentes web para
permitir su consumo futuro desde Android o KOReader.

### Requisitos

- **RF-IA-01 [EARS: estado]:** Mientras no exista una sesión válida, la
  función de generación deberá rechazar la solicitud y no deberá llamar a
  OpenRouter.
- **RF-IA-02 [EARS: evento]:** Cuando una persona autenticada envíe un prompt,
  el sistema deberá aceptar texto entre 1 y 4000 caracteres, junto con la fecha
  local de referencia y la zona horaria del navegador.
- **RF-IA-03 [EARS: evento]:** Al procesar un prompt, la función deberá cargar
  desde InsForge únicamente las asignaturas y grupos de la cuenta autenticada;
  no deberá confiar en identificadores de catálogo enviados por el navegador.
- **RF-IA-04 [EARS: condición no deseada]:** Si el modelo principal falla,
  responde con error HTTP o devuelve JSON inválido, la función deberá intentar
  secuencialmente `minimax/minimax-m3:free`,
  `poolside/laguna-s-2.1:free` y
  `nvidia/nemotron-3.5-lightning:free`, sin exponer detalles del proveedor.
- **RF-IA-05 [EARS: evento]:** La función deberá devolver como máximo 20
  borradores, con fechas locales explícitas, relaciones de catálogo válidas,
  estado, duración y `review_flags` validados antes de responder.
- **RF-IA-05.1 [EARS: evento]:** Cuando la solicitud use `mode: guided` sin
  respuestas y exista una relación ambigua, la función deberá devolver
  preguntas serializables en lugar de borradores; al recibir respuestas deberá
  devolver los borradores finales con las relaciones y propuestas
  correspondientes. Si no hay ambigüedad, podrá devolver directamente los
  borradores.
- **RF-IA-06 [EARS: evento]:** El sistema deberá mostrar los borradores en una
  vista previa y deberá permitir editar título, relación, fechas, horas,
  duración, estado, lugar y descripción, o quitar un borrador. Para un evento
  académico o personal sin coincidencia, deberá mostrar también el nombre del
  registro nuevo propuesto.
- **RF-IA-07 [EARS: evento]:** Cuando la persona confirme el guardado, el
  sistema deberá validar todos los borradores antes de persistir el primero y
  deberá crear primero cada asignatura o grupo personal nuevo confirmado y
  luego usar los servicios de catálogo y eventos existentes para conservar las
  reglas de propiedad y referencias. El mismo nombre propuesto no deberá crear
  registros duplicados dentro de una operación.
- **RF-IA-08 [EARS: condición no deseada]:** Si falta una asignatura académica,
  una fecha, una hora requerida o un rango válido, el sistema deberá bloquear
  la confirmación y explicar la corrección en español.
- **RF-IA-09 [EARS: condición no deseada]:** Si falla el guardado de uno o más
  eventos, el sistema no deberá mostrar éxito total falso y deberá informar
  cuántos eventos se guardaron cuando exista un resultado parcial.
- **RF-IA-10 [EARS: seguridad]:** La clave de OpenRouter deberá existir solo en
  el entorno server-side de InsForge; no deberá estar en código cliente,
  variables `VITE_*`, respuestas, prompts, mensajes o logs.
- **RF-IA-11 [EARS: privacidad]:** La función no deberá persistir el prompt,
  el catálogo enviado al modelo ni la respuesta de generación.
- **RF-IA-12 [EARS: evento]:** Si el usuario confirma un borrador personal con
  `new_personal_group_name`, el sistema deberá crear ese grupo con color nulo y
  asociar el evento al grupo recién creado; si el usuario elige un grupo
  existente durante la revisión, no deberá crear uno nuevo.
- **RF-IA-13 [EARS: evento]:** Si la persona confirma un borrador académico con
  `new_subject_name`, el sistema deberá crear una asignatura con ese nombre,
  código y abreviación derivados, color de catálogo predeterminado y asociar el
  evento a la asignatura recién creada; si elige una asignatura existente, no
  deberá crear una nueva.

## 4. Contrato HTTP De La Función

Slug: `karenda-ai-event-drafts`.

### Solicitud

`POST /functions/karenda-ai-event-drafts` con la sesión de InsForge en
`Authorization: Bearer <access-token>`:

```json
{
  "prompt": "El viernes tengo un control de cálculo a las 10:00...",
  "time_zone": "America/Santiago",
  "reference_date": "2026-09-01",
  "mode": "quick",
  "answers": []
}
```

En `mode: guided`, una solicitud sin respuestas devuelve:

```json
{
  "questions": [
    {
      "id": "academic_subject",
      "question": "¿A qué asignatura pertenece el control?",
      "options": [
        { "id": "subject:uuid-del-catalogo", "label": "Cálculo" },
        { "id": "create_subject:calculo", "label": "Crear asignatura «Cálculo»" }
      ],
      "allows_other": true,
      "optional": false
    }
  ]
}
```

Las respuestas se envían como `answers: [{ "question_id":
"academic_subject", "option_id": "create_subject:calculo", "other_text":
null, "no_preference": false }]`. `option_id` no autoriza por sí solo a
escribir: el servidor vuelve a validar las relaciones y la creación queda
pendiente de la confirmación final.

### Respuesta Correcta

```json
{
  "events": [
    {
      "kind": "academic",
      "title": "Control de Cálculo",
      "subject_id": "uuid-del-catalogo",
      "personal_group_id": null,
      "start_at": "2026-09-04T10:00",
      "end_at": null,
      "is_all_day": false,
      "status": "pending",
      "location": null,
      "description": null,
      "new_subject_name": null,
      "new_personal_group_name": null,
      "review_flags": []
    }
  ]
}
```

Los eventos con `is_all_day: true` usan `YYYY-MM-DD` en `start_at` y
`end_at`. Los eventos con hora usan `YYYY-MM-DDTHH:mm` en la zona indicada.
No se convierten a UTC hasta que el servicio de dominio persiste el evento.

La función puede normalizar una referencia textual de asignatura o grupo cuando
el modelo devuelva el nombre, código o abreviación en lugar del UUID exacto,
siempre que la coincidencia sea única dentro del catálogo autenticado. Si no
hay coincidencia única, conserva el evento para revisión y puede convertir la
referencia textual en `new_subject_name` o `new_personal_group_name`. También
normaliza segundos superfluos en fechas locales sin cambiar la zona horaria.
La extracción debe expandir abreviaturas académicas inequívocas como `I3` o
`I-3` a títulos reconocibles como `Interrogación 3`, y reutilizar la misma
asignatura cuando varios eventos del prompt mencionen el mismo ramo. Para
tolerar variaciones de los modelos, el servidor puede completar campos
derivables, como `kind` académico desde una asignatura, fechas desde `date` y
horas desde `time`, y descartar un `end_at` igual al inicio en un evento de
todo el día; el contrato que devuelve al navegador siempre queda normalizado.

### Errores

Los errores devuelven `{ "error_code": "...", "message": "..." }` con un
status HTTP apropiado. Los mensajes públicos son españoles y no incluyen la
clave, el prompt completo, la respuesta del modelo ni detalles internos del
proveedor.

## 5. Requisitos No Funcionales

- **RNF-IA-01:** OpenRouter solo se llamará desde una función de InsForge; el
  navegador solo invocará la función mediante `insforge.functions.invoke`.
- **RNF-IA-02:** La función limitará prompt, cantidad de eventos, longitud de
  campos, tokens de salida y tiempo de espera por modelo.
- **RNF-IA-03:** La salida se validará en servidor y nuevamente antes de
  persistir; el modelo nunca tendrá autoridad para insertar registros.
- **RNF-IA-04:** La experiencia mantendrá los estados inicial, carga, respuesta,
  revisión, guardado, éxito parcial, error de sesión, error de catálogo, error
  de modelo y vacío, todos con copy en español.

## 6. Fuera Del Alcance

- Conversación abierta o historial de chats. La creación de una asignatura o
  grupo personal propuesto sí forma parte del guardado confirmado descrito en
  RF-IA-07, RF-IA-12 y RF-IA-13; no incluye edición de registros existentes.
- Recurrencias, recordatorios, invitaciones o búsqueda web automática.
- Guardado automático de borradores o modificación de eventos existentes.

## 7. Criterios De Aceptación

- **CA-IA-01:** Un prompt que describe varios compromisos produce una vista
  previa con un borrador por evento reconocible y no modifica InsForge.
- **CA-IA-02:** La relación académica o personal solo puede apuntar a un
  registro presente en el catálogo de la cuenta autenticada, salvo una
  propuesta explícita de `new_subject_name` o `new_personal_group_name` que
  todavía no se ha guardado.
- **CA-IA-03:** Una respuesta inválida del modelo activa el siguiente fallback;
  si todos fallan, la UI muestra un error español sin detalles sensibles.
- **CA-IA-04:** La persona puede editar o quitar borradores y puede corregir
  una fecha, hora, estado o relación antes de guardar.
- **CA-IA-05:** La confirmación valida el conjunto completo; los borradores
  incompletos no se guardan y muestran la corrección necesaria.
- **CA-IA-06:** Un guardado total muestra la cantidad creada; un guardado
  total muestra la cantidad de eventos y grupos creados; un guardado parcial
  nunca se presenta como éxito total.
- **CA-IA-07:** La clave de OpenRouter no aparece en el bundle, código fuente
  cliente, contrato HTTP, mensajes ni logs del navegador.
- **CA-IA-08:** Tests, typecheck, lint y build pasan; esta spec, la dirección
  UI/UX y la matriz de trazabilidad describen el comportamiento implementado.
- **CA-IA-09:** El modo guiado muestra preguntas de relación, permite elegir una
  alternativa existente, crear la propuesta sugerida o responder `Otro`, y la
  segunda generación recibe las respuestas con el contrato estable.
