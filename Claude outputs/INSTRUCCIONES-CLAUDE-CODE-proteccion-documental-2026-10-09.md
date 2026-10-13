# Instrucciones para Claude Code — Protección documental: almacenamiento privado y descarga solo como copia controlada

Fecha: 2026-10-09
Autor: Cowork (investigación sobre el código real)
Origen: Toño. Un operario puede bajar el documento vigente y la acción no queda registrada en el log.
Change sugerido: `proteccion-documental`

Ciclo: `/opsx:sync` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

Dependencias: va después de `visor-documentos` y `autor-lectura-publicado`, porque usa el visor y la matriz ya corregida.

---

## Diagnóstico (confirmado leyendo el código)

| Vía | Qué entrega | Quién | ¿Log? |
|---|---|---|---|
| `GET /api/documents/{id}/archivo-distribucion` (botón del detalle, `useGetArchivoDistribucionUrl`) | **PDF maestro publicado**, sin marca de agua | Cualquiera con `CanViewArchivoDistribucion` (incluye OPERARIO en PUBLICADO) | ❌ **No** |
| `POST/GET .../exportar-pdf` (`ExportarPdfControladoHandler`) | Copia con marca de agua (usuario, hora de Lima, hash) | Solo valida tenant y estado PUBLICADO: **no valida confidencialidad ni `CanRead`** | ✅ `DESCARGA` |
| Botón "Exportar PDF controlado" (`DocumentActionPanel`) | — | **Nunca se muestra**: `canExportarPdf` exige `documento.archivoUrl`, que el backend real no envía | — |
| Botón "Ver archivo" (`canVerArchivo`) | — | Mismo problema (`archivoUrl`): nunca se muestra | — |
| `GET /:id/archivo` (`ObtenerArchivoHandler`) + `GET /download-url` + `GET /stream/{token}` + `POST /audit/access` | URL firmada de 15 min (RN-DOC-009) | El frontend no lo usa. `ObtenerArchivo` registra **VISUALIZACION** aunque es una descarga | Parcial |
| **URL estática `/uploads/documentos/...`** (`DocumentoStorageService` guarda en `wwwroot` + `app.UseStaticFiles()`) | **Cualquier archivo**: original y distribución | **Cualquiera, sin iniciar sesión** | ❌ No |
| Igual para planos de Locales (`PlanoStorageService` en `wwwroot`) | Planos | Cualquiera, sin sesión | ❌ No |

Lo que pide el PRD:
- Matriz M1: "PUBLICADO — Descargar PDF (URL firmada)" ✓ para todos los roles.
- RN-DOC-007: marca de agua con usuario y fecha.
- RN-DOC-008: cada descarga y visualización queda en el audit trail.
- RN-DOC-009: el frontend nunca expone la URL directa; la URL tiene TTL de 15 min.
- RN-DOC-010: impresión solo para JCD y DIR; copia de texto deshabilitada para todos.
- RN-DOC-003: un documento OBSOLETO no se distribuye.

## Decisiones de Toño (2026-10-09)

- **D1 — ✅ Opción A: la única descarga de un documento vigente es la copia controlada.** Cualquier lector con acceso (incluido OPERARIO) puede descargar, pero **siempre** recibe la copia con marca de agua, su nombre y la fecha y hora, y la descarga queda en el log. El **PDF maestro deja de ser descargable**; solo se usa internamente (visor y generación de copias).
- **D2 — ✅ Leyenda de la marca de agua: "COPIA NO CONTROLADA"**, la práctica recomendada para ISO. Se mantiene el texto actual del código: "COPIA NO CONTROLADA — Solo válido al momento de impresión". Anota en `design.md` que **diverge a propósito** del texto de DOC-AC-005 del PRD ("COPIA CONTROLADA"), por decisión de Toño.
- **D3 — ✅ En este mismo change, sacar todos los archivos de `wwwroot`** (almacenamiento privado), incluidos los planos de Locales.

---

## Qué implementar

### 1. Almacenamiento privado (D3)
1. **Raíz configurable fuera de `wwwroot`.** `appsettings.Development.json` ya tiene `FileStorage:DocumentosRootPath: "/data/documentos"`, aparentemente sin uso: verifica si algo la lee. Usa una sección `FileStorage` con una raíz por dominio, o una raíz única con subcarpetas, y documenta el valor para Windows de desarrollo, por ejemplo una carpeta `storage` junto al proyecto, fuera de `wwwroot` y fuera del control de versiones (`.gitignore`). **No** asumas el hosting de producción: Toño decidió dejarlo para el final, así que solo debe ser configuración.
2. **Guarda claves relativas, no URLs públicas.** Hoy `ArchivoOriginalUrl`, `ArchivoDistribucionUrl` y `PlanoPngUrl` guardan `/uploads/...`. Pasa a guardar una clave relativa a la raíz, como `documentos/{empresaId}/{documentoId}/original/{archivo}`. Puedes mantener los nombres de columna o renombrarlos con una migración; documenta la elección.
3. **Migración de archivos existentes:** un comando o rutina idempotente de arranque en Development que mueva los archivos de `wwwroot/uploads/...` a la raíz privada y actualice las claves en la base. Informa en `design.md` cuántos archivos movió. **No** borres nada que no se haya copiado y verificado.
4. **Cierra el acceso estático:** que ningún archivo de usuario quede bajo `wwwroot`. Si `UseStaticFiles()` no sirve nada más, quítalo; si sirve otros assets, confirma que `/uploads` ya no existe o bloquea la ruta. Agrega un test que confirme que `GET /uploads/...` devuelve 404.
5. **Busca todos los storages que escriben en `wwwroot`**: `DocumentoStorageService`, `PlanoStorageService` y cualquier otro, como evidencias de Incidentes o adjuntos de QE/NC. Lístalos en `design.md` y migra todos.
6. **Planos de Locales:** el frontend hoy probablemente los muestra con `<img src="/uploads/...">`. Crea un endpoint autenticado (por ejemplo `GET /api/locales/{id}/plano`) que valide el tenant, y en el frontend cárgalo como blob con `api`, igual que el visor. Revisa también Zonas.

