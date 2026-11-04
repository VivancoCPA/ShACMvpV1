## MODIFIED Requirements

### Requirement: Carga del PDF autenticada vía blob, nunca una URL estática
`DocumentViewer` SHALL obtener el PDF llamando a `GET /api/documents/{id}/visor` a través de la instancia `api` (axios, con el JWT adjunto por el interceptor existente) con `{ responseType: 'blob' }`, y pasar el blob resultante a `<Document file={blob}>`. El componente SHALL NOT recibir ni construir una URL de archivo estática como prop.

Mientras la primera carga está en curso, el componente SHALL mostrar un estado "Generando vista previa…" con un spinner. Si la solicitud falla, SHALL mostrar el mensaje de error correspondiente (incluyendo el caso "el documento aún no tiene archivo para visualizar" cuando el backend responde 404 por falta de archivo original).

**fix-log-refresco-inmediato:** tras una carga exitosa del blob, el componente SHALL invalidar la query `documents.detail(documentoId)` exactamente una vez por apertura — para que la entrada `VISUALIZACION` registrada por el backend aparezca en el audit trail del detalle sin recargar la página. Esta invalidación SHALL NOT disparar una segunda solicitud del propio visor (su query, `['documents', 'visor', documentoId]`, es independiente de `documents.detail`).

#### Scenario: Carga exitosa usa blob autenticado
- **WHEN** `DocumentViewer` se monta para un documento con acceso
- **THEN** se realiza un `GET /api/documents/:id/visor` con `responseType: 'blob'` a través de `api`, y el PDF se renderiza desde el blob resultante

#### Scenario: Estado de carga mientras se genera la vista previa
- **WHEN** la solicitud del PDF está pendiente
- **THEN** el visor muestra "Generando vista previa…" con un spinner, sin renderizar contenido parcial

#### Scenario: Error de documento sin archivo muestra mensaje claro
- **WHEN** la solicitud responde `404` porque el documento no tiene archivo original
- **THEN** el visor muestra el mensaje "Este documento aún no tiene archivo para visualizar" en vez de un error genérico

#### Scenario: Error genérico muestra un estado de error
- **WHEN** la solicitud del PDF falla por cualquier otra razón
- **THEN** el visor muestra un estado de error, sin quedar en el spinner de carga indefinidamente

#### Scenario: Carga exitosa invalida el detalle del documento exactamente una vez
- **WHEN** el visor carga el PDF exitosamente
- **THEN** la query `documents.detail(documentoId)` se invalida exactamente una vez, y `getDocumentVisorBlob` no se vuelve a invocar como consecuencia de esa invalidación

#### Scenario: Carga fallida no invalida el detalle
- **WHEN** la solicitud del PDF falla (403/404/422)
- **THEN** `documents.detail(documentoId)` no se invalida
