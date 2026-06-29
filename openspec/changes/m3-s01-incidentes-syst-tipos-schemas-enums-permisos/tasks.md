## 1. Tipos y enums del dominio

- [x] 1.1 Crear `src/features/incidents/types/incident.types.ts` con los tipos `IncidentType`, `IncidentStatus`, `IncidentSeveridad`, `IncidentTurno`, `CondicionEntorno` y la constante `CondicionEntornoValues`
- [x] 1.2 Agregar la interfaz `AuditTrailEntry` (con `entidadTipo: 'Incidente'`) en `incident.types.ts`
- [x] 1.3 Agregar la interfaz `AccionCorrectivaIncidente` en `incident.types.ts`
- [x] 1.4 Agregar la interfaz `Incidente` (con todos los campos requeridos y opcionales, incluyendo `informeMedicoAdjunto?` y `qeId?`) en `incident.types.ts`
- [x] 1.5 Crear `src/features/incidents/types/incidentPermissions.types.ts` con la interfaz `IncidentPermissions`

## 2. Helpers de negocio

- [x] 2.1 Crear `src/features/incidents/utils/incidentPermissions.ts` con la función `getIncidentPermissions(incidente, userRole)` respetando la matriz RBAC completa
- [x] 2.2 Crear `src/features/incidents/utils/incidentSeveridad.ts` con la función `getAutoSeveridad(tipo, numLesionados?)`
- [x] 2.3 Crear `src/features/incidents/utils/incidentPlazoInvestigacion.ts` con la función `getPlazoInvestigacion(severidad)`

## 3. Schemas Zod

- [x] 3.1 Crear `src/features/incidents/schemas/createIncident.schema.ts` con `createIncidentSchema` (incluyendo el `.refine` de huboLesionados) y exportar `CreateIncidentInput`
- [x] 3.2 Agregar `updateIncidentInvestigacionSchema` y `UpdateIncidentInvestigacionInput` en `createIncident.schema.ts`
- [x] 3.3 Crear `src/features/incidents/schemas/createAC.schema.ts` con `createACIncidenteSchema` y exportar `CreateACIncidenteInput`

## 4. Constantes compartidas

- [x] 4.1 Agregar `INCIDENT_TYPE_LABELS`, `INCIDENT_STATUS_LABELS` y `CONDICION_ENTORNO_LABELS` en `src/constants/shared.constants.ts` sin modificar ninguna constante existente

## 5. Barrel export

- [x] 5.1 Crear `src/features/incidents/index.ts` con barrel exports de todos los tipos, interfaces, helpers y schemas del módulo

## 6. Verificación TypeScript

- [x] 6.1 Ejecutar `tsc --noEmit` y confirmar cero errores de tipo en los archivos nuevos
- [x] 6.2 Verificar que `getIncidentPermissions(null, 'OPERARIO')` cumple los criterios de aceptación (canCreate true, demás false)
- [x] 6.3 Verificar que `getAutoSeveridad('ACCIDENTE', 2)` retorna `'CRITICA'` y `getPlazoInvestigacion('CRITICA')` retorna `3`
- [x] 6.4 Verificar que `createIncidentSchema.safeParse` falla con descripcion < 20 chars y con huboLesionados=true sin numPersonasAfectadas
