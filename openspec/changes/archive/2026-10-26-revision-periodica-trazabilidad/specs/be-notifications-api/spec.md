## MODIFIED Requirements

### Requirement: Entidad Notificacion persistida
El sistema SHALL persistir cada notificación como una fila `Notificacion` con campos `Id (Guid)`, `UsuarioId (Guid, destinatario)`, `EmpresaId (Guid, empresa de la entidad que originó la notificación)`, `Tipo`, `EntidadTipo`, `EntidadId (Guid)`, `EntidadCodigo (string, el código legible de la entidad — p.ej. "QE-2026-001")`, `Mensaje (string)`, `Leida (bool, default false)`, `CreatedAt (DateTime UTC)`, `Link (string, ruta deep-link del frontend)` y `CicloClave (string, default "")`. `CicloClave` SHALL permanecer `""` para toda notificación que no sea del bloque de vencimiento de revisión periódica de Documentos (Acciones Correctivas, cambio de estado, asignación, etc.) — preserva exactamente la idempotencia "una sola notificación para siempre por entidad" que esos bloques ya tenían antes de este campo.

#### Scenario: Notificación creada con todos los campos requeridos
- **WHEN** se genera una notificación para cualquiera de los disparadores de este módulo
- **THEN** la fila persistida tiene `UsuarioId`, `EmpresaId`, `Tipo`, `EntidadTipo`, `EntidadId`, `EntidadCodigo`, `Mensaje`, `Leida: false`, `CreatedAt` y `CicloClave` poblados

#### Scenario: CicloClave queda vacío para notificaciones que no son de revisión periódica de Documentos
- **WHEN** se genera una notificación de cambio de estado, asignación, o vencimiento de una Acción Correctiva
- **THEN** su `CicloClave` es `""`

### Requirement: Escaneo idempotente de vencimiento de revisión periódica de Documentos (RN-DOC-006)
El sistema SHALL extender el escaneo de vencimientos (`VencimientoScanner.ScanAsync`) con un cuarto bloque sobre `Documento`, limitado a documentos con `Estado == PUBLICADO`, `DeletedAt == null` y `FechaRevisionProxima` no nula. "Hoy" SHALL calcularse como fecha de calendario en `America/Lima` (no UTC del servidor), una sola vez por corrida del escaneo.

Para cada documento que cumple el filtro, SHALL calcular `diasRestantes = (FechaRevisionProxima.Date - hoyLima).Days` y distinguir dos ramas mutuamente excluyentes:
- **Preaviso** (`0 < diasRestantes <= 30`): SHALL crear una notificación `VENCIMIENTO` por destinatario (autor + todo usuario con rol efectivo `JEFE_CONTROL_DOCUMENTARIO`/`JEFE_CALIDAD_SYST` en la empresa del documento, igual que antes) con el mensaje "El documento {código} vence su revisión periódica el {dd/mm/aaaa}".
- **Vencido** (`diasRestantes <= 0`): SHALL, además de notificar a los mismos destinatarios con el mensaje "La revisión periódica de {código} está vencida desde {fecha}. Debe iniciarse la revisión.", agregar **una** entrada `REVISION_PERIODICA_VENCIDA` al audit trail del documento, con `RealizadoPorId: "system"`, `RealizadoPorNombre: "Sistema"`, `GeneradoPorIA: true`, y el motivo o `ValorNuevo` indicando la fecha de revisión vencida ("Fecha de revisión periódica alcanzada: dd/mm/aaaa").
- Documentos con `diasRestantes > 30` SHALL omitirse sin generar nada.

