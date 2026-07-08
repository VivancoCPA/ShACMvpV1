## Context

Dos defectos independientes en M1 (Control Documentario), agrupados en un solo change por tamaño reducido:

1. El guard de `/documents/:id/edit` (`src/router/index.tsx:93-110`) usa `<RoleGuard requiredRoles={['JEFE_CONTROL_DOCUMENTARIO', 'JEFE_CALIDAD_SYST', 'SUPERVISOR']}>`. `RoleGuard` (`src/router/RoleGuard.tsx`) solo compara `user.rol` contra esa lista — no tiene forma de conocer el documento específico que se está solicitando. Como consecuencia, un Autor con rol global `OPERARIO` (el caso más común: la mayoría de autores de documentos no son Jefes) nunca puede editar su propio documento en `BORRADOR`, aunque `getDocumentPermissions('BORRADOR', 'AUTOR')` en `permissions.ts` le otorgaría `canEdit: true`.

   Investigación confirmó que `SUPERVISOR` en esa lista no cubre "autoría" de ningún modo: `DocRole` (tipo en `documents.types.ts`) no tiene variante `SUPERVISOR`; en todos los sitios donde se deriva `DocRole` desde `UserRole` (ver `DocumentDetailPage.tsx:121-132`), un SUPERVISOR que no es autor/revisor/aprobador cae a `docRole: 'OPERARIO'`, que es `DENY_ALL` (`canEdit: false`) en `BORRADOR`. Y `DocumentFormPage`/`useDocumentForm` no verifican permisos por sí mismos antes de permitir submit — dependen enteramente del guard de ruta. Es decir, hoy SUPERVISOR SÍ puede editar (enviar el PUT) cualquier documento en `BORRADOR` a través de esta ruta, un hueco de permisos que contradice el propio `permissions.ts`.

2. `useDocumentList.ts:27` fija `pageSize: 5`. El resto del sistema no es totalmente uniforme: `useQEList`/`useIncidentList` usan `pageSize: 10`; `useNCList` también usa `pageSize: 5` (inconsistencia preexistente, fuera de este alcance); `LocalList` no pagina (lista acotada a 5 locales activos, no comparable). El criterio de aceptación del change fija 10 como el valor objetivo para `DocumentList`, alineado con QEList/IncidentList.

## Goals / Non-Goals

**Goals:**
- El guard de `/documents/:id/edit` permite acceso si el rol global es `JEFE_CONTROL_DOCUMENTARIO`/`JEFE_CALIDAD_SYST`, o si el usuario autenticado es el `autorId` real del documento solicitado.
- `SUPERVISOR` deja de tener acceso de edición vía esta ruta (decisión confirmada con el usuario: cierra el hueco de permisos descrito arriba).
- `DocumentList` usa `pageSize: 10` por defecto, igual que QEList/IncidentList.

**Non-Goals:**
- No se corrige la inconsistencia de `pageSize: 5` en `useNCList` (fuera de alcance, requeriría su propio change).
- No se modifica `permissions.ts` ni `getDocumentPermissions` — el guard de ruta y las reglas de permisos por estado siguen siendo capas independientes.
- No se agrega gating de permisos dentro de `DocumentFormPage`/`useDocumentForm` más allá del guard de ruta (fuera de alcance de este fix puntual).

## Decisions

**Guard de autoría como componente propio, no cambio en `RoleGuard` genérico.**
`RoleGuard` es usado por ~15 rutas distintas y su contrato (`requiredRoles?: UserRole[]`) es genérico y no tiene noción de "entidad con autoría". En vez de sobrecargar `RoleGuard` con lógica específica de documentos, se crea `DocumentEditGuard` (`src/router/DocumentEditGuard.tsx`) como wrapper específico para esta única ruta:

```tsx
export function DocumentEditGuard() {
  const { isAuthenticated, user } = useAuthStore()
  const { id } = useParams<{ id: string }>()
  const { data: documento, isLoading } = useDocument(id ?? '')

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (isLoading) return null // o skeleton mínimo
  const isGlobalRole = user && ['JEFE_CONTROL_DOCUMENTARIO', 'JEFE_CALIDAD_SYST'].includes(user.rol)
  const isAuthor = user && documento && documento.autorId === user.id
  if (!isGlobalRole && !isAuthor) return <Navigate to="/no-autorizado" replace />
  return <Outlet />
}
```

