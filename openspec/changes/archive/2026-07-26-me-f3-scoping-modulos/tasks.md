## 1. Documentos (`documents.handlers.ts`)

- [x] 1.1 En `GET /api/documents`, restringir el candidate set a `d.empresaId === empresaActivaId` (leído de `useAuthStore.getState()`) antes de aplicar `estado`/`tipo`/`area`/`search`/`codigo`/`pendientes`.
- [x] 1.2 En `GET /api/documents/:id`, extender el guard `if (!doc) return err('Documento no encontrado', 404)` a `if (!doc || doc.empresaId !== empresaActivaId) return err(...)`.
- [x] 1.3 Extender el mismo guard a cada operación por id: `PUT /api/documents/:id`, `POST /api/documents/:id/status`, `PATCH /api/documents/:id/status`, `POST /api/documents/:id/sign`, `DELETE /api/documents/:id`, `POST /api/documents/:id/upload`, `POST /api/documents/:id/nueva-version`, `POST /api/documents/:id/exportar-pdf`, `GET /api/documents/:id/download-url`, `PATCH /api/documents/:id/confirmar-revision`, `PATCH /api/documents/:id/restaurar`, `POST /api/documents/:id/audit/access`, `GET/POST /api/documents/:id/archivo-original`, `GET /api/documents/:id/archivo-distribucion`, `POST /api/documents/:id/publicar`. (También `GET /api/documents/:id/archivo`, encontrado durante implementación — no estaba en el inventario original de design.md.)
- [x] 1.4 En `POST /api/documents`, reemplazar el literal `empresaId: 'empresa-001'` por `empresaId` leído de la sesión activa; responder `401` si `empresaActivaId` es `null`.
- [x] 1.5 Scope `generateCodigo(tipo)` para contar solo documentos con `empresaId === empresaActivaId` del mismo `tipo`.
- [x] 1.6 Revisar `documents.handlers.test.ts` (o equivalente): actualizar fixtures/mocks de `authStore` en cada test para setear una empresa activa consistente con los documentos que el test espera ver; agregar casos de aislamiento cross-empresa para list/detail/create/status/delete.
- [x] 1.7 `tsc --noEmit` y correr la suite de Documentos.
- [ ] 1.8 Verificación en navegador con `user-supervisor-001`: listado y detalle de Documentos cambian por completo al alternar empresa con el selector de `TopNav`; acceso directo por URL a un documento de la otra empresa muestra "no encontrado"; crear un documento nuevo queda con la empresa activa correcta y `codigo` correlativo dentro de esa empresa.
- [x] 1.9 Dejar resumen corto (handlers/tests tocados, qué se verificó) antes de continuar con Incidentes.

## 2. Incidentes (`incidents.handlers.ts`)

- [x] 2.1 En `GET /api/incidents`, restringir el candidate set a `empresaId === empresaActivaId` antes de aplicar `tipo`/`fechaDesde`/`fechaHasta`/`search`/`showDeleted`.
- [x] 2.2 En `GET /api/incidents/:id`, extender el guard 404 a incluir `empresaId !== empresaActivaId`.
- [x] 2.3 Extender el mismo guard a `PATCH /api/incidents/:id`, `PATCH /api/incidents/:id/status`, `DELETE /api/incidents/:id`, `PATCH /api/incidents/:id/restore`, y a los 3 endpoints de acciones correctivas anidadas bajo `:incidenteId` (vía lookup del incidente padre — la acción correctiva no necesita `empresaId` propio).
- [x] 2.4 En `POST /api/incidents`, reemplazar el literal `empresaId: 'empresa-001'` por la empresa activa de la sesión; responder `401` si no hay empresa activa.
- [x] 2.5 Scope `generateNumero()` para contar solo incidentes con `empresaId === empresaActivaId`.
- [x] 2.6 Revisar tests de `incidents.handlers` (y cualquier test que dependa de `getIncidentsStore()` desde `locales.handlers.test.ts`): setear empresa activa consistente; agregar casos de aislamiento cross-empresa. (`locales.handlers.test.ts` revisado en el módulo 5 — usa `getIncidentsStore()` directo, no el handler HTTP, sin impacto de este cambio.)
- [x] 2.7 `tsc --noEmit` y correr la suite de Incidentes.
- [ ] 2.8 Verificación en navegador con `user-supervisor-001`: listado/detalle/mapa de Incidentes cambian por completo al alternar empresa; acceso directo por URL a un incidente de la otra empresa muestra "no encontrado"; crear un incidente nuevo queda con la empresa activa correcta y `numero` correlativo dentro de esa empresa.
- [x] 2.9 Dejar resumen corto antes de continuar con No Conformidades.

