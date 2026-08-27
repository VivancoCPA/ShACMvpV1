# Spec: documento-nc-vinculacion

## Purpose

Vinculación real Documento↔NoConformidad vía tabla puente: los 4 endpoints simétricos (creación idempotente, eliminación, aislamiento cross-empresa), el resumen poblado en ambos `GET :id`, el audit trail de cada vínculo, y el componente combobox usado desde ambos detalles para buscar y vincular.

---

## Requirements

### Requirement: Tabla puente Documento↔NoConformidad
El sistema SHALL modelar la vinculación entre `Documento` y `NoConformidad` como una tabla puente con clave primaria compuesta `(DocumentoId, NoConformidadId)`, de modo que un par documento-NC nunca puede estar vinculado más de una vez. Cada fila SHALL registrar `EmpresaId` (fijado desde la sesión activa al crear el vínculo, nunca desde el body de la petición) y `CreadoPorId`/`CreadoEn`. Ambos lados del vínculo SHALL pertenecer a la misma `EmpresaId` — un vínculo cross-empresa nunca puede crearse.

#### Scenario: Un par documento-NC no puede vincularse dos veces
- **WHEN** un documento y una NC ya están vinculados y se solicita vincularlos nuevamente (desde cualquiera de los dos endpoints)
- **THEN** el sistema no crea una segunda fila para el mismo par

### Requirement: Endpoints simétricos de vinculación desde el lado Documento
El sistema SHALL exponer `POST /api/documents/:id/nc-vinculadas` (body `{ noConformidadId }`) para crear el vínculo, y `DELETE /api/documents/:id/nc-vinculadas/:noConformidadId` para eliminarlo. La creación SHALL ser idempotente: si el vínculo ya existe, el sistema responde `200` sin error, no `409`.

#### Scenario: Vincular una NC a un documento por primera vez
- **WHEN** se envía `POST /api/documents/:id/nc-vinculadas` con un `noConformidadId` válido, sin vínculo previo entre ambos
- **THEN** el sistema responde `200`/`201` y el vínculo queda creado

#### Scenario: Vincular la misma NC dos veces es idempotente
- **WHEN** se envía `POST /api/documents/:id/nc-vinculadas` con un `noConformidadId` que ya está vinculado a ese documento
- **THEN** el sistema responde `200`, sin crear un vínculo duplicado ni responder `409`

#### Scenario: Desvincular un vínculo existente
- **WHEN** se envía `DELETE /api/documents/:id/nc-vinculadas/:noConformidadId` sobre un vínculo existente
- **THEN** el sistema responde `200` y el vínculo deja de existir

#### Scenario: Desvincular un vínculo inexistente responde 404
- **WHEN** se envía `DELETE /api/documents/:id/nc-vinculadas/:noConformidadId` y ese par no está vinculado
- **THEN** el sistema responde `404`

### Requirement: Endpoints simétricos de vinculación desde el lado No Conformidad
El sistema SHALL exponer `POST /api/nonconformities/:id/documentos-vinculados` (body `{ documentoId }`) y `DELETE /api/nonconformities/:id/documentos-vinculados/:documentoId`, sobre la misma tabla puente que los endpoints del lado Documento, con idéntico criterio de idempotencia y de `404` en desvinculación.

#### Scenario: Vincular un documento a una NC desde el lado NC
- **WHEN** se envía `POST /api/nonconformities/:id/documentos-vinculados` con un `documentoId` válido, sin vínculo previo
- **THEN** el sistema responde `200`/`201` y el vínculo queda creado, visible también desde `GET /api/documents/:documentoId`

#### Scenario: Un vínculo creado desde un lado es visible desde el otro
- **WHEN** se crea un vínculo vía `POST /api/documents/:id/nc-vinculadas`
- **THEN** `GET /api/nonconformities/:noConformidadId` incluye ese documento en su lista de vinculados, sin necesidad de una llamada adicional desde el lado NC

