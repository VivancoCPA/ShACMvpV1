## ADDED Requirements

### Requirement: Handlers MSW de listado, export y origen de AC
`src/mocks/handlers/acciones-correctivas.handlers.ts` SHALL agregar tres handlers:
- `GET /api/acciones-correctivas`;
- `GET /api/acciones-correctivas/export`;
- `GET /api/acciones-correctivas/:id/origen`.

Todos SHALL tener latencia de 400 ms y SHALL operar sobre los stores vivos de QE, NC e incidentes de la empresa activa (sin orígenes eliminados).

SHALL replicar el contrato del backend:
- estado normalizado;
- `vencida` con el mismo `esAcVencida` que usa `dashboard.handlers.ts` (extraído a un módulo compartido);
- días hábiles con signo;
- visibilidad por rol (el SUPERVISOR usa `areaIds`), con 403 para los roles de administración;
- filtros, orden, paginación y `contadores` con la misma separación entre filtros base y filtros de estado;
- tope de 5.000 filas en el export (422 `EXPORT_DEMASIADAS_FILAS`);
- 404 del origen.

`/api/acciones-correctivas/export` y `/api/acciones-correctivas/candidatos-responsable` SHALL registrarse antes de `/:id/origen`, para que no los capture el parámetro.

#### Scenario: Vencidas del listado igual al KPI-08 en MSW
- **WHEN** un `JEFE_CALIDAD_SYST` pide `GET /api/acciones-correctivas` y `GET /api/dashboard/kpis` en MSW
- **THEN** `contadores.vencidas` es igual al valor de KPI-08

#### Scenario: Operario en MSW
- **WHEN** un `OPERARIO` pide `GET /api/acciones-correctivas`
- **THEN** todas las filas tienen `responsableId` igual a su id

#### Scenario: Cobertura de fixtures
- **WHEN** un JCA lista las AC en MSW con los fixtures por defecto
- **THEN** los seis contadores son mayores que 0, y hay al menos una AC de cada origen (QE, NC e incidente)
