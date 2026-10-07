## Context

`resolveUserDisplayName` (`src/mocks/fixtures/userIdentity.fixtures.ts`) busca el id en el store mock (`getUsersStore()` de `auth.fixtures.ts`) y, si no lo encuentra, en `seedLegacyNames`; si tampoco está ahí, devuelve el `id` crudo. Siete archivos de producción lo importan hoy (confirmado con `grep -rln resolveUserDisplayName src --include='*.{ts,tsx}'`, excluyendo `*.test.*` y `src/mocks/`):

| Archivo | Campo(s) resuelto(s) |
|---|---|
| `features/documents/components/DocumentDetailHeader.tsx` | `autorId`, `revisorId`, `aprobadorId` |
| `features/documents/components/DocumentActionPanel.tsx` | `aprobadorId` (solo en el preview del PDF controlado) |
| `features/quality-events/components/QEHeaderSection.tsx` | `reportadoPorId` |
| `features/quality-events/components/QEInvestigationSection.tsx` | `causaRaizAprobadaPorId` |
| `features/quality-events/pages/QualityEventForm.tsx` | `reportadoPorId` (modo edición, solo lectura) |
| `features/quality-events/export/buildQualityEventPdf.ts` | `reportadoPorId`, `causaRaizAprobadaPorId` (no es componente React) |
| `features/nonconformities/pages/NonconformityDetailPage.tsx` | `detectadoPorId` (además usa `getUsersStore()` directo para mostrar el rol, con fallback a `resolveUserDisplayName`) |

Contra el backend real el store mock está vacío, así que todos estos campos muestran el GUID crudo. `GET /api/users` (`Features/Users/ListarUsuarios`) está `RequireRole(ADMINISTRADOR_EMPRESA, SUPERADMIN)` — ninguno de los roles que ven estas pantallas (JCA, JCD, DIR, SUPERVISOR, OPERARIO) califica.

Precedente directo ya implementado en el repo: `Features/Documentos/CandidatosAsignacion` + `DocumentoAsignacionService` (change `documentos-revisor-aprobador-reales`) — mismo patrón de endpoint Dapper multi-tenant sobre `asp_net_users ⋈ usuarios_empresa`, con `RequireEmpresaActivaFilter` + `RequireAuthorization()` sin restricción de rol. Se reutiliza su forma, no su regla de elegibilidad (ese endpoint sí exige `activo = TRUE` y `estado = 'ACTIVO'`; este no).

## Goals / Non-Goals

**Goals:**
- Que los 7 archivos de arriba muestren el nombre real del usuario contra el backend real, incluidos usuarios inactivos o con asignación inactiva.
- Un solo request HTTP por pantalla, aunque la pantalla necesite resolver varios ids.
- Que el modo mock siga funcionando con la misma regla de inclusión.
- Que `resolveUserDisplayName`/`seedLegacyNames` queden confinados a `src/mocks/` y tests una vez migrados estos 7 usos.

**Non-Goals:**
- Resolver `rol`, `email` o `avatarUrl` — el endpoint nuevo expone solo `id`/`nombreCompleto` (D1). Esto implica una pérdida de información aceptada en `NonconformityDetailPage` (ver Risks).
- Tocar `LoginPage.tsx` (`authFixtures`) ni `ACSection.tsx` (`qualityEventFixtures`) — imports desde `mocks/` detectados en el barrido previo pero fuera del alcance de `resolveUserDisplayName`/nombres de usuario.
- Cambiar `AuditTrailEntry.realizadoPorNombre` — ya viaja resuelto desde el backend; no pasa por este hook.
- Implementar un endpoint de búsqueda/autocompletado de usuarios; la entrada es siempre una lista de ids ya conocida por el caller.

## Decisions

**D1 — Contrato del endpoint: `GET /api/users/nombres?ids=<guid>,<guid>,...` → `{ id, nombreCompleto }[]`.**
Decidido por Toño: superficie mínima (sin email/avatar/rol) porque alimenta únicamente texto de display, nunca un selector de asignación (ese caso ya lo cubre `candidatos-asignacion`, que sí expone rol porque lo necesita para agrupar). Un id de otra empresa o inexistente no aparece en la respuesta — no es 404 ni error, para no revelar si un id existe fuera del alcance del caller. Límite de 100 ids por request → 400 si se excede; un id con formato inválido (no GUID) → 400. `RequireAuthorization()` + `RequireEmpresaActivaFilter`, sin restricción de rol (a diferencia de `GET /api/users`).

