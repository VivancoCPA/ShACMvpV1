# documentos-candidatos-asignacion

## Purpose

Define quiénes son los candidatos elegibles para los roles `RevisorId`/`AprobadorId` de un `Documento` (RN-DOC-019 y decisión D1 de `documentos-revisor-aprobador-reales`), el endpoint que los expone al frontend real (reemplazando los fixtures estáticos usados antes por `DocumentForm`), y la validación server-side que impide persistir un `RevisorId`/`AprobadorId` fuera de ese conjunto.

## Requirements

### Requirement: Roles elegibles de Revisor y Aprobador (D1)
El sistema SHALL definir la elegibilidad por rol en una única constante por lado (backend y `features/documents/constants.ts`): Revisor ∈ {`JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO`, `ALTA_DIRECCION`}; Aprobador ∈ {`JEFE_CONTROL_DOCUMENTARIO`, `ALTA_DIRECCION`}. El rol evaluado SHALL ser `usuarios_empresa.rol` de la empresa activa. El autor del documento SHALL quedar excluido de ambas listas (D2).

#### Scenario: Rol no elegible como Aprobador
- **WHEN** un usuario con rol `AUDITOR_INTERNO` se evalúa como Aprobador
- **THEN** no es elegible

#### Scenario: Rol elegible como Revisor
- **WHEN** un usuario con rol `AUDITOR_INTERNO` se evalúa como Revisor
- **THEN** es elegible

### Requirement: Endpoint de candidatos de asignación
El sistema SHALL exponer `GET /api/documents/candidatos-asignacion?tipo=REVISOR|APROBADOR[&documentoId=]`, con `RequireAuthorization` y `RequireEmpresaActivaFilter`, accesible a cualquier usuario autenticado con empresa activa (no restringido a `ADMINISTRADOR_EMPRESA`). SHALL devolver solo usuarios activos con asignación ACTIVA en la empresa activa de la sesión y rol elegible para `tipo`, ordenados por nombre, con los campos `id`, `nombreCompleto` y `rol` únicamente (sin email ni avatar). SHALL excluir al autor: el usuario de la sesión si no se envía `documentoId`, o el `AutorId` del documento si se envía. SHALL responder `404` si `documentoId` no existe o pertenece a otra empresa, y `400` si `tipo` es inválido.

#### Scenario: Solo usuarios de la empresa activa
- **WHEN** existen usuarios elegibles en otra empresa y se consulta el endpoint
- **THEN** ninguno de ellos aparece en la respuesta

#### Scenario: Usuario inactivo o con asignación inactiva excluido
- **WHEN** un usuario de rol elegible está inactivo o su asignación en la empresa no es ACTIVA
- **THEN** no aparece en la respuesta

#### Scenario: Autor excluido en creación
- **WHEN** el autor (usuario de sesión) tiene rol elegible y consulta sin `documentoId`
- **THEN** no aparece en su propia lista

#### Scenario: Autor excluido en edición
- **WHEN** se consulta con `documentoId` de un documento de la empresa
- **THEN** se excluye el `AutorId` de ese documento

#### Scenario: documentoId de otra empresa
- **WHEN** se consulta con el `documentoId` de un documento de otra empresa
- **THEN** el sistema responde `404`

### Requirement: Validación server-side de Revisor y Aprobador
El sistema SHALL validar, mediante un helper compartido en `Features/Documentos/Shared/`, que `RevisorId` y `AprobadorId` informados en `POST /api/documents` y `PUT /api/documents/:id` correspondan a un usuario existente, activo, con asignación ACTIVA en la empresa activa, con rol elegible según D1 y distinto del autor (actor en creación, `AutorId` en edición). Ante incumplimiento SHALL responder error de validación (mismo formato de `ValidationFilter`, no 404) con mensaje por campo `revisorId` / `aprobadorId`. Los campos ausentes no se validan. `NuevaVersionDocumento` hereda ambos valores del documento origen y no los acepta, por lo que no aplica.

#### Scenario: Candidato de otra empresa rechazado
- **WHEN** se envía `revisorId` de un usuario de otra empresa
- **THEN** el sistema rechaza con error de validación en `revisorId`

#### Scenario: GUID inexistente rechazado
- **WHEN** se envía `aprobadorId` que no existe
- **THEN** el sistema rechaza con error de validación en `aprobadorId`

#### Scenario: Usuario inactivo rechazado
- **WHEN** se envía un `revisorId` de usuario inactivo
- **THEN** el sistema rechaza con error de validación

#### Scenario: Rol no elegible rechazado
- **WHEN** se envía como `aprobadorId` un usuario `SUPERVISOR`
- **THEN** el sistema rechaza con error de validación

#### Scenario: Autor como revisor rechazado
- **WHEN** el actor se envía como su propio `revisorId` en creación
- **THEN** el sistema rechaza con error de validación

#### Scenario: Candidato válido aceptado
- **WHEN** se envían un revisor y un aprobador válidos distintos entre sí y del autor
- **THEN** el documento se crea y queda con esos IDs

### Requirement: Hook y contrato del frontend
El frontend SHALL exponer `useCandidatosAsignacion(tipo, documentoId?)` con TanStack Query contra el endpoint, con el tipo `CandidatoAsignacion { id; nombreCompleto; rol }` en `types/documents.types.ts`. El handler MSW correspondiente SHALL aplicar la misma regla D1/D2 filtrando el store de usuarios mock (no el fixture estático).

#### Scenario: Mock respeta D1
- **WHEN** MSW responde `tipo=APROBADOR`
- **THEN** solo incluye usuarios `JEFE_CONTROL_DOCUMENTARIO` o `ALTA_DIRECCION` distintos del autor
