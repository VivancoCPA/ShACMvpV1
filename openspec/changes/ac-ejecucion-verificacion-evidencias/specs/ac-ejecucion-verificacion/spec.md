## ADDED Requirements

### Requirement: Estado COMPLETADA y trazabilidad de ejecución y verificación de AC de QE
`QEAccionCorrectivaEstado` SHALL tener los valores `PENDIENTE`, `EN_EJECUCION`, `COMPLETADA` ("Pendiente de verificación") y `CERRADA`.

`AccionCorrectivaQE` SHALL guardar los campos `EjecutadaEn`, `EjecutadaPorId`, `VerificadaEn`, `VerificadaPorId` y `MotivoDevolucion` (el último motivo).

Toda lectura de AC (detalle de QE, `GET /api/quality-events/{id}/acciones-correctivas` y listado de QE) SHALL devolver:
- `estado`, `ejecutadaEn`, `ejecutadaPorNombre`, `verificadaEn`, `verificadaPorNombre` y `motivoDevolucion`;
- `evidencias: [{ id, nombreArchivo, contentType, tamanioBytes, subidoEn }]`;
- `evidenciaUrl`, solo si tiene un valor histórico.

Los nombres SHALL resolverse en el servidor. La respuesta MUST NOT exponer la clave de almacenamiento.

La migración `AcEjecucionVerificacionEvidencias` MUST NOT modificar las AC existentes: las `CERRADA` conservan su `evidenciaUrl` como evidencia histórica de solo lectura.

#### Scenario: Lectura de una AC verificada
- **WHEN** se obtiene el detalle de un QE con una AC cerrada mediante la verificación
- **THEN** la AC incluye `verificadaPorNombre` con el nombre del JCA, `verificadaEn` y sus `evidencias`, sin ids de usuario sin resolver ni claves de almacenamiento

#### Scenario: AC histórica con URL
- **WHEN** una AC `CERRADA` previa a la migración tiene `evidenciaUrl`
- **THEN** la lectura la devuelve igual, con `evidencias` vacío

### Requirement: Solo el responsable inicia, sube evidencias y ejecuta la AC
El backend SHALL exponer, para AC de un QE de la empresa de la sesión (otra empresa → 404; AC que no pertenece al QE → 404):

- `POST /api/quality-events/{id}/acciones-correctivas/{acId}/iniciar`:
  - solo en `PENDIENTE`, pasa la AC a `EN_EJECUCION`;
  - registra `AC_INICIADA` en el audit trail.
- `POST …/{acId}/evidencias`:
  - multipart con un archivo por request, solo en `EN_EJECUCION`;
  - guarda el archivo y devuelve `{ id, nombreArchivo, contentType, tamanioBytes, subidoEn }`;
  - registra `AC_EVIDENCIA_AGREGADA`.
- `DELETE …/{acId}/evidencias/{evId}`:
  - solo en `EN_EJECUCION`;
  - borra la fila y el archivo;
  - registra `AC_EVIDENCIA_ELIMINADA`.
- `POST …/{acId}/ejecutar` con `{ descripcionEvidencia }` (de 50 a 300 caracteres; si no, 400):
  - solo en `EN_EJECUCION` y con al menos 1 evidencia (si no hay, 422);
  - pasa la AC a `COMPLETADA` y guarda `EjecutadaEn`, `EjecutadaPorId` y la descripción;
  - registra `AC_EJECUTADA`;
  - notifica a los JEFE_CALIDAD_SYST activos de la empresa, excepto el actor: "La AC {desc} del {QE} está lista para verificación".

Si quien actúa no es `ac.ResponsableId`, los cuatro endpoints MUST responder 403 con `errorCode: 'SOLO_RESPONSABLE_AC'`. Un estado de origen inválido MUST responder 422.

#### Scenario: Un tercero intenta iniciar
- **WHEN** un usuario de la empresa que no es el responsable hace `POST …/iniciar`
- **THEN** la respuesta es 403 con `SOLO_RESPONSABLE_AC` y la AC sigue `PENDIENTE`

#### Scenario: Un tercero intenta subir evidencia o ejecutar
- **WHEN** un usuario que no es el responsable hace `POST …/evidencias` o `POST …/ejecutar`
- **THEN** la respuesta es 403 con `SOLO_RESPONSABLE_AC`

