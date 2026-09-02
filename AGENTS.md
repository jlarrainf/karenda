# Karenda Web

## Objetivo

Karenda Web es una aplicación para gestionar un calendario académico
(controles, pruebas y entregas universitarias) junto con eventos personales.

La visión futura incluye un plugin para KOReader en un Kindle con jailbreak.
El plugin creará una página en el home de SimpleUI para mostrar el calendario,
por lo que los datos y contratos de la aplicación deben facilitar esa
integración posterior.

## Stack Y Responsabilidades

- Frontend: framework web moderno, definido durante la fase de especificación.
- Backend centralizado: InsForge administra exclusivamente la base de datos,
  autenticación, lógica de backend, almacenamiento necesario y hosting.
- La aplicación web no debe introducir un backend, una base de datos local de
  producción ni un sistema de autenticación alternativo.

## Regla De Idioma

- Todo el código debe estar escrito en inglés: variables, funciones, lógica y
  comentarios.
- Todo lo visible para el usuario debe estar estrictamente en español: UI,
  mensajes y logs.

## Regla Para Agentes

Antes de iniciar cualquier tarea, el agente debe leer este archivo,
`docs/constitution.md` y `docs/git-workflow.md`. Si hay otra sesión o agente
trabajando en el mismo proyecto, también debe leer
`docs/agent-collaboration.md`. Después debe identificar la spec, los criterios
de aceptación, las tareas y la verificación relacionados.
Toda decisión y cambio debe respetar estos documentos.

## Flujo Spec-Anchored

- No implementar comportamiento que no esté definido en la spec correspondiente.
- Si cambia el comportamiento, el modelo, un contrato o la interfaz, actualizar
  la spec y la trazabilidad en el mismo cambio.
- Antes de modificar UI, actualizar primero `docs/ui-design.md` con las
  decisiones de UI/UX requeridas por la constitución.
- Cada requisito verificable debe tener tests apropiados y toda tarea terminada
  debe dejar evidencia de la verificación ejecutada.
- No marcar tareas como completadas solo porque se haya escrito código.

## Trabajo Con Ramas

`docs/git-workflow.md` es el procedimiento obligatorio para trabajar con Git y
GitHub. En cada tarea el agente debe:

- Inspeccionar antes de editar `git status --short --branch`, la rama actual,
  las ramas relacionadas, los remotos y la relación con `origin/main`.
- Reutilizar una rama existente cuando su propósito y alcance coincidan; no
  crear una rama nueva por rutina.
- Preservar cambios locales ajenos y nunca usar `reset --hard`, `clean`,
  `checkout --` ni `push --force` para ocultar o reemplazar trabajo.
- Mantener `main` estable: el trabajo normal ocurre en ramas de tarea y llega a
  `main` mediante un Pull Request con verificaciones exitosas.
- En una carpeta compartida, solo un agente puede escribir, cambiar de rama,
  preparar commits o mutar el contexto de InsForge; para dos agentes escritores
  se deben usar worktrees separados.
- Cada cambio de backend debe registrar la relación entre la rama Git y la
  rama InsForge. No crear ramas InsForge por sesión ni superar su cuota;
  reutilizar una rama coincidente o cerrar una rama ya auditada con respaldo.
- Antes de cada commit o push revisar el diff real, buscar secretos, ejecutar
  las verificaciones pertinentes y confirmar el upstream. Después de publicar,
  comprobar que el remoto contiene el commit esperado.
- No resolver conflictos eligiendo automáticamente un lado completo. Revisar
  cada conflicto contra la spec, la constitución y los tests; detenerse si la
  intención no puede determinarse con seguridad.

No duplicar estas instrucciones en otro archivo raíz: `AGENTS.md` es el archivo
canónico de instrucciones del proyecto.

## Estándar De Infraestructura Futura

Cuando comience la implementación, las tareas de backend deben gestionarse con
las skills de InsForge y usando exactamente esta configuración. Estos comandos
son documentación del estándar del proyecto; no deben ejecutarse durante la
fase de planificación:

```text
npx @insforge/cli login --user-api-key "$INSFORGE_USER_API_KEY"
npx @insforge/cli link --project-id 5930dac6-6cab-43e7-b701-612843379b65
```

`INSFORGE_USER_API_KEY` debe existir únicamente en el entorno local o en el
gestor de secretos; nunca se debe escribir su valor en documentación.

<!-- INSFORGE:START -->
## InsForge backend

This project uses [InsForge](https://insforge.dev): an all-in-one, open-source Postgres-based backend (BaaS) that gives this app a database, authentication, file storage, edge functions, realtime, an AI model gateway, and payments through one platform.

- **Project:** **karenda** (API base `https://5zz5dxgt.us-east.insforge.app`)
- **Skills:** these InsForge skills are installed for supported coding agents. Reach for them before implementing any InsForge feature instead of guessing the API:
  - `insforge`: app code with the `@insforge/sdk` client (database CRUD, auth, storage, edge functions, realtime, AI, email, and Stripe payments).
  - `insforge-cli`: backend and infrastructure via the `insforge` CLI (projects, SQL, migrations, RLS policies, storage buckets, functions, secrets, payment setup, schedules, deploys).
  - `insforge-debug`: diagnosing failures (SDK/HTTP errors, RLS denials, auth and OAuth issues) and running security or performance audits.
  - `insforge-integrations`: wiring external auth providers (Clerk, Auth0, WorkOS, Better Auth, etc.) for JWT-based RLS, or the OKX x402 payment facilitator.
  - `find-skills`: discovering additional skills on demand.
- **Credentials:** app code reads keys from `.env.local`; the CLI reads `.insforge/project.json`. Never hardcode or commit keys.

Key patterns:

- Database inserts take an array: `insert([{ ... }])`.
- Reference users with `auth.users(id)`; use `auth.uid()` in RLS policies.
- For storage uploads, persist both the returned `url` and `key`.
<!-- INSFORGE:END -->
