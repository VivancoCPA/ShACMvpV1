## Why

Tras varias demos a usuarios surgió la necesidad de instalar SHAC para distintas empresas usando una misma base de datos (multi-tenant, DB compartida), donde un usuario puede pertenecer a más de una empresa con un rol distinto en cada una. Como el backend .NET real aún no existe, esta es la etapa de menor costo para incorporar el cambio de modelo de datos antes de construir el backend real.

Esta es la **Fase 1 de 5** de la iniciativa Multiempresa (ver `SHAC-Multiempresa-Propuesta-2026-07-23.md` para el detalle completo de RN-EMP-001 a 007). Esta fase cubre únicamente el modelo de datos base y la mock data de verificación.

## What Changes

- **ADDED**: Entidad `Empresa` (`id`, `razonSocial`, `ruc`, `estado` ACTIVA/INACTIVA, `logoUrl`, `fechaAlta`).
- **ADDED**: Entidad puente `UsuarioEmpresa` (`usuarioId`, `empresaId`, `rol`, `estado` ACTIVO/INACTIVO, `fechaAsignacion`). El rol vive aquí, no en `Usuario` — un mismo usuario puede tener rol distinto en cada empresa (RN-EMP-002).
- **MODIFIED**: Entidades transaccionales existentes — `Documento`, `Incidente`, `NoConformidad`, `QualityEvent`, `Local`, `Zona` — agregan `empresaId: string` obligatorio e inmutable tras creación (RN-EMP-001).
- **ADDED**: Mock data de 2 empresas de prueba completas (minería/logística en Perú), cada una con logo propio, 3-4 usuarios con roles operativos (incluyendo al menos 1 usuario asignado a **ambas** empresas con rol distinto en cada una), y un set de datos independiente por módulo (Documentos, Incidentes, NC, QE) correctamente etiquetado con su `empresaId`.
- **MODIFIED**: Fixtures/factories de tests existentes que construyen estas entidades, para incluir `empresaId` sin romper la suite actual.

**Fuera de alcance de esta fase** (no implementar todavía — pertenece a Fases 2-4):
- Filtrado por empresa en handlers MSW o en la UI (Fase 3).
- Selector de empresa activa / cambio de contexto en sesión (Fase 2).
- Resolución de rol efectivo vía `UsuarioEmpresa` en RBAC (Fase 2).
- CRUD de administración de empresas y asignación de usuarios (Fase 4).
- Pantalla de Login con panel de logo (Fase 2).

En esta fase el campo `empresaId` existe en el modelo y en los mocks, pero el comportamiento actual de la app puede seguir ignorándolo — se debe validar que no rompa nada existente (specs y handlers actuales siguen operando sin filtrar por empresa).

## Capabilities

### New Capabilities
- `empresa-types`: tipos TypeScript y constantes para la entidad `Empresa` (estado, forma del objeto).
- `empresa-usuario-types`: tipos TypeScript para la entidad puente `UsuarioEmpresa` (rol por empresa, estado de asignación).
- `empresa-msw-fixtures`: mock data de las 2 empresas de prueba y las asignaciones `UsuarioEmpresa`, incluyendo el usuario con doble asignación.

### Modified Capabilities
- `document-types`: `Documento` agrega `empresaId: string` obligatorio e inmutable tras creación.
- `document-msw-fixtures`: fixtures existentes de documentos etiquetados con `empresaId`, más nuevos fixtures de `empresa-002`.
- `incident-types`: `Incidente`, `Local` y `Zona` (las tres definidas en `src/features/incidents/types/incident.types.ts`) agregan `empresaId: string` obligatorio e inmutable tras creación.
- `incident-msw-fixtures`: fixtures existentes de incidentes (`src/mocks/fixtures/incidents.fixtures.ts`) etiquetados con `empresaId`, más nuevos fixtures de `empresa-002`.
- `incident-locales`: fixtures existentes de `Local`/`Zona` (`src/mocks/fixtures/locales.fixtures.ts`) etiquetados con `empresaId`, más un nuevo local/zona de `empresa-002`.
- `nonconformity-types`: `NoConformidad` agrega `empresaId: string` obligatorio e inmutable tras creación.
- `nc-msw-fixtures`: fixtures existentes de no conformidades etiquetados con `empresaId`, más nuevos fixtures de `empresa-002`.
- `quality-event-types`: `QualityEvent` agrega `empresaId: string` obligatorio e inmutable tras creación.
- `quality-event-msw-fixtures`: fixtures existentes de quality events etiquetados con `empresaId`, más nuevos fixtures de `empresa-002`.

**Nota de alcance:** `Area` (catálogo de departamentos, `features/areas/`) y las capabilities `area-types`/`location-business-rules`/`location-admin-mocks`/`area-admin-mocks` (reglas y admin CRUD de M6) **no** se modifican en esta fase — el proposal original solo pide `empresaId` en Documentos/Incidentes/NC/QE/Locales/Zonas, no en el catálogo de Áreas. `shared-user-identity` tampoco se modifica: su única responsabilidad es resolución de nombres para display y no es el lugar natural para documentar la relación `Usuario` ↔ `UsuarioEmpresa` — esa relación queda documentada dentro de la nueva capability `empresa-usuario-types`.

## Impact

- **Specs afectadas**: las listadas arriba (tipos + fixtures de Documentos, Incidentes, NC, QE, Locales/Zonas) más las dos specs nuevas de `Empresa`/`UsuarioEmpresa`.
- **Código afectado**: definiciones de tipos/entidades (`*.types.ts`) de cada dominio, fixtures en `src/mocks/fixtures/`, factories/fixtures usadas por tests unitarios que instancian estas entidades.
- **Riesgo**: bajo — es aditivo y no debería alterar comportamiento observable de la app en esta fase (ningún handler MSW ni componente filtra aún por `empresaId`), solo el modelo de datos subyacente y la mock data.
- **Dependencias**: ninguna — es la base para las Fases 2-5.
