## Context

Verificado contra el código real de `ShcMvpEndPoint` (.NET 10, EF Core para escrituras, patrón vertical-slice `Features/<Modulo>/<Accion>/`) y `shc-controldoc` (React, MSW), y contra la implementación real (no solo el design.md) de `fs-vinculacion-documento-qe` (ya archivado, el par hermano de este cambio):

- `Domain/Entities/NoConformidad.cs` no tiene ningún campo `DocumentosVinculados` — nunca se portó desde el mock. `Domain/Entities/Documento.cs` no tiene ningún campo equivalente (`NcVinculados`) tampoco — a diferencia de `QeVinculados`, que ya existía como columna real muerta antes de `fs-vinculacion-documento-qe`, acá no hay nada que migrar del lado Documento, se crea desde cero.
- `NoConformidad.documentosVinculados: string[]` (frontend) existe con default `[]` en `createNC.schema.ts`/`updateNC.schema.ts`, poblado por el mock al crear, pero `NCForm.tsx` no tiene ningún control que lo edite (confirmado línea por línea).
- La implementación real de `fs-vinculacion-documento-qe` usó nombres distintos a los que su propio `design.md` proponía originalmente: el módulo backend es `Features/VinculacionDocumentoQE/` (no `Features/DocumentoQualityEvent/`), con `Shared/DocumentoQualityEventLinkService.cs`, `VincularDesdeDocumento/`, `VincularDesdeQE/`. Este cambio sigue los nombres **reales** ya en el repo, no los del design.md archivado.
- `Domain/Common/DocumentoVinculadoResumen.cs` ya existe con la forma exacta `{ Id, Codigo, Titulo, Estado }` — es el resumen de un Documento vinculado, ya usado por `QualityEvent.DocumentosVinculados`. Es directamente reutilizable como el tipo de `NoConformidad.DocumentosVinculados` sin crear un DTO nuevo — el nombre del campo coincide y la forma es idéntica.
- No existe ningún `NcVinculadoResumen` (resumen de una NC vinculada, análogo a `QeVinculadoResumen`) — se crea nuevo, mismo patrón: `{ Id, Numero, Tipo (NCTipo), Severidad (NCSeveridad), Estado (NCEstado) }`.
- `ActualizarNoConformidadHandler`/`ActualizarNoConformidadEndpoint` no tienen ningún gate de rol — el único control es bloquear edición en estado terminal (`CERRADA`/`ANULADA`, `409`). `PATCH /api/nonconformities/:id` solo exige `RequireAuthorization()`. Es la misma situación que tenía QE antes del cambio anterior (sin resolver de permisos por-entidad en el backend), pero acá es más marcada: NC no tiene *ningún* gate de rol en *ningún* endpoint de mutación hoy, ni siquiera parcial.
- `ncPermissions.ts` (frontend) sí tiene un modelo de permisos completo por rol+estado (`getNCPermissions`). `canEdit` es verdadero para `SUPERVISOR` y `JEFE_CALIDAD_SYST` en todo estado no terminal, **sin** distinguir por `responsableInvestigacionId` (a diferencia de lo que la instrucción original sugería verificar — confirmado que NC no tiene ese concepto de "responsable con permiso ampliado" que sí tiene QE vía `puedeVincularDocumentos`).
- `ListarNoConformidadesQuery`/`Handler` **ya soporta `search`** (`ILIKE` sobre título/número, verificado en `ListarNoConformidadesEndpoint.cs`) — a diferencia de QE, que necesitó agregar `search` como gap (D7 del cambio anterior). No hace falta ningún cambio de backend para que el combobox pueda buscar NCs.
- `useNonconformities(filters?)` (frontend, `useNonconformities.ts`) **no acepta un segundo parámetro `enabled`** — a diferencia de `useDocuments(filters, enabled)`/`useQualityEvents(filters, enabled)`, que sí lo tienen y son los que consume `DocumentoQECombobox` para controlar cuándo la query dispara. Gap pequeño no anticipado por la instrucción original: hace falta agregarlo para que un combobox del lado "buscar NC" pueda controlar el fetch igual que los otros dos.
- `getNonconformitiesStore()` ya está exportado desde `mocks/handlers/nonconformities.handlers.ts` (mismo patrón cross-dominio que `getDocumentsStore()`/`getQeStore()`) — reutilizable directamente por los handlers MSW nuevos del lado Documento sin crear ningún mecanismo nuevo.
- `DashboardSummaryBuilder.cs`/`DashboardSummaryDtos.cs`: no hay ningún campo ni sentinel que dependa de este vínculo (confirmado, ver proposal.md) — este cambio no toca `Features/Dashboard/` en absoluto.
- `EliminarDocumentoHandler` tiene un guard de integridad existente (no es RN-DOC-005) que bloquea `DELETE /api/documents/:id` si el documento tiene **cualquier** vínculo en `DocumentoQualityEvent`, vía `DocumentoQualityEventLinkService.TieneAlgunVinculoAsync`. Hoy ese guard es ciego a vínculos de NC — un documento sin QEs vinculados pero con NCs vinculadas pasaría el guard igual, lo cual es inconsistente con el propio criterio del guard ("cualquier vínculo bloquea").

