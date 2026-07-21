## ADDED Requirements

### Requirement: Notificacion interface
The system SHALL define a `Notificacion` interface in `src/types/notification.types.ts` with fields: `id: string`, `usuarioId: string` (an id resolvable in the live `authFixtures` store), `tipo: NotificacionTipo`, `entidadTipo: NotificacionEntidadTipo`, `entidadId: string`, `entidadCodigo: string`, `mensaje: string`, `leida: boolean`, `createdAt: string` (ISO 8601), `link: string` (deep-link route to the entity's detail page).

#### Scenario: Notificacion rejects missing required fields
- **WHEN** a developer constructs a `Notificacion` object literal without `usuarioId` or `link`
- **THEN** TypeScript emits a compile error for each missing required field

### Requirement: NotificacionTipo and NotificacionEntidadTipo enums
The system SHALL define `type NotificacionTipo = 'CAMBIO_ESTADO' | 'ASIGNACION' | 'VENCIMIENTO'` and `type NotificacionEntidadTipo = 'QE' | 'NC' | 'INCIDENTE' | 'DOCUMENTO' | 'AC'` in `src/types/notification.types.ts`.

#### Scenario: NotificacionTipo restricts to the three known categories
- **WHEN** a developer assigns a `Notificacion.tipo` value outside `'CAMBIO_ESTADO' | 'ASIGNACION' | 'VENCIMIENTO'`
- **THEN** TypeScript emits a compile error

### Requirement: MarcarLeidaResponse and notifications list DTOs
The system SHALL define `NotificacionesListResponse` as `ApiResponse<Notificacion[]>` and a request-less response type for the mark-read and mark-all-read endpoints returning the updated `Notificacion` (single) or `Notificacion[]` (all), consistent with the existing `ApiResponse<T>` envelope used across all other domains.

#### Scenario: List response follows the standard ApiResponse envelope
- **WHEN** `GET /api/notifications` succeeds
- **THEN** the response body matches `ApiResponse<Notificacion[]>` with `success: true` and `data` as an array
