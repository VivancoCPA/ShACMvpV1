## ADDED Requirements

### Requirement: Tipos, API y hooks del listado de AC
El sistema SHALL definir en `src/features/acciones-correctivas/` lo siguiente:

**Tipos** (`types/accionesCorrectivasListado.types.ts`):
- `ACEstadoNormalizado` (`'PENDIENTE' | 'EN_EJECUCION' | 'PENDIENTE_VERIFICACION' | 'CERRADA'`);
- `ACOrigenTipo` (`'QE' | 'NC' | 'INCIDENTE'`);
- `AccionCorrectivaListadoItem`, `ACListadoFiltros`, `ACListadoContadores` y `ACListadoResponse`.

**API** (`api/accionesCorrectivasListado.api.ts`): `listarAccionesCorrectivas(filtros)`, `exportarAccionesCorrectivas(filtros)` y `obtenerOrigenAccionCorrectiva(id)`, sobre la instancia Axios.

**Hooks:**
- `useAccionesCorrectivasListado(filtros)`, con la query key `['acciones-correctivas', 'listado', filtros]` y `placeholderData: keepPreviousData`;
- `useOrigenAccionCorrectiva(id)`.

#### Scenario: Query key del listado
- **WHEN** `useAccionesCorrectivasListado({ vencida: true, page: 1 })` se monta
- **THEN** la query usa la key `['acciones-correctivas', 'listado', { vencida: true, page: 1 }]`

### Requirement: Página AccionesCorrectivasPage con título por rol
El sistema SHALL implementar `AccionesCorrectivasPage` (`pages/AccionesCorrectivasPage.tsx`) dentro de `PageWrapper` y de su propio `ErrorBoundary`.

- **Título:** `t('accionesCorrectivas:title')` para todos los roles, salvo el `OPERARIO`, que ve `t('accionesCorrectivas:titleMias')`.
- **Acción del encabezado:** el botón "Exportar a Excel".

#### Scenario: Operario ve "Mis acciones correctivas"
- **WHEN** un `OPERARIO` abre `/acciones-correctivas`
- **THEN** el título es "Mis acciones correctivas" y no aparece el filtro de responsable

#### Scenario: JCA ve "Acciones correctivas"
- **WHEN** un `JEFE_CALIDAD_SYST` abre `/acciones-correctivas`
- **THEN** el título es "Acciones correctivas" y el filtro de responsable está disponible

### Requirement: Franja de contadores que filtran la tabla
La página SHALL mostrar seis `AlertaCard` en modo selector (`onSelect`, `activa`, con `aria-pressed`), en una grilla responsive. Los números SHALL salir de `contadores` del backend.

| Tarjeta | Nivel | Filtro que aplica |
|---|---|---|
| Abiertas | `info` | `estado=PENDIENTE,EN_EJECUCION` |
| En ejecución | `info` | `estado=EN_EJECUCION` |
| Pendientes de verificación | `warning` | `estado=PENDIENTE_VERIFICACION` |
| Por vencer (5 días hábiles) | `warning` | `porVencer=true` |
| Vencidas | `error` | `vencida=true` |
| Cerradas este mes | `success` | `estado=CERRADA`, más `cerradaDesde`/`cerradaHasta` del mes actual en Lima |

- Al hacer clic, la tarjeta reemplaza los filtros de estado por el suyo, vuelve a `page=1` y queda activa.
- Un segundo clic quita su filtro.
- Una tarjeta está activa cuando los filtros de estado de la URL coinciden exactamente con los suyos.

#### Scenario: Clic en Vencidas
- **WHEN** `contadores.vencidas` es 30 y el usuario hace clic en "Vencidas"
- **THEN** la URL tiene `vencida=true`, la tarjeta tiene `aria-pressed="true"`, y el total de la tabla es 30 (las 2 páginas de 25 suman 30 filas)

#### Scenario: Segundo clic quita el filtro
- **WHEN** "Vencidas" está activa y el usuario vuelve a hacer clic
- **THEN** la URL ya no tiene `vencida` y la tarjeta tiene `aria-pressed="false"`

### Requirement: Filtros sincronizados con la URL
La barra de filtros SHALL ofrecer:
- estado (selección múltiple), tipo, origen (QE, NC o Incidente);
- responsable (combo con búsqueda; **oculto para el OPERARIO**);
- área (para el SUPERVISOR, solo sus `areaIds`);
- rangos de plazo y de creación, y búsqueda de texto con debounce;
- un botón "Limpiar filtros".

Todos los filtros, el orden y la página SHALL vivir en la URL (`useSearchParams`), sin estado local duplicado. Cambiar un filtro SHALL volver a `page=1`.

#### Scenario: Filtros sobreviven a F5
- **WHEN** el usuario filtra por `origenTipo=INCIDENTE&tipo=MEJORA` y recarga la página
- **THEN** los controles muestran esos valores y la tabla sigue filtrada

#### Scenario: Limpiar filtros
- **WHEN** el usuario pulsa "Limpiar filtros"
- **THEN** la URL queda sin parámetros de filtro y ninguna tarjeta está activa