## 3. No Conformidades (`nonconformities.handlers.ts`)

- [x] 3.1 En `GET /api/nonconformities`, restringir el candidate set a `empresaId === empresaActivaId` antes de aplicar el resto de `NCFilters`.
- [x] 3.2 En `GET /api/nonconformities/:id`, extender el guard 404 a incluir `empresaId !== empresaActivaId`.
- [x] 3.3 Extender el mismo guard a `PATCH /api/nonconformities/:id`, `DELETE /api/nonconformities/:id`, `PATCH /api/nonconformities/:id/restore`, `POST /api/nonconformities/:id/anular`, y a los 2 endpoints de acciones correctivas anidadas bajo `:ncId` (vía lookup de la NC padre).
- [x] 3.4 En `POST /api/nonconformities`, reemplazar el literal `empresaId: 'empresa-001'` por la empresa activa de la sesión; responder `401` si no hay empresa activa.
- [x] 3.5 Scope `generateNumero(dominio)` para contar solo NCs con `empresaId === empresaActivaId` del mismo `dominio`.
- [x] 3.6 Scope la detección de duplicados RN-NC-005 (mismo `dominio` + `areaAfectada` en los últimos 30 días) para considerar solo NCs de la misma empresa activa — una NC de otra empresa nunca debe disparar el warning `POSIBLE_DUPLICADO`.
- [x] 3.7 Revisar tests de `nonconformities.handlers`: setear empresa activa consistente; agregar casos de aislamiento cross-empresa y de no-falso-positivo en duplicados.
- [x] 3.8 `tsc --noEmit` y correr la suite de No Conformidades.
- [ ] 3.9 Verificación en navegador con `user-supervisor-001`: listado/detalle de NC cambian por completo al alternar empresa; acceso directo por URL a una NC de la otra empresa muestra "no encontrado"; crear una NC nueva queda con la empresa activa correcta y `numero` correlativo dentro de esa empresa.
- [x] 3.10 Dejar resumen corto antes de continuar con Quality Events.

## 4. Quality Events (`quality-events.handlers.ts`)

- [x] 4.1 En `GET /api/quality-events`, restringir el candidate set a `empresaId === empresaActivaId` antes de aplicar `estado`/`tipo`/`severidad`/`origen`/`fechaDesde`/`fechaHasta`/`soloReincidencias`.
- [x] 4.2 En `GET /api/quality-events/:id`, extender el guard 404 a incluir `empresaId !== empresaActivaId`.
- [x] 4.3 Extender el mismo guard a las 17 operaciones por id restantes: `PATCH /:id`, `PATCH /:id/status`, `DELETE /:id`, `PATCH /:id/reactivar`, `POST /:id/export-pdf`, los 4 endpoints de `acciones-correctivas` (incluyendo `solicitud-plazo`), `PATCH /:id/cerrar`, `PATCH /:id/firmar-cierre`, `PATCH /:id/forzar-vencimiento-verificacion`, `POST /:id/verificacion-eficacia`, `PATCH /:id/solicitar-ac`, `GET /:id/audit-trail`, `PATCH /:id/editar-reporte-inicial`, `PATCH /:id/editar-severidad`, `PATCH /:id/editar-mineral`.
- [x] 4.4 En `POST /api/quality-events`, reemplazar el literal `empresaId: 'empresa-001'` por la empresa activa de la sesión; responder `401` si no hay empresa activa.
- [x] 4.5 Scope el literal `` `QE-2026-${qeStore.length + 1}` `` para contar solo quality events con `empresaId === empresaActivaId`.
- [x] 4.6 Revisar tests de `quality-events.handlers`: setear `useAuthStore` con empresa activa consistente (patrón ya usado por este handler desde Fase 2); agregar casos de aislamiento cross-empresa. (También corregidos `useEditarReporteInicial/Severidad/Mineral.test.ts`, `useForzarVencimientoVerificacion.test.ts`, `useTransitionQEStatus.test.ts` y `areas.handlers.test.ts`, que dependían del mismo `loginAs`/sesión sin `empresaActivaId`.)
- [x] 4.7 `tsc --noEmit` y correr la suite de Quality Events.
- [ ] 4.8 Verificación en navegador con `user-supervisor-001`: listado/detalle de QE cambian por completo al alternar empresa; acceso directo por URL a un QE de la otra empresa muestra "no encontrado"; crear un QE nuevo queda con la empresa activa correcta y `numero` correlativo dentro de esa empresa.
- [x] 4.9 Dejar resumen corto antes de continuar con Locales/Zonas.

## 5. Locales y Zonas (`locales.handlers.ts`)