### Requirement: Aislamiento cross-empresa en ambos ids de un vínculo
Todo endpoint de vinculación/desvinculación SHALL verificar que **ambos** ids referenciados (el de la URL y el del body/param) pertenecen a la empresa activa de la sesión. Si cualquiera de los dos no existe o pertenece a otra empresa, el sistema SHALL responder `404` uniforme — nunca `403`, nunca un mensaje que distinga "no existe" de "es de otra empresa" (mismo criterio 404-siempre usado en el resto de la API).

#### Scenario: El documento de la URL es de otra empresa
- **WHEN** se envía `POST /api/documents/:id/nc-vinculadas` con un `:id` que existe pero pertenece a otra empresa
- **THEN** el sistema responde `404`

#### Scenario: El noConformidadId del body es de otra empresa
- **WHEN** se envía `POST /api/documents/:id/nc-vinculadas` con un documento válido de la empresa activa pero un `noConformidadId` que existe en otra empresa
- **THEN** el sistema responde `404`, sin crear ningún vínculo

### Requirement: Resumen poblado en las respuestas de detalle
`GET /api/documents/:id` SHALL incluir `ncVinculados` como una lista de objetos `{ id, numero, tipo, severidad, estado }` (uno por cada NC vinculada), no solo los ids. `GET /api/nonconformities/:id` SHALL incluir `documentosVinculados` como una lista de objetos `{ id, codigo, titulo, estado }`. Ninguno de los dos listados de `GET` (`ListarDocumentos`/`ListarNoConformidades`) SHALL poblar este resumen — permanece vacío en listados paginados, para evitar N+1 consultas.

#### Scenario: Detalle de documento incluye resumen de NCs vinculadas
- **WHEN** se solicita `GET /api/documents/:id` sobre un documento con 2 NCs vinculadas
- **THEN** `data.ncVinculados` contiene 2 objetos, cada uno con `id`, `numero`, `tipo`, `severidad` y `estado`

#### Scenario: Detalle de NC incluye resumen de documentos vinculados
- **WHEN** se solicita `GET /api/nonconformities/:id` sobre una NC con 1 documento vinculado
- **THEN** `data.documentosVinculados` contiene 1 objeto con `id`, `codigo`, `titulo` y `estado`

#### Scenario: Listado de documentos no puebla el resumen de NCs vinculadas
- **WHEN** se solicita `GET /api/documents` (listado paginado)
- **THEN** cada elemento de `data` tiene `ncVinculados: []`, independientemente de sus vínculos reales

### Requirement: Permiso para vincular/desvincular desde el lado Documento
El sistema SHALL exigir el mismo permiso de edición ya usado para el resto de mutaciones sobre un documento (`CanEdit`: docRole `AUTOR`/`JEFE_CALIDAD` en estado `BORRADOR`/`EN_REVISION`) para crear o eliminar un vínculo vía `POST`/`DELETE /api/documents/:id/nc-vinculadas[...]`.

#### Scenario: Autor puede vincular en BORRADOR
- **WHEN** el autor del documento envía `POST /api/documents/:id/nc-vinculadas` sobre un documento propio en `BORRADOR`
- **THEN** el sistema crea el vínculo

#### Scenario: Vinculación rechazada sobre documento PUBLICADO
- **WHEN** cualquier usuario envía `POST /api/documents/:id/nc-vinculadas` sobre un documento en `PUBLICADO`
- **THEN** el sistema responde con un error de permiso, sin crear el vínculo

### Requirement: Permiso para vincular/desvincular desde el lado No Conformidad
El sistema SHALL permitir crear o eliminar un vínculo vía `POST`/`DELETE /api/nonconformities/:id/documentos-vinculados[...]` únicamente a los roles `SUPERVISOR` o `JEFE_CALIDAD_SYST`, mientras la NC no esté en estado `CERRADA` ni `ANULADA`. A diferencia del criterio equivalente del lado Quality Event, no SHALL exigirse que el `SUPERVISOR` sea el responsable de investigación asignado — `NoConformidad` no distingue ese concepto de responsable-con-permiso-ampliado.

