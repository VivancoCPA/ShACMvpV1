## ADDED Requirements

### Requirement: AreaForm cubre creación y edición en un único componente

El sistema SHALL exportar `AreaForm` desde `src/features/areas/components/AreaForm.tsx`, un único componente con prop `mode: 'create' | 'edit'` (y `area?: Area` en modo `edit`) que renderiza los campos `nombre` (texto, requerido) y `descripcion` (texto, opcional), validados con `areaFormSchema` vía `useForm` + `zodResolver`. `src/features/areas/pages/AreaNewPage.tsx` SHALL montar `<AreaForm mode="create" />` en la ruta `/admin/areas/new`, y `src/features/areas/pages/AreaEditPage.tsx` SHALL montar `<AreaForm mode="edit" area={area} />` en `/admin/areas/:id/editar`, precargando `area` vía `useArea(id)`.

#### Scenario: Formulario de creación arranca vacío

- **WHEN** un usuario con permiso de administración navega a `/admin/areas/new`
- **THEN** se renderiza `AreaForm` en modo `create` con los campos `nombre` y `descripcion` vacíos

#### Scenario: Formulario de edición precarga los valores del Área

- **WHEN** un usuario con permiso de administración navega a `/admin/areas/area-001/editar` y `useArea('area-001')` resuelve un Área con `nombre: 'Almacén Norte'`
- **THEN** `AreaForm` se renderiza en modo `edit` con ese valor precargado en el campo `nombre`

#### Scenario: Loading mientras se obtiene el Área en modo edición

- **WHEN** `useArea(id)` está en estado `isLoading` en `/admin/areas/:id/editar`
- **THEN** se muestra un estado de carga (skeleton) en vez del formulario

---

### Requirement: Envío bloqueado por nombre duplicado (RN-ARE-004) muestra error inline

Si el backend responde con error HTTP `409` al crear o editar (nombre duplicado), `AreaForm` SHALL mostrar un mensaje de error inline dentro del formulario, asociado al campo `nombre`, usando el mensaje descriptivo devuelto por el backend, en vez de solo un toast genérico.

#### Scenario: Envío bloqueado por nombre duplicado muestra error en el campo

- **WHEN** el usuario envía el formulario de creación con un `nombre` que ya existe en el catálogo (distinta capitalización) y el backend responde `409`
- **THEN** `AreaForm` muestra un mensaje de error inline asociado al campo `nombre`, con el texto descriptivo devuelto por el backend

#### Scenario: Envío exitoso con nombre no duplicado

- **WHEN** el usuario envía el formulario de creación con un `nombre` no existente en el catálogo
- **THEN** el Área se crea exitosamente y no se muestra ningún mensaje de error

---

### Requirement: Guardado exitoso redirige al listado con confirmación

Al guardar exitosamente (crear o editar) un Área, `AreaForm` SHALL navegar a `/admin/areas`. La invalidación de la query de listado y el `toast.success` de confirmación SHALL producirse a través de los hooks `useCrearArea`/`useActualizarArea` ya existentes (sin duplicar un segundo toast desde el propio componente), de modo que la fila correspondiente en el listado refleje los datos actualizados sin requerir un refresh manual.

#### Scenario: Crear un Área exitosamente redirige y actualiza el listado

- **WHEN** el usuario completa el formulario de creación con datos válidos y lo envía
- **THEN** la aplicación navega a `/admin/areas`, se muestra un `toast.success`, y la nueva Área aparece en el listado sin recargar la página

#### Scenario: Editar un Área exitosamente redirige y actualiza la fila

- **WHEN** el usuario edita la `descripcion` de un Área existente y guarda
- **THEN** la aplicación navega a `/admin/areas` y la fila de esa Área en el listado muestra la nueva `descripcion` sin recargar la página

---

### Requirement: Estado de carga del botón de envío

El botón de envío de `AreaForm` SHALL deshabilitarse y mostrar el texto "Guardando..." mientras la mutación de creación/actualización está en curso (`isSubmitting` del formulario o `isPending` de la mutation correspondiente).

#### Scenario: Botón deshabilitado durante el guardado

- **WHEN** el usuario envía el formulario y la mutation de creación aún no resuelve
- **THEN** el botón de envío está deshabilitado y muestra el texto "Guardando..."

---

### Requirement: Acceso restringido a solo administradores en las páginas de formulario

`AreaNewPage` y `AreaEditPage` SHALL redirigir a `/admin/areas` si `puedeAdministrarAreas(usuario)` es `false`, sin mostrar el formulario a un usuario de solo consulta (a diferencia del guard de ruta de Local/Zona, aquí el guard de ruta de nivel superior ya exige `ADMINISTRADOR_SISTEMA` — ver `area-list-view` — por lo que esta redirección interna es una capa de defensa adicional consistente con el mismo patrón, no una relajación del guard de ruta).

#### Scenario: ADMINISTRADOR_SISTEMA accede sin redirección

- **WHEN** un usuario con rol `ADMINISTRADOR_SISTEMA` navega a `/admin/areas/new`
- **THEN** el formulario `AreaForm` se renderiza sin redirección