La idempotencia SHALL evaluarse por **ciclo**: cada rama usa una `CicloClave` derivada de la `FechaRevisionProxima` vigente (p.ej. `"PREAVISO:{fecha:yyyy-MM-dd}"` / `"VENCIDO:{fecha:yyyy-MM-dd}"`), reforzada por el índice único `(EntidadTipo, EntidadId, UsuarioId, CicloClave)` filtrado a `Tipo = 'VENCIMIENTO'`. Mientras la `FechaRevisionProxima` del documento no cambie, cada rama SHALL generar como máximo un lote de notificaciones (y, en el caso de vencido, una sola entrada de audit trail); al confirmarse una `FechaRevisionProxima` nueva (ver `ConfirmarRevisionPeriodicaHandler`), el ciclo siguiente SHALL volver a evaluar y notificar independientemente de los avisos de ciclos anteriores, que SHALL NOT borrarse.

#### Scenario: Documento a 15 días de su revisión notifica a autor y jefes (preaviso)
- **WHEN** el escaneo corre y un documento `PUBLICADO` tiene `fechaRevisionProxima` a 15 días corridos (calculados en `America/Lima`), sin notificación `VENCIMIENTO` previa para ese ciclo, en una empresa con un `JEFE_CALIDAD_SYST` y un `JEFE_CONTROL_DOCUMENTARIO` distintos del autor
- **THEN** se crean 3 notificaciones `VENCIMIENTO` (autor + 2 jefes) con la `CicloClave` de preaviso de ese ciclo

#### Scenario: Documento a más de 30 días no genera notificación
- **WHEN** el escaneo corre y un documento `PUBLICADO` tiene `fechaRevisionProxima` a 45 días corridos
- **THEN** no se crea ninguna notificación `VENCIMIENTO` para ese documento

#### Scenario: Documento vencido genera notificación de vencido y una entrada de audit trail
- **WHEN** el escaneo corre y un documento `PUBLICADO` tiene `fechaRevisionProxima` en el pasado, sin notificación de vencido previa para ese ciclo
- **THEN** se crea la notificación `VENCIMIENTO` de vencido para cada destinatario, y el audit trail del documento gana exactamente una entrada `REVISION_PERIODICA_VENCIDA` con actor `"Sistema"`

#### Scenario: Repetir el escaneo en el mismo ciclo no duplica notificaciones ni la entrada de audit trail
- **WHEN** el escaneo se ejecuta dos veces seguidas sin que cambie `FechaRevisionProxima`
- **THEN** la segunda ejecución no crea notificaciones adicionales ni una segunda entrada `REVISION_PERIODICA_VENCIDA`, incluso si un nuevo `JEFE_CALIDAD_SYST` se incorporó a la empresa entre ambas corridas

#### Scenario: Confirmar la vigencia con una fecha nueva vuelve a habilitar los avisos del ciclo siguiente
- **WHEN** un documento ya generó sus avisos de preaviso y/o vencido para una `FechaRevisionProxima`, y luego se confirma la revisión periódica con una `FechaRevisionProxima` distinta
- **THEN** cuando esa nueva fecha entra en la ventana de 30 días, el escaneo vuelve a generar el preaviso correspondiente — sin borrar las notificaciones del ciclo anterior

#### Scenario: Documentos en BORRADOR, OBSOLETO o EN_REVISION_PERIODICA no generan avisos
- **WHEN** un documento en `BORRADOR`, `EN_REVISION`, `EN_APROBACION`, `OBSOLETO` o `EN_REVISION_PERIODICA` tiene `fechaRevisionProxima` dentro de la ventana de 30 días (heredada de un ciclo anterior)
- **THEN** el escaneo lo omite sin generar ninguna notificación ni entrada de audit trail

#### Scenario: Documento sin fechaRevisionProxima nunca dispara este escaneo
- **WHEN** un documento tiene `fechaRevisionProxima` nula (p.ej. tipo `INF` sin revisión periódica)
- **THEN** el escaneo lo omite sin evaluarlo

#### Scenario: El escaneo ejecuta dentro del mismo BackgroundService
- **WHEN** corre `VencimientoScanService`
- **THEN** evalúa Acciones Correctivas y Documentos en la misma corrida, sin un proceso separado
