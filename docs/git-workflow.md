# Flujo De Trabajo Con Git Y GitHub

Este documento define cómo se conserva la trazabilidad del proyecto cuando
varias implementaciones se desarrollan en ramas distintas. Complementa a
`AGENTS.md` y no reemplaza `docs/constitution.md`, las specs ni los tests.
Para dos sesiones concurrentes, `docs/agent-collaboration.md` contiene el
protocolo operativo de lock, worktrees y coordinación.

## 1. Fuentes De Verdad

El comportamiento del producto se decide en `specs/`. La constitución fija los
principios obligatorios. `plan.md`, `tasks.md` y `docs/traceability.md`
organizan y verifican el trabajo. Git registra la evolución de esos artefactos
y del código; una rama nunca justifica saltarse la sincronización Spec-Anchored.

El archivo raíz canónico para instrucciones del agente es `AGENTS.md`. No crear
otro `agents.md` con reglas paralelas.

## 2. Modelo De Ramas

- `main` es la rama estable y la base de integración.
- Cada trabajo nuevo debe usar una rama descriptiva basada en `main`:
  `feature/<spec>-<short-name>`, `fix/<spec>-<short-name>`,
  `docs/<short-name>`, `test/<short-name>` o `chore/<short-name>`.
- Las ramas de tarea deben tener un alcance pequeño y revisable. No mezclar una
  funcionalidad con una refactorización no relacionada o una actualización de
  dependencias sin justificarla.
- Mantener las ramas de tarea cortas. Como objetivo práctico, terminar y
  fusionar una rama en pocos días; si el trabajo es mayor, dividirlo por
  incrementos verificables o explicar por qué debe permanecer abierta y
  actualizarla con frecuencia desde `main`.
- Antes de crear una rama, buscar primero ramas locales y remotas cuyo nombre,
  commits recientes o archivos modificados correspondan al objetivo. Si la
  coincidencia es clara, reutilizarla. Si hay más de una candidata o la
  intención no es evidente, informar y pedir una decisión.
- Si la tarea ya tiene una rama activa, continuar en ella. No crear una segunda
  rama para el mismo objetivo solo porque el agente inició una nueva sesión.
- No trabajar directamente sobre `main` después del bootstrap inicial del
  repositorio. No borrar ramas ni reescribir su historial sin autorización.
- Después de integrar una rama, eliminarla solo cuando se haya confirmado que
  no contiene trabajo pendiente ni es la base de otra rama activa.

## 3. Inspección Obligatoria Antes De Editar

Ejecutar y revisar, como mínimo:

```text
git status --short --branch
git branch --all --verbose --no-abbrev
git log --oneline --decorate --graph --all -20
git remote -v
```

Si existe `origin`, actualizar referencias sin modificar archivos locales:

```text
git fetch --prune origin
git status --short --branch
git branch -vv
```

Un árbol de trabajo sucio pertenece al usuario hasta demostrar lo contrario.
No hacer `stash`, `reset`, `clean`, `checkout --` ni descartar archivos para
facilitar un cambio de rama. Si los cambios no se relacionan con la tarea,
preservarlos y trabajar solo sobre archivos no conflictivos; si es necesario
cambiar de rama, detenerse y pedir instrucciones.

Para decidir si una rama existente es la correcta, revisar su nombre, su
upstream, sus commits recientes y su diferencia con `main`; no confiar solo en
el nombre de la rama.

## 4. Inicio De Una Tarea

1. Leer `AGENTS.md`, `docs/constitution.md`, este documento y la documentación
   de la spec relevante. Si existe concurrencia, leer también
   `docs/agent-collaboration.md`.
2. Inspeccionar el estado local y remoto.
3. Reutilizar una rama coincidente, o crear una rama desde la referencia
   actualizada de `origin/main` cuando el árbol esté limpio.
4. Anotar en el plan o en la descripción del trabajo qué spec, requisitos,
   criterios de aceptación y tests se cubrirán.
5. Si el cambio afecta UI, documentar primero la dirección en
   `docs/ui-design.md`. Si afecta comportamiento o contrato, actualizar la spec
   antes o junto con la implementación.

Una rama no es una copia de seguridad de cambios sin identificar. Antes de
trabajar sobre una rama existente, comprobar que sus cambios realmente
pertenecen al objetivo actual.

## 5. Commits Y Verificación

Los commits deben ser pequeños, atómicos y descriptivos. No incluir secretos,
`.env.local`, artefactos generados, `node_modules`, tokens ni cambios ajenos.
Antes de confirmar un commit:

```text
git diff --check
git diff --stat
git diff --cached
git status --short
```

Ejecutar las verificaciones adecuadas al alcance. Para cambios generales del
frontend, el conjunto base es:

```text
npm run lint
npm run typecheck
npm test
npm run build
```

Los cambios de UI o rutas deben añadir las pruebas E2E y de accesibilidad que
correspondan. Los cambios de InsForge deben usar sus skills, validar RLS y
actualizar migraciones, contratos, tipos y trazabilidad en el mismo cambio.

Se adopta una convención ligera de Conventional Commits para que el historial
sea legible y automatizable: `feat`, `fix`, `docs`, `test`, `ci`, `chore`,
`refactor` y `perf` son tipos válidos. El formato mínimo es
`type(scope): short description`; una modificación incompatible debe marcarse
con `!` o explicar `BREAKING CHANGE:`. La convención no reemplaza el contexto
del Pull Request. Por ejemplo: `docs: define the GitHub branch workflow`.

## 6. Push Y Comprobación Del Remoto

Publicar es una escritura externa. El agente solo debe hacer push cuando la
tarea lo solicite explícitamente o exista autorización clara para publicar la
rama actual. La autorización para crear el repositorio inicial permite publicar
el baseline, pero no autoriza pushes posteriores a `main` sin una instrucción
específica.

