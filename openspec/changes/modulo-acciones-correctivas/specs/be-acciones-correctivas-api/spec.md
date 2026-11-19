## ADDED Requirements

### Requirement: Consulta unificada de AC de QE, NC e incidente
El backend SHALL exponer `AccionesCorrectivasQuery` (`Features/AccionesCorrectivas/Shared/`), que lee con Dapper las tres tablas de AC en un `UNION ALL`. Cada rama SHALL hacer JOIN con su origen (`quality_events`, `no_conformidades`, `incidentes`) y SHALL aplicar `origen.empresa_id = @EmpresaId` y `origen.deleted_at IS NULL`.

Cada fila SHALL traer:
- `Id`, `OrigenTipo` (`QE` | `NC` | `INCIDENTE`), `OrigenId` y `OrigenNumero`;
- `Titulo`, `Descripcion`, `Tipo` (`CORRECTIVA` | `PREVENTIVA` | `MEJORA`) y `Prioridad`;
- `ResponsableId` y `ResponsableNombre` (para incidente, resuelto desde `asp_net_users`);
- `AreaId` y `AreaNombre` del **origen**;
- `PlazoFecha`, `EstadoOriginal` y `EstadoNormalizado`;
- `EjecutadaEn`, `VerificadaEn` y `VerificadaPorNombre` (`null` fuera de QE);
- `CreadoEn` y `FechaCierre`;
- `Vencida` y `DiasHabilesRestantes`.

#### Scenario: Incluye los tres orígenes
- **WHEN** la empresa activa tiene una AC de QE, una de NC y una de incidente
- **THEN** el listado devuelve las tres, cada una con su `OrigenTipo`, el número de su origen y el área de su origen

#### Scenario: Excluye orígenes eliminados y otras empresas
- **WHEN** un QE de la empresa está eliminado (`deleted_at` no nulo) y otra empresa tiene AC
- **THEN** ni las AC del QE eliminado ni las de la otra empresa aparecen

### Requirement: Estado normalizado y vencida con la regla del KPI-08
`EstadoNormalizado` SHALL ser:
- `PENDIENTE`, si viene de PENDIENTE;
- `EN_EJECUCION`, si viene de EN_EJECUCION, o de VENCIDA en una AC de NC;
- `PENDIENTE_VERIFICACION`, si viene de COMPLETADA (en las tres tablas);
- `CERRADA`, si viene de CERRADA.

`Vencida` SHALL calcularse en C# con `DashboardKpiCalculator.EsAcVencida(EstadoOriginal, PlazoFecha, ahora)`, nunca en SQL.

`DiasHabilesRestantes` SHALL calcularse con `AjustePlazoCalculator.ContarDiasHabiles`, con signo: positivo o cero mientras el plazo no pasó, negativo cuando ya pasó.

#### Scenario: COMPLETADA se normaliza a pendiente de verificación
- **WHEN** hay AC en estado COMPLETADA en las tres tablas
- **THEN** las tres tienen `EstadoNormalizado = PENDIENTE_VERIFICACION` y `Vencida = false`, aunque su plazo haya pasado

#### Scenario: VENCIDA de NC no es un estado aparte
- **WHEN** una AC de NC tiene estado `VENCIDA` y plazo de ayer
- **THEN** su `EstadoNormalizado` es `EN_EJECUCION`, su `EstadoOriginal` es `VENCIDA` y `Vencida` es `true`

#### Scenario: Vencidas coinciden con el KPI-08
- **WHEN** un `JEFE_CALIDAD_SYST` pide `GET /api/acciones-correctivas` sin filtros
- **THEN** `contadores.vencidas` es igual al `valor` del KPI-08 calculado sobre los mismos datos en el mismo instante

### Requirement: Visibilidad por rol filtrada en el servidor
El listado, el export y el origen SHALL resolver el rol con `GetRolEfectivo()` de la empresa activa.

| Rol | Alcance |
|---|---|
| `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO`, `ALTA_DIRECCION` | Todas las AC de la empresa |
| `SUPERVISOR` | AC cuyo origen tiene `area_id` en sus áreas (`DashboardDataFetcher.FetchUsuarioAreaIdsAsync`), más las AC donde es `responsable_id` |
| `OPERARIO` | Solo las AC donde es `responsable_id` |
| `ADMINISTRADOR_EMPRESA`, `ADMINISTRADOR_SISTEMA`, `SUPERADMIN` y cualquier otro rol | 403 |

Los filtros de la petición SHALL combinarse con la visibilidad (AND), nunca ampliarla.

#### Scenario: JCA ve todas
- **WHEN** un `JEFE_CALIDAD_SYST` lista las AC
- **THEN** recibe las AC de todas las áreas de la empresa

#### Scenario: Supervisor ve su área y las suyas
- **WHEN** un `SUPERVISOR` del área A lista las AC, y existen una AC de origen en el área A, una de origen en el área B donde él es responsable y otra del área B donde no lo es
- **THEN** recibe las dos primeras y no la tercera

#### Scenario: Operario ve solo las suyas
- **WHEN** un `OPERARIO` lista las AC
- **THEN** todas las filas tienen `ResponsableId` igual a su id

#### Scenario: Administrador de empresa recibe 403
- **WHEN** un `ADMINISTRADOR_EMPRESA` pide `GET /api/acciones-correctivas`
- **THEN** la respuesta es 403

