## ADDED Requirements

### Requirement: TopNav muestra el nombre de la empresa activa; el control de cambio solo aparece con más de una empresa asignada
El sistema SHALL mostrar en `TopNav` el nombre (`razonSocial`) de la empresa activa siempre que `authStore` tenga una empresa activa resuelta, independientemente de cuántas empresas tenga asignadas el usuario. El control interactivo para cambiar de empresa (botón con chevron + dropdown de opciones) SHALL aparecer únicamente cuando `authStore.empresasDisponibles` tiene más de un elemento — con una sola empresa asignada, el nombre se muestra como texto simple, sin control de cambio (no hay entre qué cambiar). Al elegir una empresa distinta a la activa desde el control, el sistema SHALL invocar el flujo de cambio de empresa (`empresa-session`: `switch-empresa`, limpieza de caché, redirect condicional) sin cerrar la sesión.

#### Scenario: Usuario de una sola empresa ve el nombre sin control de cambio
- **WHEN** `user-operario-001` (asignado únicamente a `empresa-001`) está autenticado
- **THEN** `TopNav` muestra "Minera Andina del Sur S.A.C." como texto
- **THEN** no hay botón ni dropdown asociado a ese texto — no es interactivo

#### Scenario: Usuario multi-empresa ve el nombre con control de cambio
- **WHEN** `user-supervisor-001` (asignado a `empresa-001` y `empresa-002`) está autenticado
- **THEN** `TopNav` muestra la empresa activa como un botón con chevron, que al hacer click despliega ambas opciones

#### Scenario: Elegir otra empresa dispara el cambio de contexto
- **WHEN** el usuario multi-empresa abre el control y elige una empresa distinta a la activa
- **THEN** se invoca el cambio de empresa activa (sin navegar a `/login`, sin perder la sesión)

#### Scenario: Badge de rol en TopNav refleja el rol de la nueva empresa tras el cambio
- **WHEN** `user-supervisor-001` cambia de `empresa-001` (`SUPERVISOR`) a `empresa-002` (`JEFE_CALIDAD_SYST`) usando el control de cambio
- **THEN** el badge de rol junto al nombre del usuario en `TopNav` pasa a mostrar `JEFE_CALIDAD_SYST`

---

### Requirement: Sidebar se refiltra automáticamente tras un cambio de empresa activa
El sistema SHALL re-evaluar en render-time los ítems visibles del sidebar cuando `authStore.user.rol` cambia como consecuencia de un cambio de empresa activa — mismo mecanismo de filtrado por rol ya existente, sin recarga de página.

#### Scenario: Ítems del sidebar cambian tras el switch de empresa
- **WHEN** `user-supervisor-001` cambia de `empresa-001` (`SUPERVISOR`, sin ítem "Usuarios") a una empresa donde su rol resuelto fuera `ADMINISTRADOR_SISTEMA`
- **THEN** el ítem "Usuarios" aparece en el sidebar sin necesidad de recargar la página

#### Scenario: Ítems del sidebar no parpadean para usuarios mono-empresa
- **WHEN** un usuario con una sola empresa asignada navega por la aplicación
- **THEN** el sidebar se comporta exactamente igual que antes de esta fase, sin ningún cambio observable
