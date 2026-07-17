## ADDED Requirements

### Requirement: Ruta dev-only de reset de stores mock
El sistema SHALL exponer una ruta `/dev/reset-mocks`, registrada como hija de `<AppShell>` sin ningún `<RoleGuard requiredRoles={...}>` adicional (solo requiere sesión autenticada), no enlazada desde `Sidebar.tsx` ni desde ningún flujo de usuario de producción.

#### Scenario: Acceso autenticado por URL directa
- **WHEN** un usuario autenticado con cualquier rol navega directamente a `/dev/reset-mocks`
- **THEN** el sistema renderiza la página de reset sin redirigir a `/no-autorizado`

#### Scenario: No aparece en navegación de producción
- **WHEN** cualquier usuario navega la aplicación mediante `Sidebar.tsx` o cualquier menú de producción
- **THEN** ningún enlace o item conduce a `/dev/reset-mocks`

### Requirement: Confirmación previa a la ejecución del reset
El sistema SHALL solicitar confirmación explícita del usuario antes de ejecutar el reset de stores mock.

#### Scenario: Usuario cancela la confirmación
- **WHEN** el usuario activa el control de reset en `/dev/reset-mocks` y cancela el diálogo de confirmación
- **THEN** el sistema no ejecuta ningún reset de store ni recarga la página

#### Scenario: Usuario acepta la confirmación
- **WHEN** el usuario activa el control de reset y confirma el diálogo
- **THEN** el sistema procede a ejecutar el reset de todos los stores mock de dominio

### Requirement: Reset completo de stores mock de dominio operativo
Al confirmarse el reset, el sistema SHALL reinicializar a su estado de fixtures original todos los stores mutables de los dominios: Documentos, Quality Events, No Conformidades, Incidentes y Locales/Zonas.

#### Scenario: Datos modificados durante la sesión desaparecen tras el reset
- **WHEN** un documento, quality event, no conformidad, incidente o local/zona fue creado o modificado durante la sesión de desarrollo actual, y el usuario confirma el reset en `/dev/reset-mocks`
- **THEN** tras la recarga, ese registro ya no aparece con el valor modificado — el listado del dominio correspondiente refleja únicamente los datos de fixtures originales

#### Scenario: Mutaciones de usuarios también se revierten como efecto del reload
- **WHEN** un usuario fue creado, editado, activado/desactivado o tuvo su contraseña reseteada desde `/usuarios` durante la sesión, y luego se confirma el reset en `/dev/reset-mocks`
- **THEN** tras la recarga, esos datos de usuario también vuelven a su estado de fixtures original — no como resultado de que `resetAllMockStores()` los toque explícitamente, sino porque `window.location.reload()` reinicializa todo el contexto JS de la página (donde viven todos los stores MSW, incluido `authFixtures`), sin importar qué stores reinicialice el código de reset explícito

### Requirement: Recarga completa tras el reset sin cerrar sesión
Tras ejecutar el reset de stores, el sistema SHALL disparar una recarga completa de la página (`window.location.reload()`) manteniendo la sesión del usuario activa.

#### Scenario: Sesión se mantiene tras el reload
- **WHEN** el reset de stores se ejecuta y la página se recarga por completo
- **THEN** el usuario permanece autenticado y no es redirigido a `/login`
