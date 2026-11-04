# notification-links Specification

## Purpose
Enlaces de las notificaciones: apuntan a rutas reales del frontend, corrección de las notificaciones ya guardadas con enlaces inválidos, y redirección de las rutas en español heredadas.

## Requirements

### Requirement: Enlaces de notificaciones apuntan a rutas reales del frontend
Toda notificación creada por el backend SHALL llevar en `Link` una ruta registrada en `router/index.tsx`:

| Notificación | `Link` |
|---|---|
| Incidente | `/incidents/{id}` |
| No conformidad | `/nonconformities/{id}` |
| Quality Event | `/quality-events/{id}` |
| Documento | `/documentos/{id}` |
| Acción correctiva | ruta de detalle de su entidad de origen |

Para las acciones correctivas, la ruta de origen es `/incidents/{incidenteId}`, `/nonconformities/{ncId}` o `/quality-events/{qeId}`, según corresponda. Esto aplica tanto a la asignación de responsable como al escaneo de vencimiento. Ninguna notificación nueva SHALL usar los prefijos `/incidentes/`, `/no-conformidades/` ni `/acciones-correctivas/`.

#### Scenario: Notificación de cambio de estado de incidente
- **WHEN** se crea una notificación de incidente
- **THEN** su `link` es `/incidents/{incidenteId}`

#### Scenario: Asignación de AC de una NC
- **WHEN** se reasigna el responsable de una acción correctiva de NC
- **THEN** la notificación `ASIGNACION` tiene `link` `/nonconformities/{ncId}`

#### Scenario: Vencimiento de AC de QE
- **WHEN** el escáner notifica el vencimiento de una AC de un QE
- **THEN** la notificación tiene `link` `/quality-events/{qeId}`

### Requirement: Corrección de notificaciones ya guardadas
Una migración de datos SHALL reescribir el `link` de las notificaciones existentes:
- `/incidentes/{id}` pasa a `/incidents/{id}`;
- `/no-conformidades/{id}` pasa a `/nonconformities/{id}`;
- `/acciones-correctivas/{acId}` pasa a la ruta de la entidad de origen de esa AC.

La migración SHALL NOT cambiar el esquema.

#### Scenario: Notificación vieja de AC de incidente
- **WHEN** existe una notificación con `link` `/acciones-correctivas/<id de una AC de incidente>` y se aplica la migración
- **THEN** su `link` pasa a `/incidents/<incidenteId de esa AC>`

### Requirement: Redirección de rutas en español heredadas
El router del frontend SHALL redirigir con `replace` `/incidentes/:id` → `/incidents/:id` y `/no-conformidades/:id` → `/nonconformities/:id`, para cubrir enlaces externos o notificaciones que la migración no alcance.

#### Scenario: Redirección de incidente
- **WHEN** el usuario navega a `/incidentes/abc`
- **THEN** termina en `/incidents/abc` sin entrada intermedia en el historial

#### Scenario: Redirección de no conformidad
- **WHEN** el usuario navega a `/no-conformidades/abc`
- **THEN** termina en `/nonconformities/abc`
