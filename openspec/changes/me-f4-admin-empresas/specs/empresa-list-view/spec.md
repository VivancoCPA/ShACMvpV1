## ADDED Requirements

### Requirement: EmpresasAdminPage lista todas las empresas del sistema
`src/features/empresas/pages/EmpresasAdminPage.tsx` SHALL renderizarse en la ruta `/admin/empresas`, mostrando una tabla con logo (o placeholder de iniciales si no hay `logoUrl`), razón social, RUC, estado (badge activa/inactiva) y fecha de alta formateada con `Intl.DateTimeFormat` según el locale activo. La página SHALL usar `EmpresaFormModal` (ver `empresa-form`) para alta/edición.

#### Scenario: Listado muestra todas las empresas con sus datos clave
- **WHEN** `SUPERADMIN` navega a `/admin/empresas`
- **THEN** la tabla muestra logo/placeholder, razón social, RUC, estado y fecha de alta de cada empresa, incluidas las inactivas

#### Scenario: Empresa sin logo muestra placeholder
- **WHEN** una empresa no tiene `logoUrl`
- **THEN** la fila muestra un placeholder (iniciales de la razón social sobre fondo de color), no un ícono roto ni un espacio vacío

### Requirement: Activar/desactivar empresa requiere confirmación explícita
La acción de desactivar una empresa SHALL abrir un modal de confirmación que advierte explícitamente que todos sus usuarios asignados perderán acceso (RN-EMP-005) antes de ejecutar el cambio. La acción de reactivar SHALL advertir explícitamente que las asignaciones de usuario no se restauran automáticamente.

#### Scenario: Desactivar pide confirmación con advertencia de impacto
- **WHEN** el admin hace click en "Desactivar" sobre una empresa activa
- **THEN** se abre un modal de confirmación indicando que sus usuarios asignados perderán acceso, y la desactivación NO se ejecuta hasta confirmar

#### Scenario: Reactivar pide confirmación con advertencia de que las asignaciones no se restauran
- **WHEN** el admin hace click en "Reactivar" sobre una empresa inactiva
- **THEN** se abre un modal de confirmación indicando que las asignaciones de usuario deben reactivarse manualmente, y la reactivación NO se ejecuta hasta confirmar

### Requirement: Cada fila enlaza a la pantalla de asignación de usuarios de esa empresa
Cada fila de `EmpresaList` SHALL incluir un enlace/botón "Usuarios" que navega a `/admin/empresas/:id/usuarios` (ver `empresa-user-assignment`).

#### Scenario: Click en "Usuarios" navega a la pantalla de asignación
- **WHEN** el admin hace click en "Usuarios" sobre la fila de `empresa-001`
- **THEN** navega a `/admin/empresas/empresa-001/usuarios`
