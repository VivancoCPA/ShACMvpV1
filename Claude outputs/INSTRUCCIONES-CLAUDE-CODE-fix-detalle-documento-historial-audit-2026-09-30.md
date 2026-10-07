# Instrucciones para Claude Code — Fix: el detalle de documento crashea (historialVersiones) y el audit trail llega vacío

Fecha: 2026-09-30
Autor: Cowork (verificado releyendo el código real a partir del hallazgo reportado por Claude Code)
Change sugerido: `fix-detalle-documento-historial-audit`. Es un change **aparte**: no lo mezcles con `fix-fechas-utc` ni con `documentos-revisor-aprobador-reales`.

Ciclo: `/opsx:sync` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

---

## Hallazgo 1 (el que reportó Claude Code): confirmado

- `features/documents/components/DocumentHistorial.tsx:23` ejecuta `documento.historialVersiones.map(...)`.
- En `types/documents.types.ts`, `Documento.historialVersiones: VersionEntry[]` es un campo obligatorio.
- La entidad real `Documento.cs` **no tiene** ese campo. El backend modela las versiones como documentos separados que comparten `codigo` y se enlazan con `VersionAnteriorId`. El campo nunca viaja en `GET /api/documents/:id`, así que `.map()` sobre `undefined` tumba la página de detalle de **cualquier** documento.
- El handler MSW sí lo envía (`historialVersiones: []`). Por eso nunca falló con mocks.

## Hallazgo 2 (encontrado por Cowork al verificar el 1): el audit trail real siempre llega vacío

- `Documento.cs` tiene `List<DocumentoAuditTrail> AuditTrail { get; set; } = []`. Pero `ObtenerDocumentoHandler` carga el documento con Dapper (`SELECT {DocumentoSqlHelpers.SelectColumns} FROM documentos`) y **nunca** consulta `documento_audit_trail`. Solo completa `QeVinculados` y `NcVinculados`, así que `auditTrail` siempre se serializa como `[]`.
- Cuando se corrija el hallazgo 1, esto dejará de crashear, pero **fallará en silencio** en varios lugares:
  - `DocumentAuditTrail.tsx`: el panel "Audit trail" del detalle mostrará "sin entradas" aunque la tabla tenga filas (creación, cambios de estado, firma, descargas, visualizaciones…).
  - `DocumentHistorial.tsx`: la entrada "Creado en borrador" depende de `auditTrail`, así que nunca aparece.
  - `DocumentVersionesTab.tsx` (`getPublisher`): el nombre de quien publicó sale del `auditTrail`, así que nunca aparece.
- Esto importa más allá de lo visual. El audit trail es la evidencia de trazabilidad que exige ISO 9001 §7.5 (RN-DOC-008: descargas y visualizaciones append-only). Hoy se **graba** bien, pero **no se puede ver**.

## Decisión de Toño

**D1 — ✅ DECIDIDO (2026-09-30): corregir en el frontend y poblar el audit trail real.** Se elimina `historialVersiones` del contrato; el backend no lo va a construir. Descartada: que el backend recorra la cadena `VersionAnteriorId` y devuelva el array embebido, porque duplicaría lo que ya resuelve la pestaña Versiones. Documenta las dos opciones y la elegida en `design.md`.

---

## Qué implementar

### Backend
1. En `ObtenerDocumentoHandler`, después de las comprobaciones de tenant y confidencialidad (que devuelven 404, como hoy), carga las filas de `documento_audit_trail` de ese `documento_id` con Dapper, ordenadas por `timestamp`, y asígnalas a `documento.AuditTrail`.
   - Confirma los nombres reales de tabla y columnas en `ShacDbContextModelSnapshot` o en la migración `AddDocumentos`. Si difieren de este documento, manda el código y lo anotas.
   - Proyecta todas las columnas que declara `AuditTrailEntry` en TS y que existen en la tabla. `entidadTipo`, `entidadId` e `ipOrigen` **no existen** en la entidad del backend: anota esa divergencia de tipos en `design.md` y, en el tipo TS, déjalos opcionales o elimínalos. No los inventes en el backend.
