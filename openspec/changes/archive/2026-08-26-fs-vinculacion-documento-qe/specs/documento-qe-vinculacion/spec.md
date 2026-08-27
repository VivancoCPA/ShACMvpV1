## ADDED Requirements

### Requirement: Tabla puente Documento↔QualityEvent
El sistema SHALL modelar la vinculación entre `Documento` y `QualityEvent` como una tabla puente con clave primaria compuesta `(DocumentoId, QualityEventId)`, de modo que un par documento-QE nunca puede estar vinculado más de una vez. Cada fila SHALL registrar `EmpresaId` (fijado desde la sesión activa al crear el vínculo, nunca desde el body de la petición) y `CreadoPorId`/`CreadoEn`. Ambos lados del vínculo SHALL pertenecer a la misma `EmpresaId` — un vínculo cross-empresa nunca puede crearse.

#### Scenario: Un par documento-QE no puede vincularse dos veces
- **WHEN** un documento y un QE ya están vinculados y se solicita vincularlos nuevamente (desde cualquiera de los dos endpoints)
- **THEN** el sistema no crea una segunda fila para el mismo par

### Requirement: Endpoints simétricos de vinculación desde el lado Documento
El sistema SHALL exponer `POST /api/documents/:id/qe-vinculados` (body `{ qualityEventId }`) para crear el vínculo, y `DELETE /api/documents/:id/qe-vinculados/:qualityEventId` para eliminarlo. La creación SHALL ser idempotente: si el vínculo ya existe, el sistema responde `200` sin error, no `409`.

#### Scenario: Vincular un QE a un documento por primera vez
- **WHEN** se envía `POST /api/documents/:id/qe-vinculados` con un `qualityEventId` válido, sin vínculo previo entre ambos
- **THEN** el sistema responde `200`/`201` y el vínculo queda creado

#### Scenario: Vincular el mismo QE dos veces es idempotente
- **WHEN** se envía `POST /api/documents/:id/qe-vinculados` con un `qualityEventId` que ya está vinculado a ese documento
- **THEN** el sistema responde `200`, sin crear un vínculo duplicado ni responder `409`

#### Scenario: Desvincular un vínculo existente
- **WHEN** se envía `DELETE /api/documents/:id/qe-vinculados/:qualityEventId` sobre un vínculo existente
- **THEN** el sistema responde `200` y el vínculo deja de existir

#### Scenario: Desvincular un vínculo inexistente responde 404
- **WHEN** se envía `DELETE /api/documents/:id/qe-vinculados/:qualityEventId` y ese par no está vinculado
- **THEN** el sistema responde `404`

### Requirement: Endpoints simétricos de vinculación desde el lado Quality Event
El sistema SHALL exponer `POST /api/quality-events/:id/documentos-vinculados` (body `{ documentoId }`) y `DELETE /api/quality-events/:id/documentos-vinculados/:documentoId`, sobre la misma tabla puente que los endpoints del lado Documento, con idéntico criterio de idempotencia y de `404` en desvinculación.

#### Scenario: Vincular un documento a un QE desde el lado QE
- **WHEN** se envía `POST /api/quality-events/:id/documentos-vinculados` con un `documentoId` válido, sin vínculo previo
- **THEN** el sistema responde `200`/`201` y el vínculo queda creado, visible también desde `GET /api/documents/:documentoId`

#### Scenario: Un vínculo creado desde un lado es visible desde el otro
- **WHEN** se crea un vínculo vía `POST /api/documents/:id/qe-vinculados`
- **THEN** `GET /api/quality-events/:qualityEventId` incluye ese documento en su lista de vinculados, sin necesidad de una llamada adicional desde el lado QE

### Requirement: Aislamiento cross-empresa en ambos ids de un vínculo
Todo endpoint de vinculación/desvinculación SHALL verificar que **ambos** ids referenciados (el de la URL y el del body/param) pertenecen a la empresa activa de la sesión. Si cualquiera de los dos no existe o pertenece a otra empresa, el sistema SHALL responder `404` uniforme — nunca `403`, nunca un mensaje que distinga "no existe" de "es de otra empresa" (mismo criterio 404-siempre usado en el resto de la API).

