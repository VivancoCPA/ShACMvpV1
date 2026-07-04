## 1. Tipos y permisos — No Conformidad (M2)

- [x] 1.1 Agregar `canCrearQE` a la interfaz `NCPermissions` en `src/features/nonconformities/types/nonconformity.types.ts`
- [x] 1.2 Implementar la regla de `canCrearQE` en `getNCPermissions` (`src/features/nonconformities/utils/ncPermissions.ts`): `true` para `SUPERVISOR`/`JEFE_CALIDAD_SYST` cuando `estado` no es `CERRADA`/`ANULADA` y `qeGeneradoId` está ausente; `false` en cualquier otro caso
- [x] 1.3 Test unitario de `canCrearQE` cubriendo los escenarios de `specs/nonconformity-permissions/spec.md`

## 2. Tipos y permisos — Incidente (M3)

- [x] 2.1 Agregar `canCrearQE` a la interfaz `IncidentPermissions` en `src/features/incidents/types/incidentPermissions.types.ts`
- [x] 2.2 Implementar la regla de `canCrearQE` en `getIncidentPermissions` (`src/features/incidents/utils/incidentPermissions.ts`): `true` para `SUPERVISOR`/`JEFE_CALIDAD_SYST` cuando `estado` no es `CERRADO`/`ANULADO`, `deletedAt` está ausente, y `qeId` está ausente; `false` en cualquier otro caso
- [x] 2.3 Test unitario de `canCrearQE` cubriendo los escenarios de `specs/incident-permissions/spec.md`

## 3. Claves i18n

- [x] 3.1 Agregar clave `nonconformities:detail.crearQE` (es-PE: "Crear QE", en-US: "Create QE") en los archivos de locale
- [x] 3.2 Agregar clave `incidents:detail.crearQE` (mismo texto) en los archivos de locale
- [x] 3.3 Agregar clave `qualityEvents:form.areaDivergeWarning` con interpolación `{{tipoEtiqueta}}`, `{{numero}}`, `{{areaOrigen}}` en es-PE ("Esta área difiere de la registrada en {{tipoEtiqueta}} {{numero}}: {{areaOrigen}}.") y su equivalente en en-US

## 4. Botón "Crear QE" en detalle de NC

- [x] 4.1 Renderizar el botón "Crear QE" en `NonconformityDetailPage` cuando `getNCPermissions(nc, userRole).canCrearQE === true`, junto a los demás botones de acción
- [x] 4.2 Implementar el `onClick` que navega a `/quality-events/nuevo?origen=O2_NC_DETECTADA&ncId={id}&ncNumero={numero}&ncArea={areaAfectada}` con los valores codificados para URL (`encodeURIComponent`)
- [x] 4.3 Test: botón visible/ausente según `canCrearQE`, y navegación con los query params correctos al hacer clic

## 5. Botón "Crear QE" en detalle de Incidente

- [x] 5.1 Renderizar el botón "Crear QE" en la página de detalle de incidente cuando `getIncidentPermissions(incidente, userRole).canCrearQE === true`, distinto del enlace "Ver en QE" / botón "Solicitar AC en QE" existentes
- [x] 5.2 Implementar el `onClick` que navega a `/quality-events/nuevo?origen=O1_INCIDENTE_CAMPO&incidenteId={id}&incidenteNumero={numero}&incidenteArea={areaId}` con los valores codificados para URL
- [x] 5.3 Test: botón visible/ausente según `canCrearQE`, y navegación con los query params correctos al hacer clic

## 6. QualityEventForm — lectura de query params de vinculación

- [x] 6.1 Leer `origen`, `ncId`/`incidenteId`, `ncNumero`/`incidenteNumero`, `ncArea`/`incidenteArea` con `useSearchParams` al montar en modo creación
- [x] 6.2 Cuando `origen` es `O2_NC_DETECTADA` o `O1_INCIDENTE_CAMPO`, prellenar `origen` y el campo específico de origen (`ncId`/`incidenteId`) vía `setValue`, una sola vez al montar
- [x] 6.3 Cuando `origen` es cualquier otro valor o está ausente, no aplicar ningún prellenado (comportamiento actual sin cambios)
- [x] 6.4 Test: prellenado correcto para O1 y O2, ausencia de prellenado sin query params o con `origen` no reconocido

## 7. QualityEventForm — prellenado y advertencia de área (RN-QE-013)

- [x] 7.1 Derivar y memoizar `origenEntidad: { tipoEtiqueta: 'la NC' | 'el Incidente'; numero: string; area: string } | null` a partir de los query params, solo cuando el área de origen no está vacía
- [x] 7.2 Prellenar `areaAfectada` con `origenEntidad.area` cuando `origenEntidad` no es `null`
- [x] 7.3 Comparar en tiempo real `watch('areaAfectada')` contra `origenEntidad.area` y renderizar la advertencia no bloqueante con `t('qualityEvents:form.areaDivergeWarning', ...)` cuando difieren y el valor no está vacío
- [x] 7.4 Confirmar que la advertencia nunca bloquea el submit ni genera `AuditTrailEntry`
- [x] 7.5 Test: todos los escenarios de `specs/quality-event-form/spec.md` para esta regla (prefill sin advertencia, advertencia exacta para NC e Incidente, advertencia no bloqueante, advertencia desaparece al restaurar el área original, sin prefill/advertencia para O1 sin query params, sin prefill/advertencia cuando falta el área de origen)

## 8. Verificación manual

- [ ] 8.1 Recorrer los 8 criterios de aceptación de `proposal.md` de punta a punta en el navegador (MSW activo): crear QE desde NC, desde Incidente, cambiar y restaurar área, caso de origen sin área registrada
