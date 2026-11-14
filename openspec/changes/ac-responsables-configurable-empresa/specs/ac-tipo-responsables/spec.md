## MODIFIED Requirements

### Requirement: Política única de responsables de AC por tipo
El sistema SHALL definir en un único lugar (`ResponsableAcPolicy`) qué usuarios pueden ser responsables de una AC según su tipo. Los roles elegibles de cada tipo SHALL leerse de la configuración de la empresa activa (`RolesPermitidosAsync(empresaId, tipo)`, capability `ac-responsables-config-empresa`); si la empresa no tiene configuración para ese tipo, SHALL usarse la tabla por defecto (`ResponsablesAcDefaults`):

| Tipo | Roles elegibles por defecto (rol en `usuarios_empresa`) |
|---|---|
| `CORRECTIVA` | OPERARIO, SUPERVISOR, JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, AUDITOR_INTERNO, ALTA_DIRECCION |
| `PREVENTIVA` | SUPERVISOR, JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, ALTA_DIRECCION |
| `MEJORA` | JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, ALTA_DIRECCION |

Además, el usuario MUST tener una asignación `ACTIVO` en la empresa activa de la sesión y MUST estar activo. ADMINISTRADOR_EMPRESA, ADMINISTRADOR_SISTEMA y SUPERADMIN MUST NOT ser nunca responsables: `RolesPermitidosAsync` MUST filtrarlos aunque figuren en la configuración guardada. El endpoint de candidatos, los tres handlers de creación y los tres de actualización (cuando cambian `responsableId`) SHALL usar esta política. Un cambio de configuración MUST NOT alterar las AC existentes: solo se evalúa al crear una AC o al cambiar su `responsableId`.

#### Scenario: Rol permitido por el tipo
- **WHEN** se evalúa un OPERARIO activo de la empresa para una AC `CORRECTIVA` sin configuración de empresa
- **THEN** la política lo acepta

#### Scenario: Rol no permitido por el tipo
- **WHEN** se evalúa un SUPERVISOR activo de la empresa para una AC `MEJORA` sin configuración de empresa
- **THEN** la política lo rechaza

#### Scenario: Configuración de la empresa
- **WHEN** la empresa configuró `MEJORA = [JEFE_CALIDAD_SYST]` y se evalúa un ALTA_DIRECCION activo para una AC `MEJORA`
- **THEN** la política lo rechaza, y los candidatos de `MEJORA` solo incluyen JEFE_CALIDAD_SYST

#### Scenario: Rol de administración en la configuración guardada
- **WHEN** la fila de la empresa contiene `ADMINISTRADOR_EMPRESA` (editada fuera de la API)
- **THEN** `RolesPermitidosAsync` no lo devuelve y ningún ADMINISTRADOR_EMPRESA es candidato

#### Scenario: AC existente tras cambiar la configuración
- **WHEN** una AC `MEJORA` tiene como responsable a un ALTA_DIRECCION y luego la empresa configura `MEJORA = [JEFE_CALIDAD_SYST]`
- **THEN** la AC conserva su responsable; un `PATCH` que cambie `responsableId` a otro ALTA_DIRECCION responde 400 en `responsableId`

#### Scenario: Usuario o asignación inactivos
- **WHEN** el usuario está inactivo, o su asignación en la empresa está `INACTIVO`
- **THEN** la política lo rechaza para cualquier tipo

#### Scenario: Usuario de otra empresa
- **WHEN** el usuario solo tiene asignación en otra empresa
- **THEN** la política lo rechaza

#### Scenario: Administradores nunca elegibles
- **WHEN** se evalúa un ADMINISTRADOR_EMPRESA para cualquier tipo
- **THEN** la política lo rechaza

### Requirement: MSW replica la política de responsables de AC
Los handlers MSW SHALL: exponer `GET /api/acciones-correctivas/candidatos-responsable?tipo=…` filtrando con los roles de la configuración en memoria de la empresa activa (o los defaults si no tiene), contando el rol en la empresa activa, asignación activa y usuario activo, nunca roles de administración (400 si el tipo es inválido); exigir `tipo` en los tres `POST` de AC (400 si falta) y responder error de validación de `responsableId` cuando el responsable no cumple esa misma política; incluir `tipo` en los fixtures de AC (`CORRECTIVA` para los existentes).

#### Scenario: POST MSW con responsable no permitido
- **WHEN** con MSW activo se crea una AC `MEJORA` con un OPERARIO como responsable
- **THEN** el handler responde 400 con error en `responsableId`

#### Scenario: Candidatos MSW con configuración de empresa
- **WHEN** con MSW activo la empresa activa configuró `MEJORA = [JEFE_CALIDAD_SYST]` y se consultan los candidatos de `MEJORA`
- **THEN** solo se devuelven usuarios con rol JEFE_CALIDAD_SYST en la empresa
