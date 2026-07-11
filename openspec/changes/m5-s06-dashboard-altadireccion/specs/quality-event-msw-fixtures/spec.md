## ADDED Requirements

### Requirement: At least 2 fixtures seed a pending solicitudAjustePlazo on an ALTA/CRITICA QE's AC
`qeAccionesCorrectivas` SHALL include at least 2 `AccionCorrectivaQE` entries with `solicitudAjustePlazo.estado === 'PENDIENTE'`, each belonging to a QE fixture with `severidad === 'ALTA'` or `severidad === 'CRITICA'`. At least 1 additional `AccionCorrectivaQE` entry SHALL have `solicitudAjustePlazo.estado` set to `'APROBADA'` or `'RECHAZADA'`, to verify that the Alta Dirección widget filters by `PENDIENTE` and does not simply show every AC that has ever had a request.

#### Scenario: At least 2 PENDIENTE requests on ALTA/CRITICA QEs
- **WHEN** `qeAccionesCorrectivas` is flattened and filtered by `ac => ac.solicitudAjustePlazo?.estado === 'PENDIENTE'`
- **THEN** the result has at least 2 elements, and each one's owning QE fixture has `severidad === 'ALTA'` or `severidad === 'CRITICA'`

#### Scenario: At least 1 non-pending request exists as a negative fixture
- **WHEN** `qeAccionesCorrectivas` is flattened and filtered by `ac => ac.solicitudAjustePlazo?.estado === 'APROBADA' || ac.solicitudAjustePlazo?.estado === 'RECHAZADA'`
- **THEN** the result has at least 1 element