## Goals / Non-Goals

**Goals:**
- Tabla puente real `DocumentoNoConformidad` + 4 endpoints simétricos, mismo patrón exacto (servicio compartido, idempotencia, 404 cross-empresa, doble audit trail) que `fs-vinculacion-documento-qe`.
- `GET /api/documents/:id` y `GET /api/nonconformities/:id` devuelven el vínculo poblado con resumen suficiente para renderizar sin una segunda llamada.
- UI nueva (combobox + sección de solo-lectura) en `DocumentDetailPage` y `NonconformityDetailPage`, más los 4 handlers MSW equivalentes.
- Extender el guard de integridad existente de `EliminarDocumentoHandler` para que también considere vínculos de NC (consistencia con su propio criterio, no una regla de negocio nueva).

**Non-Goals:**
- Cualquier regla de negocio bloqueante nueva (RN-DOC-*/RN-NC-*) derivada de este vínculo — confirmado que no existe ninguna que lo requiera (a diferencia de RN-DOC-005 en el cambio anterior).
- Cualquier campo o sentinel de Dashboard.
- Habilitar la vinculación desde `NCForm.tsx` en creación — decisión a confirmar con Toño (ver Open Questions); por defecto replica el precedente de QE (solo post-creación).
- Conectar el frontend real a `ShcMvpEndPoint` (cutover de MSW a backend real) — sigue pendiente como cambio transversal futuro.
- Crear specs formales para el resto de la superficie de No Conformidades (CRUD, ACs, permisos) — este cambio solo crea `documento-nc-vinculacion`; el módulo NC en general sigue sin pasar por el ciclo `/opsx:propose` completo.

## Decisions

### D1 — Reutilizar `DocumentoVinculadoResumen` para `NoConformidad.DocumentosVinculados`; DTO nuevo solo para el otro sentido
`Domain/Common/DocumentoVinculadoResumen.cs` ya tiene la forma exacta que necesita `NoConformidad.DocumentosVinculados` (`{ Id, Codigo, Titulo, Estado }`) — se reutiliza tal cual, sin duplicar el record. Se crea únicamente:
```csharp
// Domain/Common/NcVinculadoResumen.cs
public sealed record NcVinculadoResumen(Guid Id, string Numero, NCTipo Tipo, NCSeveridad Severidad, NCEstado Estado);
```
usado por `Documento.NcVinculados`.

**Alternativa descartada**: crear un `DocumentoResumenNC` paralelo idéntico a `DocumentoVinculadoResumen` — descartada por duplicación innecesaria; el nombre del campo (`DocumentosVinculados`) y la forma ya coinciden exactamente entre ambos usos.

### D2 — Tabla puente y estructura de módulo: mismo layout real que `Features/VinculacionDocumentoQE/`
```csharp
// Domain/Entities/DocumentoNoConformidad.cs
public class DocumentoNoConformidad
{
    public Guid DocumentoId { get; set; }
    public Guid NoConformidadId { get; set; }
    public required Guid EmpresaId { get; set; }
    public required Guid CreadoPorId { get; set; }
    public DateTime CreadoEn { get; set; }
}
```
`ShacDbContext`: nuevo `DbSet<DocumentoNoConformidad> DocumentosNoConformidades`, `HasKey(x => new { x.DocumentoId, x.NoConformidadId })`, índices en ambas columnas, sin navegaciones de colección — mismo criterio D1 del cambio anterior (el resumen mezcla columnas de dos tablas, no es mapeable 1:1 por EF).

