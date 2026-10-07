## ADDED Requirements

### Requirement: Resetear PIN de un usuario asignado requiere confirmación
`EmpresaUsuariosPage` SHALL render a "Resetear PIN" action per row, visible for every `UsuarioEmpresa` row regardless of `estado`. Clicking it SHALL open a confirmation modal (same `ConfirmModal` component used for "Desactivar"/"Reactivar") showing the user's name and the empresa, before executing. Confirming SHALL call `PATCH /api/empresas/{empresaId}/usuarios/{usuarioId}/reset-pin`. On success, the system SHALL show a toast explaining that the user's PIN was cleared and that they must configure a new one from `/perfil` before they can sign again.

#### Scenario: Resetear PIN pide confirmación antes de ejecutar
- **WHEN** `SUPERADMIN` hace click en "Resetear PIN" sobre una fila
- **THEN** se abre un modal de confirmación con el nombre del usuario, y la petición NO se envía hasta confirmar

#### Scenario: Confirmar llama al endpoint correcto
- **WHEN** `SUPERADMIN` confirma el reset de PIN de la fila de `user-supervisor-001` en `empresa-002`
- **THEN** el sistema llama `PATCH /api/empresas/empresa-002/usuarios/{usuarioId de user-supervisor-001}/reset-pin`

#### Scenario: Reset exitoso muestra un toast explicativo
- **WHEN** la respuesta del reset es exitosa
- **THEN** el sistema muestra un toast indicando que el usuario deberá configurar un PIN nuevo antes de poder firmar
