## ADDED Requirements

### Requirement: Parámetros globales de sesión editables sin desplegar
El sistema SHALL persistir en la base de datos una única fila de parámetros globales de sesión con: inactividad por defecto, mínima y máxima (minutos), y sesión máxima por defecto, mínima y máxima (horas), más quién y cuándo los actualizó por última vez. Los valores semilla SHALL ser: inactividad 30 (mín. 5, máx. 240) y sesión máxima 12 (mín. 1, máx. 24). Estos valores SHALL NOT leerse de `appsettings`.

#### Scenario: Base de datos recién migrada
- **WHEN** se aplica la migración en una base sin parámetros
- **THEN** `GET /api/sistema/parametros-sesion` devuelve `inactividadDefaultMinutos: 30`, `inactividadMinMinutos: 5`, `inactividadMaxMinutos: 240`, `sesionMaximaDefaultHoras: 12`, `sesionMaximaMinHoras: 1`, `sesionMaximaMaxHoras: 24`

### Requirement: Solo SUPERADMIN edita los parámetros globales
`GET` y `PUT /api/sistema/parametros-sesion` SHALL estar restringidos a SUPERADMIN (otros roles → 403). El `PUT` SHALL validar:
- cada límite dentro del rango absoluto (inactividad 5–1440 min, sesión máxima 1–168 h);
- `min ≤ default ≤ max` en cada par;
- `sesionMaximaDefaultHoras × 60 ≥ inactividadDefaultMinutos`.

Si una validación falla, responde 400 con un error por campo.

#### Scenario: SUPERADMIN cambia la sesión máxima por defecto
- **WHEN** un SUPERADMIN hace `PUT` con `sesionMaximaDefaultHoras: 1` y el resto de los valores válidos
- **THEN** la respuesta es 200 y un `GET` posterior devuelve `sesionMaximaDefaultHoras: 1`, con `actualizadoPorId` igual al SUPERADMIN

#### Scenario: Default fuera de sus límites
- **WHEN** un SUPERADMIN envía `inactividadDefaultMinutos: 300` con `inactividadMaxMinutos: 240`
- **THEN** la respuesta es 400 y `errors` incluye una entrada que empieza por `inactividadDefaultMinutos:`

#### Scenario: Rol no autorizado
- **WHEN** un ADMINISTRADOR_EMPRESA hace `PUT /api/sistema/parametros-sesion`
- **THEN** la respuesta es 403

### Requirement: Configuración de sesión por empresa
`GET` y `PUT /api/empresas/{id}/seguridad-sesion` SHALL leer y actualizar `inactividadMinutos` y `sesionMaximaHoras` de la empresa. Ambos campos son nulables: `null` significa usar el valor global. Acceso:
- ADMINISTRADOR_EMPRESA, solo cuando `id` es su empresa activa; si no lo es, responde 404;
- SUPERADMIN, para cualquier empresa existente; si la empresa no existe, responde 404;
- cualquier otro rol recibe 403.

La respuesta SHALL incluir:
- los valores configurados;
- la política efectiva;
- los parámetros globales (default y límites);
- quién y cuándo hizo el último cambio.

#### Scenario: ADMINISTRADOR_EMPRESA configura su empresa
- **WHEN** un ADMINISTRADOR_EMPRESA hace `PUT /api/empresas/{suEmpresa}/seguridad-sesion` con `{ inactividadMinutos: 5, sesionMaximaHoras: null }`
- **THEN** la respuesta es 200 con `inactividadMinutos: 5`, `sesionMaximaHoras: null`, `efectiva.inactividadMinutos: 5`, `efectiva.sesionMaximaHoras` igual al default global, y `actualizadoPorId` igual al administrador

#### Scenario: ADMINISTRADOR_EMPRESA intenta editar otra empresa
- **WHEN** un ADMINISTRADOR_EMPRESA hace `PUT /api/empresas/{otraEmpresa}/seguridad-sesion`
- **THEN** la respuesta es 404 y la configuración de la otra empresa no cambia

#### Scenario: OPERARIO intenta editar
- **WHEN** un OPERARIO hace `PUT /api/empresas/{suEmpresa}/seguridad-sesion`
- **THEN** la respuesta es 403

#### Scenario: Valor fuera de rango
- **WHEN** se envía `inactividadMinutos: 2` con un mínimo global de 5
- **THEN** la respuesta es 400 con un error que empieza por `inactividadMinutos:`

#### Scenario: Sesión máxima menor que la inactividad
- **WHEN** se envía `{ inactividadMinutos: 120, sesionMaximaHoras: 1 }`
- **THEN** la respuesta es 400 con un error que empieza por `sesionMaximaHoras:`

### Requirement: Resolución única de la política efectiva
El sistema SHALL resolver la política efectiva en un único componente. Para una empresa:
- cada valor es el de la empresa o, si es nulo, el default global;
- cada valor se ajusta al límite global más cercano si quedó fuera de rango;
- si tras el ajuste la inactividad supera la sesión máxima en minutos, la inactividad se reduce a la sesión máxima.

Sin empresa (SUPERADMIN), la política SHALL ser el default global.

#### Scenario: Empresa sin configuración propia
- **WHEN** se resuelve la política de una empresa sin fila de configuración
- **THEN** el resultado es `{ inactividadMinutos: default global, sesionMaximaHoras: default global }`

#### Scenario: Límite global endurecido después de configurar la empresa
- **WHEN** una empresa tiene `inactividadMinutos: 200` y luego el SUPERADMIN baja `inactividadMaxMinutos` a 60
- **THEN** la política efectiva de esa empresa tiene `inactividadMinutos: 60`

#### Scenario: SUPERADMIN sin empresa activa
- **WHEN** se resuelve la política con `empresaId` nulo
- **THEN** el resultado es el par de valores por defecto globales

### Requirement: Auditoría de cambios de configuración
Cada cambio efectivo de un campo de los parámetros globales o de la configuración de una empresa SHALL registrar una fila append-only con:
- ámbito (`GLOBAL`/`EMPRESA`) y empresa;
- campo, valor anterior y valor nuevo;
- quién (id y nombre) y cuándo.

Un `PUT` que no cambia ningún valor SHALL NOT registrar filas.

#### Scenario: Cambio de inactividad de una empresa
- **WHEN** un ADMINISTRADOR_EMPRESA cambia `inactividadMinutos` de `null` a `15`
- **THEN** queda una fila con `ambito: EMPRESA`, `campo: inactividadMinutos`, `valorAnterior: null`, `valorNuevo: "15"` y el id del administrador
