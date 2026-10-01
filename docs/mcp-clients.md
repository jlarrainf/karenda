# Conectar Karenda MCP a un harness

## Staging

El servidor MCP de pruebas está en la rama aislada `karenda-mcp-release` de
InsForge. Su endpoint Streamable HTTP es:

~~~text
https://5zz5dxgt-h6d.function2.insforge.app/karenda-mcp/mcp
~~~

La aplicación web de staging que presenta el consentimiento está publicada en:

~~~text
https://5zz5dxgt-h6d.insforge.site/mcp/consent
~~~

La metadata OAuth y de recurso protegido responde, el endpoint MCP sin token
responde `401`, el origen web configurado pasa CORS y los orígenes externos se
bloquean. El registro dinámico de clientes responde `201`. El preview web para
consentimiento responde `200`, aunque el flujo OAuth autenticado aún no se ha
probado: el intento E2E se detuvo porque la API administrativa de staging
respondió `401` al crear una cuenta sintética; no se creó ninguna cuenta. La
rama no tiene datos de dominio y no debe usarse para validar datos de producción.

## Producción

La implementación integrada en `main` mediante PR #17 está desplegada en el
proyecto principal de InsForge. El endpoint Streamable HTTP para clientes es:

~~~text
https://5zz5dxgt.function2.insforge.app/karenda-mcp/mcp
~~~

El consentimiento usa `https://karenda.insforge.site/mcp/consent`. La web de
producción responde `200` en `/` y `/mcp/consent`; el despliegue del 1 de
octubre de 2026 es `f54c0480-451e-4ba2-9351-f8e302b0896c`. La variable de
compilación `VITE_KARENDA_MCP_URL` contiene la base
`https://5zz5dxgt.function2.insforge.app/karenda-mcp`, sin el sufijo `/mcp`,
porque la web usa esa base para consultar y decidir solicitudes OAuth.

El smoke de producción confirma metadata OAuth y de recurso protegido `200`,
endpoint MCP sin token `401` con challenge, CORS permitido para el origen web,
bloqueo de origen externo y registro DCR `201`. Codex completó OAuth; después de
que un refresh indicara sesión vencida, `codex mcp login karenda` terminó con
éxito y una sesión nueva de Codex descubrió el catálogo de herramientas. No se
llamaron herramientas que leen o modifican datos de la cuenta. Para cargar el
catálogo en una conversación que ya estaba abierta, inicia una conversación
nueva o reinicia Codex. La verificación de descubrimiento no cierra los gates
de seguridad ni de interoperabilidad.

## Codex CLI y Codex IDE

Codex CLI y el IDE comparten configuración. Añade el endpoint del entorno que
corresponda:

~~~powershell
codex mcp add karenda --url https://<APP_KEY>.function2.insforge.app/karenda-mcp/mcp
codex mcp list
codex mcp login karenda
~~~

El comando de login abre el navegador para OAuth y consentimiento. Revisa los
permisos antes de autorizar. El checkout principal de Karenda y la configuración
global de Codex apuntan a producción. No uses staging para consultar o modificar
datos reales de Karenda.

## Claude Code

~~~powershell
claude mcp add --transport http karenda https://<APP_KEY>.function2.insforge.app/karenda-mcp/mcp
claude mcp list
~~~

Después, ejecuta `/mcp` y completa el login OAuth en el navegador.

## OpenCode

~~~powershell
opencode mcp add karenda --url https://<APP_KEY>.function2.insforge.app/karenda-mcp/mcp
opencode mcp list
opencode mcp auth karenda
~~~

La autenticación remota usa OAuth y abre el navegador para consentir en Karenda.

## Configuración del servidor por entorno

Configura estos valores en los secretos/variables de la Edge Function de cada
entorno, nunca en el harness ni en el bundle del navegador:

- `MCP_INSFORGE_ACCESS_TOKEN_ENCRYPTION_KEY`: secreto aleatorio de 32 bytes,
  estable mientras existan concesiones OAuth cifradas. Si se rota, hay que
  volver a autorizar las conexiones existentes.
- `KARENDA_WEB_ORIGIN`: origen exacto de la aplicación web que muestra el
  consentimiento, por ejemplo `https://karenda.example`.
- `MCP_CONSENT_URL`: URL absoluta de la ruta protegida de consentimiento, por
  ejemplo `https://karenda.example/mcp/consent`.

`INSFORGE_BASE_URL` y `API_KEY` son secretos reservados que proporciona el
entorno InsForge. La rama de staging tiene su propia clave de cifrado y sus
valores de origen/consentimiento; el dominio debe coincidir con el preview web
publicado en esa rama.

## Permisos y desconexión

Elige solo los scopes que necesites. Los permisos de escritura empiezan
desactivados en la pantalla de consentimiento. Karenda no comparte la
contraseña ni el token de sesión web con el harness. Puedes revocar una
conexión desde **Organización y conexiones → Conexiones MCP**; para quitar una
conexión local, usa el comando de eliminación de servidor del harness.

Cada herramienta que modifica datos requiere un UUID `idempotencyKey` nuevo
para cada operación lógica. Karenda guarda el resultado hasta 30 días, devuelve
la respuesta guardada cuando se repite la misma operación y rechaza reutilizar
la clave con argumentos distintos. No reintentes una escritura cuya respuesta
quedó en curso sin consultar antes su estado.

## Construir y desplegar la Edge Function

InsForge necesita un único archivo de entrada. El empaquetador incluye el
código local y conserva las dependencias npm con sus versiones fijadas; el
artefacto temporal queda en `functions/.deploy/` y no se guarda en Git.

~~~powershell
npm run build:mcp:function
npx -y deno@2.9.6 cache --config functions/deno.json functions/.deploy/karenda-mcp.js
npx -y @insforge/cli functions deploy karenda-mcp --file functions/.deploy/karenda-mcp.js --name "Karenda MCP" --description "Servidor remoto para consultar y gestionar datos de Karenda mediante OAuth"
~~~

## Documentación oficial de clientes

- [Codex: MCP en Codex](https://developers.openai.com/codex/mcp)
- [Claude Code: MCP](https://code.claude.com/docs/en/mcp)
- [OpenCode: MCP servers](https://opencode.ai/v2/docs/mcp-servers)
