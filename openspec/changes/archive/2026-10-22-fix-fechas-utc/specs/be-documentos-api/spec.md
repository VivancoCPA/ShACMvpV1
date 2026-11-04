## ADDED Requirements

### Requirement: Fechas de calendario sin offset se aceptan y persisten en UTC
`POST /api/documents`, `PUT /api/documents/:id` y cualquier otro endpoint que reciba `FechaVigencia`, `FechaRevisionProxima` u otro campo `DateTime`/`DateTime?` del dominio Documentos SHALL aceptar un valor de fecha sin offset (p.ej. `"2026-09-29"`, deserializado por el cliente JSON como `DateTimeKind.Unspecified`) sin responder `500`. El valor SHALL persistirse como el instante UTC de medianoche de ese día calendario (`DateTimeKind.Utc`), sin desplazar la hora. Esto se logra con un convertidor de valor global de EF Core (no un mapeo por propiedad), por lo que aplica igual a cualquier entidad del sistema con columnas `timestamp with time zone`, no solo a Documentos.

#### Scenario: Fecha de vigencia sin offset no produce 500
- **WHEN** se envía `POST /api/documents` con `fechaVigencia: "2026-09-29"` (sin hora ni offset)
- **THEN** el sistema responde `201` y el documento queda con `fechaVigencia` en `2026-09-29T00:00:00Z`

#### Scenario: Fecha de vigencia vacía u omitida no produce 500
- **WHEN** se envía `POST /api/documents` sin `fechaVigencia` (campo omitido)
- **THEN** el sistema responde `201` sin error de deserialización
