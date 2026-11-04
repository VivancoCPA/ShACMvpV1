## ADDED Requirements

### Requirement: Paridad de nombres y ubicación con el backend real
Los handlers MSW de incidentes SHALL devolver `reportadoPorNombre`, `localNombre` y `zonaNombre` tanto en `GET /api/incidents/:id` como en cada item de `GET /api/incidents`. `POST /api/incidents` y `PATCH /api/incidents/:id` SHALL leer `ubicacionX` / `ubicacionY` del body y devolver `ubicacion: { x, y }`, y SHALL NOT leer `body.ubicacion`.

#### Scenario: Listado y detalle con nombres
- **WHEN** se solicita `GET /api/incidents` o `GET /api/incidents/:id` con MSW activo
- **THEN** los incidentes con reportante, local y zona incluyen los tres nombres

#### Scenario: Crear con ubicacionX/Y
- **WHEN** se hace `POST /api/incidents` con `ubicacionX: 20` y `ubicacionY: 70`
- **THEN** el incidente creado se devuelve con `ubicacion: { x: 20, y: 70 }`