`Documento.NcVinculados`: `[NotMapped] public List<NcVinculadoResumen> NcVinculados { get; set; } = [];`, poblado manualmente en `ObtenerDocumentoHandler`. `NoConformidad.DocumentosVinculados` (backend, campo nuevo — hoy no existe): `[NotMapped] public List<DocumentoVinculadoResumen> DocumentosVinculados { get; set; } = [];`, poblado en `ObtenerNoConformidadHandler`.

Módulo nuevo, mismo layout real (no el propuesto originalmente) que el cambio anterior:
```
Features/VinculacionDocumentoNC/
  Shared/DocumentoNoConformidadLinkService.cs   // Vincular/Desvincular/ObtenerResumenes
  VincularDesdeDocumento/   // POST+DELETE /api/documents/:id/nc-vinculadas[...]
  VincularDesdeNC/          // POST+DELETE /api/nonconformities/:id/documentos-vinculados[...]
```
`DocumentoNoConformidadLinkService` replica método por método `DocumentoQualityEventLinkService` (verificación cross-empresa de ambos lados, idempotencia, doble audit trail con acciones `DOCUMENTO_VINCULADO`/`DOCUMENTO_DESVINCULADO` del lado Documento y `NC_VINCULADO`/`NC_DESVINCULADO` del lado NC — nomenclatura análoga a `QE_VINCULADO`/`QE_DESVINCULADO`).

**Alternativa descartada**: generalizar `DocumentoQualityEventLinkService` a un servicio genérico "vinculación de Documento con cualquier entidad" (parametrizado por tipo) — descartada por sobre-ingeniería: sería la primera abstracción genérica de este tipo en el proyecto para resolver solo 2 casos concretos (QE, NC), y CLAUDE.md pide explícitamente no diseñar para reutilización hipotética futura. Duplicar la lógica (ya sencilla, ~150 líneas) es más simple de leer y mantener que una capa de indirección nueva.

### D3 — Permiso de vinculación/desvinculación: mismo criterio en ambos sentidos — confirmado por Toño
**Lado Documento**: idéntico al cambio anterior, sin ambigüedad — `DocumentPermissionResolver.GetPermissions(documento.Estado, docRole).CanEdit` (verdadero para `AUTOR`/`JEFE_CALIDAD` en `BORRADOR`/`EN_REVISION`). Ningún cambio necesario, se reutiliza el resolver existente tal cual.

**Lado NC** (sin ningún gate de rol backend existente que replicar — mismo vacío que tenía QE, pero acá el vacío es total, no parcial): nuevo `DocumentoNoConformidadLinkService.PuedeVincularDesdeNC(nc, actorRolGlobal)` que replica exactamente `getNCPermissions(nc, userRole).canEdit` del frontend — verdadero para `SUPERVISOR` o `JEFE_CALIDAD_SYST` mientras `nc.Estado` no sea `CERRADA` ni `ANULADA`, sin restricción adicional por `ResponsableInvestigacionId` (confirmado que NC no tiene ese concepto de responsable-con-permiso-ampliado que sí tiene QE — ver Context). Es el mirror literal de un criterio ya confirmado y en producción del lado frontend, no una regla inventada.

**Confirmado explícitamente por Toño** (2026-08-26, vía `AskUserQuestion` en la sesión de `/opsx:propose`): este criterio es el correcto, aceptando que sea el primer gate de rol real en el backend de No Conformidades para cualquier mutación (hoy ninguna lo tiene).

### D4 — Extender el guard de integridad de `EliminarDocumentoHandler` para incluir vínculos de NC
El guard existente (`DocumentoQualityEventLinkService.TieneAlgunVinculoAsync`, criterio "cualquier vínculo bloquea DELETE, sin distinguir estado") se extiende para también consultar `DocumentoNoConformidadLinkService.TieneAlgunVinculoAsync`. `EliminarDocumentoHandler` bloquea si *cualquiera* de los dos servicios devuelve `true`.

Este es un hallazgo no anticipado por la instrucción original (que solo hablaba de reglas *nuevas* que no existen para este par) — no es una regla de negocio nueva, es una inconsistencia real en un guard ya existente: hoy ese guard dice (spec `be-documentos-api`) "el documento no tiene ningún vínculo", pero solo mira una de las dos tablas puente que existirán después de este cambio. Dejarlo como está sería un bug silencioso (permitir borrar un documento con NCs activas vinculadas). Se documenta como Decision, no como Open Question, porque se deriva directamente del propio texto ya vigente del guard ("ningún vínculo", sin calificar "de QE") — no requiere una llamada de producto nueva.