- [x] 5.1 En `GET /api/locales` y `GET /api/zonas`, restringir el resultado a `empresaId === empresaActivaId` antes de aplicar los filtros existentes (`activo`, `localId`).
- [x] 5.2 En `GET /api/locales/:id`, extender el guard 404 a incluir `empresaId !== empresaActivaId`.
- [x] 5.3 En `POST /api/locales`, reemplazar el literal `empresaId: 'empresa-001'` por la empresa activa de la sesión; responder `401` si no hay empresa activa.
- [x] 5.4 Scope `generateCodigoLocal()`/`generateCodigoZona()` para contar solo locales/zonas con `empresaId === empresaActivaId`.
- [x] 5.5 Corregir `puedeCrearLocalActivo(locales)`: pasar solo el subconjunto de `locales` cuyo `empresaId` coincide con la empresa activa (RN-LOC-001 es un límite de 5 activos por empresa, no global) — aplica tanto en `POST /api/locales` como en `PATCH /api/locales/:id/reactivar`.
- [x] 5.6 Corregir `puedeDesactivarLocal`/`puedeDesactivarZona`: filtrar `getIncidentsStore()` por el `empresaId` del local/zona antes de pasarlo como argumento de incidentes bloqueantes — un incidente de otra empresa nunca debe bloquear la desactivación.
- [x] 5.7 Extender el guard 404-por-empresa a `PATCH /api/locales/:id`, `PATCH /api/locales/:id/desactivar`, `PATCH /api/locales/:id/reactivar`, `POST /api/locales/:id/zonas` (herencia de `empresaId` del local padre a la zona nueva, sin cambios — ya correcto), `PATCH /api/zonas/:id`, `PATCH /api/zonas/:id/desactivar`, `PATCH /api/zonas/:id/reactivar`.
- [x] 5.8 Revisar tests de `locales.handlers` (y los que dependen de `getIncidentsStore()` cross-dominio): setear empresa activa consistente; agregar casos de aislamiento cross-empresa y del límite RN-LOC-001 por empresa. (También corregidos `useZonasByLocal.test.ts` y `useLocales.test.ts`, que dependían de la misma sesión sin `empresaActivaId`.)
- [x] 5.9 `tsc --noEmit` y correr la suite de Locales/Zonas.
- [ ] 5.10 Verificación en navegador con `user-supervisor-001`: administración de Locales/Zonas (M6) y el selector de `IncidentForm`/`IncidentDetailPage`/`IncidentMapView` (M3) cambian por completo al alternar empresa; acceso directo por URL a un Local/Zona de la otra empresa muestra "no encontrado"; crear un Local nuevo en una empresa con 5 activos en la otra empresa no se ve bloqueado por ese límite ajeno.
- [x] 5.11 Dejar resumen corto antes de pasar a la verificación final.

## 6. Verificación final

- [x] 6.1 `tsc --noEmit` sobre todo el proyecto y la suite completa de tests (no solo por módulo) para detectar regresiones cruzadas entre los 5 handlers tocados. `tsc --noEmit`: 0 errores. Suite completa: 1191/1196 passing (158 archivos, 152 verdes). Los 6 archivos que fallan son pre-existentes y no relacionados con este cambio, verificados uno por uno (no importan ninguno de los 5 handlers tocados y/o reproducen en aislamiento): `Pagination.test.tsx` (import roto a `../../i18n/config`), `useDashboardSummary.test.ts` y `JefeCalidadDashboard.test.tsx` (bugs de Dashboard — módulo explícitamente fuera de alcance, ver design.md Non-Goals), `useNCList.test.ts` (default `pageSize` de un hook, sin relación con empresa), `qualityEventCreate.schema.test.ts` ×2 (tests de schema Zod puro, sin red ni sesión).
- [ ] 6.2 Verificación manual completa en navegador con `user-supervisor-001` (asignado a `empresa-001` como `SUPERVISOR` y `empresa-002` como `JEFE_CALIDAD_SYST`, ver `me-f2-sesion-rbac-login`): recorrer los 5 módulos (Documentos, Incidentes, No Conformidades, Quality Events, Locales/Zonas) alternando empresa desde el selector de `TopNav` sin cerrar sesión, confirmando en cada uno que listado y detalle cambian por completo y que no queda ningún dato de la empresa anterior visible tras el cambio (incluyendo el efecto de `queryClient.clear()` de Fase 2).
- [ ] 6.3 Confirmar que ningún acceso directo por URL a un id de un módulo scoped que pertenece a la empresa no activa es alcanzable (responde "no encontrado" en los 5 módulos).
- [x] 6.4 Documentar en el resumen final los Non-Goals confirmados como deliberadamente fuera de alcance (Dashboard, Notificaciones, Fase 4, Fase 5) para que no se lean como regresión no intencional.