#### Scenario: El documento de la URL es de otra empresa
- **WHEN** se envía `POST /api/documents/:id/qe-vinculados` con un `:id` que existe pero pertenece a otra empresa
- **THEN** el sistema responde `404`

#### Scenario: El qualityEventId del body es de otra empresa
- **WHEN** se envía `POST /api/documents/:id/qe-vinculados` con un documento válido de la empresa activa pero un `qualityEventId` que existe en otra empresa
- **THEN** el sistema responde `404`, sin crear ningún vínculo

### Requirement: RN-DOC-005 real — bloqueo de obsoletización con QE activo vinculado
El sistema SHALL evaluar RN-DOC-005 en el único punto donde un documento pasa a `OBSOLETO`: la obsoletización automática de la versión `PUBLICADO` previa, que ocurre al firmar la publicación de una nueva versión con el mismo código. Si esa versión previa tiene al menos un vínculo a un `QualityEvent` cuyo estado no es `CERRADO` ni `VERIFICADO`, el sistema SHALL rechazar la operación completa con `409`, sin publicar la nueva versión ni obsoletizar la anterior.

#### Scenario: Publicación bloqueada por QE activo vinculado a la versión previa
- **WHEN** se firma la publicación de una nueva versión de un documento cuya versión `PUBLICADO` previa tiene un vínculo a un QE en estado `EN_INVESTIGACION`
- **THEN** el sistema responde `409`, la nueva versión no queda `PUBLICADO`, y la versión previa permanece `PUBLICADO`

#### Scenario: Publicación permitida cuando todos los QE vinculados están cerrados o verificados
- **WHEN** se firma la publicación de una nueva versión de un documento cuya versión previa solo tiene vínculos a QEs en estado `CERRADO` o `VERIFICADO`
- **THEN** el sistema completa la publicación: la nueva versión queda `PUBLICADO` y la anterior queda `OBSOLETO`

#### Scenario: Publicación permitida cuando la versión previa no tiene vínculos
- **WHEN** se firma la publicación de una nueva versión de un documento cuya versión previa no tiene ningún vínculo a un QE
- **THEN** el sistema completa la publicación normalmente

### Requirement: Resumen poblado en las respuestas de detalle
`GET /api/documents/:id` SHALL incluir `qeVinculados` como una lista de objetos `{ id, numero, tipo, severidad, estado }` (uno por cada QE vinculado), no solo los ids. `GET /api/quality-events/:id` SHALL incluir `documentosVinculados` como una lista de objetos `{ id, codigo, titulo, estado }`. Ninguno de los dos listados de `GET` (`ListarDocumentos`/`ListarQualityEvents`) SHALL poblar este resumen — permanece vacío en listados paginados, para evitar N+1 consultas.

#### Scenario: Detalle de documento incluye resumen de QEs vinculados
- **WHEN** se solicita `GET /api/documents/:id` sobre un documento con 2 QEs vinculados
- **THEN** `data.qeVinculados` contiene 2 objetos, cada uno con `id`, `numero`, `tipo`, `severidad` y `estado`

#### Scenario: Detalle de QE incluye resumen de documentos vinculados
- **WHEN** se solicita `GET /api/quality-events/:id` sobre un QE con 1 documento vinculado
- **THEN** `data.documentosVinculados` contiene 1 objeto con `id`, `codigo`, `titulo` y `estado`

#### Scenario: Listado de documentos no puebla el resumen de QEs vinculados
- **WHEN** se solicita `GET /api/documents` (listado paginado)
- **THEN** cada elemento de `data` tiene `qeVinculados: []`, independientemente de sus vínculos reales

### Requirement: Permiso para vincular/desvincular desde el lado Documento
El sistema SHALL exigir el mismo permiso de edición ya usado para el resto de mutaciones sobre un documento (`CanEdit`: docRole `AUTOR`/`JEFE_CALIDAD` en estado `BORRADOR`/`EN_REVISION`) para crear o eliminar un vínculo vía `POST`/`DELETE /api/documents/:id/qe-vinculados[...]`.

#### Scenario: Autor puede vincular en BORRADOR
- **WHEN** el autor del documento envía `POST /api/documents/:id/qe-vinculados` sobre un documento propio en `BORRADOR`
- **THEN** el sistema crea el vínculo