`be-documentos-api` spec (delta): el requirement "Eliminación y restauración" se actualiza para decir "ningún vínculo en `DocumentoQualityEvent` ni en `DocumentoNoConformidad`" en vez de solo la primera tabla.

### D5 — Combobox: componente hermano `DocumentoNCCombobox`, no una extensión de `DocumentoQECombobox`
Se evaluaron ambas rutas que la instrucción dejaba abiertas. Generalizar `DocumentoQECombobox` (agregar `mode: 'document-search-nc' | 'nc-search-document'`) es mecánicamente viable — `useNonconformities` devuelve la misma forma `{ items, pagination }` que `useDocuments`/`useQualityEvents`, y el mapeo a `ResultOption { id, primary, secondary }` encaja igual de bien (`numero` / `tipo · severidad · estado` para NC). Pero el nombre del componente (`DocumentoQECombobox`) quedaría engañoso — un componente cuyo nombre dice "QE" pasaría a resolver vínculos con NC también, ensuciando la legibilidad de sus dos consumidores ya en producción (`DocumentQEVinculadosList`, `QEDocumentosVinculadosSection`) sin necesidad real.

Se crea `components/shared/DocumentoNCCombobox.tsx`, copiando la mecánica exacta (debounce 300ms, `role="combobox"`/`role="listbox"`, cierre por `mousedown` afuera, selección con chips vía el componente contenedor) con `mode: 'document-search-nc' | 'nc-search-document'`. Consume `useNonconformities(filters, enabled)` (ganando el parámetro `enabled`, D6) y `useDocuments(filters, enabled)` (ya lo tiene). Mismas props que `DocumentoQECombobox` (`linkedIds`, `onSelect`, `ariaLabel`) para minimizar la superficie de aprendizaje entre ambos componentes.

**Alternativa descartada**: generalizar `DocumentoQECombobox` con los 4 modos — descartada por el argumento de naming de arriba; el ahorro de líneas (un componente de ~110 líneas, ya pequeño) no compensa la confusión de nombre para dos features que ya funcionan en producción.

### D6 — `useNonconformities` gana un segundo parámetro `enabled` (gap no anticipado)
```typescript
export function useNonconformities(filters?: NCFilters, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.nonconformities.list(filters ?? {}),
    queryFn: () => getNonconformities(filters),
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}
```
Mismo patrón exacto que `useDocuments(filters, enabled)`. Sin este cambio, `DocumentoNCCombobox` no tiene forma de evitar disparar la búsqueda antes de que el usuario escriba (mismo problema que resolvió D7 del cambio anterior para `useQualityEvents`, pero acá el gap es en el parámetro `enabled`, no en `search` — `search` ya existe en `NCFilters` y en el backend).

### D7 — Placement en cada detalle
- `DocumentDetailPage.tsx`: nueva sección colapsable `NcVinculadasList`, mismo patrón `useState`+`ChevronDown`/`ChevronUp` que la sección "QE vinculados" ya existente (línea 273-296) — se agrega inmediatamente después de esa sección, antes de "Audit trail". Usa el mismo `perms.canEdit` ya calculado en la página (sin gate adicional, D3).
- `NonconformityDetailPage.tsx`: nueva sección `NCDocumentosVinculadosSection`, mismo patrón que `QEDocumentosVinculadosSection` del cambio anterior — se agrega entre la sección "Acciones Correctivas" (línea 277-287) y "Audit Trail" (línea 290-318). El gate de edición usa `permissions.canEdit` (ya calculado en la página vía `getNCPermissions`), sin necesitar la nueva `PuedeVincularDesdeNC` del backend en el frontend — el frontend replica su propio `canEdit`, ya probado.

### D8 — Frontend + MSW en paralelo, mismo contrato (mismo criterio D10 del cambio anterior)
Los 4 handlers MSW nuevos reutilizan `getDocumentsStore()` (ya exportado desde `documents.handlers.ts`) y `getNonconformitiesStore()` (ya exportado desde `nonconformities.handlers.ts`) — el "vínculo" en el mock muta `doc.ncVinculados`/`nc.documentosVinculados` en memoria en ambos stores a la vez, sin tabla puente real (mismo criterio que QE). `nonconformities.fixtures.ts` migra sus vínculos precargados existentes (si los hay) de `string[]` a la forma de objeto enriquecido; `documents.fixtures.ts` agrega `ncVinculados: []` (o precargado) como campo nuevo en cada fixture.

## Risks / Trade-offs