### 2. Descarga solo como copia controlada (D1)
1. **`GET /archivo-distribucion` deja de servir el maestro.** Elimínalo, o haz que responda lo mismo que la copia controlada; documenta la elección. El visor (`VisualizarDocumentoHandler`) y la generación de copias leen el maestro **internamente** desde el storage, nunca por un endpoint de descarga.
2. **`ExportarPdfControladoHandler` pasa a ser la única descarga** de un documento vigente:
   - Agrega las validaciones que faltan: confidencialidad (404 uniforme) y `CanRead` según la matriz (403).
   - Estados permitidos: **PUBLICADO y EN_REVISION_PERIODICA**, porque el documento sigue vigente mientras se revisa. **OBSOLETO no se descarga** (RN-DOC-003); solo puede verse en el visor con el sello.
   - Mantén la marca de agua (D2), el hash y el registro `DESCARGA` con el hash.
   - **Restricciones del PDF (RN-DOC-010):** aplica permisos con PdfSharpCore (`SecuritySettings`): **sin copia de texto para nadie** y **sin impresión salvo para JCD y ALTA_DIRECCION**. Documenta que es una medida disuasoria, porque un lector de PDF puede ignorarla.
3. **Circuito de URLs firmadas** (`ObtenerArchivo`, `ObtenerDownloadUrl`, `StreamArchivo`, `RegistrarAccesoAudit`, `DocumentoSignedUrlService`):
   - Verifica qué consume el frontend.
   - Recomendación de Cowork: si nada lo usa, **elimínalo** y deja escrito en `design.md` cómo se cumple RN-DOC-009 sin él. Toda descarga va por una petición autenticada con JWT, el frontend nunca recibe ni expone una URL directa a un archivo y el storage ya no es accesible por URL.
   - Si decides conservar algo, corrige que `ObtenerArchivo` registre `VISUALIZACION` cuando en realidad es una descarga.
   - Lista lo que elimines y lo que conserves.
4. **El archivo original** (`GET /archivo-original`) mantiene sus reglas: RN-DOC-013, CA-34 y el registro `DESCARGA_ARCHIVO_ORIGINAL`. Solo cambia de dónde lee el archivo.

### 3. Frontend
1. **Detalle de un documento vigente:**
   - una acción principal **"Ver documento"** (visor);
   - una acción secundaria **"Descargar copia (PDF)"** que llama a la copia controlada;
   - elimina el botón actual de descarga del PDF de distribución (`useGetArchivoDistribucionUrl`).
2. Corrige `canExportarPdf`: que dependa del estado (PUBLICADO o EN_REVISION_PERIODICA) y de `canRead` / confidencialidad, no de `archivoUrl`. Elimina `canVerArchivo` y los campos `archivoUrl`, `tipoArchivo` y similares del tipo `Documento` si el backend no los envía (ver el barrido de `fix-detalle-documento-historial-audit`).
3. Muestra un texto de ayuda junto a la descarga: "La copia descargada lleva tu nombre y la fecha; es una COPIA NO CONTROLADA".
4. En OBSOLETO no hay botón de descarga, solo "Ver documento".
5. MSW: refleja los endpoints eliminados o cambiados y las reglas nuevas.

---

## Tests
- **Backend:**
  - `GET /uploads/...` → 404;
  - OPERARIO descarga la copia de un PUBLICADO → 200, PDF con marca de agua y entrada `DESCARGA` con hash;
  - OPERARIO intenta descargar un documento CONFIDENCIAL → 404;
  - descargar un OBSOLETO → error de negocio;
  - EN_REVISION_PERIODICA → 200;
  - el maestro ya no se puede obtener por ningún endpoint de descarga;
  - el visor sigue funcionando leyendo el maestro internamente;
  - el plano de un Local de otra empresa → 404;
  - la migración de archivos es idempotente: correrla dos veces no duplica ni rompe nada.
- **Frontend:**
  - los botones del detalle por estado (vigente: Ver + Descargar copia; obsoleto: solo Ver);
  - el plano de Locales se carga por blob autenticado.

## Reglas de siempre
- El código real manda sobre este doc; cualquier divergencia va en `design.md`.
- Un cambio de contrato se refleja a la vez en backend, MSW, tipos TS y tests.
- Corre la suite completa del frontend, los tests del backend y `tsc`.
- **Detén el backend; si hay migración, ejecuta `dotnet ef database update`, y luego `dotnet build` antes de la prueba manual.**
- Prueba manual con MSW apagado:
  1. Copia en el navegador una URL antigua `/uploads/documentos/...` sin iniciar sesión → debe fallar.
  2. Como operario, descarga un documento publicado → la copia tiene tu nombre, la fecha y "COPIA NO CONTROLADA", no permite copiar texto ni imprimir, y la descarga aparece en el log.
  3. Como JCD, la misma copia sí permite imprimir.
  4. En un documento obsoleto no aparece la descarga.
  5. Los planos de Locales se siguen viendo.
  6. Los documentos y planos anteriores al cambio siguen abriendo después de la migración.
- Al terminar, Toño avisa con "listo". Cowork verifica releyendo el código real y actualiza el mapa de proceso.
