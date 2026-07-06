# location-list-view

## Purpose

Vista de listado de Locales y Zonas para el módulo de administración (M6): `LocalList` reemplaza el placeholder de `LocalesAdminPage.tsx` con filas expandibles de Locales que muestran sus Zonas, contadores de activos, y acciones de administración (crear/editar/desactivar/reactivar) controladas por permiso de rol. TBD: detalle de layout y estilos específicos no cubierto aún por requisitos explícitos.

## Requirements

### Requirement: LocalList reemplaza el placeholder de administración con filas expandibles
`src/features/locations/pages/LocalesAdminPage.tsx` SHALL renderizar `LocalList` en vez del placeholder "Próximamente". `LocalList` SHALL mostrar un encabezado con el título "Locales y zonas", el contador "X de 5 locales activos" (calculado desde `useLocales()`) y, si `puedeAdministrarLocales(usuario)` es `true`, el botón "Nuevo local". Cada Local SHALL renderizarse como una fila con: chevron de expandir/colapsar, nombre, badge de estado (activo/inactivo), dirección, y el contador "X de Y zonas activas" (calculado agrupando `useZonas()` por `localId`).

#### Scenario: Encabezado muestra el contador de locales activos
- **WHEN** `useLocales()` resuelve 3 locales con `activo: true` y 2 con `activo: false`
- **THEN** el encabezado muestra "3 de 5 locales activos"

#### Scenario: Fila de Local muestra el contador de zonas activas
- **WHEN** un Local tiene 4 zonas asociadas, de las cuales 3 tienen `activo: true`
- **THEN** su fila colapsada muestra "3 de 4 zonas activas"

#### Scenario: Botón Nuevo local solo visible para quien puede administrar
- **WHEN** el usuario autenticado tiene rol `JEFE_CALIDAD_SYST` (solo `puedeConsultarLocales`)
- **THEN** el botón "Nuevo local" no se renderiza, pero el listado completo de Locales sí

---

### Requirement: Expandir una fila muestra las Zonas del Local con sus acciones
Al hacer clic en el chevron de una fila de Local, `LocalList` SHALL expandir esa fila mostrando la lista de sus Zonas: nombre, badge de estado (activo/inactivo), indicador numérico de incidentes activos (calculado con `puedeDesactivarZona(zona, incidentes)` sobre los incidentes obtenidos vía `useIncidents`) cuando ese número sea mayor a 0, y botones de editar/desactivar/reactivar por Zona según permisos. Al final de la lista de Zonas SHALL mostrar un enlace/botón "Nueva zona" (visible solo si `puedeAdministrarLocales(usuario)`).

#### Scenario: Expandir un Local muestra sus Zonas
- **WHEN** el usuario hace clic en el chevron de un Local con 2 zonas
- **THEN** la fila se expande mostrando ambas zonas con su nombre y badge de estado

#### Scenario: Colapsar oculta las Zonas
- **WHEN** el usuario hace clic nuevamente en el chevron de un Local ya expandido
- **THEN** la lista de Zonas de ese Local deja de mostrarse

#### Scenario: Indicador de incidentes activos visible cuando hay bloqueo
- **WHEN** una Zona tiene 2 incidentes en estado `ABIERTO`/`EN_INVESTIGACION`/`EN_EJECUCION`
- **THEN** su fila muestra el número "2" como indicador de incidentes activos

#### Scenario: Sin indicador cuando no hay incidentes bloqueantes
- **WHEN** una Zona no tiene incidentes en estados bloqueantes
- **THEN** no se muestra ningún indicador numérico junto a esa Zona

#### Scenario: Enlace Nueva zona solo visible para quien puede administrar
- **WHEN** el usuario autenticado solo tiene `puedeConsultarLocales`
- **THEN** el enlace "Nueva zona" al final de la lista expandida no se renderiza

---

### Requirement: Loading y empty state del listado
`LocalList` SHALL mostrar un estado de carga (skeleton) mientras `useLocales()` está en estado `isLoading`, y un estado vacío explícito si la lista resuelta de Locales está vacía.

#### Scenario: Skeleton visible durante la carga
- **WHEN** `useLocales()` está en estado `isLoading`
- **THEN** se renderiza un skeleton de filas en vez de la tabla de datos

#### Scenario: Estado vacío cuando no hay locales
- **WHEN** `useLocales()` resuelve una lista vacía
- **THEN** se muestra un mensaje de estado vacío en vez de filas

---

### Requirement: Botón Nuevo local siempre habilitado, navega a la ruta de creación
El botón "Nuevo local" SHALL estar siempre habilitado (no deshabilitado aunque ya existan 5 locales activos); la validación de RN-LOC-001 ocurre al enviar el formulario de creación (`M6-S04`), no en este botón. Al hacer clic, SHALL navegar a `/admin/locales/new`. El botón/enlace "Nueva zona" de un Local expandido SHALL navegar a `/admin/locales/:localId/zonas/new`.

#### Scenario: Nuevo local habilitado con 5 locales activos ya existentes
- **WHEN** ya existen 5 locales con `activo: true` y el usuario puede administrar
- **THEN** el botón "Nuevo local" se muestra habilitado (no deshabilitado)

