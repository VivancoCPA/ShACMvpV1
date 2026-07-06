## Context

M6-S01/S02/S03 ya entregaron, sin cambios pendientes:
- `src/features/locations/schemas/localForm.schema.ts` (`localFormSchema`/`LocalFormInput`: `nombre`, `direccion`, `planoUrl` opcional con refine PNG/2MB, `planoAncho`/`planoAlto` opcionales) y `zonaForm.schema.ts` (`zonaFormSchema`/`ZonaFormInput`: `nombre`, `descripcion` opcional).
- `src/features/locations/api/locales.api.ts` y `src/features/locations/hooks/useLocales.ts`: `useCrearLocal`, `useActualizarLocal`, `useCrearZona`, `useActualizarZona`, `useLocal(id)` (detalle con zonas embebidas), `useLocales()`. Todas las mutations de crear/actualizar **ya invocan `toast.success`/`toast.error` genérico en `onSuccess`/`onError`** y ya invalidan las query keys correctas.
- `src/mocks/handlers/locales.handlers.ts`: `POST /api/locales` ya valida RN-LOC-001 (400 con mensaje descriptivo del conteo) y RN-LOC-003 (tipo/tamaño del plano) server-side.
- El router (`src/router/index.tsx:279-315`) ya registra las 4 rutas reales bajo `<RoleGuard requiredRoles={['ADMINISTRADOR_SISTEMA','JEFE_CALIDAD_SYST']}>`, apuntando hoy a placeholders `LocalNewComingSoon`/`LocalEditComingSoon`/`ZonaNewComingSoon`/`ZonaEditComingSoon` (`src/router/ComingSoonPages.tsx`). Estas 4 rutas fueron especificadas en `openspec/specs/routing/spec.md` explícitamente como placeholders "hasta que M6-S04 implemente LocalForm/ZonaForm".
- `LocalList.tsx` ya navega con `useNavigate()` a las 4 rutas (`handleEditarLocal`, `handleEditarZona`, `handleNuevaZona`, botón "Nuevo local") — no requiere cambios de callback, solo que las rutas destino ahora rendericen los formularios reales.
- El campo de tipo `Local` real (`src/features/incidents/types/incident.types.ts:77-86`) expone `planoPngUrl` (no `planoUrl` — ese nombre es solo el campo del formulario) y **no tiene `planoAncho`/`planoAlto`**; el MSW handler tampoco los usa nunca.

## Goals / Non-Goals

**Goals:**
- Reemplazar los 4 placeholders con formularios funcionales reutilizando 100% de los schemas/hooks/API ya existentes.
- Cumplir RN-LOC-003 (validación en vivo, no solo al submit) y RN-LOC-001 (validación server-side al submit, con mensaje claro en el formulario).
- Presentar ZonaForm como modal/panel superpuesto, preservando las rutas dedicadas ya especificadas (direccionabilidad y guards ya probados no deben romperse).

**Non-Goals:**
- No se modifica ningún schema, hook, cliente API o handler MSW existente.
- No se implementa preview real (thumbnail) del PNG — solo ícono genérico + nombre de archivo, por diseño explícito del pedido.
- No se resuelve aquí el auto-cálculo de `planoAncho`/`planoAlto` mencionado en `location-schemas` — ver Decisión 4.
- No se cambia el redirect de login de `ADMINISTRADOR_SISTEMA` (pendiente, spec separada).

## Decisions

### 1. Un componente `LocalForm` para crear y editar, en página completa
El template concreto a seguir es `src/features/incidents/components/IncidentForm.tsx` + `IncidentNewPage.tsx`/`IncidentEditPage.tsx` (no `DocumentForm`/`NCForm`): `IncidentForm` ya resuelve exactamente este caso — prop `mode: 'create' | 'edit'`, `isEdit = mode === 'edit'`, `defaultValues` por ternario, y usa hooks pre-construidos (`useCreateIncident`/`useUpdateIncident`) análogos a `useCrearLocal`/`useActualizarLocal`. `LocalForm` replica esa forma: prop `mode` + `local?: LocalConZonas`, un solo componente para alta y edición.