#### Scenario: Vinculación rechazada sobre documento PUBLICADO
- **WHEN** cualquier usuario envía `POST /api/documents/:id/qe-vinculados` sobre un documento en `PUBLICADO`
- **THEN** el sistema responde con un error de permiso, sin crear el vínculo

### Requirement: Permiso para vincular/desvincular desde el lado Quality Event
El sistema SHALL permitir crear o eliminar un vínculo vía `POST`/`DELETE /api/quality-events/:id/documentos-vinculados[...]` únicamente a: el rol `JEFE_CALIDAD_SYST`, o el `SUPERVISOR` responsable de la investigación (`qe.responsableInvestigacionId` igual al actor) — en ambos casos, solo mientras el QE no esté en estado `CERRADO` ni `VERIFICADO`.

#### Scenario: Jefe de Calidad puede vincular en cualquier estado activo
- **WHEN** un usuario `JEFE_CALIDAD_SYST` envía `POST /api/quality-events/:id/documentos-vinculados` sobre un QE en `EN_EJECUCION`
- **THEN** el sistema crea el vínculo

#### Scenario: Supervisor no responsable no puede vincular
- **WHEN** un `SUPERVISOR` que no es el responsable de investigación del QE envía `POST /api/quality-events/:id/documentos-vinculados`
- **THEN** el sistema responde con un error de permiso, sin crear el vínculo

#### Scenario: Vinculación rechazada sobre QE cerrado o verificado
- **WHEN** cualquier usuario envía `POST /api/quality-events/:id/documentos-vinculados` sobre un QE en estado `CERRADO` o `VERIFICADO`
- **THEN** el sistema responde con un error de permiso, sin crear el vínculo

### Requirement: Auditoría de vinculación y desvinculación
Toda creación o eliminación de un vínculo SHALL registrar una entrada de audit trail en ambos dominios afectados (`Documento` y `QualityEvent`), con acción `DOCUMENTO_VINCULADO`/`DOCUMENTO_DESVINCULADO` en el audit trail del documento y `QE_VINCULADO`/`QE_DESVINCULADO` en el del QE, identificando quién realizó la acción y cuándo.

#### Scenario: Vincular registra una entrada en cada audit trail
- **WHEN** se crea un vínculo entre un documento y un QE
- **THEN** el audit trail del documento gana una entrada `DOCUMENTO_VINCULADO` y el audit trail del QE gana una entrada `QE_VINCULADO`, ambas con el mismo actor y timestamp

#### Scenario: Desvincular registra una entrada en cada audit trail
- **WHEN** se elimina un vínculo existente
- **THEN** el audit trail del documento gana una entrada `DOCUMENTO_DESVINCULADO` y el del QE gana `QE_DESVINCULADO`

### Requirement: Componente combobox compartido de vinculación
El sistema SHALL proveer un componente de UI compartido (usado tanto desde el detalle de Documento como desde el detalle de Quality Event) que: busca con debounce (300ms) contra el endpoint paginado de listado del lado contrario (`GET /api/documents?search=...&pageSize=10` o `GET /api/quality-events?search=...&pageSize=10`), excluye de los resultados los ids ya vinculados, permite selección múltiple representada como chips removibles, y dispara la mutación de vincular/desvincular inmediatamente al seleccionar/remover un chip — sin un botón "Guardar" separado.

#### Scenario: Buscar con debounce no dispara una petición por cada tecla
- **WHEN** el usuario escribe 4 caracteres consecutivos en menos de 300ms en el combobox
- **THEN** el sistema realiza una sola petición de búsqueda, con el texto final

#### Scenario: Seleccionar un resultado vincula inmediatamente
- **WHEN** el usuario selecciona un resultado de la lista del combobox
- **THEN** se dispara la mutación de vincular sin requerir una confirmación adicional, y el resultado aparece como chip

#### Scenario: Remover un chip desvincula inmediatamente
- **WHEN** el usuario hace clic en el ícono de remover de un chip ya vinculado
- **THEN** se dispara la mutación de desvincular correspondiente, y el chip desaparece de la lista al confirmarse

#### Scenario: Resultados ya vinculados no se repiten en la búsqueda
- **WHEN** el usuario busca en el combobox y uno de los resultados coincidentes ya está vinculado
- **THEN** ese resultado no aparece en la lista de opciones seleccionables