#### Scenario: Ejecutar sin archivos
- **WHEN** el responsable hace `POST …/ejecutar` con una descripción válida y la AC no tiene evidencias
- **THEN** la respuesta es 422 y la AC sigue `EN_EJECUCION`

#### Scenario: Descripción corta
- **WHEN** el responsable hace `POST …/ejecutar` con una descripción de 49 caracteres
- **THEN** la respuesta es 400

#### Scenario: Ejecución exitosa
- **WHEN** el responsable inició la AC, subió 2 archivos y hace `POST …/ejecutar` con una descripción válida
- **THEN** la AC queda `COMPLETADA` con `ejecutadaEn` y `ejecutadaPorNombre`, y cada JCA activo de la empresa recibe la notificación

#### Scenario: QE de otra empresa
- **WHEN** un usuario hace `POST …/iniciar` sobre una AC de un QE de otra empresa
- **THEN** la respuesta es 404

### Requirement: Validación de archivos de evidencia de AC
El endpoint de subida SHALL aceptar solo las extensiones `.pdf`, `.jpg`, `.jpeg`, `.png`, `.mp4`, `.docx` y `.xlsx`, y SHALL validar la firma real de los primeros bytes:

| Extensión | Firma esperada |
|---|---|
| PDF | `%PDF-` |
| JPG / JPEG | `FF D8 FF` |
| PNG | `89 50 4E 47` |
| MP4 | `ftyp` en el offset 4 |
| DOCX / XLSX | `PK` |

Respuestas de error:
- extensión no permitida, firma que no coincide, archivo vacío o de más de 50 MB → 400 con un mensaje claro;
- un sexto archivo cuando la AC ya tiene 5 → 422 (`MAX_EVIDENCIAS_AC`).

Los archivos SHALL guardarse en el almacenamiento privado (nunca en `wwwroot`). El `contentType` guardado SHALL derivarse de la extensión validada. El endpoint SHALL admitir requests de hasta 55 MB.

#### Scenario: Ejecutable renombrado
- **WHEN** el responsable sube un `.exe` renombrado a `.pdf`
- **THEN** la respuesta es 400 y no se guarda ninguna evidencia

#### Scenario: Archivo demasiado grande
- **WHEN** el responsable sube un archivo de 51 MB
- **THEN** la respuesta es 400

#### Scenario: Sexto archivo
- **WHEN** la AC ya tiene 5 evidencias y el responsable sube otra
- **THEN** la respuesta es 422

### Requirement: Descarga autenticada de evidencias de AC
`GET /api/quality-events/{id}/acciones-correctivas/{acId}/evidencias/{evId}/archivo` SHALL servir el archivo a cualquier usuario autenticado de la empresa del QE, en cualquier estado de la AC, con el `Content-Type` guardado y un `Content-Disposition` con el nombre original del archivo. Sin sesión MUST responder 401. Si el QE o la evidencia no existen, o el QE es de otra empresa, MUST responder 404.

#### Scenario: Descarga con sesión de la empresa
- **WHEN** un usuario de la empresa pide el archivo de una evidencia
- **THEN** la respuesta es 200 con el contenido y el nombre real en `Content-Disposition`

#### Scenario: Descarga sin sesión
- **WHEN** se pide el archivo sin token
- **THEN** la respuesta es 401

### Requirement: Solo el JCA verifica, cierra o devuelve la AC
`POST /api/quality-events/{id}/acciones-correctivas/{acId}/verificar` con `{ aprobada: boolean, comentario?: string }` SHALL estar permitido solo cuando el rol efectivo de la sesión es `JEFE_CALIDAD_SYST`; para cualquier otro rol MUST responder 403 con `errorCode: 'SOLO_JCA_VERIFICA'`. La AC MUST estar en `COMPLETADA`; si no, responde 422.

**Si `aprobada`:**
- la AC pasa a `CERRADA` con `VerificadaEn`, `VerificadaPorId` y `FechaCierre`;
- se registra `AC_VERIFICADA_CERRADA`;
- si todas las AC del QE quedan `CERRADA` con evidencia (descripción y, además, al menos un archivo o una `evidenciaUrl` histórica) y el QE está en `EN_EJECUCION`, el QE SHALL pasar a `PENDIENTE_CIERRE`, con la sincronización del incidente vinculado y la notificación de "listo para cierre".

