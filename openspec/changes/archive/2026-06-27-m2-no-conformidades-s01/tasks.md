## 1. Tipos TypeScript — NoConformidad

- [x] 1.1 Crear `src/features/nonconformities/types/nonconformity.types.ts` con las uniones `NCStatus`, `NCOrigen`, `NCTipo`, `NCSeveridad`
- [x] 1.2 Agregar las interfaces `NCPermissions` (9 flags booleanos requeridos) y `NCFilters` al mismo archivo
- [x] 1.3 Agregar la interfaz `NoConformidad` con todos los campos requeridos y opcionales, incluyendo `qeGeneradoId: string | null`
- [x] 1.4 Agregar la interfaz `AuditTrailEntry` scoped a `'NoConformidad'` (entidadTipo literal)
- [x] 1.5 Modificar `src/features/documents/types/document.types.ts`: ampliar `AuditTrailEntry.entidadTipo` de `'Documento'` a `'Documento' | 'NoConformidad'`

## 2. Schemas Zod

- [x] 2.1 Crear `src/features/nonconformities/schemas/createNC.schema.ts` con `createNCSchema` y el tipo exportado `CreateNCInput`
- [x] 2.2 Crear `src/features/nonconformities/schemas/updateNC.schema.ts` con `updateNCSchema` (todos los campos opcionales) y el tipo exportado `UpdateNCInput`
- [x] 2.3 Crear `src/features/nonconformities/schemas/cambiarEstadoNC.schema.ts` con `cambiarEstadoNCSchema` (lógica condicional: `correccionEvidenciaUrl` requerida si `nuevoEstado === 'PENDIENTE_CIERRE'`) y el tipo exportado `CambiarEstadoNCInput`

## 3. Constantes del módulo

- [x] 3.1 Crear `src/features/nonconformities/constants/nonconformity.constants.ts` con `NC_STATE_TRANSITIONS: Record<NCStatus, NCStatus[]>` definiendo las 6 transiciones del state machine
- [x] 3.2 Agregar `NC_STATUS_LABELS`, `NC_TIPO_LABELS`, `NC_SEVERIDAD_LABELS`, `NC_ORIGEN_LABELS` como `Record<T, string>` con claves i18n `'nonconformities:...'`
- [x] 3.3 Agregar `NC_SEVERIDAD_COLORS` y `NC_STATUS_COLORS` con clases Tailwind del design system (`teal`, `amber`, `error`, `success`, `warning`)

## 4. Función de permisos

- [x] 4.1 Crear `src/features/nonconformities/utils/ncPermissions.ts` con la función pura `getNCPermissions(nc: NoConformidad, userRole: UserRole): NCPermissions`
- [x] 4.2 Implementar la lógica de permisos para `OPERARIO` (read-only después de reportar)
- [x] 4.3 Implementar la lógica de permisos para `SUPERVISOR` (puede iniciar, corregir, solicitar cierre; no puede cerrar)
- [x] 4.4 Implementar la lógica de permisos para `JEFE_CALIDAD_SYST` (puede cerrar en `PENDIENTE_CIERRE`, puede reabrir en `CERRADA`)
- [x] 4.5 Implementar la lógica de permisos para `AUDITOR_INTERNO` (read + comment en todos los estados)
- [x] 4.6 Implementar la lógica de permisos para `ALTA_DIRECCION` (read + comment + cerrar + reabrir; nunca editar campos)
- [x] 4.7 Implementar la lógica de permisos para `JEFE_CONTROL_DOCUMENTARIO` (read-only, sin acciones de escritura)

## 5. i18n — Claves de traducción

- [x] 5.1 Agregar namespace `nonconformities` en `src/i18n/es-PE.json` con claves para `status.*`, `tipo.*`, `severidad.*`, `origen.*` y mensajes de validación Zod
- [x] 5.2 Agregar las mismas claves en `src/i18n/en-US.json` con traducciones al inglés

## 6. Tests unitarios

- [x] 6.1 Crear `src/features/nonconformities/utils/ncPermissions.test.ts` con casos de prueba para `getNCPermissions`: SUPERVISOR en DETECTADA, JEFE_CALIDAD_SYST en PENDIENTE_CIERRE, OPERARIO en cualquier estado, AUDITOR_INTERNO
- [x] 6.2 Crear `src/features/nonconformities/schemas/createNC.schema.test.ts` con pruebas de `createNCSchema`: payload válido, `descripcion` corta, `origen` faltante
- [x] 6.3 Crear `src/features/nonconformities/schemas/cambiarEstadoNC.schema.test.ts` con prueba de la validación condicional de `correccionEvidenciaUrl` al transicionar a `PENDIENTE_CIERRE`
