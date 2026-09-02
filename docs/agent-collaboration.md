# Protocolo De Colaboración De Agentes

Este protocolo aplica cuando dos o más sesiones de ChatGPT, agentes o personas
trabajan sobre Karenda. Complementa `AGENTS.md` y
`docs/git-workflow.md`; no cambia la constitución ni autoriza operaciones
destructivas por sí solo.

## 1. Regla Principal

Una carpeta de trabajo Git tiene un único índice, un único árbol de archivos,
un único contexto local de InsForge en `.insforge/project.json` y un entorno
local en `.env.local`. Por eso:

- En la misma carpeta puede haber varios agentes leyendo e inspeccionando.
- Solo un agente puede escribir archivos, cambiar de rama, preparar cambios,
  hacer commit, ejecutar merges o cambiar el backend enlazado.
- Si dos agentes necesitan escribir a la vez, cada uno debe usar un worktree
  distinto. No se resuelve la concurrencia con `stash`, `reset`, `clean` o
  cambios repetidos de rama.

La coordinación debe proteger también los cambios que todavía no tienen
commit. Todo archivo modificado al inicio pertenece a su autor hasta que este
confirme lo contrario.

## 2. Protocolo Para Una Carpeta Compartida

Antes de editar, el agente escritor debe:

1. Leer `AGENTS.md`, `docs/constitution.md`, `docs/git-workflow.md`, esta guía
   y la spec relacionada.
2. Ejecutar la inspección Git obligatoria y comprobar si existe un lock local.
3. Declarar mentalmente o en la conversación su alcance, archivos permitidos,
   rama Git y, si corresponde, rama/proyecto InsForge.
4. Crear exclusivamente el lock `.git/karenda-agent.lock` si no existe. El
   contenido debe registrar sesión, alcance, rama, PID y hora de inicio. La
   creación debe ser exclusiva: si falla porque el archivo existe, el agente
   no edita ni cambia contexto.
5. Volver a comprobar `git status --short` justo antes de editar y antes de
   preparar un commit.

En PowerShell, la creación exclusiva puede hacerse así; después de ganar el
lock se escribe dentro la metadata de la sesión:

```powershell
$lockPath = Join-Path (git rev-parse --git-dir) 'karenda-agent.lock'
New-Item -ItemType File -Path $lockPath -ErrorAction Stop
```

Si `New-Item` falla porque el archivo ya existe, se trata como una carpeta
bloqueada y no se modifica ni se cambia de rama.

El lock no reemplaza la comunicación. Si ya existe, el segundo agente debe
trabajar en modo lectura o pedir al primer agente que libere la carpeta. Nunca
debe borrar un lock ajeno automáticamente. Para un lock aparentemente huérfano
se comprueba primero el PID, la sesión y la hora; solo la persona responsable
puede autorizar su retiro.

Mientras el lock pertenece a otro agente, quedan prohibidos en esa carpeta:

- `git switch`, `git merge`, `git pull`, `git rebase`, `git stash`, `git reset`,
  `git clean`, `git checkout --` y cualquier `push`.
- `git add --all` o cualquier operación que prepare archivos que el agente no
  revisó explícitamente.
- `branch switch`, `branch reset`, `branch merge`, `db migrations`,
  `config apply`, despliegues y cambios de secretos de InsForge.
- Cambiar `.env.local`, `.insforge/project.json` o iniciar un servidor con un
  backend distinto al que usa el agente escritor.

El agente escritor debe trabajar con una lista de archivos permitidos y usar
`git add <archivo>` para preparar solo sus cambios. Si aparece un archivo
modificado que no reconoce, detiene el commit, conserva el archivo y lo
comunica.

Al terminar, el agente escritor ejecuta las verificaciones, comprueba que el
árbol quedó en el estado esperado y libera el lock. Si deja cambios sin commit,
debe informar sus rutas y no permitir que otro agente los incluya por accidente.

## 3. Worktrees Para Concurrencia Real

La opción recomendada para dos agentes escritores es un worktree por tarea:

```text
git fetch --prune origin
git worktree add ..\karenda-wt-<short-name> -b feature/<spec>-<short-name> origin/main
```

Si todavía no existe `origin`, se usa el commit local de `main` solo cuando la
persona responsable lo haya confirmado. Cada worktree debe tener su propio
`.env.local` creado desde el gestor de secretos o copiado de forma segura; no
se comparte ni se versiona su contenido.

Cada worktree mantiene su propio `.insforge/project.json`, servidor local y
contexto de prueba. Aun así, dos agentes no deben mutar el mismo proyecto o
rama de InsForge simultáneamente: los worktrees aíslan Git, pero no crean una
base de datos aislada si ambos apuntan al mismo backend.

Al cerrar una tarea se verifica que el worktree no tenga cambios pendientes y
se elimina solo después de confirmar que la rama no es base de otra tarea:

```text
git worktree list
git worktree remove ..\karenda-wt-<short-name>
```

`git worktree remove` no se usa para esconder cambios. Si el worktree está
sucio, se detiene y se entrega primero su estado.

