## ADDED Requirements

### Requirement: getArchivoOriginalUrl resuelve el nombre de archivo vía el helper compartido
`getArchivoOriginalUrl(id: string, fallbackNombre?: string)` SHALL resolver el nombre del archivo descargado con `getFileNameFromContentDisposition` (capability `shared-content-disposition`) sobre el header `content-disposition` de la respuesta. SHALL NOT usar una expresión regular propia. Si el helper no encuentra ningún nombre en el header, SHALL usar `fallbackNombre` (el `documento.archivoOriginalNombre` ya conocido por el caller) cuando esté definido. Si tampoco hay `fallbackNombre`, SHALL usar un nombre genérico que incluya una extensión (nunca un nombre sin extensión).

#### Scenario: Nombre resuelto desde el header cuando está presente
- **WHEN** la respuesta de `GET /:id/archivo-original` incluye `Content-Disposition: attachment; filename*=UTF-8''Procedimiento%20de%20Inspecci%C3%B3n.docx`
- **THEN** `getArchivoOriginalUrl` resuelve `fileName` como `"Procedimiento de Inspección.docx"`

#### Scenario: Fallback a archivoOriginalNombre cuando el header no llega
- **WHEN** la respuesta no incluye `content-disposition` (p.ej. CORS lo oculta) y se llama `getArchivoOriginalUrl(id, documento.archivoOriginalNombre)`
- **THEN** `fileName` resuelto es igual a `documento.archivoOriginalNombre`, con su extensión original

#### Scenario: Fallback final nunca queda sin extensión
- **WHEN** no hay header `content-disposition` ni `fallbackNombre`
- **THEN** el `fileName` resuelto incluye una extensión de archivo (nunca un nombre pelado)

### Requirement: getArchivoDistribucionBlob resuelve el nombre de archivo vía el helper compartido
`getArchivoDistribucionBlob(id: string)` SHALL resolver el nombre del archivo descargado con `getFileNameFromContentDisposition`, con fallback a `documento-${id}-distribucion.pdf` (ya incluye extensión) si el header no llega. SHALL NOT usar una expresión regular propia.

#### Scenario: Nombre resuelto desde el header cuando está presente
- **WHEN** la respuesta de `GET /:id/archivo-distribucion` incluye `Content-Disposition: attachment; filename="PRC-CD-013-v1.0.pdf"`
- **THEN** `getArchivoDistribucionBlob` resuelve `fileName` como `"PRC-CD-013-v1.0.pdf"`

#### Scenario: Fallback con extensión cuando el header no llega
- **WHEN** la respuesta no incluye `content-disposition`
- **THEN** `fileName` resuelto es `documento-<id>-distribucion.pdf`

### Requirement: exportarPdfControlado resuelve el nombre de archivo vía el helper compartido
`exportarPdfControlado(id, payload)` SHALL resolver el nombre del archivo descargado con `getFileNameFromContentDisposition`, con fallback a `documento-${id}-controlado.pdf` si el header no llega. SHALL NOT usar una expresión regular propia.

#### Scenario: Nombre resuelto desde el header cuando está presente
- **WHEN** la respuesta de `POST /:id/exportar-pdf` incluye `Content-Disposition: attachment; filename=PRC-CD-013-copia.pdf`
- **THEN** `exportarPdfControlado` resuelve `fileName` como `"PRC-CD-013-copia.pdf"`

#### Scenario: Fallback con extensión cuando el header no llega
- **WHEN** la respuesta no incluye `content-disposition`
- **THEN** `fileName` resuelto es `documento-<id>-controlado.pdf`
