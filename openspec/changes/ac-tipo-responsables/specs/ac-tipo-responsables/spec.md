## ADDED Requirements

### Requirement: Tipo de acción obligatorio y no editable en las AC de QE, NC e incidente
Toda acción correctiva (`AccionCorrectivaQE`, `AccionCorrectivaNC`, `AccionCorrectivaIncidente`) SHALL tener un `tipo` del enum `AccionCorrectivaTipo` = `CORRECTIVA` | `PREVENTIVA` | `MEJORA` (PRD §2.2). El `tipo` MUST ser obligatorio al crear la AC y MUST NOT poder modificarse después: los commands de actualización de AC no aceptan `tipo` y, si llega en el body, se ignora. Las AC existentes antes de este cambio SHALL quedar con `tipo = CORRECTIVA` (migración `AddTipoAccionCorrectiva`, columna `tipo` texto NOT NULL con default `CORRECTIVA` en las tres tablas). Toda respuesta que devuelva una AC (detalle de QE/NC/incidente, `GET /api/quality-events/:id/acciones-correctivas`, `AccionCorrectivaResumen` del dashboard) SHALL incluir `tipo`.

#### Scenario: Crear AC sin tipo
- **WHEN** se hace `POST /api/quality-events/:id/acciones-correctivas` (o el equivalente de NC o incidente) sin `tipo` o con un valor fuera del enum
- **THEN** la respuesta es 400 de validación y no se crea la AC

#### Scenario: El tipo no se puede editar
- **WHEN** se hace `PATCH` de una AC con `tipo: 'MEJORA'` en el body y la AC es `CORRECTIVA`
- **THEN** la AC sigue siendo `CORRECTIVA`

#### Scenario: AC existentes migradas
- **WHEN** se aplica la migración `AddTipoAccionCorrectiva` sobre una base con AC previas
- **THEN** todas las AC previas quedan con `tipo = CORRECTIVA`

#### Scenario: El tipo viaja en las lecturas
- **WHEN** se obtiene el detalle de un QE con AC
- **THEN** cada AC de `accionesCorrectivas` incluye `tipo`

### Requirement: Política única de responsables de AC por tipo
El sistema SHALL definir en un único lugar (`ResponsableAcPolicy`) qué usuarios pueden ser responsables de una AC según su tipo:

| Tipo | Roles elegibles (rol en `usuarios_empresa`) |
|---|---|
| `CORRECTIVA` | OPERARIO, SUPERVISOR, JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, AUDITOR_INTERNO, ALTA_DIRECCION |
| `PREVENTIVA` | SUPERVISOR, JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, ALTA_DIRECCION |
| `MEJORA` | JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, ALTA_DIRECCION |

Además, el usuario MUST tener una asignación `ACTIVO` en la empresa activa de la sesión y MUST estar activo. ADMINISTRADOR_EMPRESA, ADMINISTRADOR_SISTEMA y SUPERADMIN MUST NOT ser nunca responsables. El endpoint de candidatos, los tres handlers de creación y los tres de actualización (cuando cambian `responsableId`) SHALL usar esta política.

#### Scenario: Rol permitido por el tipo
- **WHEN** se evalúa un OPERARIO activo de la empresa para una AC `CORRECTIVA`
- **THEN** la política lo acepta

#### Scenario: Rol no permitido por el tipo
- **WHEN** se evalúa un SUPERVISOR activo de la empresa para una AC `MEJORA`
- **THEN** la política lo rechaza

#### Scenario: Usuario o asignación inactivos
- **WHEN** el usuario está inactivo, o su asignación en la empresa está `INACTIVO`
- **THEN** la política lo rechaza para cualquier tipo

#### Scenario: Usuario de otra empresa
- **WHEN** el usuario solo tiene asignación en otra empresa
- **THEN** la política lo rechaza

#### Scenario: Administradores nunca elegibles
- **WHEN** se evalúa un ADMINISTRADOR_EMPRESA para cualquier tipo
- **THEN** la política lo rechaza

### Requirement: Endpoint de candidatos a responsable de AC
El backend SHALL exponer `GET /api/acciones-correctivas/candidatos-responsable?tipo=CORRECTIVA|PREVENTIVA|MEJORA`, accesible a cualquier usuario autenticado con empresa activa (sin restricción de rol). SHALL devolver `[{ id, nombreCompleto, rol, avatarUrl? }]` con los usuarios de la empresa de la sesión que cumplen la política para ese tipo, ordenados por nombre. Un `tipo` ausente o inválido MUST responder 400.

#### Scenario: Candidatos para MEJORA
- **WHEN** un JEFE_CALIDAD_SYST consulta `?tipo=MEJORA`
- **THEN** la respuesta es 200 y solo incluye usuarios activos de la empresa con rol JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO o ALTA_DIRECCION

#### Scenario: Tipo inválido
- **WHEN** se consulta `?tipo=OTRO` o sin `tipo`
- **THEN** la respuesta es 400

