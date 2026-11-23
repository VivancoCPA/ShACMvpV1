## ADDED Requirements

### Requirement: Reinicio del cierre al reabrir un QE
Al reabrir un QE (ciclo N → N+1, `QEReaperturaHelper`, usado por la verificación `NO_EFECTIVO` y por el forzado de vencimiento dev-only), el backend SHALL, antes de cambiar el estado, registrar una entrada de audit trail `accion: 'CICLO_REINICIADO'` con `campoModificado: 'cierre/verificacion/causaRaiz'`, `valorAnterior` = un resumen legible del ciclo que termina y `valorNuevo: 'Ciclo {N+1}'`, con el mismo actor que la reapertura. El resumen SHALL usar nombres y fechas, nunca ids (p. ej. "Ciclo 1 · Cierre: {resultado, máx. 100 caracteres} · Firma JCA: {nombre} {fecha} · Firma supervisor: {nombre} {fecha} · Verificación: {resultado} {fecha} · Causa raíz aprobada por {nombre} {fecha}"), omitiendo los segmentos sin dato.

Después SHALL poner en `null` `resultadoCierre`, `plazoVerificacionDias`, `cerradoPorId`, `cierreFirmaSupervisorId`, `fechaVerificacionProgramada`, `resultadoVerificacion`, `causaRaizAprobadaPorId` y `causaRaizFirmadaEn`, y mantener lo existente: `estado = EN_INVESTIGACION`, `ciclo + 1`, la entrada `REABIERTO` y la sincronización del incidente. SHALL conservar `metodoAnalisis`, los 5 Porqués, el Ishikawa, `causaRaizDefinitiva`, `responsableInvestigacionId` y las acciones correctivas del ciclo anterior sin cambios.

#### Scenario: Reapertura por verificación no efectiva
- **WHEN** un QE en ciclo 1, con cierre firmado por el JCA y el supervisor, causa raíz aprobada y AC cerradas, recibe una verificación `NO_EFECTIVO`
- **THEN** queda en EN_INVESTIGACION con `ciclo: 2`, los ocho campos en null, `causaRaizDefinitiva` y el análisis intactos, sus AC siguen CERRADA, y el audit trail tiene una entrada `CICLO_REINICIADO` cuyo `valorAnterior` contiene los nombres de los firmantes y ningún id

#### Scenario: El ciclo 2 exige aprobar de nuevo la causa raíz
- **WHEN** el QE reabierto intenta pasar de ANALISIS_COMPLETADO a EN_EJECUCION sin una nueva aprobación de la causa raíz
- **THEN** el sistema responde 422 `RN-QE-002`

#### Scenario: Ciclo 2 completo
- **WHEN** en el ciclo 2 se aprueba la causa raíz, se crea, ejecuta y verifica una AC nueva, el JCA registra el resultado y firma, y firma un supervisor del área
- **THEN** el QE pasa por EN_EJECUCION y PENDIENTE_CIERRE hasta quedar CERRADO

### Requirement: AC del ciclo actual para pasar a PENDIENTE_CIERRE
En un QE reabierto (con al menos una entrada `REABIERTO`), el paso a PENDIENTE_CIERRE — manual o automático al verificar una AC — SHALL exigir al menos una acción correctiva con `creadoEn` posterior al último `REABIERTO`, además de que todas las AC estén CERRADA con evidencia. El ciclo de cada AC SHALL deducirse comparando `creadoEn` con la fecha del último `REABIERTO`, sin columnas nuevas. En la verificación automática, si no se cumple, el QE SHALL quedar en EN_EJECUCION sin error.

#### Scenario: Sin AC nuevas no pasa a PENDIENTE_CIERRE
- **WHEN** un QE reabierto en EN_EJECUCION solo tiene las AC cerradas del ciclo anterior
- **THEN** no pasa a PENDIENTE_CIERRE (la transición manual responde 422 `RN-QE-003-CICLO`)

