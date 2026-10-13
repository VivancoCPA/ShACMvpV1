# Instrucciones para Claude Code — Visor de documentos dentro de la app

Fecha: 2026-10-07
Autor: Cowork
Origen: Toño. El usuario normalmente no necesita descargar el documento para revisarlo; necesita verlo dentro de la app.
Change sugerido: `visor-documentos`

Ciclo: `/opsx:sync` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

Dependencias: usa el conversor de `pdf-distribucion-real` (`IDocumentoPdfConverter` / LibreOffice) y los helpers de nombres de `fix-descarga-archivos-nombre`. Si `revision-periodica-permiso-por-rol` todavía no está archivado, implementa este change después.

---

## Decisiones de Toño (2026-10-07)

- **D1 — ✅ Opción 1: vista previa en PDF generada en el servidor con LibreOffice**, mostrada en un visor PDF integrado. Se descartaron el render en el navegador (docx-preview/xlsx), un servidor de documentos (OnlyOffice/Collabora) y los visores comerciales.
- **D2 — ✅ El aprobador puede ver la vista previa en EN_APROBACION.** Hoy firma sin poder ver el documento, porque RN-DOC-013 bloquea el original en ese estado. La vista previa es un PDF de **solo lectura** y **no** habilita la descarga del original: RN-DOC-013 sigue vigente para el archivo original.
- **D3 — ✅ El visor bloquea la descarga para todos.** La impresión solo está permitida a `JEFE_CONTROL_DOCUMENTARIO` y `ALTA_DIRECCION` (RN-DOC-010). La copia de texto queda deshabilitada para todos (RN-DOC-010).
- **D4 — ✅ Solo visualización.** Sin comentarios ni anotaciones en el visor; las observaciones siguen yendo por el motivo de rechazo.

---

## Qué mostrar según el estado

| Estado | Qué ve el visor | Quién puede verlo |
|---|---|---|
| BORRADOR, EN_REVISION | **Vista previa** generada desde el archivo original, con marca de agua "VISTA PREVIA — NO CONTROLADO — {ESTADO}" | docRole ≠ OPERARIO con `canRead` en ese estado (autor, revisor, aprobador, jefe de calidad), igual que hoy para el original |
| EN_APROBACION | **Vista previa**, con la misma marca de agua (D2) | Igual que la fila anterior. Verifica que el aprobador tenga `canRead`: según la matriz actual, sí |
| PUBLICADO, EN_REVISION_PERIODICA | **PDF de distribución** ya guardado; no se genera nada | Cualquiera con `canRead` y acceso por confidencialidad |
| OBSOLETO | PDF de distribución con la marca "OBSOLETO — No usar" (RN-DOC-003), aplicada al servir | Según la matriz de OBSOLETO, incluida la excepción CA-34 |

Usa la matriz real (`DocumentPermissionResolver` / `permissions.ts`) y la confidencialidad (`CanAccessByConfidencialidad`); no inventes reglas nuevas. Si alguna fila no encaja con la matriz, anótalo en `design.md` y pregunta.

---

## Qué implementar

### Backend
1. **Endpoint de visualización**, por ejemplo `GET /api/documents/{id}/visor`. Devuelve **bytes PDF** (`application/pdf`, `Content-Disposition: inline`) según la tabla de arriba. Aplica primero el tenant y la confidencialidad (404 uniforme) y después el permiso por estado y docRole (403).
2. **Vista previa con caché:**
   - Genera la vista previa con `IDocumentoPdfConverter` a partir del original vigente y estámpale la marca de agua con PdfSharpCore. Reutiliza la lógica de sellado de `DocumentoPdfGenerator`.
   - Guárdala en caché **fuera de `wwwroot`**, con una clave que identifique la versión exacta del original (por ejemplo `documentoId` + nombre archivado o hash del original). Si el original se reemplaza (`ReemplazarArchivoOriginalHandler`), la vista previa vieja deja de usarse; borra el archivo viejo o deja que caiga en desuso, y documenta cuál de las dos elegiste.
   - Si la conversión falla, responde con el mismo error de negocio claro que en la firma, sin un 500 genérico, y regístralo en el log (`fix-log-conversion-pdf`).
   - Si el documento no tiene original, responde un 404 con un mensaje claro: "Este documento aún no tiene archivo para visualizar".
3. **Marca OBSOLETO:** aplícala al vuelo sobre el PDF de distribución o guarda una copia en caché. No modifiques el archivo publicado original, porque su hash es la evidencia de la firma.
4. **Audit trail (RN-DOC-008):** cada apertura del visor registra `VISUALIZACION`. Ya existe `RegistrarAccesoAudit` (`POST /:id/audit/access`): decide si el endpoint del visor registra la apertura directamente o si el frontend sigue llamando a ese endpoint, pero que quede **una sola** entrada por apertura, y anótalo.
5. **Concurrencia:** la vista previa puede pedirse a la vez desde varias sesiones. Evita convertir dos veces el mismo original al mismo tiempo, por ejemplo con un lock por clave de caché.

