# Instrucciones para Claude Code — Aceptar PDF como archivo original (solo INF, MAT y PLAN)

Fecha: 2026-10-13
Autor: Cowork (diagnóstico leyendo el código real)
Origen: Toño quiere cargar un Plan que solo existe en PDF. El sistema solo acepta Word o Excel.
Change sugerido: `original-pdf-tipos-permitidos`

Ciclo: `/opsx:sync` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

---

## Diagnóstico (confirmado leyendo el código)

1. **Frontend:** en `FileUploadField.tsx`, la variante `original` solo acepta `.docx` y `.xlsx` (`ACCEPTED_TYPES_ORIGINAL` y `accept=".docx,.xlsx"`). La zona "PDF de distribución" de `DocumentForm` solo muestra el texto "se genera automáticamente" y no permite subir nada.
2. **Firma:** `FirmarPublicarDocumentoHandler` exige un archivo original (`SIN_ARCHIVO_ORIGINAL`) y siempre lo convierte con `IDocumentoPdfConverter` (LibreOffice) antes de sellarlo.
3. **Visor:** `VisualizarDocumentoHandler` genera la vista previa convirtiendo el original con el mismo converter.
4. **Validación de backend:** revisa si `CrearDocumento`, `EditarDocumento` y `ReemplazarArchivoOriginalHandler` validan la extensión o el tipo del archivo. Por lo leído, la restricción vive solo en el frontend.

Resultado: hoy no hay forma de publicar un documento que solo existe en PDF. Eso contradice RN-DOC-017 y CA-33 del PRD (ADD-02), que admiten un documento "solo con PDF nativo, sin editable".

## Decisiones de Toño (2026-10-13)

- **D1 — ✅ Opción A: el PDF se acepta como archivo original**, en la misma zona de carga que el Word o el Excel. **No** se habilita la carga manual separada del "PDF de distribución" (opción B, descartada). Anota en `design.md` que así se cumplen RN-DOC-017 y CA-33 sin un segundo camino de carga.
- **D2 — ✅ Solo para los tipos `INF` (Informe), `MAT` (Material) y `PLAN` (Plan).** Para `POL`, `PRC`, `INS` y `REG` el original sigue siendo `.docx` o `.xlsx`. Define la lista en **un solo lugar** en el backend (por ejemplo `DocumentoFormatosPermitidos.TiposConOriginalPdf`), con un espejo en el frontend (`constants.ts`), igual que `DOCUMENT_ASIGNACION_ELIGIBLE_ROLES`, para poder ampliarla después con un cambio de una línea.

---

## Qué implementar

### Backend
1. **Validación de formato en el servidor**, en un helper compartido que usen la creación, la edición con archivo y el reemplazo del original:
   - Permitidos siempre: `.docx` y `.xlsx`. Además `.pdf` si el tipo del documento está en la lista de D2.
   - Valida la **extensión** y la **firma del archivo**: un PDF empieza con `%PDF-`; un docx o xlsx es un ZIP que empieza con `PK`. Así no pasa un archivo renombrado.
   - Si no cumple, responde 400 con un mensaje claro: "Para documentos de tipo {tipo} el archivo original debe ser Word (.docx) o Excel (.xlsx)" o "Formato no permitido".
2. **Cambio de tipo con un PDF ya cargado:** si en BORRADOR se edita el documento y se cambia el tipo a uno que no admite PDF teniendo un original `.pdf`, rechaza con 400: "Este tipo de documento requiere un original editable; reemplaza el PDF por un Word o Excel".
3. **Firma (`FirmarPublicarDocumentoHandler`):** si el original es PDF, **no lo conviertas**: usa sus bytes directamente como entrada de `DocumentoPdfGenerator.SellarPublicado`. El resto del flujo no cambia: hash, `ARCHIVO_ORIGINAL_CONGELADO`, `ARCHIVO_DISTRIBUCION_GENERADO` y obsolescencia de la versión previa. Encapsula la decisión en un solo punto, por ejemplo `ObtenerPdfBaseAsync(original, nombre)`, que devuelva los bytes tal cual si es PDF o llame al converter si no, y úsalo también en el visor.
4. **Visor (`VisualizarDocumentoHandler`):** en BORRADOR, EN_REVISION y EN_APROBACION, si el original es PDF, la vista previa es ese PDF con la marca "VISTA PREVIA — NO CONTROLADO" (`SellarVistaPrevia`), sin LibreOffice. Mantén la caché por clave de original.
5. **PDF protegido o dañado:** si PdfSharpCore no puede abrir el PDF para sellarlo (cifrado con contraseña, corrupto), responde con un error de negocio claro, sin un 500: "El PDF está protegido o dañado; súbelo sin contraseña". Escribe el detalle en el log (`fix-log-conversion-pdf`). Si puedes detectarlo, valida esto **al subir** el archivo y no recién al firmar.
6. **Nueva versión:** el original PDF se copia al nuevo BORRADOR igual que un docx (RN-DOC-015). Confirma que no haya ningún supuesto de "docx/xlsx" en `NuevaVersionDocumentoHandler`.
7. **Descarga del original** (RN-DOC-013 y CA-34): sin cambios en las reglas. Confirma que el Content-Type resulte `application/pdf` (`FileExtensionContentTypeProvider`).