`LocalNewPage`/`LocalEditPage` (nuevas, en `src/features/locations/pages/`) replican el patrón exacto de `IncidentEditPage.tsx:20-66`: `useParams<{ id?: string }>()`, `useLocal(id ?? '')` para precargar, `SkeletonBlock` mientras `isLoading`, `useEffect` que redirige a `/admin/locales` si `!puedeAdministrarLocales(user)` (ver Decisión 5), y `PageWrapper` envolviendo `<LocalForm mode="edit" local={local} onCancel={...} />` dentro de `mx-auto max-w-3xl`.

**Alternativa descartada**: dos componentes separados (`LocalCreateForm`/`LocalEditForm`) — más código duplicado sin beneficio, ya que el 90% del formulario (campos, validación, plano) es idéntico.

### 2. `ZonaForm` se renderiza en modal, pero las rutas dedicadas se conservan
El texto del pedido dice que ZonaForm "no vive en su propia ruta", pero `router/index.tsx` y `openspec/specs/routing/spec.md` ya establecieron y testearon `/admin/locales/:localId/zonas/new` y `/admin/locales/:localId/zonas/:zonaId/editar` como rutas reales guardadas por rol. Romper esas rutas invalidaría specs ya archivadas y tests existentes (`locationsAccess.test.tsx`).

Resolución: `ZonaFormPage` (montada en esas 2 rutas) renderiza `<LocalesAdminPage />` de fondo (mismo listado, para dar la sensación de "panel sobre el listado") y superpone `ZonaFormModal` (mismo patrón visual `fixed inset-0 z-50 …` que `ConfirmarDesactivarModal`) con el `ZonaForm` dentro. Cerrar el modal (cancelar o guardar con éxito) navega a `/admin/locales` con `navigate('/admin/locales', { replace: true })`. Esto cumple la UX pedida (modal/panel) sin descartar la infraestructura de rutas ya construida y probada.

**Alternativa descartada**: modal 100% en estado de React dentro de `LocalList` sin cambiar rutas — requeriría reescribir `LocalList` y su navegación ya probada (fuera de alcance explícito: "no se debe modificar el listado expandible salvo el callback"), y dejaría las 2 rutas ya especificadas sin componente real, incumpliendo `routing/spec.md`.

### 3. RN-LOC-001 (límite de 5 activos) se muestra inline en el formulario, no solo vía toast
`useCrearLocal` ya dispara un `toast.error` genérico (`toasts.localCreateError`) en `onError`, y esta spec **no debe modificarlo**. Pero el pedido exige un mensaje claro con el conteo real ("ya existen 5 locales activos") en el formulario mismo. Por lo tanto `LocalForm`:
1. Llama `useCrearLocal().mutateAsync(data)` dentro de un `try/catch` propio en el submit handler (en vez de depender solo de `mutation.isError`).
2. En el `catch`, si `isAxiosError(error) && error.response?.status === 400`, extrae `error.response.data.message` y lo muestra en un banner inline sobre el formulario (mismo texto que devuelve el backend, sin reinterpretarlo — igual mecanismo que `getServerErrorMessage` en `useLocales.ts`, duplicado localmente en el componente porque el hook no expone ese helper).
3. El `toast.error` genérico del hook seguirá disparándose en paralelo (aceptado: no se puede evitar sin tocar el hook); el banner inline es el mensaje autoritativo que ve el usuario.

**Alternativa descartada**: modificar `useCrearLocal` para aceptar callbacks `onError` personalizados o exponer el mensaje — vetado explícitamente por el alcance de la spec ("no modificar los hooks de M6-S02").

### 4. Preview del plano: componente propio `PlanoUploadField`, sin leer dimensiones de imagen
Se crea `src/features/locations/components/PlanoUploadField.tsx`, inspirado en el patrón visual de `src/features/documents/components/FileUploadField.tsx` (ícono genérico 📄/🖼️ + nombre de archivo + botón quitar/reemplazar + error inline bajo el drop zone) pero **no se reutiliza ese componente directamente**: pertenece al dominio de documentos (tipos MIME de documentos, namespace `documents`, variantes `original`/`distribucion` no aplicables aquí). El nuevo componente valida únicamente `image/png` y ≤2MB, usando directamente `localFormSchema.shape.planoUrl` para el mensaje de error, y expone `existingFileName` para modo edición (deriva el nombre desde `planoPngUrl` del local existente vía `fileNameFromUrl`).

