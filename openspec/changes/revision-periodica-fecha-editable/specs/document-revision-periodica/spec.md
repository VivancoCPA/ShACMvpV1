## ADDED Requirements

### Requirement: Campo de fecha editable en la opción A del modal
`DocumentRevisionPeriodicaModal`, al seleccionar la opción A ("Confirmar vigencia sin cambios"), SHALL mostrar un campo `<input type="date">` para `fechaRevisionProxima`, precargado con una fecha sugerida según `documento.tipo` (misma tabla que `DOC_PERIODICIDAD_POR_TIPO`: hoy + 12/24/6 meses según tipo, vacío para `REG`/`INF`), editable por el usuario, con atributo `min` igual a "hoy + 30 días". Para `tipo ∈ {REG, INF}` el campo SHALL ser opcional y SHALL NOT tener una sugerencia precargada.

#### Scenario: PRC precarga la fecha sugerida
- **WHEN** se abre la opción A para un documento `tipo: PRC`
- **THEN** el campo de fecha muestra "hoy + 12 meses" precargado, editable

#### Scenario: REG no precarga ninguna fecha
- **WHEN** se abre la opción A para un documento `tipo: REG`
- **THEN** el campo de fecha aparece vacío, y el usuario puede dejarlo así o completarlo

#### Scenario: El atributo min impide elegir una fecha por debajo del margen
- **WHEN** el campo de fecha se renderiza
- **THEN** su atributo `min` es la fecha de "hoy + 30 días" (fecha de calendario del navegador)

### Requirement: Validación cliente del margen mínimo
El formulario de la opción A SHALL validar con Zod que, si `fechaRevisionProxima` no está vacío, sea una fecha igual o posterior a "hoy + 30 días"; SHALL mostrar el error del backend en el campo si el servidor lo rechaza (margen no cumplido), sin perder el valor ingresado.

#### Scenario: Fecha por debajo del mínimo muestra error sin enviar
- **WHEN** el usuario ingresa una fecha a 10 días de hoy y confirma
- **THEN** el formulario muestra un error de validación en el campo, sin llamar al backend

#### Scenario: Error del servidor se muestra en el campo
- **WHEN** el backend rechaza la fecha enviada con un error de validación en `fechaRevisionProxima`
- **THEN** el mensaje de error del servidor se muestra debajo del campo, y el valor ingresado permanece visible

### Requirement: Envío del body y toast con la fecha correcta
`useConfirmarRevisionPeriodica` SHALL enviar `{ fechaRevisionProxima }` (el valor del campo, o `undefined`/`null` si quedó vacío) en el `PATCH /documents/:id/confirmar-revision`. El toast de éxito SHALL formatear la fecha devuelta por el servidor usando el formateador de fecha de calendario (`formatCalendarDateMedium`, zona `UTC`), no un formateador de timestamp en la zona horaria del navegador.

#### Scenario: El body incluye la fecha elegida
- **WHEN** el usuario confirma la opción A con una fecha editada
- **THEN** el `PATCH` enviado incluye `{ fechaRevisionProxima: "<fecha elegida>" }`

#### Scenario: El toast no desfasa la fecha en UTC-5
- **WHEN** el servidor confirma con `fechaRevisionProxima: "2026-03-01T00:00:00Z"` y el navegador está en `America/Lima` (UTC-5)
- **THEN** el toast muestra "1 de marzo de 2026", no "28 de febrero de 2026"

### Requirement: Handler MSW con el mismo contrato
El handler MSW de `PATCH /documents/:id/confirmar-revision` SHALL aceptar el mismo body opcional `{ fechaRevisionProxima?: string | null }`, aplicar la misma regla de margen mínimo (hoy + 30 días) cuando se envía una fecha, usar la misma fecha sugerida por tipo cuando no se envía ninguna, y persistir siempre como fecha de calendario (sin desfase por zona horaria local del entorno de pruebas).

#### Scenario: MSW rechaza una fecha por debajo del margen
- **WHEN** se envía `{ fechaRevisionProxima: "<hoy + 5 días>" }` vía MSW
- **THEN** la respuesta es un error de validación, sin actualizar el documento

#### Scenario: MSW sin body usa la fecha sugerida por tipo
- **WHEN** se llama `PATCH /documents/:id/confirmar-revision` sin body sobre un documento `tipo: MAT`
- **THEN** la `fechaRevisionProxima` resultante es "hoy + 6 meses", como fecha de calendario
