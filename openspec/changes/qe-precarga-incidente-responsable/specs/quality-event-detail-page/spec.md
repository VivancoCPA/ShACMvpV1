## ADDED Requirements

### Requirement: QEHeaderSection muestra y permite asignar el responsable de investigación
`QEHeaderSection` SHALL renderizar la fila `t('qualityEvents:detail.responsable.label')` con avatar (foto o iniciales) y `qe.responsableInvestigacionNombre`. Sin responsable SHALL mostrar `t('qualityEvents:detail.responsable.sinAsignar')` en ámbar. Si el usuario es `JEFE_CALIDAD_SYST` y el estado no es `CERRADO`, `EN_VERIFICACION` ni `VERIFICADO`, SHALL mostrar el botón `asignar` (sin responsable) o `cambiar` (con responsable), que abre un modal con el `SearchableSelect` de candidatos y llama a `PATCH /api/quality-events/{id}/responsable`; al terminar SHALL invalidar el detalle y el audit trail del QE.

#### Scenario: Sin responsable, visto por JCA
- **WHEN** un JCA abre un QE ABIERTO sin responsable
- **THEN** ve "Sin asignar" y el botón "Asignar"

#### Scenario: Visto por otro rol
- **WHEN** un SUPERVISOR abre el mismo QE
- **THEN** ve "Sin asignar" y no ve el botón

#### Scenario: Asignación exitosa
- **WHEN** el JCA elige un candidato y confirma
- **THEN** la cabecera muestra el nombre del responsable

### Requirement: QEStatusTransitionPanel bloquea EN_INVESTIGACION sin responsable
Cuando `EN_INVESTIGACION` es un destino válido y `qe.responsableInvestigacionId` está vacío, `QEStatusTransitionPanel` SHALL renderizar ese botón deshabilitado con el tooltip `t('qualityEvents:errors.QE_SIN_RESPONSABLE')`. Si el usuario es JCA, SHALL ofrecer un enlace que abre el mismo modal de asignación de la cabecera. Si el servidor responde `errorCode = QE_SIN_RESPONSABLE`, SHALL mostrar ese mismo mensaje traducido.

#### Scenario: Botón deshabilitado
- **WHEN** un QE ABIERTO no tiene responsable
- **THEN** el botón EN_INVESTIGACION está deshabilitado con el tooltip

#### Scenario: Error del servidor
- **WHEN** la transición devuelve `QE_SIN_RESPONSABLE`
- **THEN** el toast muestra el mensaje traducido de `errors.QE_SIN_RESPONSABLE`