## 4. Relación Entre Git, GitHub E InsForge

Una rama Git y una rama InsForge son recursos diferentes y deben registrarse
juntas en el plan o Pull Request:

| Git | InsForge | Uso |
| --- | --- | --- |
| `main` | Proyecto principal `karenda` | Producción |
| `feature/<spec>-<short-name>` | `karenda-<short-name>` | Desarrollo y validación aislada |
| `fix/<spec>-<short-name>` | Rama existente coincidente o rama temporal | Corrección backend aislada |

No se crea una rama InsForge por cada sesión ni se reutiliza una rama para dos
objetivos no relacionados. Antes de crearla se consulta `branch list`; con el
límite de dos ramas activas por proyecto se reutiliza una rama coincidente o se
termina y audita una rama ya fusionada. No se elimina una rama con trabajo
pendiente para liberar cupo.

La rama InsForge no es una copia de seguridad. El merge no copia filas de
tablas de usuario y el reset elimina el estado de esa rama desde su T0. Antes
de DDL destructivo, cambios de autenticación o RLS se necesita un backup
disponible; si la cuota de backups está llena y la operación no es reversible,
se detiene y se pide una decisión.

## 5. Flujo Seguro Para Cambios De Backend

Cuando una tarea toca migraciones, RLS, funciones, configuración o datos de
backend:

1. Crear o reutilizar una rama InsForge desde el proyecto principal actual y
   registrar su nombre, ID y propósito. Usar `schema-only` para validaciones
   sintéticas y `full` solo cuando se necesiten datos existentes autorizados.
2. Confirmar con `current --json` que la CLI apunta a esa rama. Recordar que
   `branch switch` no actualiza `.env.local`; el SDK puede seguir apuntando al
   backend anterior si no se corrige el entorno.
3. Crear migraciones nuevas forward-only. Nunca editar una migración ya
   aplicada para corregirla; añadir una migración posterior idempotente.
4. Aplicar y verificar esquema, privilegios, políticas, funciones y metadatos.
   Para RLS se prueba como mínimo acceso propio, acceso cruzado, inserción,
   actualización, borrado y acceso anónimo según el contrato.
5. Ejecutar `branch merge <name> --dry-run`, guardar/revisar el SQL y detenerse
   ante cualquier conflicto. No usar `-y` para saltarse la revisión.
6. Respaldar el proyecto principal cuando la capacidad lo permita y fusionar
   solo el resultado validado. El merge es transaccional, pero la revisión del
   SQL sigue siendo obligatoria.
7. Después del merge, verificar en el proyecto principal las migraciones,
   RLS, políticas y funciones. Mantener la rama fusionada para auditoría hasta
   confirmar que no tiene trabajo pendiente.

Si el dry-run informa conflicto en `system.migrations`, no se ejecuta el merge.
Se inspeccionan el T0, el estado actual del padre y el de la rama. La solución
preferida es crear una rama limpia desde el padre actual cuando el cupo y el
respaldo permitan hacerlo; la alternativa es una migración manual que combine
intenciones. Nunca se elige automáticamente el lado del padre o de la rama.

## 6. GitHub Y Publicación

Cuando existe un remoto:

- `origin/main` es la base actualizable y `main` debe estar protegido.
- El flujo normal es worktree de tarea, commit atómico, push de la rama,
  Pull Request, CI, revisión y merge a `main`.
- No se hace push directo a `main`, force-push ni se cierra un PR reemplazando
  su historial sin autorización explícita.
- El PR debe indicar la spec, el mapeo InsForge, migraciones, verificaciones,
  riesgos y pasos de despliegue.

Si no hay remoto configurado, no se afirma que existe un PR ni que el commit
está publicado. Se puede dejar `main` local actualizado solo por solicitud
explícita, pero el despliegue de InsForge no sustituye la publicación en
GitHub. Antes de desplegar frontend se exige árbol limpio, build exitoso,
variables de hosting verificadas y registro del ID/estado del despliegue.

El despliegue web, el merge de backend y la distribución del plugin de KOReader
son canales distintos. El plugin debe llegar a `main` mediante Git y sus pruebas
de dispositivo deben quedar registradas; un despliegue del frontend de InsForge
no instala automáticamente el plugin en un Kindle.

## 7. Secuencia Recomendada Para Dos Sesiones

| Situación | Acción segura |
| --- | --- |
| Una sesión edita y otra consulta | La segunda es solo lectura; no cambia Git, `.env` ni InsForge |
| Ambas necesitan editar código | Crear dos worktrees y ramas Git diferentes |
| Ambas necesitan backend | Usar ramas InsForge distintas, con una sola sesión escritora por rama |
| La cuota de InsForge está llena | Auditar ramas y backups; reutilizar una rama compatible o pedir decisión |
| Aparece un cambio ajeno | Detener staging/commit, conservarlo y comunicar las rutas |
| El dry-run muestra conflicto | No fusionar; inspeccionar historial y rebasar manualmente o recrear con seguridad |
| Una rama ya fue fusionada | Mantenerla para auditoría; resetearla solo para reutilizar el mismo propósito |