### Frontend
1. **`FileUploadField`**, variante `original`: recibe el `tipo` del documento (o una prop `allowPdf`) y amplía `accept` y la validación de MIME a `.pdf` / `application/pdf` solo para INF, MAT y PLAN.
2. **`DocumentForm`:**
   - El texto de ayuda del original cambia según el tipo:
     - Para INF, MAT y PLAN: "Word, Excel o PDF. Si tienes el archivo editable, súbelo: el PDF no se puede editar en nuevas versiones."
     - Para los demás: "Word o Excel".
   - Si el usuario cambia el tipo y ya hay un PDF seleccionado o cargado que el nuevo tipo no admite, muestra el error en el campo y bloquea el guardado.
   - La zona "PDF de distribución" se queda igual (solo informativa).
3. **`DocumentReplaceArchivoOriginalModal`:** la misma regla por tipo.
4. Valida con Zod en `documentForm.schema.ts`, sin `useEffect` para derivar estado (regla 1 de CLAUDE.md).
5. Agrega i18n (es-PE / en-US) para los textos nuevos y los mensajes de error.
6. **MSW:** replica la validación por tipo y que un original PDF se publique sin conversión.

---

## Tests
- **Backend:**
  - crear un PLAN con un original PDF → 201;
  - crear un PRC con un PDF → 400;
  - un `.pdf` que en realidad es otra cosa (sin `%PDF-`) → 400;
  - un docx renombrado a `.pdf` en un PLAN → 400;
  - cambiar el tipo de PLAN a PRC con un original PDF → 400;
  - firmar un PLAN con un original PDF → PUBLICADO, el PDF de distribución tiene el sello, el hash está registrado y **el converter no se llama** (verifícalo con el converter fake);
  - firmar un PRC con docx → sigue usando el converter;
  - el visor de un PLAN en EN_REVISION con un PDF → 200 con la marca, sin converter;
  - un PDF cifrado → error de negocio, no 500;
  - nueva versión de un PLAN con PDF → el nuevo BORRADOR tiene el PDF copiado.
- **Frontend:**
  - el campo acepta PDF para INF, MAT y PLAN, y lo rechaza para los demás;
  - el texto de ayuda cambia con el tipo;
  - cambiar el tipo con un PDF ya cargado muestra el error y bloquea el guardado;
  - el modal de reemplazo sigue la misma regla.

## Reglas de siempre
- El código real manda sobre este doc; cualquier divergencia va en `design.md`.
- Un cambio de contrato se refleja en backend, MSW, tipos TS y tests a la vez.
- Corre la suite completa del frontend, los tests del backend y `tsc`.
- **Detén el backend y ejecuta `dotnet build` antes de la prueba manual.**
- Prueba manual con MSW apagado:
  1. Crea un PLAN con el PDF de Toño.
  2. Revísalo en el visor (debe verse la marca de vista previa).
  3. Envíalo a revisión, apruébalo y fírmalo: queda publicado con el sello.
  4. Descarga la copia no controlada.
  5. Intenta subir un PDF a un procedimiento (PRC): debe rechazarse.
  6. Intenta cambiar de tipo el PLAN con el PDF cargado: debe rechazarse.
- Al terminar, Toño avisa con "listo". Cowork verifica releyendo el código real y actualiza `SHAC-Mapa-Proceso-Control-Documentario.md`.
