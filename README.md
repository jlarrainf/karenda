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

## Desarrollo Android

La aplicación Android vive dentro de este mismo repositorio, en `android/`, y
empaqueta el build local de Vite mediante Capacitor. No carga la interfaz desde
la web publicada: conserva InsForge como backend compartido.

Requisitos locales: Android Studio con su SDK instalado y un JDK compatible con
la versión de Gradle del proyecto (JDK 21 recomendado).

Antes de crear la APK, configura las variables públicas de InsForge en
`.env.local`. La clave anónima se obtiene desde InsForge y no debe compartirse
ni confirmarse en Git:

```text
VITE_INSFORGE_URL=https://5zz5dxgt.us-east.insforge.app
VITE_INSFORGE_ANON_KEY=tu-clave-anonima
```

```text
npm run android:build
npm run android:open
```

`android:build` genera el frontend, sincroniza sus assets con el proyecto
nativo y crea `android/app/build/outputs/apk/debug/app-debug.apk`. La firma de
release debe configurarse fuera del repositorio; el APK de debug sirve
únicamente para pruebas personales.

## Documentación Para Agentes Y Colaboradores

- [`AGENTS.md`](AGENTS.md): instrucciones canónicas para agentes.
- [`docs/constitution.md`](docs/constitution.md): principios obligatorios del
  producto.
- [`docs/git-workflow.md`](docs/git-workflow.md): ramas, push, PRs, merges y
  resolución segura de conflictos.
- [`specs/`](specs/): especificaciones y criterios de aceptación.

El trabajo normal se realiza en una rama de tarea y llega a `main` mediante un
Pull Request con CI exitoso.
