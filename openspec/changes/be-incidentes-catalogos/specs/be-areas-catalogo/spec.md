## ADDED Requirements

### Requirement: Catálogo de Áreas sembrado en desarrollo, por empresa
El sistema SHALL sembrar, en entorno de desarrollo y de forma idempotente, las 19 áreas fijas del catálogo `AREAS_SHAC` (códigos determinísticos `area-001`..`area-019`, mismos nombres que `shc-controldoc/src/mocks/fixtures/areas.fixtures.ts`) **para cada Empresa existente**, no una sola vez de forma global.

#### Scenario: Primer arranque en desarrollo con empresas ya existentes
- **WHEN** la aplicación arranca en `Development`, ya existe al menos una Empresa, y esa Empresa todavía no tiene ninguna de las 19 áreas
- **THEN** el sistema crea las 19 áreas para esa Empresa, con los mismos códigos y nombres del catálogo de referencia

#### Scenario: Arranques subsecuentes
- **WHEN** la aplicación arranca en `Development` y una Empresa ya tiene las 19 áreas sembradas
- **THEN** el sistema no crea filas duplicadas para esa Empresa ni falla el arranque

#### Scenario: Nueva Empresa creada después del primer seed
- **WHEN** se crea una Empresa nueva vía `POST /api/empresas` y luego la aplicación se reinicia en `Development`
- **THEN** el sistema siembra las 19 áreas también para la Empresa nueva, sin duplicar las de empresas ya sembradas

#### Scenario: Sin ninguna Empresa todavía
- **WHEN** la aplicación arranca en `Development` y no existe ninguna Empresa
- **THEN** el sistema no crea ningún Área ni falla el arranque — vuelve a intentarlo en el próximo arranque

### Requirement: Áreas como catálogo por-empresa
El sistema SHALL exponer el catálogo de Áreas scoped por `empresaId` de la sesión (`empresaActivaId`) — un Área solo es visible y referenciable dentro de la empresa a la que pertenece, igual que Locales/Zonas.

#### Scenario: Dos empresas distintas consultan el catálogo
- **WHEN** usuarios de dos empresas distintas hacen `GET /api/areas` con sesiones activas en empresas diferentes
- **THEN** cada uno recibe únicamente las áreas de su propia empresa (mismos 19 códigos `area-001`..`area-019`, pero filas distintas por empresa)

### Requirement: Listado de Áreas
El sistema SHALL exponer `GET /api/areas`, retornando todas las áreas (activas e inactivas) de la empresa activa de la sesión.

#### Scenario: Listado exitoso
- **WHEN** un usuario autenticado con empresa activa solicita `GET /api/areas`
- **THEN** el sistema responde 200 con el arreglo completo de áreas de esa empresa, cada una con `id`, `nombre`, `descripcion` (opcional) y `activo`

### Requirement: Detalle de Área
El sistema SHALL exponer `GET /api/areas/:id`, resuelto dentro de la empresa activa de la sesión.

#### Scenario: Área existente en la empresa propia
- **WHEN** un usuario autenticado solicita `GET /api/areas/:id` con un id existente en su empresa activa
- **THEN** el sistema responde 200 con el área correspondiente

#### Scenario: Área inexistente
- **WHEN** un usuario autenticado solicita `GET /api/areas/:id` con un id que no existe en ninguna empresa
- **THEN** el sistema responde 404

#### Scenario: Área de otra empresa
- **WHEN** un usuario autenticado solicita `GET /api/areas/:id` con un id que existe pero pertenece a otra empresa
- **THEN** el sistema responde 404 (nunca 403 — mismo patrón multi-tenant que el resto del backend)

### Requirement: Sin mutaciones de Áreas en este alcance
El sistema SHALL NOT exponer endpoints de creación, edición, desactivación o reactivación de Áreas en este cambio.

#### Scenario: Intento de crear un Área
- **WHEN** un cliente envía `POST /api/areas`
- **THEN** el sistema no expone esa ruta (404 de enrutamiento, no un endpoint funcional)