#### Scenario: Clic en Nuevo local navega a la ruta de creación
- **WHEN** el usuario con permiso de administración hace clic en "Nuevo local"
- **THEN** la aplicación navega a `/admin/locales/new`

#### Scenario: Clic en Nueva zona navega a la ruta de creación de zona del local correspondiente
- **WHEN** el usuario hace clic en "Nueva zona" dentro del Local expandido `loc-001`
- **THEN** la aplicación navega a `/admin/locales/loc-001/zonas/new`

---

### Requirement: Desactivar Local/Zona exitoso requiere confirmación previa
Al hacer clic en el botón de desactivar (Local o Zona), `LocalList` SHALL mostrar un modal de confirmación simple antes de ejecutar la mutation correspondiente (`useDesactivarLocal`/`useDesactivarZona`). La mutation NO SHALL ejecutarse al solo hacer clic en el botón. Si la respuesta es exitosa (200), SHALL cerrarse el modal y mostrarse un `toast.success`.

#### Scenario: Clic en desactivar abre el modal sin ejecutar la mutation
- **WHEN** el usuario con permiso de administración hace clic en "Desactivar" sobre un Local activo
- **THEN** se muestra un modal de confirmación y la mutation de desactivar aún no se ha invocado

#### Scenario: Confirmar desactivación exitosa cierra el modal y muestra toast de éxito
- **WHEN** el usuario confirma la desactivación de una Zona sin incidentes bloqueantes
- **THEN** la mutation se ejecuta, el modal se cierra y se muestra un `toast.success`

#### Scenario: Cancelar el modal no ejecuta la mutation
- **WHEN** el usuario hace clic en "Cancelar" dentro del modal de confirmación de desactivar
- **THEN** el modal se cierra y la mutation de desactivar no se invoca

---

### Requirement: Desactivar bloqueado por incidentes activos (409) muestra modal de desglose
Si la mutation de desactivar (Local o Zona) responde con error HTTP `409`, `LocalList` SHALL mostrar un modal específico de bloqueo con el conteo de incidentes bloqueantes devuelto por el backend: para un Local, el desglose por Zona (o el conteo agregado si el backend no lo desglosa); para una Zona, el conteo simple. El modal SHALL incluir un elemento "Ver incidentes" documentado como no funcional (deshabilitado o con nota explícita) mientras `/incidents` no soporte filtrar por `localId`/`zonaId`.

#### Scenario: Desactivar un Local bloqueado por incidentes muestra el modal de bloqueo
- **WHEN** el usuario confirma la desactivación de un Local y el backend responde `409` con el mensaje de incidentes bloqueantes
- **THEN** se muestra un modal de bloqueo con el conteo de incidentes, distinto del modal de confirmación inicial

#### Scenario: Desactivar una Zona bloqueada por incidentes muestra el conteo simple
- **WHEN** el usuario confirma la desactivación de una Zona y el backend responde `409`
- **THEN** se muestra un modal de bloqueo con el conteo de incidentes bloqueantes de esa Zona

---

### Requirement: Reactivar Local/Zona se ejecuta sin confirmación previa
Al hacer clic en el botón de reactivar (Local o Zona), `LocalList` SHALL invocar directamente la mutation correspondiente (`useReactivarLocal`/`useReactivarZona`), sin modal de confirmación previo. Si el backend responde `400` (RN-LOC-001, ya existen 5 locales activos), SHALL mostrarse un `toast.error` con el mensaje descriptivo devuelto por el backend.

#### Scenario: Clic en reactivar ejecuta la mutation sin modal
- **WHEN** el usuario con permiso de administración hace clic en "Reactivar" sobre una Zona inactiva
- **THEN** la mutation se invoca inmediatamente, sin mostrarse ningún modal de confirmación

#### Scenario: Reactivar un Local bloqueado por el límite de 5 activos muestra el mensaje del backend
- **WHEN** el usuario hace clic en "Reactivar" sobre un Local inactivo y ya existen 5 locales activos
- **THEN** se muestra un `toast.error` con el mensaje devuelto por el backend (no un mensaje genérico)

---

### Requirement: Acciones de administración ocultas para usuarios de solo consulta
Los botones "Nuevo local", "Nueva zona", editar y desactivar/reactivar (Local y Zona) SHALL renderizarse únicamente si `puedeAdministrarLocales(usuario)` es `true`. Si el usuario solo tiene `puedeConsultarLocales(usuario)` (caso `JEFE_CALIDAD_SYST`), `LocalList` SHALL mostrar el listado completo de Locales y Zonas sin ninguno de esos botones.

#### Scenario: JEFE_CALIDAD_SYST ve el listado sin botones de acción
- **WHEN** un usuario con rol `JEFE_CALIDAD_SYST` visualiza `LocalList`
- **THEN** el listado completo de Locales y Zonas se muestra, pero ningún botón de crear/editar/desactivar/reactivar es visible

#### Scenario: ADMINISTRADOR_SISTEMA ve el listado con todos los botones de acción
- **WHEN** un usuario con rol `ADMINISTRADOR_SISTEMA` visualiza `LocalList`
- **THEN** los botones "Nuevo local", "Nueva zona", editar y desactivar/reactivar son visibles según el estado de cada fila
