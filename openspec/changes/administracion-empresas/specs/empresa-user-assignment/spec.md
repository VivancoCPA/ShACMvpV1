## ADDED Requirements

### Requirement: EmpresaUsuariosPage permite volver a la lista de empresas
`EmpresaUsuariosPage` SHALL incluir un `Link` a `/admin/empresas` (no `navigate(-1)`) con el mismo patrón visual que las páginas de detalle (`ArrowLeft` + texto localizado), para que funcione también al entrar por deep link. Los filtros y la página de la lista se reinician al volver.

#### Scenario: Volver desde un deep link
- **WHEN** el admin abre directamente `/admin/empresas/:id/usuarios` y pulsa "Volver a empresas"
- **THEN** navega a `/admin/empresas`