#### Scenario: Jefe de Calidad puede vincular en cualquier estado activo
- **WHEN** un usuario `JEFE_CALIDAD_SYST` envía `POST /api/nonconformities/:id/documentos-vinculados` sobre una NC en `EN_EJECUCION`
- **THEN** el sistema crea el vínculo

#### Scenario: Cualquier Supervisor puede vincular, sin restricción de responsable
- **WHEN** un `SUPERVISOR` que no es el responsable de investigación de la NC envía `POST /api/nonconformities/:id/documentos-vinculados` sobre una NC activa
- **THEN** el sistema crea el vínculo

#### Scenario: Vinculación rechazada sobre NC cerrada o anulada
- **WHEN** cualquier usuario envía `POST /api/nonconformities/:id/documentos-vinculados` sobre una NC en estado `CERRADA` o `ANULADA`
- **THEN** el sistema responde con un error de permiso, sin crear el vínculo

#### Scenario: Operario no puede vincular
- **WHEN** un usuario `OPERARIO` envía `POST /api/nonconformities/:id/documentos-vinculados` sobre una NC activa
- **THEN** el sistema responde con un error de permiso, sin crear el vínculo

### Requirement: Auditoría de vinculación y desvinculación
Toda creación o eliminación de un vínculo SHALL registrar una entrada de audit trail en ambos dominios afectados (`Documento` y `NoConformidad`), con acción `DOCUMENTO_VINCULADO`/`DOCUMENTO_DESVINCULADO` en el audit trail del documento y `NC_VINCULADO`/`NC_DESVINCULADO` en el de la NC, identificando quién realizó la acción y cuándo.

#### Scenario: Vincular registra una entrada en cada audit trail
- **WHEN** se crea un vínculo entre un documento y una NC
- **THEN** el audit trail del documento gana una entrada `DOCUMENTO_VINCULADO` y el audit trail de la NC gana una entrada `NC_VINCULADO`, ambas con el mismo actor y timestamp

#### Scenario: Desvincular registra una entrada en cada audit trail
- **WHEN** se elimina un vínculo existente
- **THEN** el audit trail del documento gana una entrada `DOCUMENTO_DESVINCULADO` y el de la NC gana `NC_DESVINCULADO`

### Requirement: Componente combobox de vinculación Documento↔NC
El sistema SHALL proveer un componente de UI (usado tanto desde el detalle de Documento como desde el detalle de No Conformidad) que: busca con debounce (300ms) contra el endpoint paginado de listado del lado contrario (`GET /api/documents?search=...&pageSize=10` o `GET /api/nonconformities?search=...&pageSize=10`), excluye de los resultados los ids ya vinculados, y dispara la mutación de vincular inmediatamente al seleccionar un resultado — sin un botón "Guardar" separado. Los vínculos existentes SHALL representarse como una lista de solo-lectura removible (ícono de quitar por ítem), no necesariamente como chips inline junto al input de búsqueda.

#### Scenario: Buscar con debounce no dispara una petición por cada tecla
- **WHEN** el usuario escribe 4 caracteres consecutivos en menos de 300ms en el combobox
- **THEN** el sistema realiza una sola petición de búsqueda, con el texto final

#### Scenario: Seleccionar un resultado vincula inmediatamente
- **WHEN** el usuario selecciona un resultado de la lista del combobox
- **THEN** se dispara la mutación de vincular sin requerir una confirmación adicional, y el resultado aparece en la lista de vínculos

#### Scenario: Quitar un vínculo desvincula inmediatamente
- **WHEN** el usuario hace clic en el ícono de quitar de un vínculo existente
- **THEN** se dispara la mutación de desvincular correspondiente, y el ítem desaparece de la lista al confirmarse

#### Scenario: Resultados ya vinculados no se repiten en la búsqueda
- **WHEN** el usuario busca en el combobox y uno de los resultados coincidentes ya está vinculado
- **THEN** ese resultado no aparece en la lista de opciones seleccionables
