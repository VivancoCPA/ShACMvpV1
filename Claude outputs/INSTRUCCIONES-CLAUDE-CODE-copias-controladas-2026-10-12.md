# Instrucciones para Claude Code — Copias controladas registradas (distribución ISO 7.5.3.2)

Fecha: 2026-10-12
Autor: Cowork
Origen: Toño preguntó cómo bajar el documento sin la marca "COPIA NO CONTROLADA". Hoy nadie puede hacerlo (decisión A de `proteccion-documental`).
Change sugerido: `copias-controladas`

Ciclo: `/opsx:sync` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

Dependencias: va después de `proteccion-documental` (storage privado y copia no controlada como única descarga) y de `fix-log-refresco-inmediato`.

---

## Decisiones de Toño (2026-10-12)

- **D1 — ✅ Opción B: "copia controlada" registrada.** Para distribuir un documento vigente en papel o en un punto fijo (por ejemplo un tablero de planta o la entrega a un auditor), se emite una **copia controlada numerada y asignada a un destinatario**. Cada emisión queda registrada y la copia se puede rastrear hasta que se recoge. Se descartan "dejarlo como está" (A) y "PDF limpio sin marca" (C).
- **D2 — Quién emite:** solo `JEFE_CONTROL_DOCUMENTARIO`. Toño no pidió agregar a Alta Dirección. Define la regla en **un solo lugar** (`PuedeEmitirCopiaControlada(rol)`) para que ampliarla después sea un cambio de una línea.
- **D3 — La impresión desde el visor también queda en el log** (JCD/DIR, RN-DOC-010).

La copia **no controlada** de `proteccion-documental` no cambia: sigue siendo la descarga normal para todos los lectores.

---

## Qué implementar

### 1. Modelo (backend, migración)
Tabla nueva `documento_copia_controlada`, multi-tenant:
- `Id`, `EmpresaId`, `DocumentoId`, `Version` (la versión del documento al emitir);
- `Numero`: correlativo **por documento y versión**, empezando en 1. Se muestra como `{codigo}-v{version}-C{nnn}`, por ejemplo `PRC-CD-013-v2-C003`. Asegura que sea único con un índice o un lock, porque puede haber dos emisiones al mismo tiempo;
- `Destinatario` (texto obligatorio: persona, área o ubicación) y `DestinatarioUsuarioId` (opcional, si se elige un usuario de la empresa);
- `Ubicacion` y `Observacion` (opcionales);
- `EmitidaPorId`, `FechaEmision` (UTC) y `HashPdf` (SHA-256 de la copia emitida);
- `Estado`: `VIGENTE` → `RECOGIDA` | `ANULADA`, con `FechaCierre`, `CerradaPorId` y `MotivoCierre`.

Nunca se borra; solo cambia de estado.

### 2. Endpoints
Todos validan el tenant (404 uniforme), la confidencialidad (404) y D2 (403). `empresaId` sale siempre de la sesión.

| Endpoint | Qué hace |
|---|---|
| `POST /api/documents/{id}/copias-controladas` (body: destinatario, destinatarioUsuarioId?, ubicacion?, observacion?) | Solo en **PUBLICADO o EN_REVISION_PERIODICA** (OBSOLETO no se distribuye, RN-DOC-003). Asigna el número, genera el PDF (punto 3), guarda el registro con el hash, escribe `COPIA_CONTROLADA_EMITIDA` en el audit trail con el número y el destinatario, y devuelve el PDF (`Content-Disposition` con nombre `{codigo}-v{version}-C{nnn}.pdf`). |
| `GET /api/documents/{id}/copias-controladas` | Lista las copias de todas las versiones del documento, con su estado. Para JCD, JCA, DIR y AUD; anota en `design.md` si la matriz sugiere otra cosa. |
| `GET /api/documents/{id}/copias-controladas/{copiaId}/pdf` | **Reimpresión** de una copia `VIGENTE`: regenera el PDF con el **mismo número**, la marca "REIMPRESIÓN dd/mm/aaaa hh:mm" y registra `COPIA_CONTROLADA_REIMPRESA`. Solo JCD. Solo si el documento sigue vigente. |
| `PATCH /api/documents/{id}/copias-controladas/{copiaId}/recoger` (body: motivo?) | `VIGENTE` → `RECOGIDA`. Registra `COPIA_CONTROLADA_RECOGIDA`. Solo JCD. |
| `PATCH .../{copiaId}/anular` (body: motivo obligatorio) | `VIGENTE` → `ANULADA`, para copias perdidas o emitidas por error. Registra `COPIA_CONTROLADA_ANULADA`. Solo JCD. |

### 3. PDF de la copia controlada
- Parte del PDF maestro de distribución, leído internamente desde el storage privado.
- **Sin** la leyenda "COPIA NO CONTROLADA". En su lugar, una franja en cada página (cabecera o pie, legible, sin tapar contenido): **"COPIA CONTROLADA N° {número} — Asignada a: {destinatario} — Emitida el {dd/mm/aaaa hh:mm, hora de Lima} por {nombre}"**, y una segunda línea: "Verifique la vigencia en SHAC antes de usar. Hash: {primeros 12 caracteres}".
- Reutiliza el sellado de `ExportarPdfControladoHandler` / `DocumentoPdfGenerator` con PdfSharpCore; no dupliques la lógica.
- Permisos del PDF: **impresión permitida** (es para distribución física) y **copia de texto deshabilitada** (RN-DOC-010). Es una medida disuasoria; déjalo escrito.
- En `design.md`, anota que esta leyenda coincide con DOC-AC-005 del PRD ("COPIA CONTROLADA") y que la copia de descarga normal sigue con "COPIA NO CONTROLADA" por la decisión D2 de `proteccion-documental`.

