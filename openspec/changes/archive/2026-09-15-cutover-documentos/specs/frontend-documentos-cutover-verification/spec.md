## ADDED Requirements

### Requirement: El ciclo de vida completo de un Documento funciona contra el backend .NET real sin MSW

Con `VITE_ENABLE_MSW=false` y `VITE_API_BASE_URL` apuntando al backend .NET real corriendo localmente contra Postgres real, el sistema SHALL completar la creación, listado, detalle, edición, y las 6 transiciones de la máquina de estados de Documentos (`BORRADOR → EN_REVISION → EN_APROBACION → PUBLICADO`, `PUBLICADO → EN_REVISION_PERIODICA`, rechazo de vuelta a `BORRADOR`) con el mismo comportamiento observable que hoy contra MSW.

#### Scenario: Creación y listado de Documento contra el backend real
- **WHEN** un usuario con permiso (`AUTOR`/`JEFE_CALIDAD_SYST`) crea un documento desde `DocumentForm` (modo `create`) con `titulo`, `tipo`, `areaId`, `confidencialidad`, `revisorId`/`aprobadorId`
- **THEN** el documento se crea contra el backend real con `codigo` generado server-side, aparece en `DocumentList`, y sus campos coinciden exactamente con lo enviado

#### Scenario: Enviar a revisión, aprobar revisión y firmar publica el documento con PIN real
- **WHEN** el documento avanza `BORRADOR → EN_REVISION` (AUTOR), `EN_REVISION → EN_APROBACION` (revisor asignado), y el aprobador asignado abre `DocumentSignatureModal` e ingresa su PIN real configurado (`POST /api/auth/set-pin`)
- **THEN** cada transición PATCH se completa contra el backend real, y la firma con PIN válido publica el documento (`estado → PUBLICADO`) sin el error 401 que producía el mismatch de contrato `password`/`Pin` previo a este change

#### Scenario: Rechazo devuelve el documento a BORRADOR con notificación
- **WHEN** el revisor o aprobador rechaza el documento desde `DocumentRejectModal` con un motivo de al menos 20 caracteres
- **THEN** el documento vuelve a `estado: 'BORRADOR'` contra el backend real y el autor es notificado si `notificarAutor` está marcado

#### Scenario: Iniciar revisión periódica y confirmarla
- **WHEN** `JEFE_CALIDAD_SYST` inicia revisión periódica desde `PUBLICADO` y luego confirma la revisión (`PATCH /:id/confirmar-revision`)
- **THEN** ambas operaciones se completan contra el backend real con el mismo comportamiento observable que contra MSW

### Requirement: RN-DOC-001 y RN-DOC-005 se verifican en un flujo de firma real, no solo por API directa

El sistema SHALL aplicar, durante una firma real disparada desde `DocumentSignatureModal` (no una llamada directa a la API), la obsoletización automática de la versión `PUBLICADO` previa del mismo código (RN-DOC-001) y el bloqueo de publicación cuando esa versión previa tiene un Quality Event vinculado en estado activo (RN-DOC-005).

#### Scenario: Firmar una nueva versión obsoletiza automáticamente la versión PUBLICADO previa
- **WHEN** existe una versión `v1.0` en estado `PUBLICADO` de un código, se crea una `v1.1` del mismo código y se firma con PIN válido hasta `PUBLICADO`
- **THEN** `v1.0` pasa automáticamente a `OBSOLETO` y solo `v1.1` queda `PUBLICADO`, verificado en `DocumentDetailPage` y `DocumentList` tras recargar

#### Scenario: Firmar se bloquea si la versión previa tiene un QE vinculado activo
- **WHEN** la versión `PUBLICADO` previa del mismo código tiene un Quality Event vinculado en un estado distinto de `CERRADO`/`VERIFICADO`, y se intenta firmar la nueva versión
- **THEN** el backend responde 409 y `DocumentSignatureModal` muestra el error sin publicar ninguna de las dos versiones

### Requirement: Gestión de archivos (original, distribución, PDF controlado) funciona contra el backend real

El sistema SHALL completar el reemplazo del archivo original editable, la generación del PDF de distribución al firmar, la exportación de PDF controlado, y la descarga con registro de auditoría, contra el backend .NET real.

#### Scenario: Reemplazar el archivo original en BORRADOR/EN_REVISION
- **WHEN** el `AUTOR` o `JEFE_CONTROL_DOCUMENTARIO` sube un nuevo archivo original desde `DocumentForm` mientras el documento está en `BORRADOR` o `EN_REVISION`
- **THEN** `POST /:id/archivo-original` (multipart real) reemplaza el archivo contra el backend real y `archivoOriginalUrl`/`archivoOriginalNombre` se actualizan

#### Scenario: Exportar PDF controlado con marca de agua si el documento está OBSOLETO
- **WHEN** un usuario exporta el PDF controlado de un documento `OBSOLETO`
- **THEN** el blob devuelto por `POST /:id/exportar-pdf` se descarga vía el patrón Blob (no `window.open` directo) y refleja la marca de agua "OBSOLETO — No usar"

#### Scenario: Descarga registra un AuditTrailEntry
- **WHEN** un usuario descarga el archivo vigente de un documento
- **THEN** `POST /:id/audit/access` registra la descarga contra el backend real, con el actor resuelto del JWT, no de un campo enviado por el cliente

### Requirement: La vinculación de Documento con Quality Event y No Conformidad sigue funcionando contra el backend real

El sistema SHALL confirmar, sin cambios de este change, que la vinculación Documento↔QE y Documento↔NC ya cutover-eada en sesiones anteriores sigue funcionando contra este mismo backend.

#### Scenario: Vincular y desvincular un Documento con un Quality Event
- **WHEN** se vincula un documento a un Quality Event vía `POST /:id/qe-vinculados` y luego se desvincula vía `DELETE /:id/qe-vinculados/:qeId`
- **THEN** ambas operaciones se completan contra el backend real, sin regresión respecto a la verificación previa de `documento-qe-vinculacion`

### Requirement: MSW se revierte a activo al cerrar la verificación de Documentos

El sistema SHALL dejar `shc-controldoc/.env.development` con `VITE_ENABLE_MSW=true` una vez completada la verificación de este change, para no bloquear el desarrollo diario de los módulos de dominio aún no cutover-eados.

#### Scenario: Estado del entorno de desarrollo al cerrar el change
- **WHEN** se inspecciona `shc-controldoc/.env.development` después de cerrado este change
- **THEN** `VITE_ENABLE_MSW` es `true`, igual que antes de iniciar la verificación
