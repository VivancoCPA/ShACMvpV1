## ADDED Requirements

### Requirement: Escaneo idempotente del plazo para vincular un QE a un incidente (RN-INC-006)
El `VencimientoScanner` SHALL evaluar, en cada corrida, los incidentes activos sin QE: `QeId` nulo, no eliminados y en un estado distinto de `CERRADO`/`ANULADO`. Lo hace contra el plazo de su tipo (ACCIDENTE 24 h, INCIDENTE 48 h, CUASI_ACCIDENTE 72 h, CONDICION_INSEGURA 48 h), en horas corridas desde `FechaEvento` en UTC, con dos ramas excluyentes:
- **Preaviso:** transcurrido ≥ 75 % y < 100 %. `CicloClave = "QE_PREAVISO"`, mensaje "El incidente {numero} ({tipo}) vence en {X} h su plazo para vincular un Quality Event.".
- **Vencido:** transcurrido ≥ 100 %. `CicloClave = "QE_VENCIDO"`, mensaje "El incidente {numero} ({tipo}) superó su plazo de {plazo} h para vincular un Quality Event.". Esta rama además agrega al audit trail del incidente `PLAZO_QE_VENCIDO`, con `ValorNuevo = "{plazo} h"`, actor "Sistema" y `GeneradoPorIA = true`.

Destinatarios y formato:
- Destinatarios: los `UsuariosEmpresa` en estado `ACTIVO` de la empresa del incidente con rol `JEFE_CALIDAD_SYST` o `SUPERVISOR`, sin duplicados.
- Notificación: `Tipo = VENCIMIENTO`, `EntidadTipo = INCIDENTE`, `EntidadCodigo` = número y `link = /incidents/{id}`.

Idempotencia: SHALL evaluarse por incidente y `CicloClave` antes de generar el lote, de modo que una segunda corrida no duplique notificaciones ni la entrada de audit.

#### Scenario: Preaviso de un ACCIDENTE
- **WHEN** un ACCIDENTE sin QE lleva 19 h desde `FechaEvento`
- **THEN** cada JCA y SUP activo de la empresa recibe una notificación `VENCIMIENTO` con `CicloClave = QE_PREAVISO`, y no se agrega audit trail

#### Scenario: Vencido de un ACCIDENTE
- **WHEN** un ACCIDENTE sin QE lleva 25 h desde `FechaEvento`
- **THEN** cada JCA y SUP activo recibe una notificación con `CicloClave = QE_VENCIDO`, y el incidente tiene una entrada `PLAZO_QE_VENCIDO` con actor Sistema

#### Scenario: Segunda corrida no duplica
- **WHEN** el escaneo se ejecuta dos veces seguidas sobre el mismo incidente vencido
- **THEN** la segunda corrida no crea notificaciones ni audit trail nuevos

#### Scenario: Incidentes excluidos
- **WHEN** el incidente tiene QE, está eliminado o está `ANULADO`
- **THEN** el escaneo no genera nada para él

#### Scenario: Destinatarios inactivos o de otra empresa
- **WHEN** hay un SUPERVISOR inactivo en la empresa y un JCA activo en otra empresa
- **THEN** ninguno de los dos recibe la notificación
