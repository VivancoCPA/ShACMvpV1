## ADDED Requirements

### Requirement: LocalForm reemplaza los placeholders de creación y edición de Local
El sistema SHALL exportar `LocalForm` desde `src/features/locations/components/LocalForm.tsx`, un único componente con prop `mode: 'create' | 'edit'` (y `local?: LocalConZonas` en modo `edit`) que renderiza los campos `nombre` (texto, requerido), `direccion` (texto, requerido) y `planoUrl` (archivo PNG opcional), validados con `localFormSchema` vía `useForm` + `zodResolver`. `src/features/locations/pages/LocalNewPage.tsx` SHALL montar `<LocalForm mode="create" />` en la ruta `/admin/locales/new`, y `src/features/locations/pages/LocalEditPage.tsx` SHALL montar `<LocalForm mode="edit" local={local} />` en `/admin/locales/:id/editar`, precargando `local` vía `useLocal(id)`.

#### Scenario: Formulario de creación arranca vacío
- **WHEN** un usuario con permiso de administración navega a `/admin/locales/new`
- **THEN** se renderiza `LocalForm` en modo `create` con los campos `nombre` y `direccion` vacíos y sin plano cargado

#### Scenario: Formulario de edición precarga los valores del Local
- **WHEN** un usuario con permiso de administración navega a `/admin/locales/loc-001/editar` y `useLocal('loc-001')` resuelve un Local con `nombre: 'Almacén Sur'` y `direccion: 'Av. Industrial 450'`
- **THEN** `LocalForm` se renderiza en modo `edit` con esos valores precargados en los campos correspondientes

#### Scenario: Loading mientras se obtiene el Local en modo edición
- **WHEN** `useLocal(id)` está en estado `isLoading` en `/admin/locales/:id/editar`
- **THEN** se muestra un estado de carga (skeleton) en vez del formulario

---

### Requirement: Validación en vivo del plano PNG (RN-LOC-003)
El campo `planoUrl` de `LocalForm` SHALL validarse en el momento de seleccionar el archivo (no solo al enviar el formulario), rechazando cualquier archivo cuyo tipo MIME no sea `image/png` o cuyo tamaño supere 2 MB, y mostrando el mensaje de error correspondiente inline, debajo del campo, sin bloquear la edición del resto del formulario.

#### Scenario: Seleccionar un PNG válido no muestra error
- **WHEN** el usuario selecciona un archivo `image/png` de 1 MB en el campo de plano
- **THEN** no se muestra ningún mensaje de error y el archivo queda seleccionado

#### Scenario: Seleccionar un archivo que no es PNG muestra error inline inmediato
- **WHEN** el usuario selecciona un archivo `image/jpeg` en el campo de plano
- **THEN** se muestra inline un mensaje indicando que solo se acepta formato PNG, sin necesidad de enviar el formulario

#### Scenario: Seleccionar un PNG mayor a 2MB muestra error inline inmediato
- **WHEN** el usuario selecciona un archivo `image/png` de 2.5 MB en el campo de plano
- **THEN** se muestra inline un mensaje indicando que el archivo no debe superar 2 MB, sin necesidad de enviar el formulario

---

### Requirement: Preview del plano cargado con thumbnail real
Al seleccionar un archivo de plano PNG válido, `LocalForm` SHALL mostrar un thumbnail real de la imagen cargada (p.ej. mediante `URL.createObjectURL` o equivalente) — nunca un ícono genérico con solo el nombre del archivo. En modo edición, si el Local ya tiene `planoPngUrl` y el usuario no ha seleccionado un archivo nuevo, SHALL mostrarse automáticamente al abrir el formulario, sin acción del usuario, el thumbnail real del plano ya guardado. Si en modo edición el usuario selecciona un plano nuevo, el thumbnail SHALL actualizarse para reflejar el archivo recién seleccionado, reemplazando cualquier preview anterior.

#### Scenario: Thumbnail real tras seleccionar un plano válido
- **WHEN** el usuario selecciona `plano-almacen.png` (PNG válido) en el campo de plano
- **THEN** se muestra un `<img>` con el contenido real del archivo cargado (vía `URL.createObjectURL` o equivalente), reemplazando cualquier preview anterior

