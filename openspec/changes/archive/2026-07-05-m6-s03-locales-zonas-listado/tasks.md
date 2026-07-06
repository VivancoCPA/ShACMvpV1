## 1. Capa de datos (extensión de M6-S02)

- [x] 1.1 Agregar `listarZonas()` a `src/features/locations/api/locales.api.ts` (llama `GET /api/zonas` sin filtro de `localId`)
- [x] 1.2 Agregar `useZonas()` a `src/features/locations/hooks/useLocales.ts` bajo `LOCATION_ADMIN_QUERY_KEYS.zonas`
- [x] 1.3 Extender `getServerErrorMessage` (o equivalente) en `useLocales.ts` para leer `error.response.data.message` también en status `400`, y usarlo en `useReactivarLocal`/`useReactivarZona`
- [x] 1.4 Tests: `useZonas()` devuelve zonas de todos los locales incluyendo inactivas; `useReactivarLocal`/`useReactivarZona` muestran el mensaje del backend en `400`

## 2. i18n

- [x] 2.1 Agregar claves nuevas bajo el namespace `locations` en `src/i18n/es-PE.json` (header, contadores, columnas, badges activo/inactivo, modales de confirmar/bloqueo, placeholders de rutas nuevas)
- [x] 2.2 Agregar las mismas claves (traducidas) en `src/i18n/en-US.json`

## 3. Componentes de presentación

- [x] 3.1 Crear `src/features/locations/components/ActivoBadge.tsx` (pill activo/inactivo, dark mode)
- [x] 3.2 Crear `src/features/locations/components/ZonaRow.tsx` (nombre, badge, indicador de incidentes bloqueantes, acciones editar/desactivar/reactivar según permisos)
- [x] 3.3 Crear `src/features/locations/components/LocalRow.tsx` (chevron, nombre, badge, dirección, contador de zonas, acciones editar/desactivar/reactivar; renderiza `ZonaRow[]` + enlace "Nueva zona" cuando está expandida)
- [x] 3.4 Crear `src/features/locations/components/ConfirmarDesactivarModal.tsx` (confirmación previa a desactivar, reutilizable para Local/Zona vía props)
- [x] 3.5 Crear `src/features/locations/components/BloqueoIncidentesModal.tsx` (desglose/conteo de incidentes bloqueantes tras un 409; nota explícita de "Ver incidentes" no funcional)

## 4. LocalList (contenedor)

- [x] 4.1 Crear `src/features/locations/components/LocalList.tsx`: combina `useLocales()` + `useZonas()` + `useIncidents({ pageSize: 500 })`, agrupa zonas por `localId`, calcula contadores e indicadores con `puedeDesactivarZona`
- [x] 4.2 Cablear estado de expansión de filas (un `Set<string>` o similar de `localId`s expandidos)
- [x] 4.3 Cablear permisos (`puedeAdministrarLocales`/`puedeConsultarLocales` desde `authStore`) para mostrar/ocultar botones de acción
- [x] 4.4 Cablear flujo de desactivar: abre `ConfirmarDesactivarModal` → al confirmar, `mutate` → éxito cierra modal y usa el toast ya emitido por el hook; error 409 abre `BloqueoIncidentesModal` con el mensaje del backend
- [x] 4.5 Cablear flujo de reactivar: `mutate` directo sin modal (el hook ya emite `toast.success`/`toast.error` con el mensaje del backend en 400)
- [x] 4.6 Cablear loading state (skeleton) y empty state
- [x] 4.7 Cablear botón "Nuevo local" (siempre habilitado, `navigate('/admin/locales/new')`) y enlace "Nueva zona" (`navigate('/admin/locales/:localId/zonas/new')`)
- [x] 4.8 Actualizar `src/features/locations/pages/LocalesAdminPage.tsx` para renderizar `LocalList` dentro de `PageWrapper` (título + acciones del header)

## 5. Routing

- [x] 5.1 Cambiar `src/features/locations/pages/LocalDetailPage.tsx` (o el registro en `src/router/index.tsx`) para que `/admin/locales/:id` renderice `<Navigate to="/admin/locales" replace />`
- [x] 5.2 Registrar `/admin/locales/new` (placeholder "Próximamente") antes de `/admin/locales/:id`, bajo el mismo `RoleGuard`
- [x] 5.3 Registrar `/admin/locales/:localId/zonas/new` (placeholder "Próximamente", con `useParams().localId`), bajo el mismo `RoleGuard`
- [x] 5.4 Actualizar `src/router/locationsAccess.test.tsx`: el caso de `/admin/locales/loc-001` debe verificar el redirect a `/admin/locales`, no el texto de detalle placeholder
- [x] 5.5 (adicional, aprobado por el usuario) Registrar `/admin/locales/:id/editar` y `/admin/locales/:localId/zonas/:zonaId/editar` como placeholders, destino de los botones "Editar" de `LocalRow`/`ZonaRow`

## 6. Tests de componente (LocalList)

- [x] 6.1 Renderizado con datos mockeados (locales + zonas + incidentes) vía MSW
- [x] 6.2 Expandir/colapsar una fila de Local muestra/oculta sus Zonas
- [x] 6.3 Ocultamiento de botones de acción y del botón "Nuevo local" para `JEFE_CALIDAD_SYST`
- [x] 6.4 Flujo de desactivación exitosa (200): modal de confirmación → confirmar → toast de éxito
- [x] 6.5 Flujo de desactivación bloqueada (409): modal de confirmación → confirmar → `BloqueoIncidentesModal` con el conteo del backend
- [x] 6.6 Flujo de reactivación exitosa sin modal, y flujo de reactivación bloqueada (400) con `toast.error` mostrando el mensaje del backend
- [x] 6.7 Loading state y empty state

## 7. Verificación

- [x] 7.1 `tsc --noEmit` sin errores
- [x] 7.2 `npm run lint` sin errores nuevos (24 errores/10 warnings preexistentes, ninguno en archivos tocados por esta spec)
- [x] 7.3 `npm test` (suite completa): 527/529 en verde. Los 2 tests que fallan (`qualityEventCreate.schema.test.ts`) y los 2 archivos con error de import (`DeadlineBadge.test.tsx`, `Pagination.test.tsx`, import roto a `../../i18n/config`) son preexistentes y no relacionados — confirmado sin cambios locales vía `git status`. Todos los tests de `locationsAccess.test.tsx` y `LocalList.test.tsx` pasan.
- [ ] 7.4 Verificación manual en navegador (Light/Dark mode) del flujo completo — NO realizada: no hay navegador headless disponible en este entorno (chromium-cli/Playwright no instalados). El servidor de desarrollo arranca correctamente (`npm run dev`, HTML servido en `:5173`), pero falta la verificación visual interactiva.
