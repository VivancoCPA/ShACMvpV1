## ADDED Requirements

### Requirement: Nueva versión — autor y herencia condicionada (MSW)
El handler MSW de `POST /documents/:id/nueva-version` SHALL replicar la misma regla que el backend real: `autorId` del nuevo documento SHALL ser el actor que hace la solicitud (`getUserFromRequest`), nunca el `autorId` del documento origen. `revisorId`/`aprobadorId` SHALL heredarse del origen solo si son distintos del nuevo `autorId` y siguen siendo candidatos elegibles (activo, rol elegible para ese tipo de asignación, con asignación activa en la empresa activa) — en caso contrario SHALL quedar `null`/`undefined`, reutilizando la misma lógica de elegibilidad que el handler de `GET /documents/candidatos-asignacion`, sin duplicarla. El handler SHALL rechazar con `403` si el actor no es el `autorId` del documento origen ni tiene rol `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO`.

#### Scenario: MSW asigna el autor correcto
- **WHEN** un `JEFE_CONTROL_DOCUMENTARIO` que era el revisor del documento origen crea una nueva versión vía MSW
- **THEN** el nuevo documento tiene `autorId` igual a ese usuario, y `revisorId: undefined`

#### Scenario: MSW rechaza la creación sin permiso
- **WHEN** un usuario que no es autor del origen ni JCA/JCD solicita `POST /documents/:id/nueva-version` vía MSW
- **THEN** la respuesta es un error `403`, sin crear ningún documento nuevo

## MODIFIED Requirements

### Requirement: BORRADOR state actions
En state `BORRADOR`, el panel SHALL mostrar, resolviendo el `docRole` del actor sobre ESTE documento con la misma precedencia que el backend (`AUTOR → REVISOR → APROBADOR → JEFE_CALIDAD (rol global) → OPERARIO`, vía `resolveDocRoleForUser` compartido con `DocumentDetailPage`), no un flag de rol global suelto:
- "Enviar a revisión" solo si `docRole === 'AUTOR'` o `docRole === 'JEFE_CALIDAD'` → modal de confirmación → `PATCH /documents/:id/status` con `{ estado: 'EN_REVISION' }`.
- "Eliminar" con la misma condición que "Enviar a revisión".

Si el documento no tiene `revisorId` o no tiene `aprobadorId` asignado, el panel SHALL mostrar un aviso ("Asigna revisor y aprobador para poder enviar a revisión") con un enlace a `/documents/:id/edit`, y el botón "Enviar a revisión" SHALL estar deshabilitado con un `title` explicando el motivo.

#### Scenario: AUTOR puede enviar a revisión un BORRADOR propio con revisor y aprobador asignados
- **WHEN** `estado === 'BORRADOR'`, el usuario es el autor, y el documento tiene `revisorId` y `aprobadorId`
- **THEN** el botón "Enviar a revisión" está visible y habilitado

#### Scenario: AUTOR no puede eliminar BORRADOR
- **WHEN** `estado === 'BORRADOR'` y el usuario no es `AUTOR` ni `JEFE_CALIDAD` para este documento
- **THEN** "Eliminar" no se muestra

#### Scenario: JEFE_CALIDAD que es revisor o aprobador asignado de este BORRADOR no ve "Enviar a revisión"
- **WHEN** `estado === 'BORRADOR'` y el usuario tiene rol global `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO` pero es el `revisorId` o `aprobadorId` asignado de este documento (no el autor)
- **THEN** el `docRole` resuelto es `REVISOR`/`APROBADOR`, y ni "Enviar a revisión" ni "Eliminar" se muestran — mismo resultado que rechazaría el backend con `403`

#### Scenario: Aviso cuando falta revisor o aprobador
- **WHEN** `estado === 'BORRADOR'` y el documento no tiene `revisorId` o no tiene `aprobadorId`
- **THEN** se muestra el aviso con enlace a editar, y "Enviar a revisión" aparece deshabilitado con un tooltip explicando el motivo

