## ADDED Requirements

### Requirement: Ruta /acciones-correctivas registrada con RoleGuard para los 6 roles operativos
`ROUTE_ROLE_GROUPS` SHALL incluir `accionesCorrectivas`, con `OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO` y `ALTA_DIRECCION`.

El router SHALL registrar `/acciones-correctivas` (que monta `AccionesCorrectivasPage`) bajo `<RoleGuard requiredRoles={ROUTE_ROLE_GROUPS.accionesCorrectivas} />`, con breadcrumb. `ROUTE_ACCESS_TABLE` SHALL incluir la entrada `/acciones-correctivas`.

#### Scenario: Operario accede
- **WHEN** un `OPERARIO` navega a `/acciones-correctivas`
- **THEN** la página se renderiza sin redirección

#### Scenario: Administrador del sistema es redirigido
- **WHEN** un `ADMINISTRADOR_SISTEMA` navega a `/acciones-correctivas`
- **THEN** es redirigido a `/no-autorizado`
