# frontend-quality-events-cutover-verification

## Purpose

Verificación manual en navegador / API directa del ciclo de vida completo de Quality Event (M4) de `shc-controldoc` contra el backend .NET real + Postgres real, con `VITE_ENABLE_MSW=false` — sin tocar UI ni lógica de cliente salvo los fixes de contrato detectados durante la propia verificación (mapeo `accion`→`estado` en `ac-plazo-extension`, invalidación de caché en vez de `setQueryData` mal tipado, manejo de `204 No Content` en export-pdf individual y batch, y PIN de firma validado solo por formato client-side). No hay automatización de navegador disponible, por lo que la verificación se realiza mediante llamadas directas a la API con un JWT real. Cubre creación, listado, detalle y la máquina de estados completa de Quality Events (incluyendo los tres guards reales RN-QE-002/003/009), la aprobación de causa raíz definitiva con PIN real, el cierre con firma dual con PINs reales distintos, la aprobación/rechazo de solicitudes de ajuste de plazo de Acciones Correctivas, y el resto del ciclo de vida ya verificado en su contrato por la investigación previa (ACs, edición de reporte inicial/severidad/mineral, exportación de PDF, verificación de eficacia y reapertura por RN-QE-007, vinculación con Documentos, eliminar/reactivar). Equivalente de Quality Events a `frontend-incidentes-cutover-verification` y `frontend-no-conformidades-cutover-verification`.

## Requirements

### Requirement: El ciclo de vida completo de un Quality Event funciona contra el backend .NET real sin MSW

Con `VITE_ENABLE_MSW=false` y `VITE_API_BASE_URL` apuntando al backend .NET real corriendo localmente contra Postgres real, el sistema SHALL completar la creación, listado, detalle, edición, y la máquina de estados de Quality Events (`ABIERTO → EN_INVESTIGACION → ANALISIS_COMPLETADO → EN_EJECUCION → PENDIENTE_CIERRE → CERRADO → EN_VERIFICACION → VERIFICADO`, con reapertura a `EN_INVESTIGACION`) con el mismo comportamiento observable que hoy contra MSW.

#### Scenario: Creación y listado de Quality Event contra el backend real
- **WHEN** un usuario con permiso crea un Quality Event desde el formulario de creación con `origen`, `tipo`, `severidad`, `descripcion`, `areaAfectada`, `turno`, `fechaEvento`
- **THEN** el QE se crea contra el backend real con `numero` generado server-side, aparece en el listado, y sus campos coinciden exactamente con lo enviado

#### Scenario: Transición de estados respeta los tres guards reales
- **WHEN** se intenta transicionar un QE a `EN_EJECUCION` sin `causaRaizDefinitiva` firmada (RN-QE-002), a `CERRADO` con alguna AC pendiente/en ejecución sin evidencia (RN-QE-003), o a `ANALISIS_COMPLETADO` con una solicitud de ajuste de plazo aún pendiente (RN-QE-009)
- **THEN** el backend rechaza la transición y el error se refleja en la UI, sin cambiar `estado`

### Requirement: La aprobación de causa raíz definitiva funciona con un PIN real, sin gate hardcodeado

El sistema SHALL permitir que un `JEFE_CALIDAD_SYST` real apruebe la causa raíz definitiva de un Quality Event ingresando su propio PIN de firma configurado (`POST /api/auth/set-pin`), sin que ningún literal hardcodeado en el frontend bloquee el envío de ese PIN.

#### Scenario: Aprobar causa raíz con un PIN real distinto de 1234
- **WHEN** un `JEFE_CALIDAD_SYST` con PIN real configurado (distinto de `1234`) completa la causa raíz definitiva y confirma la aprobación con su PIN real
- **THEN** `causaRaizFirmadaEn`/`causaRaizAprobadaPorId` quedan seteados contra el backend real, y el QE puede avanzar a `EN_EJECUCION`

### Requirement: El cierre con firma dual funciona con PINs reales distintos, sin gate hardcodeado

El sistema SHALL permitir que la primera firma (`JEFE_CALIDAD_SYST`) y la segunda firma (`SUPERVISOR`) del cierre de un Quality Event se completen con los PINs reales configurados de cada firmante, con el backend como única fuente de verdad sobre si el PIN es correcto.

#### Scenario: Firma dual completa con PINs reales distintos transiciona a CERRADO
- **WHEN** el `JEFE_CALIDAD_SYST` firma con su PIN real y luego el `SUPERVISOR` responsable firma con su propio PIN real (distinto del primero)
- **THEN** ambas firmas se completan contra `PATCH /:id/firmar-cierre`, el QE transiciona a `CERRADO`, y se computa `fechaVerificacionProgramada`