#### Scenario: REVISOR sees no actions for BORRADOR
- **WHEN** `estado === 'BORRADOR'` y el `docRole` resuelto del usuario es `REVISOR`
- **THEN** no se renderiza ningún botón de acción

### Requirement: EN_REVISION state actions
En state `EN_REVISION`, el panel SHALL mostrar, con el mismo `docRole` resuelto que `BORRADOR state actions`:
- "Aprobar revisión" para el `revisorId` asignado (`docRole === 'REVISOR'`) → `PATCH /documents/:id/status` con `{ estado: 'EN_APROBACION' }`.
- "Rechazar" para el `revisorId` asignado → `DocumentRejectModal`.
- "Cancelar revisión" solo si `docRole === 'JEFE_CALIDAD'` — un `JEFE_CALIDAD_SYST`/`JEFE_CONTROL_DOCUMENTARIO` que es el `revisorId` o `aprobadorId` asignado de ESTE documento resuelve a `REVISOR`/`APROBADOR`, no a `JEFE_CALIDAD`, y no ve "Cancelar revisión" (mismo criterio que el backend, que exige `CanEdit`).

#### Scenario: Revisor can approve review
- **WHEN** `estado === 'EN_REVISION'` y el usuario es el `revisorId` asignado
- **THEN** "Aprobar revisión" está visible

#### Scenario: JEFE_CALIDAD_SYST que no es revisor ni aprobador de este documento puede cancelar revisión
- **WHEN** `estado === 'EN_REVISION'`, el usuario tiene rol global `JEFE_CALIDAD_SYST`, y no es `revisorId` ni `aprobadorId` de este documento
- **THEN** "Cancelar revisión" está visible

#### Scenario: JEFE_CALIDAD_SYST que es el aprobador asignado de este documento no ve "Cancelar revisión"
- **WHEN** `estado === 'EN_REVISION'`, el usuario tiene rol global `JEFE_CALIDAD_SYST`, y es el `aprobadorId` asignado de este documento
- **THEN** el `docRole` resuelto es `APROBADOR`, y "Cancelar revisión" no se muestra

#### Scenario: AUTOR sees no actions for EN_REVISION
- **WHEN** `estado === 'EN_REVISION'` y el usuario es el autor del documento (no el revisor)
- **THEN** no se renderiza ningún botón de acción

### Requirement: Status change MSW handlers
El handler MSW de `PATCH /documents/:id/status` SHALL:
- Validar que la transición de estado solicitada está permitida por la máquina de estados de M1.
- En la transición `BORRADOR → EN_REVISION`, validar que el documento tenga `revisorId` y `aprobadorId` asignados; si falta alguno, SHALL responder con un error de validación por campo (mismo contrato que el backend real: `400`, con el nombre del campo faltante), sin cambiar el estado del documento.
- Aplicar RN-DOC-001: al transicionar a `PUBLICADO`, buscar el fixture con el mismo `codigo` y `estado === 'PUBLICADO'` y ponerlo en `OBSOLETO`.
- Agregar una entrada `AuditTrailEntry` con la acción, `userId` y timestamp al audit trail en memoria del documento.
- Retornar el documento actualizado envuelto en `ApiResponse<Documento>`.

#### Scenario: PATCH status applies RN-DOC-001 on PUBLICADO transition
- **WHEN** se llama `PATCH /documents/:id/status` con `{ estado: 'PUBLICADO' }` y otro documento con el mismo `codigo` ya está `PUBLICADO`
- **THEN** el estado del documento anterior pasa a `OBSOLETO` y el actual pasa a `PUBLICADO`

#### Scenario: PATCH status adds AuditTrailEntry
- **WHEN** MSW procesa un cambio de estado
- **THEN** el `auditTrail` del documento gana una nueva entrada con la acción, `userId` y timestamp correctos

#### Scenario: Enviar a revisión sin revisor o aprobador es rechazado por MSW
- **WHEN** se llama `PATCH /documents/:id/status` con `{ estado: 'EN_REVISION' }` sobre un `BORRADOR` sin `revisorId` o sin `aprobadorId`
- **THEN** MSW responde con un error `400` identificando el campo faltante, y el documento permanece en `BORRADOR`