#### Scenario: Thumbnail real del plano existente se muestra automáticamente en modo edición
- **WHEN** se abre `LocalForm` en modo `edit` para un Local cuyo `planoPngUrl` es `/mock/plano-loc-001.png` y el usuario no ha seleccionado ningún archivo nuevo
- **THEN** se muestra automáticamente, sin acción del usuario, un `<img>` con el thumbnail real cargado desde `planoPngUrl`

#### Scenario: Subir un plano nuevo en modo edición actualiza el thumbnail
- **WHEN** en modo `edit`, tras verse el thumbnail del `planoPngUrl` existente, el usuario selecciona un nuevo archivo PNG válido
- **THEN** el thumbnail se actualiza mostrando el contenido real del archivo recién seleccionado, reemplazando el thumbnail anterior

---

### Requirement: Reemplazo de plano opcional en modo edición
En modo `edit`, si el usuario no selecciona un archivo de plano nuevo, `LocalForm` SHALL enviar la actualización sin el campo `planoUrl`, preservando el `planoPngUrl` existente del Local sin modificarlo.

#### Scenario: Guardar edición sin tocar el plano preserva el existente
- **WHEN** el usuario edita solo el campo `direccion` de un Local que ya tiene `planoPngUrl` y guarda sin seleccionar un archivo nuevo
- **THEN** `useActualizarLocal().mutate` se invoca con un payload que no incluye `planoUrl`, y el Local resultante conserva su `planoPngUrl` original

---

### Requirement: Validación de RN-LOC-001 (máximo 5 locales activos) al enviar
`LocalForm` en modo `create` SHALL permitir siempre intentar el envío (ningún control de la UI se deshabilita por adelantado en base al conteo de locales activos). Si el backend responde con error HTTP 400 al crear (RN-LOC-001), `LocalForm` SHALL mostrar un mensaje de error inline y claro dentro del formulario, indicando el máximo permitido (5) y que ya existen ese número de locales activos, usando el mensaje descriptivo devuelto por el backend.

#### Scenario: Envío exitoso con menos de 5 locales activos
- **WHEN** existen 4 locales activos y el usuario envía el formulario de creación con datos válidos
- **THEN** el Local se crea exitosamente y no se muestra ningún mensaje de error de límite

#### Scenario: Envío bloqueado con 5 locales activos ya existentes
- **WHEN** ya existen 5 locales activos y el usuario envía el formulario de creación
- **THEN** el backend responde 400 y `LocalForm` muestra un mensaje inline con el texto descriptivo devuelto por el backend (incluyendo el conteo), en vez de solo un toast genérico

---

### Requirement: Guardado exitoso redirige al listado con confirmación
Al guardar exitosamente (crear o editar) un Local, `LocalForm` SHALL navegar a `/admin/locales`. La invalidación de la query de listado y el `toast.success` de confirmación SHALL producirse a través de los hooks `useCrearLocal`/`useActualizarLocal` ya existentes (sin duplicar un segundo toast desde el propio componente), de modo que la fila correspondiente en el listado refleje los datos actualizados sin requerir un refresh manual.

#### Scenario: Crear un Local exitosamente redirige y actualiza el listado
- **WHEN** el usuario completa el formulario de creación con datos válidos y lo envía
- **THEN** la aplicación navega a `/admin/locales`, se muestra un `toast.success`, y el nuevo Local aparece en el listado sin recargar la página

#### Scenario: Editar un Local exitosamente redirige y actualiza la fila
- **WHEN** el usuario edita el `nombre` de un Local existente y guarda
- **THEN** la aplicación navega a `/admin/locales` y la fila de ese Local en el listado muestra el nuevo `nombre` sin recargar la página

---

### Requirement: Estado de carga del botón de envío
El botón de envío de `LocalForm` y de `ZonaForm` SHALL deshabilitarse y mostrar el texto "Guardando..." mientras la mutación de creación/actualización está en curso (`isSubmitting` del formulario o `isPending` de la mutation correspondiente).