Se monta en `router/index.tsx` reemplazando el bloque `RoleGuard` actual, exclusivamente para `/documents/:id/edit`.

*Alternativa considerada*: extender `RoleGuard` con una prop genérica `resourceOwnerCheck?: (params) => boolean`. Descartada por ahora — agrega complejidad genérica para un único caso de uso; si aparece un segundo caso de "guard por autoría" en otro módulo, vale la pena revisar esta decisión.

**Carga del documento vía `useDocument(id)` existente — sin nuevo endpoint ni nuevo hook.**
`useDocument(id)` (`features/documents/hooks/useDocuments.ts:33-39`) ya es un `useQuery` con `queryKey: QUERY_KEYS.documents.detail(id)`. `DocumentFormPage` (vía `useDocumentForm`) también llama `useDocument(documentId)` con la misma queryKey — TanStack Query deduplica por key dentro del mismo `QueryClient`, así que montar el guard como padre de `DocumentFormPage` no duplica el fetch de red una vez cacheado; en el peor caso (guard es el primer consumidor) es una request adicional, igual de barata que la que ya hacía `DocumentFormPage` al montar.

**Estado de carga del guard.**
Mientras `useDocument` está `isLoading`, el guard no debe redirigir prematuramente a `/no-autorizado` (aún no sabemos si es autor) ni renderizar el formulario. Se renderiza `null` (o un skeleton mínimo consistente con el resto de guards) hasta resolver.

**SUPERVISOR removido de roles globales permitidos.**
Confirmado con el usuario: se remueve `SUPERVISOR` de la lista de roles globales del guard. Solo queda cubierto por la vía de autoría si además es el autor real (caso improbable pero no imposible, ya que `autorId` es independiente del rol).

**`pageSize` hardcodeado a 10 en `useDocumentList`, igual que hoy con 5 — sin nuevo parámetro configurable.**
El componente `Pagination` ya acepta `pageSize` como prop derivada de la respuesta del backend (`pagination.pageSize`), no como control de usuario — no existe UI para que el usuario cambie el tamaño de página en ningún listado del sistema. Cambiar el literal `5` → `10` en `useDocumentList.ts:27` es el único cambio necesario; no rompe la posibilidad de que el backend real devuelva un `pageSize` distinto en el futuro, ya que el valor viaja como filtro de request, no como constante de UI.

## Risks / Trade-offs

- [Riesgo] Un usuario con sesión antigua en caché de TanStack Query podría ver brevemente el formulario mientras `useDocument` resuelve, si `staleTime` mantiene datos de otro documento → Mitigación: `queryKey` incluye el `id`, por lo que no hay colisión de caché entre documentos distintos; el guard solo evalúa `isLoading` sobre la queryKey del `id` actual.
- [Riesgo] Remover `SUPERVISOR` es un cambio de comportamiento real, no solo un fix de guard → Mitigación: ya confirmado explícitamente con el usuario como parte de este change; documentado en proposal.md como **BREAKING** (comportamiento).
- [Trade-off] `DocumentEditGuard` duplica parcialmente la lógica de `RoleGuard` (chequeo de auth) en vez de componerlo — aceptable dado que es un solo caso de uso y evita acoplar `RoleGuard` genérico a conceptos de dominio de documentos.

## Migration Plan

No aplica migración de datos. Cambio de código puro:
1. Crear `DocumentEditGuard.tsx`.
2. Reemplazar el bloque `RoleGuard` de `/documents/:id/edit` en `router/index.tsx` por `DocumentEditGuard`.
3. Cambiar `pageSize: 5` → `10` en `useDocumentList.ts`.
4. Actualizar specs delta (`document-permissions`, `document-list-view`) para reflejar el nuevo comportamiento.

Rollback: revertir el commit; no hay estado persistente ni migración de esquema involucrada.

## Open Questions

Ninguna — ambas decisiones de diseño (remover SUPERVISOR, `pageSize: 10`) fueron confirmadas explícitamente con el usuario antes de escribir este documento.