**Si no se aprueba:**
- `comentario` es obligatorio, de 20 a 500 caracteres (si no, 400);
- la AC vuelve a `EN_EJECUCION` con `MotivoDevolucion`, conservando sus evidencias;
- se registra `AC_DEVUELTA`;
- se notifica al responsable con el motivo.

Un JCA que además es el responsable de la AC SHALL poder ejecutarla y verificarla.

#### Scenario: Supervisor intenta verificar
- **WHEN** un SUPERVISOR hace `POST …/verificar` sobre una AC `COMPLETADA`
- **THEN** la respuesta es 403 con `SOLO_JCA_VERIFICA`

#### Scenario: Devolución
- **WHEN** el JCA hace `POST …/verificar` con `aprobada: false` y un comentario de 30 caracteres
- **THEN** la AC vuelve a `EN_EJECUCION` con `motivoDevolucion` y el responsable recibe una notificación con el motivo

#### Scenario: Devolución sin motivo
- **WHEN** el JCA hace `POST …/verificar` con `aprobada: false` y sin comentario
- **THEN** la respuesta es 400

#### Scenario: Aprobación de la última AC
- **WHEN** el QE está en `EN_EJECUCION`, su única AC está `COMPLETADA` con archivos y el JCA la aprueba
- **THEN** la AC queda `CERRADA` con `verificadaPorNombre`, el QE pasa a `PENDIENTE_CIERRE` y el incidente vinculado se sincroniza

#### Scenario: AC histórica cuenta como evidencia
- **WHEN** un QE en `EN_EJECUCION` tiene una AC histórica `CERRADA` con `evidenciaUrl` y sin archivos, y el JCA aprueba la otra AC
- **THEN** el QE pasa a `PENDIENTE_CIERRE`

#### Scenario: JCA responsable de su propia AC
- **WHEN** el responsable de la AC es un JEFE_CALIDAD_SYST
- **THEN** ese usuario puede iniciarla, ejecutarla y verificarla

### Requirement: PATCH de estado de AC de QE no cierra
`PATCH /api/quality-events/{id}/acciones-correctivas/{acId}/status` SHALL responder 422 con `errorCode: 'USAR_FLUJO_VERIFICACION'` cuando `estado` es `CERRADA`, `COMPLETADA` o `PENDIENTE`. Con `estado: 'EN_EJECUCION'` SHALL aplicar exactamente la misma regla y el mismo permiso que `POST …/iniciar`.

#### Scenario: Cerrar por PATCH
- **WHEN** se hace `PATCH …/status` con `{ estado: 'CERRADA', descripcionEvidencia: '…' }`
- **THEN** la respuesta es 422 con `USAR_FLUJO_VERIFICACION` y la AC no cambia

### Requirement: Solo el JCA cierra AC de NC e incidentes
`POST /api/nonconformities/{ncId}/acciones-correctivas/{acId}/cerrar` y `PATCH /api/incidents/{incidenteId}/acciones/{acId}/cerrar` SHALL responder 403 con `errorCode: 'SOLO_JCA_VERIFICA'` cuando el rol efectivo no es `JEFE_CALIDAD_SYST`, y SHALL seguir exigiendo `descripcionEvidencia`. `ACSection` (NC) e `IncidentACSection` SHALL mostrar el botón de cierre solo al JEFE_CALIDAD_SYST.

#### Scenario: Operario intenta cerrar una AC de NC
- **WHEN** un OPERARIO hace `POST …/cerrar` sobre una AC de NC con evidencia
- **THEN** la respuesta es 403 con `SOLO_JCA_VERIFICA`

### Requirement: Vencimientos y KPI ignoran AC ejecutadas pendientes de verificación
Una AC de QE en `COMPLETADA` SHALL tratarse como ejecutada y, por eso:
- MUST NOT contar como vencida en KPI-08 ni en las listas de AC vencidas (`EsAcVencida`);
- MUST NOT generar notificaciones de vencimiento (`VencimientoScanner`).

KPI-05 SHALL seguir contando solo las AC `CERRADA`.

#### Scenario: AC ejecutada fuera de plazo
- **WHEN** una AC está `COMPLETADA` con `plazoFecha` en el pasado
- **THEN** no cuenta en KPI-08 y el escáner de vencimientos no notifica por ella
