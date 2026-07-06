## 1. Guard de edición por autoría (CAMBIO 1)

- [x] 1.1 Crear `src/router/DocumentEditGuard.tsx`: lee `id` con `useParams`, llama `useDocument(id)` (de `features/documents/hooks/useDocuments.ts`), y resuelve acceso: permite si `!isLoading` y (`user.rol` en `['JEFE_CONTROL_DOCUMENTARIO', 'JEFE_CALIDAD_SYST']` O `documento?.autorId === user.id`); redirige a `/login` si no autenticado, a `/no-autorizado` si ninguna condición se cumple; no renderiza nada mientras `isLoading`.
- [x] 1.2 En `src/router/index.tsx`, reemplazar el bloque `<RoleGuard requiredRoles={['JEFE_CONTROL_DOCUMENTARIO', 'JEFE_CALIDAD_SYST', 'SUPERVISOR']}>` que envuelve `/documents/:id/edit` por `<DocumentEditGuard />`, sin tocar ninguna otra ruta.
- [x] 1.3 Agregar/actualizar test de router (o test dedicado de `DocumentEditGuard`) cubriendo: OPERARIO autor accede a su propio documento; OPERARIO no-autor es redirigido a `/no-autorizado` para otro documento; SUPERVISOR sin autoría es redirigido a `/no-autorizado`; JEFE_CONTROL_DOCUMENTARIO y JEFE_CALIDAD_SYST acceden a cualquier documento; usuario no autenticado es redirigido a `/login`.
- [x] 1.4 Verificado en navegador real (Playwright + dev server + MSW): OPERARIO no-autor y SUPERVISOR no-autor son redirigidos a `/no-autorizado` al abrir `/documents/:id/edit` de un documento ajeno; JEFE_CONTROL_DOCUMENTARIO abre el formulario normalmente. Nota: todos los documentos fixture de MSW comparten el mismo `autorId` fijo (no coincide con el id de ningún usuario OPERARIO sembrado), así que el caso "OPERARIO SÍ es el autor → accede" no pudo reproducirse end-to-end con los fixtures actuales; ese camino queda cubierto por el test unitario dedicado de la tarea 1.3 (autorId mockeado = id del usuario).

## 2. Alinear pageSize de DocumentList (CAMBIO 2)

- [x] 2.1 En `src/features/documents/hooks/useDocumentList.ts`, cambiar `pageSize: 5` a `pageSize: 10`.
- [x] 2.2 Actualizar/agregar test de `useDocumentList` (o de `DocumentList`) que confirme que el filtro por defecto usa `pageSize: 10` y que, con más de 10 documentos y sin filtros, la primera página muestra 10 filas.
- [x] 2.3 Confirmado por inspección de diff: el único archivo tocado es `useDocumentList.ts`; ningún hook/componente de `/nonconformities`, `/incidents`, `/quality-events` o `/admin/locales` fue modificado, por lo que su paginación no cambia.
- [x] 2.4 Verificado en navegador real (Playwright + dev server + MSW): `/documents` sin filtros muestra exactamente 10 filas en la primera página (antes 5), sin errores de consola.

## 3. Cierre

- [x] 3.1 `npx tsc --noEmit` limpio. `npx vitest run`: 576/578 tests pasan (65/68 archivos); las 2 fallas restantes (`qualityEventCreate.schema.test.ts`) y los 2 archivos que no cargan (`Pagination.test.tsx`, `DeadlineBadge.test.tsx`, por un import roto a `../../i18n/config` que no existe) son preexistentes y no relacionados — confirmado que ninguno de esos tres archivos fue tocado por este change (`git status` solo muestra `router/index.tsx`, `useDocumentList.ts` y los archivos nuevos).
- [ ] 3.2 Revisar que ambos cambios quedaron aislados en commits/verificación separada según lo pedido en el spec (guard de autoría vs. paginación), aunque compartan el mismo change de OpenSpec.