### Requirement: GET /api/acciones-correctivas con filtros, orden, paginación y contadores
El endpoint SHALL aceptar estos query params, todos opcionales:
- `estado` (uno o varios estados normalizados, separados por coma o repetidos), `vencida` (bool) y `porVencer` (bool);
- `tipo`, `origenTipo`, `responsableId` y `areaId`;
- `plazoDesde` / `plazoHasta`, `creadaDesde` / `creadaHasta` y `cerradaDesde` / `cerradaHasta`;
- `search`, con ILIKE sobre la descripción, el título y el número de origen;
- `orden` (`plazo` | `creado` | `estado`, por defecto `plazo`) y `dir` (`asc` | `desc`);
- `page` (desde 1) y `pageSize` (25 por defecto, máximo 100).

Un valor inválido SHALL responder 400.

**Orden:** el orden por defecto SHALL poner las vencidas primero y luego ordenar por `PlazoFecha` ascendente.

**`porVencer`** SHALL significar: no vencida, estado normalizado `PENDIENTE` o `EN_EJECUCION`, y `DiasHabilesRestantes <= 5`.

**Respuesta:** `ApiResponse` con `data = { items, pagination: { page, pageSize, totalItems, totalPages }, contadores }`.

**`contadores`** SHALL calcularse sobre la visibilidad y los filtros base (`tipo`, `origenTipo`, `responsableId`, `areaId`, plazo, creación y `search`), ignorando los filtros de estado (`estado`, `vencida`, `porVencer`, cierre). SHALL traer siempre los seis:
- `abiertas` (PENDIENTE + EN_EJECUCION);
- `enEjecucion`;
- `pendientesVerificacion`;
- `porVencer`;
- `vencidas`;
- `cerradasPeriodo`: las CERRADA con `FechaCierre` dentro del rango de cierre. Si no se envía rango, el período es el mes calendario actual en `America/Lima`.

#### Scenario: Cada contador es igual al total con su filtro
- **WHEN** se compara cada contador con el `pagination.totalItems` de la petición con el filtro equivalente (`estado=PENDIENTE,EN_EJECUCION`, `estado=EN_EJECUCION`, `estado=PENDIENTE_VERIFICACION`, `porVencer=true`, `vencida=true`, y `estado=CERRADA` con el rango de cierre del mes)
- **THEN** los seis valores coinciden

#### Scenario: Los filtros de estado no cambian los contadores
- **WHEN** se pide `vencida=true` y luego la misma petición sin `vencida`
- **THEN** los `contadores` son idénticos y solo cambian `items` y `pagination`

#### Scenario: Paginación
- **WHEN** hay 30 AC visibles y se pide `page=2&pageSize=25`
- **THEN** `items` tiene 5 elementos y `pagination` es `{ page: 2, pageSize: 25, totalItems: 30, totalPages: 2 }`

#### Scenario: pageSize fuera de rango
- **WHEN** se pide `pageSize=500`
- **THEN** la respuesta es 400

#### Scenario: Combinación de filtros
- **WHEN** se pide `origenTipo=NC&tipo=PREVENTIVA&estado=EN_EJECUCION`
- **THEN** todas las filas son AC de NC, de tipo PREVENTIVA y en ejecución

### Requirement: Exportación sin paginar con tope de 5.000 filas
`GET /api/acciones-correctivas/export` SHALL aceptar los mismos filtros, sin `page` ni `pageSize`, y SHALL devolver `ApiResponse` con `data = items[]`: las mismas filas, con la misma visibilidad y el mismo orden. Si el resultado supera 5.000 filas, SHALL responder 422 con `errorCode = EXPORT_DEMASIADAS_FILAS` y un mensaje que pide acotar los filtros.

#### Scenario: Export respeta filtros y visibilidad
- **WHEN** un `SUPERVISOR` exporta con `vencida=true`
- **THEN** recibe exactamente las filas que vería en el listado con ese filtro, sin paginar

#### Scenario: Demasiadas filas
- **WHEN** el resultado tiene 5.001 filas
- **THEN** la respuesta es 422 con `errorCode` `EXPORT_DEMASIADAS_FILAS`

### Requirement: Resolución del origen de una AC
`GET /api/acciones-correctivas/{id}/origen` SHALL buscar `id` en las tres tablas, dentro de la empresa activa y con el origen no eliminado. Si lo encuentra, SHALL devolver `{ origenTipo, origenId }`; si no, 404. SHALL responder 403 a los roles de administración.

#### Scenario: AC de QE
- **WHEN** se pide el origen de una AC de QE de la empresa activa
- **THEN** la respuesta es `{ origenTipo: 'QE', origenId: <id del QE> }`

#### Scenario: AC inexistente o de otra empresa
- **WHEN** el id no existe o pertenece a otra empresa
- **THEN** la respuesta es 404

### Requirement: Índices de responsable en las tablas de AC
`ShacDbContext` SHALL declarar un índice sobre `ResponsableId` en `AccionCorrectivaQE`, `AccionCorrectivaNC` y `AccionCorrectivaIncidente`, con una migración que solo cree esos índices (sin cambios de columnas).

#### Scenario: Sin cambios de modelo pendientes
- **WHEN** se corre `dotnet ef migrations has-pending-model-changes` después de la migración
- **THEN** no hay cambios pendientes