**D2 — Inclusión de inactivos (diferencia clave con `DocumentoAsignacionService`).**
La consulta NO filtra `u.activo` ni `ue.estado` — solo exige que exista **alguna** fila `usuarios_empresa` para ese `(usuario_id, empresa_id)`, activa o no. Un documento firmado por alguien que ya se fue, o un revisor luego desactivado, debe seguir mostrando su nombre. Ubicación: `Features/Users/NombresUsuarios/` (Endpoint + Handler Dapper + Response), análogo en forma a `Features/Documentos/CandidatosAsignacion` pero sin el `DocumentoAsignacionService` de elegibilidad (no hay elegibilidad que validar, es solo lookup):
```sql
SELECT DISTINCT u.id AS "Id", u.nombre AS "Nombre", u.apellido AS "Apellido"
FROM asp_net_users u
JOIN usuarios_empresa ue ON ue.usuario_id = u.id
WHERE ue.empresa_id = @EmpresaId AND u.id = ANY(@Ids)
```
(`DISTINCT` por si un usuario tiene más de una fila `usuarios_empresa` histórica para la misma empresa — p.ej. reasignado de rol.) Nombres de tabla/columna confirmados leyendo `DocumentoAsignacionService.cs`; si divergen al implementar, prevalece el código y se anota en la sección de Divergencias.

**D3 — Hook compartido `useUserNames`, fuera de `mocks/`.**
`features/users/hooks/useUserNames.ts` (junto a `useUsers.ts` existente, mismo dominio). Firma: `useUserNames(ids: (string | null | undefined)[]): { getName(id?: string | null): string; isLoading: boolean }`. Internamente: filtra nulos/undefined, deduplica y ordena (`[...new Set(ids)].sort()`) antes de construir la query key, para que dos llamadas con el mismo conjunto de ids en distinto orden compartan caché. `queryKey: ['users', 'nombres', idsOrdenados]`, `queryFn` llama a `getUserNames(idsOrdenados)` en `api/endpoints/users.api.ts`. `staleTime: 5 * 60_000` (los nombres cambian poco). Mientras `isLoading`, `getName` devuelve un placeholder corto (`'…'`); para un id no resuelto por el backend (otra empresa, inexistente, o lista vacía) devuelve `t('common:userNames.noDisponible')` — nunca el id crudo.

**D4 — Un solo request por pantalla: hoist al componente contenedor cuando hay varios consumidores.**
`DocumentDetailHeader` y `DocumentActionPanel` son hermanos dentro de `DocumentDetailPage` y juntos necesitan `autorId`/`revisorId`/`aprobadorId` (header) y `aprobadorId` (panel, para el preview). En vez de que cada componente llame `useUserNames` con su propio subconjunto de ids (lo que generaría dos query keys distintas y dos requests), `DocumentDetailPage` llama `useUserNames([documento.autorId, documento.revisorId, documento.aprobadorId])` una vez y pasa `getName` como prop a ambos hijos. El resto de componentes migrados (`QEHeaderSection`, `QEInvestigationSection`, `QualityEventForm`, `NonconformityDetailPage`) ya son el único consumidor de sus ids en su pantalla, así que llaman el hook directamente sin necesidad de hoist.

**D5 — `buildQualityEventPdf` recibe los nombres resueltos, no los resuelve.**
No es un componente React — no puede usar hooks. Se agregan `reportadoPorNombre: string` y, cuando aplique, `causaRaizAprobadaPorNombre?: string` a `QEExportMeta` (`export/buildQualityEventPdf.ts`); `drawCabecera`/`drawCausaRaiz` dejan de llamar `resolveUserDisplayName` y usan `meta.reportadoPorNombre`/`meta.causaRaizAprobadaPorNombre`. El único invocador real, `QEHeaderSection.handleExportPdf`, ya tiene disponibles esos nombres vía su propio `useUserNames` (D4 no aplica aquí: es un solo consumidor) y los arma en el `meta` que ya construye hoy (`exportadoPorNombre`, `generadoEn`).

