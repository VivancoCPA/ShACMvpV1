## 1. i18n

- [x] 1.1 Agregar bloque `form` al namespace `locations` en `src/i18n/es-PE.json`: `form.fields.{nombre,direccion,plano,descripcion}`, `form.placeholders.*`, `form.actions.{submit,submitting,cancel}`, `form.plano.{dragHint,formatoInvalido,tamanoInvalido,reemplazar}`, `form.titles.{nuevoLocal,editarLocal,nuevaZona,editarZona}`, `form.errors.limiteLocalesActivos` (placeholder de fallback; el mensaje real viene del backend).
- [x] 1.2 Replicar el mismo bloque `form` en `src/i18n/en-US.json` con traducciones equivalentes.
- [x] 1.3 Eliminar las claves `placeholders.nuevoLocal`/`placeholders.nuevaZona` (namespace `locations`) en ambos archivos, ya sin uso tras retirar los `ComingSoon*`.

## 2. PlanoUploadField (campo de archivo PNG)

- [x] 2.1 Crear `src/features/locations/components/PlanoUploadField.tsx`: componente controlado (`value: File | null`, `onChange`, `existingFileName?`, `disabled?`) que valida en `onChange` tipo `image/png` y tamaño ≤2MB, mostrando el mensaje de error inline correspondiente sin esperar al submit.
- [x] 2.2 (Corregido — ver spec "Preview del plano cargado con thumbnail real") Implementar un thumbnail real (`<img>` vía `URL.createObjectURL`/equivalente) del archivo recién seleccionado, con botones "Reemplazar"/quitar; y mostrar automáticamente, sin acción del usuario, el thumbnail real desde `existingUrl` (`planoPngUrl`) en modo edición cuando no hay archivo nuevo seleccionado. Reemplaza la implementación previa de card+ícono genérico.
- [x] 2.3 Test unitario `PlanoUploadField.test.tsx`: rechaza `image/jpeg`, rechaza PNG >2MB, acepta PNG ≤2MB, muestra un thumbnail real (`<img>` con objectURL) tras seleccionar un PNG válido, muestra automáticamente el thumbnail real del `existingUrl` en modo edición sin selección nueva, y actualiza el thumbnail al seleccionar un archivo nuevo sobre uno existente.

## 3. LocalForm

- [x] 3.1 Crear `src/features/locations/components/LocalForm.tsx` con prop `mode: 'create' | 'edit'` y `local?: LocalConZonas`, usando `useForm<LocalFormInput>({ resolver: zodResolver(localFormSchema) })`; en modo `edit`, precargar `nombre`/`direccion` vía `defaultValues`/`reset` y pasar `existingUrl={local.planoPngUrl}` a `PlanoUploadField` (vía `Controller` para el campo `planoUrl`, ya que Zod espera `File`, no `FileList`) para que se muestre el thumbnail real automáticamente.
- [x] 3.2 Cablear el envío: en modo `create`, `useCrearLocal().mutateAsync(data)`; en modo `edit`, `useActualizarLocal().mutateAsync({ id: local.id, data })` — omitiendo `planoUrl` del payload si el usuario no seleccionó un archivo nuevo (RN-LOC: preservar `planoPngUrl` existente).
- [x] 3.3 En el `catch` del submit, si `isAxiosError(error) && error.response?.status === 400`, mostrar un banner de error inline en el formulario con `error.response.data.message` (RN-LOC-001); no suprimir el toast genérico que el hook ya dispara en paralelo.
- [x] 3.4 Al resolver exitosamente la mutation, `navigate('/admin/locales')` (sin disparar un `toast.success` adicional — ya lo hace el hook).
- [x] 3.5 Botón de envío: `disabled` mientras `isSubmitting` o `mutation.isPending`, texto "Guardando..." (`t('locations:form.actions.submitting')`) durante ese estado.
- [x] 3.6 Cada input con `<label htmlFor>` asociado; clases Tailwind con variante `dark:` en todos los elementos, siguiendo el patrón de `NCForm.tsx`/`IncidentForm.tsx`.
- [x] 3.7 Test `LocalForm.test.tsx`: modo create envía datos válidos y navega; modo edit precarga valores; edición sin nuevo archivo no envía `planoUrl`; error 400 al crear muestra el mensaje inline del backend; botón deshabilitado durante el envío.

## 4. LocalNewPage / LocalEditPage

- [x] 4.1 Crear `src/features/locations/pages/LocalNewPage.tsx`: verifica `puedeAdministrarLocales(user)` (si `false`, `useEffect` → `navigate('/admin/locales', { replace: true })`), y monta `<PageWrapper title={t('form.titles.nuevoLocal')}><LocalForm mode="create" onCancel={() => navigate('/admin/locales')} /></PageWrapper>`.
- [x] 4.2 Crear `src/features/locations/pages/LocalEditPage.tsx` siguiendo el patrón de `IncidentEditPage.tsx`: `useParams<{ id }>()`, `useLocal(id ?? '')`, `SkeletonBlock` mientras `isLoading`, estado "no encontrado" si `isError || !local`, redirect si `!puedeAdministrarLocales(user)`, y monta `<LocalForm mode="edit" local={local} onCancel={...} />`.
- [x] 4.3 Test de cada página: redirige a `/admin/locales` para `JEFE_CALIDAD_SYST`; renderiza el formulario para `ADMINISTRADOR_SISTEMA`; `LocalEditPage` muestra skeleton mientras carga y el formulario precargado al resolver.

## 5. ZonaForm y modal

