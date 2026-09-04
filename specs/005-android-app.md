# Aplicación Android De Karenda

Estado: implementación inicial en curso. Esta spec define la primera
superficie Android y no autoriza todavía el modo offline con escritura, las
notificaciones ni los widgets.

## 1. Objetivo Y Principios

Karenda Android permitirá utilizar el mismo calendario, hábitos, tareas y notas
de Karenda Web desde una aplicación instalable. La aplicación reutilizará el
frontend React/TypeScript mediante Capacitor y mantendrá InsForge como fuente
única de autenticación, autorización y persistencia.

Android no se conectará a la web publicada para obtener la interfaz. El build de
Vite se incluirá en el APK/AAB y el cliente seguirá consultando directamente el
proyecto InsForge configurado para Karenda.

## 2. Alcance De La Primera Versión

- Arranque desde assets locales empaquetados.
- Login, registro, verificación, cierre de sesión y rutas protegidas existentes.
- Calendario, hábitos, tareas recurrentes y notas con paridad funcional con la
  superficie web que ya esté verificada.
- Estados de carga, error y falta de conexión en español, sin éxito falso.
- Navegación Android con botón Atrás, teclado, barras del sistema y enlaces
  externos.
- APK firmado para instalación personal; la publicación en Google Play queda
  fuera de esta entrega.

## 3. Contrato De Plataforma

- **RF-A-01:** Al abrir la aplicación, el sistema deberá cargar la interfaz
  desde los assets incluidos en el paquete, incluso si no existe conexión.
- **RF-A-02:** Cuando exista conexión y una sesión válida, Android deberá usar
  las mismas entidades, contratos, funciones y políticas RLS de InsForge que la
  web, sin crear un backend ni una base de datos alternativa.
- **RF-A-03:** Mientras no exista sesión válida, Android deberá conservar la
  protección de rutas y los mensajes definidos por la spec web.
- **RF-A-04:** Cuando el dispositivo quede sin conexión, la interfaz deberá
  mostrar un estado en español, impedir confirmar escrituras no aceptadas por
  InsForge y permitir reintentar cuando la conexión vuelva.
- **RF-A-05:** El botón Atrás deberá cerrar en este orden un diálogo, un panel,
  el cajón de navegación o la ruta actual antes de permitir la salida de la
  actividad.
- **RF-A-06:** Los enlaces externos deberán abrirse en el navegador del sistema
  y el WebView no deberá permitir navegación arbitraria fuera de Karenda.
- **RF-A-07:** El APK no deberá contener claves administrativas, secretos de
  funciones ni credenciales distintas de las variables públicas necesarias para
  inicializar el cliente de usuario.
- **RF-A-08:** La persistencia de sesión que se habilite para producción deberá
  usar almacenamiento seguro del sistema; el almacenamiento web se considera
  únicamente una compatibilidad temporal del spike.

## 4. Requisitos No Funcionales

- **RNF-A-01:** La aplicación se construirá desde el frontend React/TypeScript
  existente y seguirá los nombres de código en inglés y los textos visibles en
  español.
- **RNF-A-02:** InsForge continuará siendo la fuente de verdad. No se añadirá
  Room, SQLite ni otra base de datos local de producción en esta versión.
- **RNF-A-03:** La configuración de Capacitor usará el directorio de build local
  y no `server.url` en compilaciones de producción.
- **RNF-A-04:** La configuración nativa mantendrá HTTPS, navegación externa
  restringida, logs de producción mínimos (sin logging de Capacitor), insets de
  `SystemBars` mediante CSS y sin mixed content.
- **RNF-A-05:** La interfaz deberá conservar los tamaños táctiles, contraste,
  foco visible y semántica definidos en `docs/ui-design.md`.
- **RNF-A-06:** El `applicationId` será estable desde el primer APK y la clave de
  firma quedará fuera del repositorio.

El spike usa provisionalmente `app.karenda.android` como `applicationId`. Debe
confirmarse antes de distribuir el primer APK de release, porque cambiarlo
después rompe la ruta de actualización de Android.

## 5. Fuera Del Alcance De V1

- Lectura offline de datos persistentes.
- Creación, edición o eliminación sin conexión.
- Colas de sincronización, resolución de conflictos y cambios de versión para
  sincronización local.
- Notificaciones, alarmas, widgets y accesos rápidos.
- Integración nativa completa con Kotlin/Jetpack Compose.
- Publicación pública en Google Play.

## 6. Evolución Offline Y Nativa

Una futura versión podrá añadir una caché cifrada de solo lectura para el
calendario próximo, catálogo y hábitos activos. Esa versión deberá actualizar
la spec, definir `synced_at`, caducidad, limpieza al cambiar de cuenta y el
indicador de antigüedad. No permitirá escrituras offline hasta documentar
idempotencia, conflictos y sincronización.

Las notificaciones y widgets se añadirán como funcionalidades separadas, con
permisos explícitos y contratos server-side solo si son necesarios. La
arquitectura de Capacitor deberá dejar un punto de extensión nativo sin duplicar
la lógica de dominio.

## 7. Criterios De Aceptación

- **CA-A-01:** Un APK instalado arranca y muestra la interfaz de autenticación
  sin solicitar la web publicada.
- **CA-A-02:** Con conexión, una cuenta puede autenticarse y consultar o
  modificar desde Android los mismos datos permitidos en la web.
- **CA-A-03:** Las políticas RLS y los errores de InsForge se comportan igual en
  web y Android; no se expone información de otra cuenta.
- **CA-A-04:** Al cortar la conexión, la aplicación muestra el estado offline,
  no confirma guardados falsos y vuelve a permitir reintentos al recuperar red.
- **CA-A-05:** El botón Atrás, el teclado, las áreas seguras y los enlaces
  externos funcionan en un teléfono Android real.
- **CA-A-06:** El análisis del bundle no encuentra claves administrativas,
  tokens de prueba ni secretos de funciones.
- **CA-A-07:** El APK release se puede instalar personalmente y conserva un
  `applicationId` y una firma reproducibles para futuras actualizaciones.

## 8. Verificación Requerida

- `npm run lint`, `npm run typecheck`, `npm test` y `npm run build`.
- Smoke en emulador y teléfono Android real con login, navegación, calendario,
  hábitos, notas, rotación, suspensión y recuperación.
- Pruebas de conexión perdida, expiración de sesión y aislamiento RLS.
- Revisión de configuración nativa, secretos, permisos y tamaño del paquete.