El formulario **no** calcula ni envía `planoAncho`/`planoAlto`: la API (`crearLocal`/`actualizarLocal` → `buildLocalFormData`) nunca los serializa y el MSW handler nunca los lee, así que serían datos muertos. Se documenta como gap conocido de `location-schemas` (los campos quedan declarados-pero-no-usados en el schema; no se remueven aquí porque tocar el schema está fuera de alcance y removerlos sería un cambio de contrato no pedido).

### 5. Guard adicional a nivel de página para `puedeAdministrarLocales`
El `RoleGuard` de ruta permite tanto a `ADMINISTRADOR_SISTEMA` como a `JEFE_CALIDAD_SYST` acceder a las 4 rutas (son las mismas para las que `puedeConsultarLocales` es `true`), pero solo `ADMINISTRADOR_SISTEMA` puede administrar (`puedeAdministrarLocales`). Si un `JEFE_CALIDAD_SYST` navega directamente a `/admin/locales/new` (o a una URL de edición/zona), las páginas nuevas deben redirigir a `/admin/locales` (mismo patrón que `LocalDetailPage.tsx` y que `IncidentEditPage.tsx:30-39`: `useEffect` que compara el permiso y llama `navigate('/admin/locales', { replace: true })`), en vez de mostrar el formulario a un rol de solo consulta.

### 6. Invalidación de cache y cierre del formulario
No se agrega lógica nueva de invalidación: `useCrearLocal`/`useActualizarLocal`/`useCrearZona`/`useActualizarZona` ya invalidan las query keys correctas (`LOCATION_ADMIN_QUERY_KEYS.list` / `.detail(id)`). El formulario solo necesita `await mutateAsync(...)` y luego `navigate('/admin/locales')` — el toast de éxito ya lo dispara el hook, no se debe duplicar con otro `toast.success` local.

### 7. Namespace `locations.form.*` nuevo en i18n
No existe hoy ningún bloque `form.*` en `locations` (solo `header`, `list`, `badges`, `actions`, `confirmarDesactivar`, `confirmarReactivar`, `bloqueoIncidentes`, `placeholders`, `toasts`). Se agrega `form.{fields,placeholders,actions,plano,zona}.*` en `es-PE.json` y `en-US.json`, siguiendo la forma ya usada en `incidents.form.*`. Las claves `placeholders.nuevoLocal`/`placeholders.nuevaZona` (usadas solo por los `ComingSoon*` que se eliminan) quedan sin uso y se remueven junto con esos placeholders.

### 8. Cuidado al importar `useLocales`
Existe un segundo hook homónimo de solo lectura en `src/features/incidents/hooks/useLocales.ts` (M3, filtra por `activo:true`). `LocalForm`/`ZonaForm` y sus páginas SIEMPRE importan desde `src/features/locations/hooks/useLocales.ts` (el admin, M6-S02) — nunca desde `features/incidents`.

## Risks / Trade-offs

- **[Riesgo]** El banner inline de RN-LOC-001 y el toast genérico del hook aparecen ambos al fallar por límite → mensaje duplicado en pantalla. **Mitigación**: aceptado explícitamente (ver Decisión 3); el banner inline es más específico y el toast desaparece solo tras unos segundos.
- **[Riesgo]** `ZonaFormPage` monta `LocalesAdminPage` completo de fondo solo para lograr el efecto visual de panel — doble fetch de `useLocales`/`useZonas` si el usuario navega directo a la URL sin pasar por el listado. **Mitigación**: aceptable porque TanStack Query cachea y las mismas query keys ya están en uso; no hay fetch duplicado innecesario más allá del primer mount.
- **[Riesgo]** Campos muertos `planoAncho`/`planoAlto` en el schema pueden confundir a un desarrollador futuro. **Mitigación**: documentado explícitamente aquí como gap conocido, no se toca el schema en esta spec.

## Open Questions

Ninguna bloqueante — decisiones tomadas arriba con alternativas explícitas para no frenar la implementación.