- [x] 5.1 Crear `src/features/locations/components/ZonaForm.tsx` con prop `mode: 'create' | 'edit'`, `localId: string`, `zona?: Zona`, usando `useForm<ZonaFormInput>({ resolver: zodResolver(zonaFormSchema) })`; `localId` nunca se expone como campo editable (RN-ZON-001).
- [x] 5.2 Cablear el envío: modo `create` → `useCrearZona().mutateAsync({ localId, data })`; modo `edit` → `useActualizarZona().mutateAsync({ zonaId: zona.id, data })`. Al resolver, invocar el `onSaved`/`onClose` provisto por el modal contenedor (navega a `/admin/locales`).
- [x] 5.3 Botón de envío con estado "Guardando..." igual que `LocalForm`; labels asociados a cada input; sin `toast.success` propio (lo dispara el hook).
- [x] 5.4 Crear `src/features/locations/components/ZonaFormModal.tsx`: overlay `fixed inset-0 z-50 ...` (mismo patrón que `ConfirmarDesactivarModal.tsx`), con botón de cerrar (`X`) que navega a `/admin/locales`, envolviendo `<ZonaForm ... />`.
- [x] 5.5 Test `ZonaForm.test.tsx`/`ZonaFormModal.test.tsx`: crear zona invoca `useCrearZona` con el `localId` de la ruta; editar zona precarga `nombre`/`descripcion`; cerrar el modal (botón X) navega a `/admin/locales` sin invocar ninguna mutation.

## 6. ZonaFormPage (nueva/editar)

- [x] 6.1 Crear `src/features/locations/pages/ZonaFormPage.tsx`: lee `localId` (y `zonaId` si aplica) de `useParams()`, verifica `puedeAdministrarLocales(user)` (redirect si `false`), obtiene la zona a editar desde `useZonas()` filtrando por `zonaId` cuando corresponda, renderiza `<LocalesAdminPage />` de fondo y `<ZonaFormModal localId={localId} zona={zona} mode={zonaId ? 'edit' : 'create'} />` superpuesto.
- [x] 6.2 Test: navegar a `/admin/locales/:localId/zonas/new` muestra el listado de fondo con el modal en modo creación para ese `localId`; navegar a `.../zonas/:zonaId/editar` precarga la zona correspondiente en el modal.

## 7. Routing

- [x] 7.1 En `src/router/index.tsx`, reemplazar `LocalNewComingSoon` → `LocalNewPage`, `LocalEditComingSoon` → `LocalEditPage`, `ZonaNewComingSoon` → `ZonaFormPage`, `ZonaEditComingSoon` → `ZonaFormPage` (mismo componente, modo derivado de la presencia de `zonaId`) en las 4 rutas ya registradas (`/admin/locales/new`, `/admin/locales/:id/editar`, `/admin/locales/:localId/zonas/new`, `/admin/locales/:localId/zonas/:zonaId/editar`), sin cambiar los `path` ni el `RoleGuard` existente.
- [x] 7.2 Eliminar de `src/router/ComingSoonPages.tsx` los componentes `LocalNewComingSoon`, `LocalEditComingSoon`, `ZonaNewComingSoon`, `ZonaEditComingSoon` (y su import en `router/index.tsx`) una vez reemplazados; conservar `ComingSoon` genérico si otras rutas (`/dashboard`, `/usuarios`) lo siguen usando.
- [x] 7.3 Actualizar `src/router/locationsAccess.test.tsx` para reflejar el render real de los formularios en vez de los placeholders "Próximamente" en los casos que lo verificaban. (Sin cambios necesarios: el archivo no ejercitaba las 4 rutas de formulario directamente, solo `/admin/locales` y `/admin/locales/:id`; verificado con la suite completa en verde tras el cambio de routing.)

## 8. Verificación final

- [x] 8.1 Ejecutar la suite de tests del feature `locations` completa (`useLocales`, `LocalList`, nuevos componentes/páginas) y confirmar que todos pasan. (86/86 verdes, incluye `router/locationsAccess.test.tsx`. Fallos preexistentes no relacionados: `Pagination.test.tsx`/otro por import faltante `i18n/config`, y 2 casos de `qualityEventCreate.schema.test.ts` — ninguno toca archivos de este change. Re-ejecutado tras la corrección del thumbnail real del plano: 80/80 verdes en `src/features/locations`.)
- [x] 8.2 Ejecutar `tsc --noEmit` y confirmar ausencia de `any` y errores de tipos en los archivos nuevos/modificados. (Sin salida — 0 errores. Re-ejecutado tras la corrección del thumbnail real: sin salida, 0 errores.)
- [x] 8.3 Verificar manualmente en el navegador (Light y Dark mode): crear un Local con y sin plano, editar un Local preservando el plano existente, forzar el error de RN-LOC-001 (5 locales activos) y confirmar el mensaje inline, crear/editar una Zona desde el modal y confirmar que el listado expandido se actualiza sin refresh. (Verificado con Playwright headless contra el dev server real + MSW: los 4 flujos pasan sin errores de consola atribuibles a los componentes nuevos, en light y dark mode. Nota incidental — no relacionada a este change: se detectó un bug preexistente en el login — dos fixtures con `rol: 'SUPERVISOR'` comparten `key={u.rol}` en el selector de rol de `LoginPage.tsx`, y una condición de carrera justo tras el login dispara un error recuperable de React ["fewer hooks than expected"]; ocurre siempre, incluso sin tocar `/admin/locales`, fuera del alcance de esta spec. Pendiente: no se repitió la verificación manual en navegador específicamente para el thumbnail real tras la corrección — solo se confirmó vía tests unitarios/tsc.)
