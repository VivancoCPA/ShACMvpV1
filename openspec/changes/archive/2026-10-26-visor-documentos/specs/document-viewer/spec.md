## ADDED Requirements

### Requirement: Componente DocumentViewer embebido basado en react-pdf
El sistema SHALL implementar un componente reutilizable `DocumentViewer` (`src/features/documents/components/DocumentViewer.tsx`) basado en `react-pdf`, con navegación por páginas, control de zoom, y un botón "ajustar al ancho". El componente SHALL funcionar en viewport móvil (≥ 360px de ancho) sin overflow horizontal.

El worker de pdf.js SHALL configurarse para Vite vía `pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()`, sin depender de un CDN externo.

#### Scenario: Navegación entre páginas
- **WHEN** el usuario hace clic en "página siguiente" en un PDF de 3 páginas
- **THEN** el visor muestra la página 2

#### Scenario: Zoom y ajuste al ancho funcionan
- **WHEN** el usuario hace clic en "ajustar al ancho"
- **THEN** la página renderizada ocupa el ancho disponible del contenedor, sin overflow horizontal

#### Scenario: Visor funciona en viewport móvil
- **WHEN** el visor se renderiza en un viewport de 360px de ancho
- **THEN** no hay scroll horizontal en la página, y los controles de navegación/zoom permanecen accesibles

### Requirement: Carga del PDF autenticada vía blob, nunca una URL estática
`DocumentViewer` SHALL obtener el PDF llamando a `GET /api/documents/{id}/visor` a través de la instancia `api` (axios, con el JWT adjunto por el interceptor existente) con `{ responseType: 'blob' }`, y pasar el blob resultante a `<Document file={blob}>`. El componente SHALL NOT recibir ni construir una URL de archivo estática como prop.

Mientras la primera carga está en curso, el componente SHALL mostrar un estado "Generando vista previa…" con un spinner. Si la solicitud falla, SHALL mostrar el mensaje de error correspondiente (incluyendo el caso "el documento aún no tiene archivo para visualizar" cuando el backend responde 404 por falta de archivo original).

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

### Requirement: Sin descarga, sin capa de texto, sin menú contextual
`DocumentViewer` SHALL NOT renderizar ningún botón de descarga del PDF, para ningún rol. Cada `<Page>` SHALL renderizarse con `renderTextLayer={false}` y `renderAnnotationLayer={false}` (sin capa de texto seleccionable ni anotaciones interactivas). El contenedor del visor SHALL deshabilitar el menú contextual del navegador (`onContextMenu` con `preventDefault`).

#### Scenario: No existe botón de descarga para ningún rol
- **WHEN** el visor se renderiza para cualquier rol con acceso (incluyendo `JEFE_CONTROL_DOCUMENTARIO`/`ALTA_DIRECCION`)
- **THEN** no hay ningún botón o control de descarga del PDF en el DOM

#### Scenario: No hay capa de texto seleccionable
- **WHEN** el visor renderiza una página
- **THEN** no existe una capa de texto seleccionable superpuesta al canvas (no se puede seleccionar ni copiar texto)

#### Scenario: Menú contextual deshabilitado sobre el visor
- **WHEN** el usuario hace clic derecho sobre el área del visor
- **THEN** el menú contextual nativo del navegador no aparece

### Requirement: Botón de imprimir visible solo para JEFE_CONTROL_DOCUMENTARIO y ALTA_DIRECCION
`DocumentViewer` SHALL renderizar un botón "Imprimir" únicamente cuando el rol global del usuario autenticado es `JEFE_CONTROL_DOCUMENTARIO` o `ALTA_DIRECCION` (verificado desde `authStore`, RN-DOC-010). Al hacer clic, el componente SHALL reutilizar el blob ya cargado (sin una nueva solicitud de red), crear un `<iframe>` oculto con `src = URL.createObjectURL(blob)`, esperar su evento `load`, invocar `iframe.contentWindow.print()`, y remover el iframe (revocando el object URL) después de imprimir. El botón SHALL dispararse únicamente por un clic directo del usuario, nunca automáticamente.

#### Scenario: Botón de imprimir visible para JEFE_CONTROL_DOCUMENTARIO
- **WHEN** un usuario con rol `JEFE_CONTROL_DOCUMENTARIO` visualiza el documento
- **THEN** el botón "Imprimir" está presente

#### Scenario: Botón de imprimir visible para ALTA_DIRECCION
- **WHEN** un usuario con rol `ALTA_DIRECCION` visualiza el documento
- **THEN** el botón "Imprimir" está presente

#### Scenario: Botón de imprimir ausente para otros roles
- **WHEN** un usuario con rol `OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST` o `AUDITOR_INTERNO` visualiza el documento
- **THEN** el botón "Imprimir" no está presente en el DOM

#### Scenario: Imprimir reutiliza el blob ya cargado
- **WHEN** un usuario con permiso de impresión hace clic en "Imprimir"
- **THEN** no se realiza ninguna solicitud de red adicional; se usa el blob ya obtenido para la vista previa

### Requirement: Acción "Ver documento" visible según estado y permiso, "Descargar" queda como secundaria
En el detalle del documento, la acción "Ver documento" (que abre `DocumentViewer`) SHALL ser la acción principal visible cuando `getDocumentPermissions(estado, docRole).canRead` es verdadero (con la excepción CA-34 de `document-viewer-api` aplicada igual en `OBSOLETO`). "Descargar archivo original" SHALL quedar como acción secundaria, sujeta a sus propias reglas existentes (RN-DOC-013/016), sin cambios.

#### Scenario: Ver documento visible para el aprobador en EN_APROBACION
- **WHEN** el `docRole APROBADOR` asignado visualiza el detalle de un documento en `EN_APROBACION`
- **THEN** el botón "Ver documento" está visible como acción principal

#### Scenario: Ver documento ausente para OPERARIO en BORRADOR
- **WHEN** un usuario con `docRole OPERARIO` visualiza el detalle de un documento en `BORRADOR`
- **THEN** el botón "Ver documento" no está visible

#### Scenario: Descargar archivo original permanece como acción secundaria
- **WHEN** el detalle de un documento renderiza ambas acciones disponibles
- **THEN** "Ver documento" se muestra con mayor énfasis visual que "Descargar archivo original"