### 4. Recogida al cambiar de versión u obsoletar
Cuando un documento pasa a **OBSOLETO**, ya sea porque se publicó una versión nueva o porque se obsoleta directamente:
- **No** cambies el estado de las copias automáticamente: siguen `VIGENTE` hasta que alguien confirme la recogida física.
- Envía una notificación a todos los JCD activos de la empresa: "El documento {código} v{versión} quedó obsoleto. Hay {n} copias controladas por recoger." Envíala solo si hay copias `VIGENTE`, con idempotencia por documento y versión.
- Escribe en el audit trail de esa versión una entrada `COPIAS_CONTROLADAS_POR_RECOGER` con el actor Sistema (la convención de `revision-periodica-trazabilidad`) y la lista de números.

### 5. Impresión desde el visor (D3)
- Primero **verifica** qué PDF sirve `GET /visor` en PUBLICADO: si es el maestro **sin marca**, hoy un JCD/DIR que imprime desde el visor obtiene una copia limpia sin registro. Documenta lo que encuentres.
- Agrega `POST /api/documents/{id}/impresion` (o equivalente) que registre `IMPRESION` en el audit trail. Solo JCD/DIR; para otros roles, 403. El visor lo llama **antes** de abrir el diálogo de impresión y, si falla, no imprime.
- Recomendación de Cowork: lo que se imprime desde el visor debe llevar la leyenda "COPIA NO CONTROLADA — Impresa por {nombre} el {fecha}", igual que la descarga normal. Para papel controlado está la copia controlada. Si implementarlo complica el visor, anótalo en `design.md` y lo decide Toño.

### 6. Frontend
- **Detalle (PUBLICADO / EN_REVISION_PERIODICA), solo JCD:** botón **"Emitir copia controlada"** que abre un modal (RHF + Zod) con destinatario (texto, con un selector opcional de usuario de la empresa), ubicación y observación. Al confirmar, descarga el PDF, muestra un toast con el número e invalida el detalle y la lista de copias.
- **Sección "Copias controladas"** en el detalle, para los roles con lectura del listado: una tabla con número, versión, destinatario, ubicación, emitida por, fecha y estado. Para JCD, las acciones Reimprimir, Recoger y Anular (con un modal de motivo).
- **Aviso en OBSOLETO** cuando hay copias `VIGENTE`: "Hay {n} copias controladas de esta versión por recoger", con enlace a la sección.
- i18n (es-PE / en-US) para las acciones nuevas del audit trail: `COPIA_CONTROLADA_EMITIDA`, `_REIMPRESA`, `_RECOGIDA`, `_ANULADA`, `COPIAS_CONTROLADAS_POR_RECOGER` e `IMPRESION`. Agrégalas a `ACCIONES_RELEVANTES` de `DocumentHistorial` según corresponda.
- Tipos TS y **MSW** con los mismos contratos y reglas.

---

## Tests
- **Backend:**
  - JCD emite en PUBLICADO → 200, PDF con "COPIA CONTROLADA N° …", registro `VIGENTE` con hash y entrada en el log;
  - JCA, DIR u OPERARIO emiten → 403;
  - emitir en OBSOLETO o BORRADOR → error de negocio;
  - documento de otra empresa → 404; CONFIDENCIAL sin acceso → 404;
  - dos emisiones concurrentes → números distintos y consecutivos;
  - la reimpresión conserva el número y registra su acción;
  - recoger y anular cambian el estado (anular sin motivo → 400);
  - publicar la versión nueva con copias `VIGENTE` de la anterior → una notificación a los JCD y la entrada `COPIAS_CONTROLADAS_POR_RECOGER`, ambas una sola vez;
  - `POST /impresion` como JCD → 200 con `IMPRESION` en el log; como OPERARIO → 403.
- **Frontend:**
  - el botón "Emitir copia controlada" aparece solo para JCD en estados vigentes;
  - validación del modal;
  - la tabla y sus acciones por rol;
  - el aviso de copias por recoger en OBSOLETO;
  - el visor llama al registro de impresión antes de imprimir.

## Reglas de siempre
- El código real manda sobre este doc; cualquier divergencia va en `design.md`.
- Un contrato nuevo se refleja en backend, MSW, tipos TS y tests a la vez.
- Corre la suite completa del frontend, los tests del backend y `tsc`.
- **Detén el backend, ejecuta `dotnet ef database update` y luego `dotnet build`** antes de la prueba manual.
- Prueba manual con MSW apagado:
  1. Como JCD, emite dos copias de un documento publicado para "Almacén" y "Auditor externo". Revisa los números C001 y C002, la leyenda, que se pueda imprimir y que no se pueda copiar texto, y que el log se actualice sin recargar.
  2. Como operario, no ves el botón y tu descarga sigue siendo "COPIA NO CONTROLADA".
  3. Publica una versión nueva: llega la notificación de copias por recoger y la versión anterior muestra el aviso.
  4. Recoge C001 y anula C002 con motivo: el aviso desaparece.
  5. Imprime desde el visor como JCD: queda `IMPRESION` en el log.
- Al terminar, Toño avisa con "listo". Cowork verifica releyendo el código real y actualiza `SHAC-Mapa-Proceso-Control-Documentario.md`.