2. **No** agregues el audit trail a `ListarDocumentosHandler`: se queda en `[]`, para evitar N+1 en listados paginados. Es el mismo criterio que `QeVinculados` y `NcVinculados`.
3. **Alcance de visibilidad.** Hoy el audit trail completo se entrega a cualquiera que pueda leer el detalle; así se comportaba también el mock. Mantén ese comportamiento en este change y déjalo escrito en `design.md` como pregunta abierta para Toño: ¿un OPERARIO que lee un PUBLICADO debería ver quién lo descargó? No lo resuelvas por tu cuenta.
4. Tests de integración:
   - `GET /:id` devuelve `auditTrail` no vacío después de crear el documento (al menos `DOCUMENTO_CREADO`) y después de un cambio de estado (`ESTADO_CAMBIADO`).
   - El listado sigue devolviendo `auditTrail: []`.

### Frontend
1. Elimina `historialVersiones` (y `VersionEntry`, si queda sin uso) de `types/documents.types.ts`, del handler MSW `documents.handlers.ts` y de las fixtures y tests que lo usen.
2. `DocumentHistorial.tsx` corresponde a la sección "Historial de estados" (ver el comentario en `DocumentDetailPage.tsx`, alrededor de la línea 237). Reconstrúyela a partir de `documento.auditTrail`:
   - la creación (`DOCUMENTO_CREADO`);
   - las transiciones (`ESTADO_CAMBIADO`, con `estadoAnterior` → `estadoNuevo`);
   - la firma y publicación (`FIRMA_REGISTRADA`);
   - si aporta, `NUEVA_VERSION_INICIADA` y `RESTAURADO`.

   Las descargas y visualizaciones **no** van aquí: ya aparecen en el panel de audit trail. El historial de **versiones** ya lo cubre `DocumentVersionesTab` con `useDocumentVersiones(codigo)`, y `GET /api/documents?codigo=` existe en el backend (`ListarDocumentosQuery.Codigo`). No lo dupliques.
3. **Defensivo:** ningún componente del detalle debe reventar si un array del contrato llega vacío o ausente. Revisa `auditTrail`, `qeVinculados` y `ncVinculados` en los componentes del detalle, y usa `?? []` donde corresponda.
4. **Formato de fechas:** los `timestamp` del audit trail **son** instantes reales, así que se convierten a hora local. No uses aquí el helper de "fecha sin zona" que introdujo `fix-fechas-utc`.
5. Tests:
   - `DocumentHistorial` con un audit trail real (creación y transiciones) y con uno vacío (no crashea y muestra un estado vacío).
   - `DocumentDetailPage` renderiza sin `historialVersiones` en la respuesta.

### Barrido obligatorio
Este es el mismo patrón de bug que ya apareció otras veces en esta serie: un campo que el tipo TS declara obligatorio, que el MSW envía y que el backend real nunca manda. Antes de cerrar:
- Compara **campo por campo** el tipo TS `Documento` con lo que devuelve realmente `GET /api/documents/:id`: las columnas de `DocumentoSqlHelpers.SelectColumns` más las propiedades que se completan a mano.
- Lista en `design.md` cada campo TS que el backend no envía. Por ejemplo, a simple vista: `fechaObsolescencia`, `archivoUrl`, `tipoArchivo`, `hashArchivo` y `deletedAt`, este último según el `SELECT`. Para cada uno, indica si algún componente lo usa y qué pasa en ese caso.
- Corrige en este change solo los que rompan o se muestren mal en el detalle. El resto queda como hallazgo para Toño.

---

## Reglas de siempre
- El código real manda sobre este documento; cualquier divergencia va en `design.md`.
- Un cambio de contrato se aplica a la vez en el backend, el handler MSW, los tipos TS y los tests.
- Corre la suite completa del frontend, los tests del backend y `tsc`.
- **Detén el backend y ejecuta `dotnet build` antes de la prueba manual.** El DLL puede quedar desactualizado, como ya pasó.
- Prueba manual con MSW apagado: abre el detalle de un documento real en BORRADOR, pásalo por EN_REVISION → EN_APROBACION → firma → PUBLICADO y comprueba que el Historial de estados, el panel de Audit trail y la pestaña Versiones (con quién publicó) muestren datos reales.
- Después, retoma las filas pendientes de la tabla de `design.md` de `fix-fechas-utc` (NC, ACs, `reporteExternoRef`) y la tarea 6.3 de `documentos-revisor-aprobador-reales`, que estaban bloqueadas por este crash.
- Al terminar, Toño avisa con "listo". Cowork verifica releyendo el código real y escribe `SHAC-Verificacion-Fix-Detalle-Documento-<fecha>.md`.
