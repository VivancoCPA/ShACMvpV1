## ADDED Requirements

### Requirement: EmpresaList pagina en cliente con PAGE_SIZE 10
`EmpresaList` SHALL paginar la lista de empresas en cliente con el componente compartido `Pagination` y `PAGE_SIZE = 10`, igual que `UserList` y `EmpresaUsuariosPage`. El contrato `GET /api/empresas` SHALL permanecer sin cambios.

#### Scenario: Más de 10 empresas se reparten en páginas
- **WHEN** existen 25 empresas
- **THEN** la primera página muestra 10 filas y `Pagination` permite navegar a 3 páginas

### Requirement: EmpresaList filtra por texto y por estado
`EmpresaList` SHALL ofrecer, con `FilterBar`, una búsqueda de texto por razón social o RUC (sin distinguir mayúsculas, RUC por coincidencia parcial) y un filtro de estado Todas/Activas/Inactivas. Cambiar cualquier filtro SHALL devolver la paginación a la página 1.

#### Scenario: Búsqueda por RUC parcial
- **WHEN** el admin escribe "2010" en la búsqueda
- **THEN** solo se muestran empresas cuya razón social o RUC contienen "2010"

#### Scenario: Filtro de estado
- **WHEN** el admin elige "Inactivas"
- **THEN** solo se muestran empresas con estado `INACTIVA` y la página vuelve a 1

### Requirement: Estado vacío distingue ausencia de datos y ausencia de coincidencias
`EmpresaList` SHALL mostrar un mensaje distinto cuando no existen empresas y cuando ningún resultado coincide con los filtros activos, con claves i18n en `es-PE` y `en-US`.

#### Scenario: Filtros sin coincidencias
- **WHEN** existen empresas pero ninguna coincide con los filtros
- **THEN** se muestra el mensaje "ningún resultado coincide con los filtros", no el de "no hay empresas"