### Requirement: Validación del responsable al crear o reasignar una AC
Al crear una AC (QE, NC o incidente) el handler SHALL validar el responsable con `ResponsableAcPolicy` y el `tipo` del command. Al actualizar una AC con un `responsableId` distinto, SHALL validarlo con el `tipo` actual de la AC. Si el responsable no es válido, la respuesta MUST ser un error de validación del campo `responsableId` (400, `FieldValidationException`) con el mensaje "El responsable no puede asignarse a una acción de tipo {tipo}" — nunca 404, aunque el usuario sea de otra empresa (mismo contrato que RN-DOC-021). El audit trail `AC_CREADA` SHALL registrar el tipo. La creación SHALL notificar la asignación al responsable (best-effort, nunca en autoasignación), igual que la reasignación.

#### Scenario: CORRECTIVA con un operario
- **WHEN** un JEFE_CALIDAD_SYST crea una AC `CORRECTIVA` en un QE con un OPERARIO activo de la empresa como responsable
- **THEN** la respuesta es 201, la AC tiene `tipo = CORRECTIVA` y el operario recibe una notificación de asignación

#### Scenario: MEJORA con un supervisor
- **WHEN** se crea una AC `MEJORA` con un SUPERVISOR como responsable
- **THEN** la respuesta es 400 con un error en el campo `responsableId` y no se crea la AC

#### Scenario: Responsable de otra empresa
- **WHEN** se crea una AC con un `responsableId` de un usuario que solo pertenece a otra empresa
- **THEN** la respuesta es 400 con un error en el campo `responsableId` (no 404)

#### Scenario: Reasignar a un rol no permitido
- **WHEN** se hace `PATCH` de una AC `MEJORA` cambiando `responsableId` a un OPERARIO
- **THEN** la respuesta es 400 con un error en el campo `responsableId` y el responsable no cambia

### Requirement: Formulario de AC del QE con tipo y responsable dependiente del tipo
El modal de creación de AC del QE (`AgregarQEACModal`) SHALL mostrar el campo obligatorio "Tipo de acción" (Correctiva / Preventiva / Mejora) antes del responsable. El combo de responsable SHALL alimentarse de `useCandidatosResponsableAC(tipo)` (queryKey `['acciones-correctivas', 'candidatos', tipo]`) y MUST estar deshabilitado con el texto "Elige primero el tipo de acción" mientras no haya tipo. Cada opción SHALL mostrar nombre y rol. Al cambiar el tipo, si el responsable elegido no está entre los nuevos candidatos, SHALL limpiarse y mostrarse el aviso inline "{nombre} no puede ser responsable de una acción de tipo {tipo}." Si no hay candidatos SHALL mostrarse "No hay usuarios activos que puedan ser responsables de este tipo de acción." Al abrir el modal desde "Crear AC" del asistente IA, el tipo SHALL precargarse con el tipo sugerido y ser editable.

#### Scenario: Sin tipo el responsable está deshabilitado
- **WHEN** se abre el modal sin tipo elegido
- **THEN** el combo de responsable está deshabilitado y muestra "Elige primero el tipo de acción"

#### Scenario: Candidatos de MEJORA
- **WHEN** se elige `MEJORA`
- **THEN** el combo solo lista usuarios JCA, JCD y DIR, cada uno con su rol

#### Scenario: Cambio de tipo que excluye al elegido
- **WHEN** se eligió un OPERARIO con `CORRECTIVA` y luego se cambia a `MEJORA`
- **THEN** el responsable se limpia y aparece el aviso con el nombre del operario y el tipo

#### Scenario: Precarga desde el asistente IA
- **WHEN** se hace clic en "Crear AC" sobre una acción sugerida `PREVENTIVA`
- **THEN** el modal abre con tipo `PREVENTIVA` y la lista de candidatos de ese tipo

### Requirement: Badge de tipo en la lista de AC del QE
La lista de AC de `QEACSection` SHALL mostrar el tipo de cada AC como un badge pequeño junto a la descripción, con el texto localizado (`common:acTipo.*`).

#### Scenario: AC de mejora
- **WHEN** el QE tiene una AC con `tipo = MEJORA`
- **THEN** la fila muestra el badge "Mejora"

### Requirement: MSW replica la política de responsables de AC
Los handlers MSW SHALL: exponer `GET /api/acciones-correctivas/candidatos-responsable?tipo=…` filtrando con la misma tabla de roles (rol en la empresa activa, asignación activa, usuario activo; 400 si el tipo es inválido); exigir `tipo` en los tres `POST` de AC (400 si falta) y responder error de validación de `responsableId` cuando el responsable no cumple la política; incluir `tipo` en los fixtures de AC (`CORRECTIVA` para los existentes).

#### Scenario: POST MSW con responsable no permitido
- **WHEN** con MSW activo se crea una AC `MEJORA` con un OPERARIO como responsable
- **THEN** el handler responde 400 con error en `responsableId`
