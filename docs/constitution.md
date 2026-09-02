# Constitución De Karenda Web

Estos principios son obligatorios y rigen cada cambio del proyecto.

## 1. La Especificación Es El Contrato

La especificación define el comportamiento esperado, los límites y los
criterios de aceptación. No se implementa una funcionalidad que no tenga una
decisión documentada en la especificación correspondiente.

## 2. Sincronización Spec-Anchored Continua

La spec y el código deben permanecer estrictamente sincronizados. Todo cambio
de comportamiento, modelo de datos, contrato o interfaz actualiza la spec en
el mismo cambio; una spec desactualizada es un defecto.

## 3. Diseño UI/UX Antes De Codificar

Antes de implementar o modificar cualquier interfaz visual, se debe realizar un
análisis UI/UX y documentar las decisiones de dirección visual, tokens, layout,
componentes, estados, responsive y accesibilidad. El análisis aplicará las
metodologías de `pbakaus/impeccable` que correspondan para dar forma, criticar,
auditar y pulir la interfaz, evitando resultados genéricos o derivados de
plantillas. `docs/ui-design.md` será el registro obligatorio de esta dirección;
ningún cambio visual puede comenzar sin una decisión documentada y alineada con
la spec.

## 4. Desarrollo Guiado Por Specs Y Tests

Cada requisito verificable debe traducirse en criterios de aceptación y tests.
El flujo normal es especificar, definir casos de prueba, implementar lo mínimo
necesario y verificar; los tests no sustituyen a la spec ni la spec sustituye
a los tests.

## 5. Trazabilidad Y Cambios Incrementales

Cada cambio debe poder relacionarse con un requisito, una decisión y una
verificación. Se prefieren incrementos pequeños, revisables y reversibles, sin
comportamiento implícito ni alcance no especificado.

## 6. InsForge Es El Backend Exclusivo

Toda la persistencia, autenticación, autorización, lógica de servidor,
funciones, almacenamiento y hosting de producción deben delegarse a InsForge.
No se replica esa lógica en el frontend ni se añade infraestructura backend
alternativa.

## 7. Contratos Preparados Para La Integración Futura

Los modelos, identificadores y contratos públicos deben ser estables,
explícitos y suficientemente agnósticos para permitir el futuro plugin de
KOReader/SimpleUI sin acoplar la aplicación web a una presentación concreta.
