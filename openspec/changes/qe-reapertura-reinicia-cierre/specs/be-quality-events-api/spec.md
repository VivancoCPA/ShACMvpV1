## MODIFIED Requirements

### Requirement: Verificación de eficacia con reapertura automática (RN-QE-007)
El sistema SHALL exponer `POST /api/quality-events/:id/verificacion-eficacia`, requiriendo `resultado` (`EFECTIVO`|`NO_EFECTIVO`) y `evidencia`. Cuando `resultado === 'EFECTIVO'`, el sistema SHALL transicionar a `VERIFICADO` (invocando el notificador best-effort si `severidad` es `ALTA` o `CRITICA`). Cuando `resultado === 'NO_EFECTIVO'`, el sistema SHALL reabrir el QE: `estado → 'EN_INVESTIGACION'`, `ciclo` incrementado en 1, conservando el historial completo (audit trail y acciones correctivas previas intactos), con una entrada de audit trail `accion: 'REABIERTO'` y `campoModificado: 'motivo'`/`valorNuevo: 'NO_EFECTIVO'`. La reapertura SHALL además reiniciar el cierre, la verificación y la firma de la causa raíz del ciclo que termina, según el requirement "Reinicio del cierre al reabrir un QE" de `quality-event-reapertura-ciclo`.

#### Scenario: Verificación efectiva
- **WHEN** se envía `POST /:id/verificacion-eficacia { resultado: 'EFECTIVO', evidencia }` sobre un QE en `EN_VERIFICACION`
- **THEN** el sistema responde 200 con `estado: 'VERIFICADO'`

#### Scenario: Verificación no efectiva reabre el ciclo
- **WHEN** se envía `POST /:id/verificacion-eficacia { resultado: 'NO_EFECTIVO', evidencia }` sobre un QE en `EN_VERIFICACION` con `ciclo: 1`
- **THEN** el sistema responde 200 con `estado: 'EN_INVESTIGACION'`, `ciclo: 2`, y el historial previo (audit trail, acciones correctivas) permanece inalterado

#### Scenario: Verificación no efectiva deja el cierre en blanco
- **WHEN** se envía `POST /:id/verificacion-eficacia { resultado: 'NO_EFECTIVO', evidencia }` sobre un QE con `resultadoCierre`, `cerradoPorId`, `cierreFirmaSupervisorId` y `causaRaizFirmadaEn` cargados
- **THEN** la respuesta trae esos campos, `plazoVerificacionDias`, `fechaVerificacionProgramada`, `resultadoVerificacion` y `causaRaizAprobadaPorId` en null, y `causaRaizDefinitiva` sin cambios

### Requirement: Reapertura por vencimiento de verificación (utilidad dev-only)
El sistema SHALL exponer `PATCH /api/quality-events/:id/forzar-vencimiento-verificacion`, disponible únicamente en entorno de desarrollo (`IsDevelopment()`), aplicando la misma reapertura que una verificación `NO_EFECTIVO` (incluido el reinicio del cierre del ciclo) con `valorNuevo: 'VENCIMIENTO_PLAZO'` en la entrada de audit trail.

#### Scenario: Forzado en desarrollo
- **WHEN** se envía `PATCH /:id/forzar-vencimiento-verificacion` en un entorno de desarrollo sobre un QE en `EN_VERIFICACION`
- **THEN** el sistema responde 200 con `estado: 'EN_INVESTIGACION'` y `ciclo` incrementado

#### Scenario: Bloqueado fuera de desarrollo
- **WHEN** se envía el mismo request en un entorno que no es de desarrollo
- **THEN** el sistema responde 404 (endpoint no expuesto)

### Requirement: EN_EJECUCION → PENDIENTE_CIERRE manual exige AC cerradas (RN-QE-003)
`PATCH /api/quality-events/:id/status` con `nuevoEstado: PENDIENTE_CIERRE` SHALL responder 422 `RN-QE-003` si alguna acción correctiva del QE no está `CERRADA` o no tiene `descripcionEvidencia`. Si el QE fue reabierto (existe al menos una entrada `REABIERTO`), SHALL responder además 422 `RN-QE-003-CICLO` cuando ninguna acción correctiva tiene `creadoEn` posterior al último `REABIERTO`: las AC del ciclo anterior, ya cerradas, no bastan para cerrar el ciclo actual.

#### Scenario: Re-cierre tras un rechazo con todas las AC cerradas
- **WHEN** un QE en EN_EJECUCION (tras un rechazo) con todas sus AC cerradas con evidencia pasa a PENDIENTE_CIERRE
- **THEN** el sistema responde 200 y envía el aviso "listo para cierre"

#### Scenario: AC abierta
- **WHEN** el QE tiene una AC en PENDIENTE
- **THEN** el sistema responde 422 `RN-QE-003`

#### Scenario: QE reabierto sin AC nuevas
- **WHEN** un QE en ciclo 2, en EN_EJECUCION, cuyas únicas AC son las del ciclo 1 (todas CERRADA con evidencia), recibe `PATCH /:id/status { nuevoEstado: 'PENDIENTE_CIERRE' }`
- **THEN** el sistema responde 422 con `errorCode: 'RN-QE-003-CICLO'` y el QE sigue en EN_EJECUCION

#### Scenario: QE reabierto con una AC nueva cerrada
- **WHEN** el mismo QE tiene además una AC creada después del `REABIERTO`, CERRADA con evidencia
- **THEN** el sistema responde 200 y el QE pasa a PENDIENTE_CIERRE
