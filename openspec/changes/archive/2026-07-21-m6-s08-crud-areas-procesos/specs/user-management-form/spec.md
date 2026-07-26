## MODIFIED Requirements

### Requirement: Formulario único de alta y edición de usuario

`src/features/users/components/UserFormModal.tsx` SHALL implementar un único formulario (React Hook Form + Zod) reutilizado tanto para alta como para edición, distinguiendo el modo por la presencia de un `userId` inicial. El campo de contraseña inicial SHALL mostrarse únicamente en modo alta; en modo edición no SHALL existir ningún campo de contraseña. Los campos `area` (single-select) y `areasAsignadas` (checkbox-grid multi-select) SHALL poblarse desde `useAreas()` (`area-admin-hooks`, M6-S08) en vez de `AREAS_SHAC.map`, mostrando `Area.nombre` como etiqueta visible y enviando `Area.id` como valor (`areaId`/`areaIds`).

#### Scenario: Modo alta no precarga campos

- **WHEN** el admin abre el formulario para crear un usuario nuevo
- **THEN** todos los campos aparecen vacíos y el formulario está en modo alta

#### Scenario: Modo edición precarga los datos del usuario

- **WHEN** el admin abre el formulario para editar un usuario existente
- **THEN** los campos `nombre`, `apellido`, `email`, `rol`, `areaId` y `areaIds` aparecen precargados con los valores actuales del usuario, y el combobox de `areaId` muestra el `nombre` del Área correspondiente (resuelto vía `useAreas()`), no su `id`

#### Scenario: Campo areaIds solo aparece para rol SUPERVISOR

- **WHEN** el admin selecciona `rol: 'SUPERVISOR'` en el formulario (alta o edición)
- **THEN** los campos `areaId` y `areaIds` se vuelven visibles y requeridos

#### Scenario: Opciones de área provienen del catálogo administrado, no de una constante estática

- **WHEN** un `ADMINISTRADOR_SISTEMA` crea una Área nueva en `/admin/areas` y luego un admin abre `UserFormModal`
- **THEN** la Área recién creada aparece como opción en los combobox de `areaId` y `areaIds`, sin requerir un despliegue de código
