# Instrucciones para Claude Code — Mostrar nombres reales en vez de IDs (resolveUserDisplayName)

Fecha: 2026-10-05
Autor: Cowork (investigación sobre el código real)
Origen: Toño. En el detalle de un documento, la tarjeta muestra los **IDs** de Autor, Revisor y Aprobador en lugar de los nombres.
Change sugerido: `nombres-usuarios-reales`. Es el change que ya recomendaba el `design.md` de `documentos-revisor-aprobador-reales` (allí aparece como `documentos-nombres-usuarios-reales`), ampliado a QE y NC.

Ciclo: `/opsx:sync` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

---

## Causa (confirmada leyendo el código)

`features/documents/components/DocumentDetailHeader.tsx` (líneas 6 y 93-104) importa `resolveUserDisplayName` desde `src/mocks/fixtures/userIdentity.fixtures`. La función busca el ID en el store **mock** y, si no lo encuentra, devuelve el ID tal cual. Con el backend real ningún ID está en el mock, así que siempre se muestra el GUID.

Claude Code ya lo había detectado en el barrido de `documentos-revisor-aprobador-reales` (tabla de imports desde `mocks/` en su `design.md`). Estos son todos los usos en código de producción:

| Archivo | Qué importa |
|---|---|
| `features/documents/components/DocumentDetailHeader.tsx` | `resolveUserDisplayName` (autor, revisor, aprobador) |
| `features/documents/components/DocumentActionPanel.tsx` | `resolveUserDisplayName` (aprobador) |
| `features/nonconformities/pages/NonconformityDetailPage.tsx` | `getUsersStore`, `resolveUserDisplayName` |
| `features/quality-events/pages/QualityEventForm.tsx` | `resolveUserDisplayName` |
| `features/quality-events/components/QEHeaderSection.tsx` | `resolveUserDisplayName` |
| `features/quality-events/components/QEInvestigationSection.tsx` | `resolveUserDisplayName` |
| `features/quality-events/export/buildQualityEventPdf.ts` | `resolveUserDisplayName` (fuera de React: el PDF exportado también sale con IDs) |

Otros imports desde `mocks/` que **no** entran en este change (quedan como hallazgos aparte): `LoginPage.tsx` (`authFixtures`) y `ACSection.tsx` (`qualityEventFixtures`).

## Decisión de Toño

**D1 — ✅ DECIDIDO (2026-10-05): endpoint liviano de nombres más un hook.** Se descartó incluir los nombres en cada respuesta de detalle, porque obligaría a cambiar los contratos de Documentos, QE y NC por separado. Documenta las dos opciones en `design.md`.

---

## Qué implementar

### Backend
1. Nuevo endpoint de lectura con Dapper: `GET /api/users/nombres?ids=<guid>,<guid>,...`. El nombre es sugerido; si encaja mejor otra ruta, usa esa y anótalo.
   - `RequireAuthorization()` más `RequireEmpresaActivaFilter`. Accesible a **cualquier** usuario autenticado con empresa activa. `GET /api/users` no sirve porque está restringido a administradores.
   - Devuelve solo `id` y `nombreCompleto`. Sin email, sin avatar y sin rol.
   - **Multi-tenancy:** resuelve solo usuarios que tengan **alguna** asignación (activa o inactiva) en la **empresa activa**. Un ID de otra empresa o inexistente simplemente **no aparece** en la respuesta: no es un error, no es un 404 y no revela nada.
   - Incluye usuarios **inactivos**, o con asignación inactiva, que pertenezcan a la empresa. Un documento firmado por alguien que ya se fue debe seguir mostrando su nombre.
   - Pon un límite razonable de IDs por request (por ejemplo 100). Si se excede, responde 400 con un mensaje claro. Si un ID tiene formato inválido, también 400.
2. Tests de integración:
   - Resuelve usuarios de la empresa activa, incluidos los inactivos.
   - Omite IDs de otra empresa e IDs inexistentes.
   - No expone email ni avatar.
   - Responde 400 con un ID malformado y al pasar el límite.

### Frontend
1. Hook `useUserNames(ids: (string | null | undefined)[])` con TanStack Query, en una ubicación compartida (por ejemplo `src/hooks/` o `features/users/hooks/`), **nunca** dentro de `mocks/`.
   - Filtra nulos, quita duplicados y ordena los IDs para que la query key sea estable.
   - Devuelve un resolvedor `getName(id)`.
   - Mientras carga, muestra un placeholder corto (skeleton o "…"), no el GUID.
   - Si el backend no resolvió un ID, muestra un texto genérico i18n como "Usuario no disponible", **nunca** el GUID crudo.
   - Usa un `staleTime` generoso, porque los nombres cambian poco.
2. Reemplaza `resolveUserDisplayName` en los 6 componentes React de la tabla por el hook. **Un solo request por pantalla:** junta todos los IDs que necesita la página (autor, revisor y aprobador en Documentos; reportante, responsables y demás en QE y NC) en una sola llamada al hook.
3. `buildQualityEventPdf.ts` no es un componente. Que reciba los nombres ya resueltos como parámetro (un mapa `id → nombre`) desde el componente que dispara la exportación. Verifica que el PDF exportado muestre nombres.
4. `NonconformityDetailPage.tsx` además usa `getUsersStore()` del mock. Investiga para qué, y reemplázalo por datos reales o por el hook. Documéntalo.
5. **MSW:** agrega el handler del endpoint nuevo, que resuelva contra el store mock filtrando por la empresa activa, para que el modo mock siga funcionando.
6. Cuando ya no quede ningún uso en código de producción, `resolveUserDisplayName` debe quedar **solo** para uso interno de los mocks y los tests. Confírmalo con una búsqueda en `src/` (excluyendo `src/mocks/` y `*.test.*`) y pega el resultado en `design.md`.
7. **Audit trail:** las entradas ya traen `realizadoPorNombre` desde el backend. No las cambies al hook.
8. Tests: el hook (dedupe, ID no resuelto → texto genérico, carga) y cada componente migrado con un nombre resuelto y con uno no resuelto. Ningún test debe esperar un GUID en pantalla.

---

## Reglas de siempre
- El código real manda sobre este documento; cualquier divergencia va en `design.md`.
- Un contrato nuevo se refleja a la vez en backend, handler MSW, tipos TS y tests.
- Corre la suite completa del frontend, los tests del backend y `tsc`.
- **Detén el backend y ejecuta `dotnet build` antes de la prueba manual.**
- Prueba manual con MSW apagado:
  - el detalle de un documento real muestra los nombres de autor, revisor y aprobador, también en el panel de acciones;
  - el detalle de un QE y el de una NC muestran los nombres de reportante y responsables;
  - el PDF exportado de un QE muestra nombres;
  - desactiva un usuario y confirma que su nombre sigue apareciendo donde está asignado.
- Al terminar, Toño avisa con "listo". Cowork verifica releyendo el código real.
