## ADDED Requirements

### Requirement: Clasificación fecha de calendario vs. timestamp real
El sistema SHALL distinguir dos categorías de campos `DateTime`/ISO al mostrarlos: **fecha de calendario** (sin hora significativa — el usuario la captura con `<input type="date">`; el valor persistido es medianoche UTC del día elegido) y **timestamp real** (con hora significativa — capturado con `<input type="datetime-local">` o generado por el servidor). Una fecha de calendario SHALL mostrarse tomando el día/mes/año del ISO tal cual, sin conversión a la zona horaria del navegador (evita el desfase de un día en zonas horarias negativas, p.ej. UTC-5). Un timestamp real SHALL seguir mostrándose convertido a la hora local del navegador (comportamiento sin cambios). Son fechas de calendario: `Documento.fechaVigencia`, `fechaRevisionProxima`, `fechaEmision`; `AccionCorrectiva{Incidente,NC,QE}.plazoFecha`, `fechaCierre`; `NoConformidad.fechaDeteccion`; `SolicitudAjustePlazoAC.fechaSolicitada`. Son timestamps reales (no tocar): `creadoEn`/`actualizadoEn`/entradas de audit trail, `Incidente.fechaEvento`/`fechaReporte`, `NoConformidad.fechaReporte`, `QualityEvent.fechaHoraEvento`/`fechaHoraReporte`, `SolicitudAjustePlazoAC.solicitadoEn`/`revisadoEn`.

#### Scenario: Fecha de calendario no se desfasa en UTC-5
- **WHEN** el backend devuelve `"2026-09-29T00:00:00Z"` para un campo de fecha de calendario y el navegador está en `UTC-5`
- **THEN** el helper de fecha de calendario muestra 29, no 28

#### Scenario: Timestamp real sigue convirtiéndose a hora local
- **WHEN** `creadoEn` es `"2026-09-29T02:00:00Z"` y el navegador está en `UTC-5`
- **THEN** el timestamp se muestra en 28 de septiembre, hora local, sin cambios respecto al comportamiento previo

### Requirement: Helper de formateo y cálculo para fechas de calendario
`src/utils/date.utils.ts` SHALL exportar un helper que formatee una fecha de calendario (ISO string) a texto localizado leyendo únicamente su prefijo `YYYY-MM-DD`, sin construir un `Date` en la zona horaria del navegador para ese propósito. SHALL exportar también un helper para calcular la diferencia en días de calendario entre una fecha de calendario ISO y "hoy", igualmente sin desfase de zona horaria (comparando contra la fecha de calendario local de "hoy", no contra un instante). Ambos helpers SHALL usarse en cualquier componente que muestre o calcule contra uno de los campos listados como "fecha de calendario".

#### Scenario: Formateo de fecha de calendario
- **WHEN** se formatea `"2026-09-29T00:00:00Z"` en `es-PE`
- **THEN** el resultado corresponde al 29 de septiembre de 2026, independientemente de la zona horaria del navegador

#### Scenario: Cálculo de días restantes no se desfasa
- **WHEN** "hoy" en la zona horaria del navegador es `2026-09-29` (UTC-5) y la fecha de calendario es `"2026-10-01T00:00:00Z"`
- **THEN** el cálculo de días restantes da 2, no 1 ni 3
