# be-locales-zonas-lectura

## Purpose

Backend .NET de solo lectura para Locales y Zonas, scoped por `empresaId` de la sesión activa: `GET /api/locales` y `GET /api/locales/:localId/zonas`, más el seed de datos de desarrollo. El CRUD administrativo de Locales/Zonas (creación, edición, plano PNG) pertenece a M6 y está fuera de alcance de este cambio.

## Requirements

### Requirement: Listado de Locales de la empresa activa
El sistema SHALL exponer `GET /api/locales`, retornando los locales de la empresa activa de la sesión (`empresaActivaId`), con filtro opcional `activo`.

#### Scenario: Listado sin filtro
- **WHEN** un usuario autenticado con empresa activa solicita `GET /api/locales`
- **THEN** el sistema responde 200 con todos los locales (activos e inactivos) de esa empresa, sin paginación

#### Scenario: Listado filtrado por activo
- **WHEN** un usuario autenticado solicita `GET /api/locales?activo=true`
- **THEN** el sistema responde 200 solo con los locales activos de su empresa activa

#### Scenario: Aislamiento multi-tenant en el listado
- **WHEN** la empresa activa de la sesión tiene cero locales propios, aunque existan locales de otras empresas
- **THEN** el sistema responde 200 con un arreglo vacío, nunca con locales de otra empresa

### Requirement: Listado de Zonas por Local
El sistema SHALL exponer `GET /api/locales/:localId/zonas` (path param), retornando las zonas activas de ese local dentro de la empresa activa.

#### Scenario: Zonas de un local propio
- **WHEN** un usuario autenticado solicita `GET /api/locales/:localId/zonas` y el local `:localId` pertenece a su empresa activa
- **THEN** el sistema responde 200 con las zonas de ese local

#### Scenario: Local inexistente o de otra empresa
- **WHEN** un usuario autenticado solicita `GET /api/locales/:localId/zonas` y `:localId` no existe o pertenece a otra empresa
- **THEN** el sistema responde 404, sin distinguir entre "no existe" y "es de otra empresa"

### Requirement: Datos de desarrollo seedeados
El sistema SHALL sembrar, en entorno de desarrollo y de forma idempotente, un conjunto realista de Locales y Zonas (2-3 locales, cada uno con 2-3 zonas) para que los endpoints de solo lectura sean verificables en pruebas manuales.

#### Scenario: Primer arranque en desarrollo
- **WHEN** la aplicación arranca en `Development` y no existen locales de desarrollo previamente sembrados
- **THEN** el sistema crea los locales y zonas de desarrollo, asociados a una empresa de desarrollo existente

#### Scenario: Arranques subsecuentes
- **WHEN** la aplicación arranca en `Development` y los locales de desarrollo ya existen
- **THEN** el sistema no duplica filas ni falla el arranque

### Requirement: Sin mutaciones de Locales/Zonas en este alcance
El sistema SHALL NOT exponer endpoints de creación, edición, desactivación, reactivación ni upload de plano PNG para Locales o Zonas en este cambio — ese es el CRUD administrativo de M6, fuera de alcance.

#### Scenario: Intento de crear un Local
- **WHEN** un cliente envía `POST /api/locales`
- **THEN** el sistema no expone esa ruta en este cambio
