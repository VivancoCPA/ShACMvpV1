## ADDED Requirements

### Requirement: esResponsable se deriva del responsable de investigación del QE
Todo consumidor de `getQualityEventPermissions` que dependa del responsable de la investigación SHALL calcular `esResponsable` como `qe.responsableInvestigacionId === usuario.id` (helper `esResponsableInvestigacion(qe, usuario)`), nunca con un literal `false`. Los consumidores que usan otro concepto de "responsable" (p. ej. `QEVerificacionSection` con `auditorAsignadoId`) SHALL conservarlo.

#### Scenario: SUPERVISOR responsable
- **WHEN** un SUPERVISOR es el `responsableInvestigacionId` de un QE en ABIERTO
- **THEN** `getQualityEventPermissions` devuelve `puedeEditarCabecera = true` para él

#### Scenario: SUPERVISOR no responsable
- **WHEN** el SUPERVISOR no es el responsable
- **THEN** `puedeEditarCabecera = false`, y `puedeAvanzarEstado` sigue siendo `true` en ABIERTO