#### Scenario: Botón deshabilitado durante el guardado
- **WHEN** el usuario envía el formulario y la mutation de creación aún no resuelve
- **THEN** el botón de envío está deshabilitado y muestra el texto "Guardando..."

---

### Requirement: ZonaForm se presenta en modal/panel sobre el listado
El sistema SHALL exportar `ZonaForm` desde `src/features/locations/components/ZonaForm.tsx` con los campos `nombre` (texto, requerido) y `descripcion` (texto, opcional), validados con `zonaFormSchema`. `ZonaForm` SHALL renderizarse dentro de un modal (`ZonaFormModal`, mismo patrón visual que `ConfirmarDesactivarModal`) montado por `src/features/locations/pages/ZonaFormPage.tsx` en las rutas `/admin/locales/:localId/zonas/new` y `/admin/locales/:localId/zonas/:zonaId/editar`, con el listado de Locales (`LocalesAdminPage`) visible de fondo. El `localId` del Local padre SHALL obtenerse de `useParams()` y pasarse implícitamente a la mutation, sin exponer un control editable para reasignarlo (RN-ZON-001).

#### Scenario: Nueva zona muestra el modal sobre el listado
- **WHEN** un usuario con permiso de administración navega a `/admin/locales/loc-001/zonas/new`
- **THEN** se renderiza el listado de Locales de fondo con el modal `ZonaForm` superpuesto, en modo creación, para el Local `loc-001`

#### Scenario: localId no es editable por el usuario
- **WHEN** se abre `ZonaForm` en modo creación para el Local `loc-001`
- **THEN** el formulario no expone ningún campo o control para cambiar el Local al que pertenece la zona

#### Scenario: Editar zona precarga sus valores en el modal
- **WHEN** un usuario navega a `/admin/locales/loc-001/zonas/zon-005/editar` y la zona `zon-005` tiene `nombre: 'Zona de Carga'` y `descripcion: 'Área de carga y descarga'`
- **THEN** el modal `ZonaForm` se renderiza en modo edición con esos valores precargados

---

### Requirement: Guardado de Zona exitoso cierra el modal e invalida el detalle del Local
Al guardar exitosamente (crear o editar) una Zona, `ZonaForm` SHALL cerrar el modal navegando a `/admin/locales`. La invalidación de la query de detalle del Local padre y el `toast.success` de confirmación SHALL producirse a través de los hooks `useCrearZona`/`useActualizarZona` ya existentes, de modo que el listado expandido de Zonas de ese Local refleje los datos actualizados sin requerir un refresh manual.

#### Scenario: Crear una zona exitosamente cierra el modal y actualiza el listado expandido
- **WHEN** el usuario completa el formulario de nueva zona para el Local `loc-001` con datos válidos y lo envía
- **THEN** el modal se cierra, la aplicación navega a `/admin/locales`, se muestra un `toast.success`, y la nueva zona aparece en la lista expandida de `loc-001` sin recargar la página

---

### Requirement: Acceso restringido a solo administradores en las páginas de formulario
Aunque el guard de ruta permite tanto a `ADMINISTRADOR_SISTEMA` como a `JEFE_CALIDAD_SYST` acceder a las rutas de creación/edición (mismo conjunto que `puedeConsultarLocales`), las páginas `LocalNewPage`, `LocalEditPage` y `ZonaFormPage` SHALL redirigir a `/admin/locales` si `puedeAdministrarLocales(usuario)` es `false`, sin mostrar el formulario a un usuario de solo consulta.

#### Scenario: JEFE_CALIDAD_SYST es redirigido al navegar directo a la URL de creación
- **WHEN** un usuario con rol `JEFE_CALIDAD_SYST` navega directamente a `/admin/locales/new`
- **THEN** es redirigido a `/admin/locales` sin ver el formulario

#### Scenario: ADMINISTRADOR_SISTEMA accede sin redirección
- **WHEN** un usuario con rol `ADMINISTRADOR_SISTEMA` navega a `/admin/locales/new`
- **THEN** el formulario `LocalForm` se renderiza sin redirección
