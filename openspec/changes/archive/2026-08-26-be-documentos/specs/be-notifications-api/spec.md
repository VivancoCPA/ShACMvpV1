## MODIFIED Requirements

### Requirement: NotificacionEntidadTipo
El sistema SHALL definir `NotificacionEntidadTipo = QE | NC | INCIDENTE | DOCUMENTO | AC` (mismo conjunto que el frontend, `notification-types`). `DOCUMENTO` SHALL emitirse activamente desde `be-documentos-api`: notificaciones de asignación (revisor/aprobador), rechazo, y el escaneo de vencimiento de revisión periódica (RN-DOC-006, ver requirement dedicado).

#### Scenario: EntidadTipo refleja el dominio de origen
- **WHEN** se genera una notificación desde un Quality Event, una No Conformidad, un Incidente o una Acción Correctiva
- **THEN** su `EntidadTipo` es `QE`, `NC`, `INCIDENTE` o `AC` respectivamente

#### Scenario: Notificación de Documento usa EntidadTipo DOCUMENTO
- **WHEN** se genera cualquier notificación con origen en un `Documento` (asignación, rechazo, o vencimiento de revisión)
- **THEN** su `EntidadTipo` es `DOCUMENTO`

## ADDED Requirements

### Requirement: Escaneo idempotente de vencimiento de revisión periódica de Documentos (RN-DOC-006)
El sistema SHALL extender el escaneo de vencimientos (`VencimientoScanner.ScanAsync`) con un cuarto bloque sobre `Documento`: para cada documento no eliminado con `fechaRevisionProxima` no nula — **sin filtrar por `estado`**, fiel al comportamiento del mock (`notificationGeneration.ts`), que evalúa cualquier documento con esa fecha asignada independientemente de si ya está `PUBLICADO` — cuyos días corridos restantes hasta esa fecha (diferencia en días de calendario, no días hábiles) sean 30 o menos, y para el cual no exista ya ninguna notificación `VENCIMIENTO` con ese `EntidadTipo: DOCUMENTO` y `EntidadId`, el sistema SHALL crear una notificación `VENCIMIENTO` dirigida a: el `autorId` del documento (si resuelve a un usuario existente) y a todo usuario cuyo rol efectivo en la empresa del documento sea `JEFE_CONTROL_DOCUMENTARIO` o `JEFE_CALIDAD_SYST`. La idempotencia SHALL evaluarse por documento (no por destinatario): si ya existe al menos una notificación `VENCIMIENTO` para ese `EntidadId`, el sistema SHALL NOT generar notificaciones adicionales para ese documento aunque haya destinatarios que aún no la recibieron. El sistema SHALL soportar persistir más de una fila de notificación por documento (una por destinatario) bajo el mismo `(EntidadTipo, EntidadId)`, reforzado por un índice único de base de datos sobre `(EntidadTipo, EntidadId, UsuarioId)` filtrado a `Tipo = 'VENCIMIENTO'` — más amplio que el índice de 2 columnas usado para Acciones Correctivas, que solo necesita un destinatario por entidad. El escaneo SHALL ejecutarse dentro del mismo `BackgroundService` (`VencimientoScanService`) que ya cubre Acciones Correctivas, no como un proceso separado.

#### Scenario: Documento a 15 días de su revisión notifica a autor y jefes
- **WHEN** el escaneo corre y un documento `PUBLICADO` tiene `fechaRevisionProxima` a 15 días corridos, sin notificación `VENCIMIENTO` previa para él, en una empresa con un `JEFE_CALIDAD_SYST` y un `JEFE_CONTROL_DOCUMENTARIO` distintos del autor
- **THEN** se crean 3 notificaciones `VENCIMIENTO` con `EntidadTipo: DOCUMENTO` y el mismo `EntidadId`: una para el autor y una para cada jefe

#### Scenario: Documento a más de 30 días no genera notificación
- **WHEN** el escaneo corre y un documento `PUBLICADO` tiene `fechaRevisionProxima` a 45 días corridos
- **THEN** no se crea ninguna notificación `VENCIMIENTO` para ese documento

#### Scenario: Repetir el escaneo no duplica notificaciones para el mismo documento
- **WHEN** el escaneo se ejecuta dos veces seguidas y el documento ya tiene al menos una notificación `VENCIMIENTO` de la primera corrida
- **THEN** la segunda ejecución no crea ninguna notificación adicional para ese documento, incluso si un nuevo `JEFE_CALIDAD_SYST` se incorporó a la empresa entre ambas corridas

#### Scenario: Documento sin fechaRevisionProxima nunca dispara este escaneo
- **WHEN** un documento tiene `fechaRevisionProxima` nula (p.ej. tipo `INF` sin revisión periódica)
- **THEN** el escaneo lo omite sin evaluarlo

#### Scenario: El escaneo evalúa documentos en cualquier estado, no solo PUBLICADO
- **WHEN** un documento en `BORRADOR` ya tiene `fechaRevisionProxima` asignada (posible desde que `fechaVigencia` tiene valor, RN-DOC-020) y esa fecha cae dentro de la ventana de 30 días
- **THEN** el escaneo lo evalúa igual que a un documento `PUBLICADO` y genera la notificación correspondiente si no existe una previa
