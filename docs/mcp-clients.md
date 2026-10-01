# Conectar Karenda MCP a un harness

## Estado del endpoint

El endpoint de staging de la rama InsForge karenda-mcp es:

~~~text
https://5zz5dxgt-tkp.function2.insforge.app/karenda-mcp/mcp
~~~

La web de prueba para consentimiento está publicada en la misma rama aislada:

~~~text
https://5zz5dxgt-tkp.insforge.site
~~~

La ruta `/mcp/consent` sirve la aplicación y el servidor MCP permite ese origen. La rama es `schema-only`; no había registros de dominio cuando se revisó. Úsala solo para pruebas con una cuenta de staging. No agregues este endpoint a un harness que use los datos reales de Karenda.

En producción se usará la misma ruta bajo el host de Edge Functions de la rama principal. La aplicación web toma la URL de VITE_KARENDA_MCP_URL; si se omite, la calcula desde VITE_INSFORGE_URL.

## Codex CLI y Codex IDE

El CLI y el IDE comparten esta configuración. Una vez que el endpoint del entorno esté listo:

~~~powershell
codex mcp add karenda --url https://<APP_KEY>.function2.insforge.app/karenda-mcp/mcp
codex mcp list
~~~

Codex abrirá el navegador para iniciar sesión en Karenda y revisar los permisos.
En esta carpeta, `.codex/config.toml` ya registra el endpoint de staging. Tras
reiniciar Codex, comprueba `codex mcp list`; la autenticación OAuth se inicia
con `codex mcp login karenda`. Este registro apunta a la rama aislada y no da
acceso a los datos de producción.

## Claude Code

~~~powershell
claude mcp add --transport http karenda https://<APP_KEY>.function2.insforge.app/karenda-mcp/mcp
claude mcp list
~~~

Después, ejecuta /mcp en Claude Code y completa el inicio de sesión OAuth en el navegador.

## OpenCode

~~~powershell
opencode mcp add karenda --url https://<APP_KEY>.function2.insforge.app/karenda-mcp/mcp
opencode mcp list
opencode mcp auth karenda
~~~

La autenticación remota usa OAuth y abre el navegador para consentir en Karenda.

## Configuración del servidor por entorno

Configura estos valores en los secretos/variables de la Edge Function de cada entorno, nunca en el harness ni en el bundle del navegador:

- `MCP_INSFORGE_ACCESS_TOKEN_ENCRYPTION_KEY`: secreto aleatorio de 32 bytes, estable mientras existan concesiones OAuth cifradas. Si se rota, hay que volver a autorizar las conexiones existentes.
- `KARENDA_WEB_ORIGIN`: origen exacto de la aplicación web que muestra el consentimiento, por ejemplo `https://karenda.example`.
- `MCP_CONSENT_URL`: URL absoluta de la ruta protegida de consentimiento, por ejemplo `https://karenda.example/mcp/consent`.

`INSFORGE_BASE_URL` y `API_KEY` son secretos reservados que proporciona el entorno InsForge. La rama de staging ya tiene una clave de cifrado propia y las variables de origen/consentimiento apuntan al preview anterior. Si cambia el dominio del preview, actualiza esos dos valores en la función.

## Permisos y desconexión

Elige solo los scopes que necesites. Los permisos de escritura empiezan desactivados en la pantalla de consentimiento. Karenda no comparte la contraseña ni el token de sesión web con el harness. Puedes revocar una conexión desde **Organización y conexiones → Conexiones MCP**; para quitar una conexión local, usa el comando de eliminación de servidor del harness.

La implementación actual no ofrece clave idempotente en las herramientas de creación, ni prueba de login real para estos tres harnesses. No conectes el endpoint de staging a datos de producción.

## Construir y desplegar la Edge Function

InsForge necesita un único archivo de entrada. El empaquetador incluye el código local y conserva las dependencias npm con sus versiones fijadas; el artefacto temporal queda en functions/.deploy/ y no se guarda en Git.

~~~powershell
npm run build:mcp:function
npx -y deno@2.9.6 cache --config functions/deno.json functions/.deploy/karenda-mcp.js
npx -y @insforge/cli functions deploy karenda-mcp --file functions/.deploy/karenda-mcp.js --name "Karenda MCP" --description "Servidor remoto para consultar y gestionar datos de Karenda mediante OAuth"
~~~

## Documentación oficial de clientes

- [Codex: MCP en Codex](https://developers.openai.com/codex/mcp)
- [Claude Code: MCP](https://code.claude.com/docs/en/mcp)
- [OpenCode: MCP servers](https://opencode.ai/v2/docs/mcp-servers)
