## ADDED Requirements

### Requirement: Campos de fecha vacíos no se envían como cadena vacía
Cuando `fechaVigencia` o `fechaRevisionProxima` quedan vacíos en el formulario (crear o editar), el envío al backend SHALL omitir el campo (`undefined`), nunca enviarlo como `""`. Una cadena vacía no se puede deserializar como `DateTime?` en el backend y produce un error de la petición distinto del flujo esperado de "campo opcional sin valor".

#### Scenario: fechaVigencia vacía se omite del payload de creación
- **WHEN** se envía el formulario en modo creación con `fechaVigencia` vacío
- **THEN** el payload enviado a `POST /api/documents` no incluye la clave `fechaVigencia` como `""`

#### Scenario: fechaRevisionProxima vacía se omite del payload de edición
- **WHEN** se envía el formulario en modo edición con `fechaRevisionProxima` vacío
- **THEN** el payload enviado a `PUT /api/documents/:id` no incluye la clave `fechaRevisionProxima` como `""`