#### Scenario: PIN incorrecto en cualquiera de las dos firmas es rechazado por el backend
- **WHEN** cualquiera de los dos firmantes ingresa un PIN incorrecto
- **THEN** el backend responde 401 "PIN incorrecto", se muestra un toast de error, y el QE no cambia de estado

### Requirement: Aprobar o rechazar una solicitud de ajuste de plazo de AC cambia realmente el estado de la solicitud

El sistema SHALL completar la aprobación y el rechazo de una solicitud de ajuste de plazo de una Acción Correctiva contra el backend real, verificando que `solicitud.estado` cambia efectivamente (no permanece en `PENDIENTE`) y que aprobar actualiza `accion.plazoFecha`.

#### Scenario: Aprobar una solicitud de ajuste de plazo actualiza plazoFecha
- **WHEN** el aprobador autorizado (`JEFE_CALIDAD_SYST` o `ALTA_DIRECCION`, según `requiereAprobacionGerencia`) hace clic en "Aprobar" sobre una solicitud pendiente
- **THEN** contra el backend real, la solicitud pasa a `estado: 'APROBADA'` y `accion.plazoFecha` se actualiza a `fechaSolicitada` — no queda en `PENDIENTE`

#### Scenario: Rechazar una solicitud de ajuste de plazo no cambia plazoFecha
- **WHEN** el aprobador autorizado hace clic en "Rechazar" con un comentario de revisión
- **THEN** contra el backend real, la solicitud pasa a `estado: 'RECHAZADA'` con el comentario guardado, y `accion.plazoFecha` permanece sin cambios

#### Scenario: Una solicitud ya revisada no puede volver a revisarse
- **WHEN** se intenta aprobar o rechazar una solicitud cuyo `estado` ya es `APROBADA` o `RECHAZADA`
- **THEN** el backend rechaza el reintento (no queda una solicitud "fantasma" en `PENDIENTE` reintentable indefinidamente)

### Requirement: El resto del ciclo de vida de un Quality Event funciona contra el backend real

El sistema SHALL completar, contra el backend .NET real, el resto de las operaciones de Quality Events ya verificadas por la investigación previa como correctas en su contrato: acciones correctivas (crear, actualizar, cerrar con evidencia), edición de reporte inicial, edición de severidad, edición de mineral involucrado, exportación de PDF (generado client-side, auditado server-side), verificación de eficacia, forzar vencimiento de verificación, y vinculación con Documentos.

#### Scenario: Ciclo completo de una Acción Correctiva
- **WHEN** se crea una AC, se actualiza su estado, y se cierra con `descripcionEvidencia`/`evidenciaUrl`
- **THEN** cada paso se completa contra el backend real, y cerrar todas las ACs con evidencia dispara la auto-transición `EN_EJECUCION → PENDIENTE_CIERRE`

#### Scenario: Edición de severidad notifica cuando corresponde
- **WHEN** se edita la severidad de un QE a `CRITICA`
- **THEN** el backend responde con `requiereNotificacionUrgente: true` en `EditarSeveridadResponse` (informativo — sin consumidor en la UI, ver `design.md` de la investigación previa)

#### Scenario: Exportar PDF registra auditoría sin generar archivo server-side
- **WHEN** un usuario exporta el PDF de un Quality Event
- **THEN** el PDF se genera client-side (`buildQualityEventPdf.ts`) y `POST /:id/export-pdf` registra una entrada `EXPORTADO_PDF` en el audit trail contra el backend real

#### Scenario: Verificación de eficacia y forzar vencimiento funcionan contra el backend real
- **WHEN** se registra el resultado de una verificación de eficacia (`EFECTIVO`/`NO_EFECTIVO` con evidencia), o se fuerza el vencimiento de una verificación no completada
- **THEN** ambas operaciones se completan contra el backend real con el mismo comportamiento observable que contra MSW, y cualquier mismatch de contrato encontrado se documenta con causa raíz (archivo + línea) antes de corregirlo

#### Scenario: La vinculación con Documentos sigue funcionando
- **WHEN** se vincula y desvincula un Documento a un Quality Event
- **THEN** ambas operaciones se completan contra el backend real, sin regresión respecto a la verificación previa de `documento-qe-vinculacion`

### Requirement: MSW se revierte a activo al cerrar la verificación de Quality Events

El sistema SHALL dejar `shc-controldoc/.env.development` con `VITE_ENABLE_MSW=true` una vez completada la verificación de este change, para no bloquear el desarrollo diario de los módulos aún no cutover-eados.

#### Scenario: Estado del entorno de desarrollo al cerrar el change
- **WHEN** se inspecciona `shc-controldoc/.env.development` después de cerrado este change
- **THEN** `VITE_ENABLE_MSW` es `true`, igual que antes de iniciar la verificación
