## MODIFIED Requirements

### Requirement: Confirmar revisión periódica
El sistema SHALL exponer `PATCH /api/documents/:id/confirmar-revision` con un body opcional `{ fechaRevisionProxima?: "YYYY-MM-DD" | null }`, permitido solo desde `PUBLICADO` o `EN_REVISION_PERIODICA`.

Si `fechaRevisionProxima` viene en el body y no es `null`, SHALL validar que sea una fecha de calendario igual o posterior a "hoy + 30 días", calculando "hoy" como fecha de calendario en la zona horaria `America/Lima` (no UTC del servidor). Si no cumple el margen, SHALL responder con un error de validación por campo (`fechaRevisionProxima`), sin modificar el documento.

Si `fechaRevisionProxima` no viene en el body o es `null`: para `Tipo ∈ {POL, PRC, PLAN, INS, MAT}` SHALL recalcular la fecha sugerida según `Tipo` (`POL/PRC/PLAN` +12 meses, `INS` +24 meses, `MAT` +6 meses, contados desde "hoy" en `America/Lima`); para `Tipo ∈ {REG, INF}` SHALL dejar `FechaRevisionProxima` en `null`.

En cualquier caso, la fecha final (enviada o calculada) SHALL persistirse como fecha de calendario a medianoche UTC del día elegido (sin hora), igual que `FechaVigencia`/`FechaRevisionProxima` en creación/edición de documentos.

El audit trail `REVISION_PERIODICA_CONFIRMADA` SHALL registrar `ValorAnterior` (la `FechaRevisionProxima` previa, formato `YYYY-MM-DD`, o ausente si no había) y `ValorNuevo` (la fecha nueva, mismo formato) — antes solo registraba la fecha nueva.

#### Scenario: Confirmar revisión de un PRC sin especificar fecha usa la sugerida
- **WHEN** se confirma revisión de un documento `tipo: PRC` sin body (o con `fechaRevisionProxima: null`)
- **THEN** la nueva `fechaRevisionProxima` es "hoy + 12 meses" (calculado en `America/Lima`), persistida como fecha de calendario sin hora

#### Scenario: Confirmar revisión con una fecha elegida válida la persiste tal cual
- **WHEN** se confirma revisión de un documento `tipo: PRC` con `{ fechaRevisionProxima: "<hoy + 60 días>" }`
- **THEN** la `fechaRevisionProxima` guardada es exactamente esa fecha, no la sugerida por tipo

#### Scenario: Fecha elegida por debajo del margen mínimo es rechazada
- **WHEN** se confirma revisión con `{ fechaRevisionProxima: "<hoy + 10 días>" }`
- **THEN** el sistema responde con un error de validación en el campo `fechaRevisionProxima`, y el documento no cambia

#### Scenario: REG sin fecha queda sin próxima revisión
- **WHEN** se confirma revisión de un documento `tipo: REG` sin body (o con `fechaRevisionProxima: null`)
- **THEN** `fechaRevisionProxima` queda `null`

#### Scenario: REG con una fecha elegida válida la acepta
- **WHEN** se confirma revisión de un documento `tipo: REG` con `{ fechaRevisionProxima: "<hoy + 45 días>" }`
- **THEN** la `fechaRevisionProxima` guardada es esa fecha

#### Scenario: El audit trail registra la fecha anterior y la nueva
- **WHEN** se confirma revisión de un documento que ya tenía `fechaRevisionProxima` definida
- **THEN** la entrada `REVISION_PERIODICA_CONFIRMADA` tiene `ValorAnterior` igual a la fecha previa y `ValorNuevo` igual a la fecha nueva, ambos en formato `YYYY-MM-DD`