### Requirement: Migración de datos de reaperturas anteriores
La migración `FixReaperturaCicloCierre` SHALL limpiar, en los QE con `deleted_at IS NULL`, `ciclo > 1` y estado EN_INVESTIGACION, ANALISIS_COMPLETADO, EN_EJECUCION o PENDIENTE_CIERRE, cada campo del reinicio cuya última entrada de audit de respaldo sea anterior al último `REABIERTO` del QE o no exista: `resultado_cierre`/`plazo_verificacion_dias` (`CIERRE_INICIADO` o `CAMPO_EDITADO` sobre `resultadoCierre`), `cerrado_por_id` (`FIRMA_CIERRE_JEFE_CALIDAD` o `FIRMA_REGISTRADA` sobre `cerradoPorId`), `cierre_firma_supervisor_id`/`fecha_verificacion_programada` (`FIRMA_CIERRE_SUPERVISOR` o `FIRMA_REGISTRADA` sobre `cierreFirmaSupervisorId`), `causa_raiz_aprobada_por_id`/`causa_raiz_firmada_en` (`CAUSA_RAIZ_APROBADA`) y `resultado_verificacion` (`VERIFICACION_EFICACIA`). Por cada QE corregido SHALL insertar una entrada `CORRECCION_DATOS_REAPERTURA` con `realizado_por_id = 'system'`, `realizado_por_nombre = 'Sistema'`, `generado_por_ia = true` y en `valor_anterior` los campos limpiados. No SHALL cambiar el esquema; `Down()` queda vacío.

#### Scenario: Firmas del ciclo anterior
- **WHEN** un QE en ciclo 2 y PENDIENTE_CIERRE tiene las dos firmas con entradas anteriores al último `REABIERTO`
- **THEN** la migración las deja en null y agrega `CORRECCION_DATOS_REAPERTURA`

#### Scenario: Firma del ciclo actual se conserva
- **WHEN** un QE en ciclo 2 tiene la firma del JCA con una entrada posterior al último `REABIERTO`
- **THEN** `cerrado_por_id` se conserva

#### Scenario: Fuera de alcance
- **WHEN** un QE está en ciclo 1, o en ciclo 2 y estado CERRADO
- **THEN** la migración no lo modifica ni le agrega entradas

### Requirement: Presentación del ciclo en el detalle del QE
`QECierreSection` SHALL tomar la fecha y el nombre de Paso 1, Firma 1 y Firma 2 solo de entradas de audit posteriores al último `REABIERTO`. Cuando `qe.ciclo > 1`, `QEHeaderSection` SHALL mostrar el badge `detail.header.ciclo` ("Ciclo {n}"). El audit trail SHALL etiquetar `CICLO_REINICIADO` ("Ciclo reiniciado") y `CORRECCION_DATOS_REAPERTURA` ("Corrección de datos de reapertura"). Para un mismo QE en PENDIENTE_CIERRE, el banner "Siguiente paso" SHALL decir "Te toca a ti" a un usuario si y solo si `QECierreSection` le muestra la acción correspondiente (formulario de resultado, firma del JCA o firma del supervisor).

#### Scenario: Badge de ciclo
- **WHEN** el QE tiene `ciclo: 2`
- **THEN** la cabecera muestra "Ciclo 2"

#### Scenario: Coherencia banner ↔ botones
- **WHEN** el QE está en PENDIENTE_CIERRE sin resultado, con resultado sin firmas, o con la firma del JCA, y se renderiza para un JCA y para un supervisor del área
- **THEN** el usuario a quien el banner dice "Te toca a ti" es exactamente el que ve el botón del paso

### Requirement: Reapertura en MSW
Los handlers MSW que reabren un QE SHALL limpiar los mismos campos y agregar la entrada `CICLO_REINICIADO`. Los fixtures SHALL incluir un QE en ciclo 2 y PENDIENTE_CIERRE con `resultadoCierre` y sin firmas, que espera la firma del JCA.

#### Scenario: Verificación no efectiva en mock
- **WHEN** se envía `POST /api/quality-events/:id/verificacion-eficacia { resultado: 'NO_EFECTIVO' }` al mock
- **THEN** la respuesta trae `ciclo` + 1 y `resultadoCierre`, `cerradoPorId`, `cierreFirmaSupervisorId` y `causaRaizFirmadaEn` en null
