## Why

M1 (Control Documentario) está completo. El siguiente módulo en la hoja de ruta es M2 — Gestión de No Conformidades, que cubre ISO 9001:2015 §8.7 y §10.2 y sirve como fuente de origen `O2_NC_DETECTADA` para Quality Events. Esta primera spec establece la capa de tipos, esquemas Zod, constantes y permisos — la base que consumen todas las specs siguientes de M2.

## What Changes

- Nuevo tipo `NCStatus` (máquina de estados de No Conformidad): `DETECTADA | EN_INVESTIGACION | EN_CORRECCION | PENDIENTE_CIERRE | CERRADA | REABIERTA`
- Nuevo tipo `NCOrigen`: `INSPECCION_INTERNA | AUDITORIA_INTERNA | AUDITORIA_EXTERNA | CLIENTE_RECLAMO | OPERACION_CAMPO | CONTROL_PROCESO`
- Nuevo tipo `NCTipo`: `PROCESO | PRODUCTO | SERVICIO | SISTEMA | SST`
- Nuevo tipo `NCSeveridad`: `MENOR | MAYOR | CRITICA`
- Nueva interfaz `NoConformidad` con todos los campos del dominio
- Nueva interfaz `NCPermissions` con flags booleanos de acción por rol/estado
- Nueva interfaz `NCFilters` para queries de lista paginada
- Nuevos schemas Zod: `createNCSchema`, `updateNCSchema`, `cambiarEstadoNCSchema`
- Nuevas constantes: `NC_STATE_TRANSITIONS`, `NC_STATUS_LABELS`, `NC_TIPO_LABELS`, `NC_SEVERIDAD_LABELS`, `NC_ORIGEN_LABELS`
- Nueva función `getNCPermissions(nc, userRole)` → `NCPermissions`
- Nuevas reglas de negocio RN-NC-001 a RN-NC-007
- Extensión de `AuditTrailEntry.entidadTipo` para incluir `'NoConformidad'`

## Capabilities

### New Capabilities
- `nonconformity-types`: Tipos TypeScript centrales del dominio M2 — `NCStatus`, `NCTipo`, `NCSeveridad`, `NCOrigen`, `NoConformidad`, `NCPermissions`, `NCFilters`, `AuditTrailEntry` scoped para NC
- `nonconformity-schemas`: Schemas Zod para crear NC, actualizar campos editables y cambiar estado, con mensajes de validación i18n
- `nonconformity-constants`: Constantes del módulo — mapa de transiciones de estado, labels de UI para cada enum, colores semáforo por severidad
- `nonconformity-permissions`: Función pura `getNCPermissions(nc, userRole)` que implementa la matriz de permisos por estado y rol

### Modified Capabilities
- `document-types`: Extender `AuditTrailEntry.entidadTipo` para incluir `'NoConformidad'` junto a `'Documento'` ya existente

## Impact

- Nuevo archivo: `src/features/nonconformities/types/nonconformity.types.ts`
- Nuevo archivo: `src/features/nonconformities/schemas/createNC.schema.ts`
- Nuevo archivo: `src/features/nonconformities/schemas/updateNC.schema.ts`
- Nuevo archivo: `src/features/nonconformities/schemas/cambiarEstadoNC.schema.ts`
- Nuevo archivo: `src/features/nonconformities/constants/nonconformity.constants.ts`
- Nuevo archivo: `src/features/nonconformities/utils/ncPermissions.ts`
- Modificación: `src/features/documents/types/document.types.ts` — ampliar `entidadTipo`
- Sin cambios en rutas, MSW ni componentes (cubiertos en specs posteriores)
