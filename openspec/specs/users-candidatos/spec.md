# users-candidatos

## Purpose

Endpoints y hooks de candidatos de usuario para selectores operativos, de modo que los módulos operativos no dependan de `GET /api/users` (restringido a administradores).

## Requirements

### Requirement: Endpoint de candidatos de usuario para selectores operativos
El backend SHALL exponer `GET /api/users/candidatos?roles=ROL1,ROL2,...`, accesible a cualquier usuario autenticado con empresa activa (sin restricción de rol). SHALL devolver `[{ id, nombreCompleto, rol, avatarUrl? }]` con los usuarios activos que tienen una asignación `ACTIVO` en la empresa de la sesión con alguno de los roles pedidos, ordenados por nombre. Los roles ADMINISTRADOR_EMPRESA, ADMINISTRADOR_SISTEMA y SUPERADMIN MUST filtrarse en el servidor y nunca devolverse, aunque se pidan. Un rol desconocido o la lista vacía MUST responder 400.

#### Scenario: Pedir auditores
- **WHEN** un JEFE_CALIDAD_SYST consulta `?roles=AUDITOR_INTERNO`
- **THEN** la respuesta es 200 con los auditores internos activos de la empresa

#### Scenario: Administradores filtrados
- **WHEN** se consulta `?roles=ADMINISTRADOR_EMPRESA,SUPERVISOR`
- **THEN** la respuesta solo incluye supervisores

#### Scenario: Rol inválido
- **WHEN** se consulta `?roles=FOO`
- **THEN** la respuesta es 400

### Requirement: Los selectores operativos no usan GET /api/users
Los componentes operativos SHALL usar `useCandidatosUsuarios(roles)` (queryKey `['users', 'candidatos', roles]`) en lugar de `useUsers()`: `QEVerificacionSection` con `['AUDITOR_INTERNO']` y `NCForm` ("Detectado por") con OPERARIO, SUPERVISOR, JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, AUDITOR_INTERNO y ALTA_DIRECCION. `useUsers()` SHALL quedar solo en pantallas de administración (`AsignarUsuarioModal`, `UserList`). Los textos que muestran a un usuario por id (solicitante del ajuste de plazo, responsable en `NCList`) SHALL mostrar el nombre resuelto (`responsableNombre` del DTO o `useUserNames`) y "Usuario no disponible" como fallback — nunca el id.

#### Scenario: Lista de auditores para el JCA
- **WHEN** un JEFE_CALIDAD_SYST abre la verificación de un QE `CERRADO`
- **THEN** la lista de auditores muestra los AUDITOR_INTERNO activos de la empresa

#### Scenario: Responsable en NCList
- **WHEN** una NC tiene una AC con responsable
- **THEN** la columna de responsable muestra su nombre, no su id

### Requirement: MSW de candidatos de usuario y 403 en GET /api/users
El MSW SHALL exponer `GET /api/users/candidatos?roles=…` con el mismo filtrado (rol en la empresa activa, asignación y usuario activos, nunca administradores). `GET /api/users` en MSW MUST responder 403 a sesiones cuyo rol no sea ADMINISTRADOR_EMPRESA ni SUPERADMIN, igual que el backend real.

#### Scenario: GET /api/users como JCA en MSW
- **WHEN** con MSW activo un JEFE_CALIDAD_SYST llama `GET /api/users`
- **THEN** la respuesta es 403
