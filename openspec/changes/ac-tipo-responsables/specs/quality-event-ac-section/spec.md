## ADDED Requirements

### Requirement: QEACSection crea AC con tipo y responsable validado por tipo
La creación de AC desde `QEACSection` (y desde "Crear AC" del asistente IA en `QEInvestigationSection`) SHALL enviar `tipo` en el body de `POST /api/quality-events/:id/acciones-correctivas` y SHALL elegir el responsable solo entre los candidatos de `GET /api/acciones-correctivas/candidatos-responsable?tipo=…` (ver capability `ac-tipo-responsables`). Un error de validación de `responsableId` devuelto por el servidor SHALL mostrarse en el campo.

#### Scenario: Body con tipo
- **WHEN** el JCA guarda una AC con tipo `PREVENTIVA`
- **THEN** el `POST` incluye `tipo: 'PREVENTIVA'` y la AC aparece en la lista con el badge "Preventiva"

### Requirement: Panel de ajuste de plazo muestra el nombre del solicitante
`AjustePlazoPanel` SHALL resolver el nombre de `solicitud.solicitadoPorId` con `useUserNames` (`GET /api/users/nombres`) y MUST NOT mostrar el id; si no se resuelve SHALL mostrar "Usuario no disponible".

#### Scenario: Solicitud pendiente
- **WHEN** una AC tiene una solicitud de ajuste de plazo pendiente
- **THEN** el panel muestra "Solicitado por {nombre del solicitante}"
