## ADDED Requirements

### Requirement: MSW replica el responsable de investigación
Los handlers de `quality-events.handlers.ts` SHALL implementar: `GET /api/quality-events/candidatos-responsable` (registrado antes de `/api/quality-events/:id`), devolviendo SUPERVISOR y JEFE_CALIDAD_SYST activos de los fixtures; `PATCH /api/quality-events/:id/responsable` con 403 para quien no es JCA, 422 `QE_CERRADO` en estados cerrados, 200 sin audit si no cambia y audit `RESPONSABLE_ASIGNADO`/`RESPONSABLE_CAMBIADO` con nombres; aceptación de `responsableInvestigacionId` en `POST /api/quality-events`; 422 `QE_SIN_RESPONSABLE` en `PATCH /:id/status` hacia EN_INVESTIGACION sin responsable; y `responsableInvestigacionNombre` en detalle y listado.

#### Scenario: Transición sin responsable en el mock
- **WHEN** con MSW activo se pide EN_INVESTIGACION para un QE sin responsable
- **THEN** el handler responde 422 con `errorCode = QE_SIN_RESPONSABLE`

#### Scenario: Asignación por no-JCA en el mock
- **WHEN** un SUPERVISOR llama a `PATCH /:id/responsable`
- **THEN** el handler responde 403
