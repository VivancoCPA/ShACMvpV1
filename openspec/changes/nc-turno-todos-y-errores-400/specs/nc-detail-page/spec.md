## ADDED Requirements

### Requirement: NonconformityDetailPage muestra el turno "Todos"
Cuando la NC tiene `turno: 'TODOS'`, el detalle SHALL mostrar la etiqueta i18n `form.turno.TODOS` ("Todos los turnos" / "All shifts"), igual que para `DIA`/`TARDE`/`NOCHE`.

#### Scenario: NC con turno TODOS
- **WHEN** el usuario abre el detalle de una NC con `turno: 'TODOS'`
- **THEN** el campo Turno muestra "Todos los turnos"