Antes de un push:

- confirmar que la rama actual no es `main`, salvo el bootstrap inicial;
- revisar `git diff`, el commit que se va a publicar y los nombres de archivos;
- comprobar que `.env.local`, credenciales y claves no estén trackeados;
- ejecutar las verificaciones pertinentes;
- comprobar upstream con `git branch -vv` y el remoto con `git remote -v`.

Para una rama nueva, usar el upstream explícito:

```text
git push --set-upstream origin <task-branch>
```

Después comprobar:

```text
git status --short --branch
git branch -vv
git ls-remote --heads origin <task-branch>
```

Si el push es rechazado, hacer `fetch`, revisar divergencia y decidir con
evidencia. No usar `push --force` como solución automática.

## 7. Secretos, Dependencias Y Archivos Ignorados

`.gitignore` evita que secretos y artefactos locales entren por accidente, pero
no elimina un archivo que ya esté trackeado ni borra secretos de la historia.
Antes del primer commit y antes de cada push:

- confirmar con `git check-ignore -v` que `.env.local`, `.insforge/`,
  `.vercel/`, builds, reportes y dependencias locales están ignorados;
- revisar que `.env.example` contenga solo nombres y valores de ejemplo, nunca
  credenciales reales;
- buscar tokens, claves privadas, contraseñas y URLs de conexión con secretos
  en los archivos que se van a publicar;
- si un secreto estuvo trackeado, detenerse, revocarlo/rotarlo y limpiar la
  historia siguiendo un procedimiento explícito; no basta con añadirlo al
  `.gitignore`;
- no imprimir valores de secretos en logs, comentarios, commits, issues o
  Pull Requests.

El workflow de CI mantiene `permissions: contents: read`. Dependabot se
configura para proponer actualizaciones de npm y GitHub Actions. En el remoto,
activar Secret Scanning con Push Protection cuando la visibilidad y el plan lo
permitan; esa barrera debe complementar, no sustituir, la revisión local.

## 8. Pull, Rebase Y Actualización De Ramas

- Para actualizar una rama sin divergencia, preferir una operación explícita y
  conservadora, como `git pull --ff-only`.
- Para una rama local que todavía no se ha compartido, se puede actualizar desde
  `origin/main` con rebase si mantiene la historia más clara.
- No hacer rebase de una rama ya publicada y compartida sin autorización, pues
  cambia los hashes que otras personas pueden estar usando.
- Una vez abierto un Pull Request, no reescribir su historial automáticamente.
  Para incorporar cambios de `main`, usar una integración que preserve la rama
  publicada o coordinar explícitamente el rebase y el push forzado seguro.
- Cuando la rama publicada debe incorporar cambios de `main`, preferir una
  actualización que conserve la historia compartida o pedir autorización para
  rebase; siempre ejecutar los tests sobre el resultado.
- Antes de integrar cualquier referencia remota, verificar qué commits entran,
  si hay divergencia y cuál es la rama objetivo. No usar `pull` sin saber qué
  upstream se está integrando.

## 9. Pull Requests Y Merges

La integración normal es `task branch -> Pull Request -> main`.

Un Pull Request debe indicar:

- qué cambia y por qué;
- la spec, requisitos y criterios de aceptación relacionados;
- qué archivos de documentación se actualizaron;
- las verificaciones ejecutadas y sus resultados;
- riesgos conocidos, migraciones o pasos manuales.

Antes de aprobar o integrar:

1. actualizar referencias con `git fetch --prune origin`;
2. confirmar que no hay conflictos y que la rama contiene la base requerida;
3. revisar el diff completo, no solo el último commit;
4. comprobar que CI pasó sobre el commit más reciente;
5. comprobar que la spec, la UI documentada, los tests y la trazabilidad siguen
   sincronizados;
6. integrar solo mediante el Pull Request y la política configurada en GitHub.

La protección recomendada para `main` es exigir Pull Request, CI exitoso,
rama actualizada con la base, resolución de conversaciones y bloqueo de push
directo, force-push y borrado. El número de revisiones requeridas debe ajustarse
al número real de colaboradores; no configurar una revisión imposible para un
repositorio personal sin un segundo revisor.

Si aparecen conflictos, resolver archivo por archivo teniendo en cuenta la
intención de ambas ramas. Buscar marcadores pendientes, revisar el resultado
completo y repetir las verificaciones. Si la intención no puede inferirse de la
spec, los commits y el contexto del usuario, detener la integración y pedir
aclaración. Nunca resolver un conflicto reemplazando todo el archivo por una
de las dos versiones sin inspección.

## 10. Fuentes De La Práctica

Estas reglas se basan en la documentación oficial de GitHub y Git:

- [Adding locally hosted code to GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)
- [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Status checks](https://docs.github.com/en/pull-requests/reference/status-checks)
- [Managing and standardizing pull requests](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/getting-started/managing-and-standardizing-pull-requests)
- [git-switch](https://git-scm.com/docs/git-switch)
- [git-pull](https://git-scm.com/docs/git-pull)

También se contrastaron guías no oficiales populares y se adoptaron solo las
prácticas compatibles con el tamaño y el estado de Karenda:

- [Atlassian: Git Feature Branch Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/feature-branch-workflow/)
- [Atlassian: Merging vs. Rebasing](https://www.atlassian.com/git/tutorials/merging-vs-rebasing)
- [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
- [Martin Fowler: Continuous Integration](https://www.martinfowler.com/articles/continuousIntegration.html)
- [Trunk Based Development: Short-Lived Feature Branches](https://trunkbaseddevelopment.com/short-lived-feature-branches/)