### Requirement: Tabla de AC con navegación al origen
La tabla SHALL mostrar estas columnas:
- **Origen:** badge QE / NC / INC con el número del origen;
- **Descripción:** truncada, con `title` completo;
- **Tipo:** badge;
- **Responsable:** iniciales o avatar y nombre;
- **Área;**
- **Plazo:** fecha y texto de semáforo. "vence en N d", "vence hoy" o "vencida hace N d", con el color de `calcularEstadoSemaforoFila`. Sin semáforo para `PENDIENTE_VERIFICACION` y `CERRADA`;
- **Estado:** badge normalizado;
- **Verificada por:** nombre y fecha, solo si está CERRADA.

**Orden y paginación:** se ordena por plazo, creado o estado con encabezados clicables (`aria-sort`), y se pagina de 25 en 25.

**Navegación al origen:** el destino sale de `rutaOrigenAC(origenTipo, origenId)`:
- QE → `/quality-events/{id}#qe-ac-section` (ancla existente de `QEACSection`, que se desplaza a la vista al montar con ese hash);
- NC → `/nonconformities/{id}`;
- INCIDENTE → `/incidents/{id}`.

La fila y el número de origen SHALL navegar al destino **solo** si `isRouteAllowedForRole(destino, rol)`. Si no, se muestran sin enlace.

**Móvil:** por debajo de `md`, cada fila SHALL mostrarse como una tarjeta apilada.

**Vacío:** sin filas, SHALL mostrarse `t('accionesCorrectivas:vacio')`.

#### Scenario: Clic en fila de QE
- **WHEN** el usuario hace clic en una fila con `origenTipo: 'QE'` y `origenId: 'qe-1'`
- **THEN** navega a `/quality-events/qe-1#qe-ac-section`

#### Scenario: Operario con AC de NC
- **WHEN** un `OPERARIO` ve una AC suya de origen NC
- **THEN** la fila no es un enlace, porque su rol no tiene acceso a `/nonconformities/:id`

#### Scenario: Estado vacío
- **WHEN** los filtros no devuelven filas
- **THEN** se muestra "No hay acciones correctivas con estos filtros."

### Requirement: Exportación a Excel de lo filtrado
El botón "Exportar a Excel" SHALL llamar a `exportarAccionesCorrectivas` con los filtros actuales (sin paginación) y SHALL armar el libro con `buildAccionesCorrectivasWorkbook(items, i18n)` (`utils/exportAccionesCorrectivas.ts`), en una hoja "Acciones correctivas".

**Columnas:** las de la tabla, más el estado original, la fecha de creación, la fecha de ejecución y la fecha de cierre.

**Fechas:**
- los timestamps van en `dd/mm/aaaa`, en hora de `America/Lima`;
- el plazo es una fecha de calendario y no se convierte de zona horaria.

**Nombre de archivo:** `acciones-correctivas-{empresa}-{yyyyMMdd}.xlsx`.

**Errores:** ante 422 con `errorCode` `EXPORT_DEMASIADAS_FILAS`, SHALL mostrar un `toast.error` con `t('accionesCorrectivas:errors.EXPORT_DEMASIADAS_FILAS')`. Ante cualquier otro error, con `t('accionesCorrectivas:errors.exportar')`.

#### Scenario: Hoja con columnas y fechas correctas
- **WHEN** `buildAccionesCorrectivasWorkbook` recibe una AC con `creadoEn: '2026-11-03T02:00:00Z'` y `plazoFecha: '2026-11-20T00:00:00Z'`
- **THEN** la hoja "Acciones correctivas" tiene la fila de encabezados esperada, la creación en `02/11/2026` (hora de Lima) y el plazo en `20/11/2026`

#### Scenario: Export bloqueado por tamaño
- **WHEN** el servidor responde 422 con `errorCode: 'EXPORT_DEMASIADAS_FILAS'`
- **THEN** se muestra un toast de error y no se descarga ningún archivo

### Requirement: Namespace i18n accionesCorrectivas
El sistema SHALL agregar el namespace `accionesCorrectivas` en `es-PE.json` y `en-US.json`, y registrarlo en `i18n/index.ts`. SHALL incluir las claves:
- `title`, `titleMias`;
- `contadores.*` (`abiertas`, `enEjecucion`, `pendientesVerificacion`, `porVencer`, `vencidas`, `cerradasPeriodo`);
- `columnas.*`;
- `estado.*` (los cuatro estados normalizados);
- `origen.*`, `tipo.*`, `filtros.*` (incluida `limpiar`), `plazo.*` (textos de semáforo);
- `exportar`, `vacio` y `errors.EXPORT_DEMASIADAS_FILAS`.

Los textos SHALL ser los de la instrucción del 2026-11-19. Ningún texto visible de la página SHALL estar hardcodeado.

#### Scenario: Paridad de claves
- **WHEN** se comparan las claves de `accionesCorrectivas` en es-PE y en-US
- **THEN** son idénticas