- [Riesgo] D3 (permiso del lado NC) introduce el primer gate de rol real en el backend de No Conformidades — un precedente de producto, no solo técnico, que Toño podría no querer sentar todavía → Mitigación: marcado como Open Question explícita, aislado en una única función estática fácil de relajar (o eliminar, cayendo a solo `RequireAuthorization()`) sin tocar el resto del servicio.
- [Riesgo] D4 (extender el guard de `EliminarDocumentoHandler`) cambia el comportamiento observable de un endpoint ya existente y ya cubierto por tests (`EliminarDocumentoHandler` tests actuales asumen que solo vínculos de QE bloquean) → Mitigación: se actualizan/agregan los tests de integración existentes de ese handler para cubrir el nuevo caso (bloqueo por NC vinculada, sin QE vinculado), no solo agregar tests nuevos aislados.
- [Riesgo] D5 duplica ~110 líneas de mecánica de combobox entre `DocumentoQECombobox` y `DocumentoNCCombobox` en vez de compartir una sola implementación → Mitigación: aceptado explícitamente (ver alternativa descartada en D5); si en el futuro aparece un tercer par a vincular con Documento, ahí sí se justificaría extraer la mecánica común a un hook (`useLinkableSearch` o similar) — prematuro hacerlo ahora para 2 casos.
- [Riesgo, no bloqueante] `[NotMapped]` en `Documento.NcVinculados`/`NoConformidad.DocumentosVinculados` tiene el mismo riesgo ya documentado en el cambio anterior (un `Include()` de EF fallaría) → Mismo comentario explícito en la propiedad como mitigación, ya es un patrón establecido en el proyecto.

## Migration Plan

1. Migración EF Core `AddDocumentoNoConformidadLink`: crea tabla `documentos_no_conformidades` (PK compuesta, índices en ambas columnas). Sin `DropColumn` (no hay columna previa). Reversible (`Down()` dropea la tabla).
2. `Domain/Entities/DocumentoNoConformidad.cs`, `Domain/Common/NcVinculadoResumen.cs` (nuevo), `Features/VinculacionDocumentoNC/Shared/DocumentoNoConformidadLinkService.cs`.
3. Los 4 endpoints (`Features/VinculacionDocumentoNC/VincularDesdeDocumento/`, `VincularDesdeNC/`), registrados en `Extensions/EndpointExtensions.cs`.
4. `EliminarDocumentoHandler` (D4, guard extendido), `ObtenerDocumentoHandler`/`ObtenerNoConformidadHandler` (resumen poblado, D2), `ShacDbContext` (nuevo `DbSet` + configuración de clave compuesta).
5. Frontend: `documents.types.ts` (`Documento.ncVinculados` nuevo), `nonconformity.types.ts` (`documentosVinculados` cambia de `string[]` a `DocumentoVinculadoResumen[]`, breaking interno), `components/shared/DocumentoNCCombobox.tsx` (D5), `useNonconformities` gana `enabled` (D6), hooks nuevos (`useVincularNC`/`useDesvincularNC` del lado Documento, `useVincularDocumento`/`useDesvincularDocumento` del lado NC — mismos nombres que ya usa QE, en el namespace de NC), secciones nuevas en ambos detalles (D7), claves i18n.
6. MSW: handlers + fixtures (D8).
7. `dotnet test` (Toño corre y reporta, Cowork no tiene SDK .NET en este entorno) + pasada manual en navegador del golden path (vincular desde ambos lados, ver sección actualizada en ambos detalles, desvincular, intentar borrar un documento con NC vinculada y confirmar el `409`).
8. Sin rollback especial más allá de la migración reversible — no hay datos de producción.

## Open Questions

Ninguna pendiente. Ambas decisiones de producto (D3 — permiso del lado NC; vinculación desde `NCForm.tsx` en creación) fueron confirmadas explícitamente por Toño el 2026-08-26 vía `AskUserQuestion` durante `/opsx:propose`, antes de generar `tasks.md`:
1. **Permiso de vinculación/desvinculación del lado NC (D3)**: confirmado — `SUPERVISOR`/`JEFE_CALIDAD_SYST` en estado no terminal, mirror literal de `getNCPermissions().canEdit`.
2. **Vinculación desde `NCForm.tsx` en creación**: confirmado — se mantiene fija en `[]`, vinculación solo post-creación desde el detalle (mismo precedente que QE). `NCForm.tsx` no se toca en este cambio.
