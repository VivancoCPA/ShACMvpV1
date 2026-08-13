## ADDED Requirements

### Requirement: Ruta /perfil accesible para cualquier rol autenticado
El sistema SHALL registrar la ruta `/perfil` sin restricción de `RoleGuard` por rol — solo requiere sesión autenticada, heredada del guard raíz. Esto incluye explícitamente a los roles `SUPERADMIN` y `ADMINISTRADOR_EMPRESA` (introducidos por `me-f4-admin-empresas`), además de los seis roles de dominio (`OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO`, `ALTA_DIRECCION`) y `ADMINISTRADOR_SISTEMA`.

#### Scenario: Cualquier rol autenticado navega a /perfil sin redirección
- **WHEN** un usuario autenticado con cualquier valor de `UserRole` navega a `/perfil`
- **THEN** el router permanece en `/perfil` y no redirige a `/no-autorizado`

#### Scenario: SUPERADMIN y ADMINISTRADOR_EMPRESA acceden a /perfil igual que los demás roles
- **WHEN** un usuario con `rol: 'SUPERADMIN'` o `rol: 'ADMINISTRADOR_EMPRESA'` navega a `/perfil`
- **THEN** el router permanece en `/perfil` y no redirige a `/no-autorizado`, con el mismo comportamiento que los seis roles de dominio y `ADMINISTRADOR_SISTEMA`
