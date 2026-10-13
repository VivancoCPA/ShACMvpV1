# Instrucciones para Claude Code — El autor puede leer su documento PUBLICADO y OBSOLETO

Fecha: 2026-10-08
Autor: Cowork (investigación sobre el código real)
Origen: Toño. En el visor, el autor no puede ver su propio documento cuando está publicado.
Change sugerido: `autor-lectura-publicado`. Es un change pequeño y aparte. Si `visor-documentos` todavía no está archivado, puede ir como tarea adicional dentro de ese change.

Ciclo: `/opsx:sync` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

---

## Diagnóstico (confirmado leyendo el código)

La matriz de permisos por estado y docRole, que existe en el backend (`DocumentPermissionResolver.GetBasePermissions`) y en el frontend (`permissions.ts`, `getBasePermissions`), asigna esto al docRole **AUTOR**:

- `PUBLICADO` → `DenyAll` (sin `CanRead`)
- `OBSOLETO` → `DenyAll` (sin `CanRead`)

En los mismos estados, REVISOR y APROBADOR tienen `CanRead = true`, y en PUBLICADO también lo tiene **OPERARIO**. El resultado es que **cualquier usuario puede leer un documento publicado, excepto quien lo escribió**.

Viene de la matriz del PRD (§4.2: "PUBLICADO: Autor — Sin acceso"), que se replicó carácter por carácter. Como `ResolveDocRole` evalúa AUTOR primero, la regla le aplica al autor aunque sea JCA o JCD.

Efectos actuales: el autor no ve "Ver documento" (`canVerDocumento` en `DocumentActionPanel`, `VisualizarDocumentoHandler` → 403), y tampoco tiene `CanViewArchivoDistribucion`, que depende de `CanRead`.

## Decisión de Toño

**D1 — ✅ DECIDIDO (2026-10-08): el autor tiene acceso de lectura a su documento en PUBLICADO y en OBSOLETO**, igual que el revisor y el aprobador. Se interpreta que el "Sin acceso" del PRD se refería a **edición**, no a lectura. Anota en `design.md` que esta regla **diverge a propósito del texto literal del PRD §4.2**, por decisión de Toño.

---

## Qué implementar

1. **Backend (`DocumentPermissionResolver.GetBasePermissions`):**
   - `PUBLICADO` + `AUTOR` → `DenyAll with { CanRead = true }`
   - `OBSOLETO` + `AUTOR` → `DenyAll with { CanRead = true }`

   No cambies nada más: el autor sigue sin poder editar, eliminar ni iniciar revisiones desde la matriz. La revisión periódica se rige por la regla por rol de `revision-periodica-permiso-por-rol`, y la nueva versión por "autor o JCA/JCD".
2. **Frontend (`permissions.ts`):** el mismo cambio, para que coincida con el backend.
3. **Efectos derivados que debes confirmar y documentar** (deben salir solos de `CanRead`):
   - "Ver documento" (visor) aparece para el autor en PUBLICADO, EN_REVISION_PERIODICA y OBSOLETO; en OBSOLETO, con el sello.
   - `CanViewArchivoDistribucion` pasa a `true` para el autor en PUBLICADO.
   - **No** cambia el acceso al **archivo original**: RN-DOC-013, RN-DOC-014 y la excepción CA-34 siguen igual.
   - Busca otros consumidores de `CanRead` / `canRead` para AUTOR (detalle, exportar PDF controlado, listados) y anota cualquier comportamiento que cambie.
4. **MSW:** si los handlers usan la matriz de `permissions.ts`, el cambio aplica solo; si no, replícalo.
5. **Mapa de proceso:** Cowork actualizará `SHAC-Mapa-Proceso-Control-Documentario.md` después de verificar el change.

## Tests
- Backend:
  - el autor abre el visor de su documento PUBLICADO → 200;
  - el autor abre el visor de su documento OBSOLETO → 200, con el sello;
  - el autor pide el archivo original en PUBLICADO → sigue en 403.
- Frontend:
  - `getDocumentPermissions('PUBLICADO', 'AUTOR').canRead === true`;
  - el panel muestra "Ver documento" al autor en PUBLICADO.
- Actualiza los tests existentes que afirmaban `DenyAll` para AUTOR en esos estados.

## Reglas de siempre
- El código real manda sobre este doc; cualquier divergencia va en `design.md`.
- Corre la suite completa del frontend, los tests del backend y `tsc`.
- **Detén el backend y ejecuta `dotnet build` antes de la prueba manual.**
- Prueba manual con MSW apagado: entra como el autor de un documento publicado y verifica que ve "Ver documento" con el PDF de distribución y que "Descargar archivo original" no está disponible.
- Al terminar, Toño avisa con "listo". Cowork verifica releyendo el código real.
