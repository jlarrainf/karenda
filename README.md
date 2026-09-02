# Karenda Web

Karenda Web gestiona un calendario académico y eventos personales. El
proyecto usa React, TypeScript, Vite e InsForge, y mantiene contratos preparados
para una futura integración de lectura con KOReader/SimpleUI.

## Estado

El MVP web y la primera definición de la integración con KOReader están
documentados en `specs/`, `plan.md`, `tasks.md` y `docs/traceability.md`. Las
tareas pendientes permanecen explícitas en `tasks.md`.

## Desarrollo Local

```text
npm ci
npm run dev
```

Comandos de calidad:

```text
npm run lint
npm run typecheck
npm test
npm run build
```

La configuración pública del cliente se toma de `.env.local`; las credenciales
y claves privadas no deben entrar al repositorio.

## Documentación Para Agentes Y Colaboradores

- [`AGENTS.md`](AGENTS.md): instrucciones canónicas para agentes.
- [`docs/constitution.md`](docs/constitution.md): principios obligatorios del
  producto.
- [`docs/git-workflow.md`](docs/git-workflow.md): ramas, push, PRs, merges y
  resolución segura de conflictos.
- [`specs/`](specs/): especificaciones y criterios de aceptación.

El trabajo normal se realiza en una rama de tarea y llega a `main` mediante un
Pull Request con CI exitoso.