**D6 — MSW.**
Handler nuevo en `mocks/handlers/users.handlers.ts`: `GET /api/users/nombres`, parsea `ids` (split por coma), valida formato GUID y el límite de 100 (mismos 400 que el backend real), filtra `getUsersStore()` por pertenencia a la empresa activa vía `getUsuarioEmpresaStore()` (sin filtrar por `estado` ni `activo` — D2), y devuelve `{ id, nombreCompleto }[]`.

**D7 — `NonconformityDetailPage` pierde el sufijo de rol en `detectadoPorId`.**
Investigado: el código actual (`getUsersStore().find(...)`) busca el usuario completo solo para mostrar `"{nombre} {apellido} ({rol})"`; si no está en el store mock, cae a `resolveUserDisplayName` (sin rol). El endpoint nuevo (D1) no expone `rol` a propósito — superficie mínima para un lookup de solo-nombre reutilizado por 3 módulos distintos. Se acepta mostrar solo el nombre, sin rol, consistente con cómo ya se muestra `reportadoPorId` en QE. Si Toño quiere recuperar el rol en NC específicamente, requeriría un campo propio en el DTO de NC (p.ej. `detectadoPorRol` denormalizado, mismo patrón que `AccionCorrectiva.responsableNombre`) — fuera de alcance de este change.

## Divergencias durante la implementación

- **Backend**: se usó un `NombresUsuariosHandler` + `NombresUsuariosEndpoint` dedicados en `Features/Users/NombresUsuarios/`, análogo a `ListarUsuariosHandler` (no un servicio compartido con `DocumentoAsignacionService`, ya que no hay regla de elegibilidad que validar aquí, solo un lookup).
- **`buildQualityEventPdf`**: el fallback de `causaRaizAprobadaPorNombre` ausente pasó de `resolveUserDisplayName(qe.causaRaizAprobadaPorId ?? entry.realizadoPorId)` a usar directamente `entry.realizadoPorNombre` (el audit trail ya trae el nombre resuelto desde el backend, por CLAUDE.md — nunca hace falta resolverlo de nuevo).
- **Export masivo (`QEList.tsx` / `exportQualityEventsBatch.ts`)**: los nombres se resuelven desde los datos ya cargados por `useQEList()` (la página visible), no desde un refetch adicional por QE — más simple y evita N llamadas a `useUserNames`. `exportQualityEventsBatch` recibe un `Record<qeId, BatchExportNombres>` ya resuelto, construido una vez en `QEList` antes de iniciar el loop.
- **Confirmación de inventario (requisito 6 de las instrucciones originales)**: `grep -rln "resolveUserDisplayName|getUsersStore" src --include='*.{ts,tsx}'` tras la migración solo matchea archivos bajo `src/mocks/` o `*.test.ts` (18 archivos, todos legítimos: handlers, fixtures, y `qualityEventPermissions.test.ts`) — ningún archivo de producción fuera de esos dos conjuntos importa ya `resolveUserDisplayName` ni `getUsersStore`.

## Risks / Trade-offs

- **Pérdida del rol en NC** (D7): aceptada: es una reducción de información, no una regresión funcional — el nombre sigue siendo correcto y resoluble.
- **Ids de otra empresa/inexistentes no generan error** (D1): una pantalla que reciba un id así (dato corrupto, o un usuario borrado de verdad en vez de desactivado) mostrará el texto "no disponible" en vez de fallar — mitigado por ser exactamente el comportamiento ya aceptado para GUIDs no resueltos en el resto del sistema.
- **`DISTINCT` en la consulta D2**: si un usuario tiene múltiples filas `usuarios_empresa` para la misma empresa con nombres distintos entre `asp_net_users` (no debería ocurrir — `nombre`/`apellido` viven en `asp_net_users`, no en `usuarios_empresa`), no hay ambigüedad real; el `DISTINCT` es solo para evitar filas duplicadas por el `JOIN`.
- **Caché de 5 minutos (`staleTime`)**: un cambio de nombre (poco frecuente) no se reflejaría hasta expirar el `staleTime` o recargar la pantalla — aceptado, igual que el resto de catálogos de referencia del sistema (áreas, empresas).
