## ADDED Requirements

### Requirement: Detalle de Local con Zonas embebidas

El sistema SHALL exponer `GET /api/locales/{id}`, retornando el Local de la empresa activa de la sesión (`empresaActivaId`) junto con sus Zonas (`zonas: Zona[]`), sin restricción de rol más allá de autenticación.

#### Scenario: Detalle exitoso de un Local propio con zonas

- **WHEN** un usuario autenticado con empresa activa solicita `GET /api/locales/{id}` de un Local que pertenece a esa empresa
- **THEN** el sistema responde `200` con el Local y el arreglo `zonas` con las zonas activas de ese Local

#### Scenario: Detalle de un Local sin zonas

- **WHEN** un usuario autenticado solicita `GET /api/locales/{id}` de un Local propio que todavía no tiene ninguna Zona
- **THEN** el sistema responde `200` con el Local y `zonas: []`

#### Scenario: Local inexistente o de otra empresa

- **WHEN** un usuario autenticado solicita `GET /api/locales/{id}` con un `id` que no existe o pertenece a otra empresa
- **THEN** el sistema responde `404`, sin distinguir entre "no existe" y "es de otra empresa"

#### Scenario: Sin empresa activa

- **WHEN** un usuario autenticado sin `empresaActivaId` resuelta en la sesión solicita `GET /api/locales/{id}`
- **THEN** el sistema responde `404`

### Requirement: Listado de todas las Zonas de la empresa activa, sin filtro de Local ni de estado

El sistema SHALL exponer `GET /api/zonas`, retornando todas las Zonas (activas e inactivas) de todos los Locales de la empresa activa de la sesión (`empresaActivaId`), sin restricción de rol más allá de autenticación. A diferencia de `GET /api/locales/:localId/zonas` (solo zonas activas de un Local), este endpoint no filtra por `activo` porque `LocalList.tsx` (frontend) agrupa el resultado por `localId` para ofrecer la acción "Reactivar" sobre una Zona inactiva — filtrar aquí las escondería sin dar forma de reactivarlas.

#### Scenario: Listado sin filtro de Local

- **WHEN** un usuario autenticado con empresa activa solicita `GET /api/zonas`
- **THEN** el sistema responde `200` con todas las Zonas (activas e inactivas) de todos los Locales de esa empresa, sin paginación

#### Scenario: Aislamiento multi-tenant en el listado

- **WHEN** la empresa activa de la sesión tiene cero Zonas propias, aunque existan Zonas de otras empresas
- **THEN** el sistema responde `200` con un arreglo vacío, nunca con Zonas de otra empresa

#### Scenario: Sin empresa activa

- **WHEN** un usuario autenticado sin `empresaActivaId` resuelta en la sesión solicita `GET /api/zonas`
- **THEN** el sistema responde `200` con un arreglo vacío, igual que `GET /api/locales` en el mismo estado
