## ADDED Requirements

### Requirement: Sección "Seguridad de sesión" para ADMINISTRADOR_EMPRESA
La página `/usuarios` SHALL mostrar al ADMINISTRADOR_EMPRESA una sección "Seguridad de sesión" de su empresa activa, con dos campos: "Cierre por inactividad (minutos)" y "Duración máxima de sesión (horas)". Cada campo SHALL:
- mostrar debajo el rango permitido y el valor global;
- ofrecer la opción "Usar valor por defecto del sistema", que envía `null`.

La sección SHALL mostrar quién hizo el último cambio y cuándo, con la fecha formateada con `Intl.DateTimeFormat` en el idioma activo.

#### Scenario: Usar valor por defecto
- **WHEN** el administrador marca "Usar valor por defecto del sistema" en inactividad y guarda
- **THEN** se envía `inactividadMinutos: null` y el campo muestra el valor global como deshabilitado

### Requirement: Validación del formulario con los límites del servidor
Los formularios de configuración SHALL usar React Hook Form y un schema Zod construido con los límites que devuelve el servidor (nunca constantes duplicadas). El schema SHALL validar:
- cada valor dentro de su rango;
- que la sesión máxima, en minutos, sea mayor o igual que la inactividad efectiva.

Los errores SHALL mostrarse localizados.

#### Scenario: Valor fuera de rango en el formulario
- **WHEN** el usuario escribe `2` en inactividad con un mínimo de 5
- **THEN** el formulario muestra el error de rango y no envía la petición

#### Scenario: Sesión máxima menor que la inactividad
- **WHEN** el usuario escribe inactividad 120 y sesión máxima 1
- **THEN** el formulario muestra el error en sesión máxima y no envía la petición

### Requirement: Parámetros globales para SUPERADMIN
La ruta `/admin/parametros-sesion` SHALL ser accesible solo para SUPERADMIN (entrada en Sidebar y `RoleGuard`). SHALL permitir editar los valores por defecto y los límites mínimo/máximo de inactividad y de sesión máxima, con validación de `min ≤ default ≤ max`, y SHALL mostrar el último cambio.

#### Scenario: Otro rol intenta acceder
- **WHEN** un ADMINISTRADOR_EMPRESA navega a `/admin/parametros-sesion`
- **THEN** es redirigido a `/no-autorizado`

### Requirement: SUPERADMIN edita la configuración de cualquier empresa
Cada fila de la lista `/admin/empresas` SHALL ofrecer al SUPERADMIN la acción "Seguridad de sesión", con ícono y `aria-label`. La acción SHALL abrir un modal con el mismo formulario de configuración de la empresa.

#### Scenario: Abrir la configuración de una empresa
- **WHEN** el SUPERADMIN pulsa "Seguridad de sesión" en la fila de una empresa
- **THEN** se abre un modal con la configuración de esa empresa, cargada desde `GET /api/empresas/{id}/seguridad-sesion`
