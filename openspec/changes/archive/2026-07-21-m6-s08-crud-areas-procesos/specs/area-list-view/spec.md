## ADDED Requirements

### Requirement: AreaList renderiza el listado de administración en /admin/areas

El sistema SHALL exportar `AreaList` desde `src/features/areas/components/AreaList.tsx`, montado por `src/features/areas/pages/AreasAdminPage.tsx` en la ruta `/admin/areas`. `AreaList` SHALL mostrar una tabla simple (sin filas expandibles, a diferencia de `LocalList`) con columnas: nombre, descripción, estado (badge activo/inactivo), y una columna de acciones inline (editar/desactivar/reactivar). Si `puedeAdministrarAreas(usuario)` es `true`, SHALL mostrarse el botón "Nueva área" en el encabezado.

#### Scenario: Tabla muestra todas las áreas sin agrupar

- **WHEN** `useAreas()` resuelve 19 áreas
- **THEN** se renderizan 19 filas, cada una con nombre, descripción, badge de estado y acciones — sin ningún mecanismo de expandir/colapsar

#### Scenario: Botón Nueva área solo visible para quien puede administrar

- **WHEN** el usuario autenticado tiene un rol distinto de `ADMINISTRADOR_SISTEMA` (solo `puedeConsultarAreas`)
- **THEN** el botón "Nueva área" no se renderiza, pero la tabla completa de Áreas sí

---

### Requirement: Loading y empty state del listado

`AreaList` SHALL mostrar un estado de carga (skeleton) mientras `useAreas()` está en estado `isLoading`, y un estado vacío explícito si la lista resuelta está vacía.

#### Scenario: Skeleton visible durante la carga

- **WHEN** `useAreas()` está en estado `isLoading`
- **THEN** se renderiza un skeleton de filas en vez de la tabla de datos

#### Scenario: Estado vacío cuando no hay áreas

- **WHEN** `useAreas()` resuelve una lista vacía
- **THEN** se muestra un mensaje de estado vacío en vez de filas

---

### Requirement: Desactivar Área requiere confirmación previa

Al hacer clic en el botón de desactivar de una fila, `AreaList` SHALL mostrar un modal de confirmación simple antes de ejecutar `useDesactivarArea`. La mutation NO SHALL ejecutarse al solo hacer clic en el botón. Si la respuesta es exitosa (200), SHALL cerrarse el modal y mostrarse un `toast.success`.

#### Scenario: Clic en desactivar abre el modal sin ejecutar la mutation

- **WHEN** el usuario con permiso de administración hace clic en "Desactivar" sobre un Área activa
- **THEN** se muestra un modal de confirmación y la mutation de desactivar aún no se ha invocado

#### Scenario: Confirmar desactivación exitosa cierra el modal y muestra toast de éxito

- **WHEN** el usuario confirma la desactivación de un Área sin referencias bloqueantes
- **THEN** la mutation se ejecuta, el modal se cierra y se muestra un `toast.success`

#### Scenario: Cancelar el modal no ejecuta la mutation

- **WHEN** el usuario hace clic en "Cancelar" dentro del modal de confirmación
- **THEN** el modal se cierra y la mutation de desactivar no se invoca

---

### Requirement: Desactivar bloqueada por referencias activas (409) muestra modal con desglose por módulo

Si la mutation de desactivar responde con error HTTP `409`, `AreaList` SHALL mostrar un modal específico de bloqueo (`AreaBloqueoModal`) que renderiza el desglose por módulo del `conteo` (`AreaConteoBloqueo`) devuelto por el backend: una línea por cada uno de `qe`, `nc` e `incidentes` con conteo mayor a 0 (p. ej. "3 Quality Events activos", "1 No Conformidad activa", "2 Incidentes activos"), y el `total` agregado. Módulos con conteo `0` SHALL NOT mostrarse en el desglose.

#### Scenario: Desactivar un Área bloqueada por dos módulos muestra ambas líneas

- **WHEN** el usuario confirma la desactivación de un Área y el backend responde `409` con `conteo: { qe: 3, nc: 0, incidentes: 2, total: 5 }`
- **THEN** se muestra el modal de bloqueo con una línea para Quality Events (3) y otra para Incidentes (2), sin línea para No Conformidades

#### Scenario: Desactivar un Área bloqueada por un solo módulo

- **WHEN** el backend responde `409` con `conteo: { qe: 0, nc: 4, incidentes: 0, total: 4 }`
- **THEN** el modal de bloqueo muestra únicamente la línea de No Conformidades (4)

---

### Requirement: Reactivar Área se ejecuta sin confirmación previa

Al hacer clic en el botón de reactivar de una fila, `AreaList` SHALL invocar directamente `useReactivarArea`, sin modal de confirmación previo (consistente con Local/Zona, y sin ninguna validación de cupo a diferencia de `useReactivarLocal`).

#### Scenario: Clic en reactivar ejecuta la mutation sin modal

- **WHEN** el usuario con permiso de administración hace clic en "Reactivar" sobre un Área inactiva
- **THEN** la mutation se invoca inmediatamente, sin mostrarse ningún modal de confirmación, y no hay ningún escenario en el que esta mutation sea rechazada por cupo

---

### Requirement: Acciones de administración ocultas para usuarios de solo consulta

Los botones "Nueva área", editar y desactivar/reactivar SHALL renderizarse únicamente si `puedeAdministrarAreas(usuario)` es `true`. Cualquier usuario autenticado con `puedeConsultarAreas(usuario)` (es decir, todos los roles) SHALL ver la tabla completa de Áreas sin esos botones si no tiene permiso de administración.

#### Scenario: Rol distinto de ADMINISTRADOR_SISTEMA ve la tabla sin botones de acción

- **WHEN** un usuario con rol `JEFE_CALIDAD_SYST` visualiza `AreaList`
- **THEN** la tabla completa de Áreas se muestra, pero ningún botón de crear/editar/desactivar/reactivar es visible

#### Scenario: ADMINISTRADOR_SISTEMA ve la tabla con todos los botones de acción

- **WHEN** un usuario con rol `ADMINISTRADOR_SISTEMA` visualiza `AreaList`
- **THEN** los botones "Nueva área", editar y desactivar/reactivar son visibles según el estado de cada fila

---

### Requirement: Ítem de Sidebar visible solo para ADMINISTRADOR_SISTEMA

`Sidebar.tsx` SHALL agregar un ítem de navegación "Áreas" (enlazando a `/admin/areas`), visible únicamente cuando `usuario.rol === 'ADMINISTRADOR_SISTEMA'`, ubicado junto al ítem existente de "Usuarios". La ruta `/admin/areas` SHALL estar protegida por `RoleGuard requiredRoles={['ADMINISTRADOR_SISTEMA']}`.

#### Scenario: ADMINISTRADOR_SISTEMA ve el ítem Áreas en el Sidebar

- **WHEN** un usuario con rol `ADMINISTRADOR_SISTEMA` visualiza el Sidebar
- **THEN** el ítem "Áreas" es visible

#### Scenario: Otro rol no ve el ítem Áreas en el Sidebar

- **WHEN** un usuario con rol `JEFE_CALIDAD_SYST` visualiza el Sidebar
- **THEN** el ítem "Áreas" no es visible

#### Scenario: Navegación directa a /admin/areas sin el rol requerido redirige

- **WHEN** un usuario con rol distinto de `ADMINISTRADOR_SISTEMA` navega directamente a `/admin/areas`
- **THEN** es redirigido a `/no-autorizado`