### Frontend
1. **Componente de visor reutilizable** basado en **pdf.js**. Se sugiere `react-pdf`: agrega la dependencia y configura el worker según su documentación para Vite.
   - Navegación por páginas, zoom y ajuste al ancho; debe funcionar bien en móvil.
   - **Sin botón de descarga** para nadie (D3).
   - **Botón de imprimir solo para JCD y ALTA_DIRECCION** (D3, RN-DOC-010).
   - **Sin capa de texto seleccionable** (`renderTextLayer={false}`), así no se puede copiar texto (RN-DOC-010). Desactiva también el menú contextual sobre el visor.
   - Carga el PDF con la instancia `api` (axios con JWT) como blob; **nunca** apuntes el visor a una URL estática.
2. **En el detalle del documento:** agrega un botón o pestaña **"Ver documento"** visible cuando corresponda según la tabla. Muéstralo como acción principal y deja "Descargar archivo original" como secundaria.
   - Mientras se genera la vista previa la primera vez, muestra "Generando vista previa…" con spinner.
   - Si hay error o falta el original, muestra el mensaje correspondiente.
3. Revisa el modal de vista previa del PDF controlado que ya existe en `DocumentActionPanel` (`pdf.previewTitle`). Si sirve, unifícalo con el visor nuevo; si no, documenta por qué conviven.
4. **MSW:** handler del endpoint del visor que devuelva un PDF de ejemplo y respete los mismos permisos por estado y rol.

### Aclaración importante para `design.md`
Bloquear la descarga, la impresión y la copia en el visor es una **medida disuasoria**, no una protección absoluta: alguien con conocimientos técnicos puede extraer el PDF desde el navegador. Deja escrito que es así y que la protección real es el control de acceso del endpoint más el audit trail.

---

## Hallazgo de seguridad relacionado (no lo resuelvas aquí; abre un change aparte)

`DocumentoStorageService` guarda los originales y los PDF de distribución en `wwwroot/uploads/documentos/...`, y `Program.cs` tiene `app.UseStaticFiles()`. Por eso **esos archivos se pueden descargar sin autenticación** por URL directa (`/uploads/documentos/{empresaId}/{documentoId}/original/...`), sin pasar por los permisos, la confidencialidad ni el audit trail. El comentario del propio servicio dice que es "aceptable solo para desarrollo". En este change:
- **no** guardes la caché de vistas previas en `wwwroot`;
- **no** uses esas URLs estáticas en el visor;
- registra el hallazgo en `design.md`.

Cowork le recomendará a Toño un change aparte (`almacenamiento-documentos-privado`) para sacar los archivos de `wwwroot`. Aplica lo mismo a los planos de Locales (`PlanoStorageService`).

---

## Tests
- **Backend:**
  - BORRADOR con autor → 200 `application/pdf`;
  - BORRADOR con OPERARIO → 403;
  - EN_APROBACION con el aprobador → 200 (D2), y `GET /archivo-original` con el aprobador sigue en 403 (RN-DOC-013);
  - PUBLICADO con un lector según confidencialidad → 200 y devuelve el PDF de distribución;
  - CONFIDENCIAL con OPERARIO → 404;
  - OBSOLETO → PDF con la marca;
  - documento de otra empresa → 404;
  - sin original → 404 con un mensaje claro;
  - la segunda apertura usa la caché (no vuelve a convertir) y, después de reemplazar el original, se genera una vista previa nueva;
  - cada apertura registra `VISUALIZACION` una sola vez.

  Usa el converter fake para las pruebas de backend.
- **Frontend:**
  - el botón de imprimir aparece solo para JCD y DIR;
  - no hay botón de descarga;
  - no hay capa de texto;
  - estados de carga y de error;
  - el botón "Ver documento" se muestra según la tabla.

## Reglas de siempre
- El código real manda sobre este documento; cualquier divergencia va en `design.md`.
- Un contrato nuevo se refleja en el backend, en MSW, en los tipos TS y en los tests.
- Corre la suite completa del frontend, los tests del backend y `tsc`.
- **Detén el backend y ejecuta `dotnet build` antes de la prueba manual.** LibreOffice debe estar configurado en `PdfConversion:SofficePath`.
- Prueba manual con MSW apagado:
  1. Como revisor, abre un documento EN_REVISION con un `.docx` de varias páginas: la vista previa debe tener la marca de agua, sin descarga ni texto seleccionable.
  2. Como aprobador, ábrelo en EN_APROBACION: debe verse.
  3. Publica el documento y ábrelo como OPERARIO: debe mostrarse el PDF de distribución.
  4. Ábrelo como JCD y como OPERARIO para confirmar que la impresión solo aparece al JCD.
  5. Reemplaza el original en BORRADOR y confirma que la vista previa se actualiza.
  6. Repite con un `.xlsx`.
- Al terminar, Toño avisa con "listo". Cowork verifica releyendo el código real y actualiza el mapa de proceso.
