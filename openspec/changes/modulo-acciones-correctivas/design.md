## Context

Las acciones correctivas viven en tres tablas con estados distintos:

| Tabla | Enum | Estados |
|---|---|---|
| `acciones_correctivas_qe` | `QEAccionCorrectivaEstado` | PENDIENTE, EN_EJECUCION, COMPLETADA, CERRADA |
| `acciones_correctivas_nc` | `NCAccionCorrectivaEstado` | Los mismos más VENCIDA |
| `acciones_correctivas_incidente` | `AccionCorrectivaEstado` | Los mismos cuatro |

Los enums se persisten como string.

El dashboard ya unifica las tres tablas en memoria:

- `DashboardSummaryBuilder.AcUnificada` y `CollectAcsConOrigen` las unen;
- la regla única de vencida es `DashboardKpiCalculator.EsAcVencida(estado, plazo, ahora)`: `estado ∉ {CERRADA, COMPLETADA} && plazo < ahora`.

No hay pantalla ni endpoint para listarlas. Todo lo que sigue se apoya en lo implementado en `ac-tipo-responsables`, `ac-ejecucion-verificacion-evidencias` y `dashboard-alertas-coherentes`.

## Goals / Non-Goals

**Goals:**
- Tener un solo listado de AC, con un número de vencidas que coincida siempre con el KPI-08 para el mismo universo.
- Filtrar la visibilidad por rol en el servidor (D2 de Toño).
- Que los contadores y la tabla coincidan al hacer clic en cada contador.
- Exportar a Excel lo filtrado.
- Resolver los enlaces viejos `/acciones-correctivas/{id}`.

**Non-Goals:**
- Numeración propia de AC (`AC-QE-NNN-01` del PRD). No se implementa: las AC se identifican por su origen.
- Acciones sobre la AC desde el listado (iniciar, ejecutar, verificar). Se hacen en el origen.
- Cambios de esquema (solo índices).

## Decisions

### D1. Consulta: SQL para el universo y C# para estado, vencida y contadores

`AccionesCorrectivasQuery` hace una sola consulta Dapper con `UNION ALL` de las tres tablas. Cada rama hace JOIN con su origen (`quality_events`, `no_conformidades`, `incidentes`) y con `areas` (clave compuesta `empresa_id` + `id`) para traer:

- el número del origen;
- el área del origen y su nombre;
- el nombre del responsable: `asp_net_users` en la rama de incidente, porque esa tabla no lo denormaliza.

**Filtros en SQL**, que acotan el universo:

- `origen.empresa_id = @EmpresaId` y `origen.deleted_at IS NULL` en las tres ramas;
- visibilidad por rol (D3);
- `tipo`, `origenTipo` (se omiten las ramas no pedidas), `responsableId` y `areaId`;
- rangos de plazo y de creación;
- `search` con `ILIKE` sobre la descripción, el título y el número de origen.

**Filtros en C#**, sobre las filas ya traídas:

- estado normalizado;
- `Vencida`, calculado con `DashboardKpiCalculator.EsAcVencida` sobre el **estado original** y con `DateTime.UtcNow`, igual que el KPI-08;
- `DiasHabilesRestantes`;
- filtros de estado, `vencida`, `porVencer` y rango de cierre;
- contadores, orden y paginación.

**Por qué no todo en SQL:** la instrucción exige que `Vencida` salga de la función C#, para que nunca diverja del KPI-08. Y `porVencer` depende de `AjustePlazoCalculator.ContarDiasHabiles`, que no tiene espejo SQL. El volumen de AC por empresa es de cientos a pocos miles de filas, así que filtrar en memoria es aceptable, y es el mismo patrón que ya usa el dashboard. **Alternativa descartada:** replicar las reglas en SQL. Se descarta porque abre dos fuentes de verdad.

### D2. Estado normalizado

| Estado normalizado | Viene de |
|---|---|
| `PENDIENTE` | PENDIENTE |
| `EN_EJECUCION` | EN_EJECUCION, y VENCIDA de NC |
| `PENDIENTE_VERIFICACION` | COMPLETADA (en las tres tablas) |
| `CERRADA` | CERRADA |

**VENCIDA de NC:** la tabla de NC no guarda si la AC se llegó a iniciar (no tiene `ejecutada_en` ni equivalente), así que no se puede distinguir de PENDIENTE. Se mapea a `EN_EJECUCION`. La condición de vencida la da el flag `Vencida`: `EsAcVencida("VENCIDA", …)` es `true` si el plazo pasó, y el plazo de una AC marcada VENCIDA siempre está vencido. `EstadoOriginal` conserva `VENCIDA` y se exporta a Excel.

### D3. Visibilidad por rol (en el servidor)

El rol es `GetRolEfectivo()`, el rol de la empresa activa, igual que en `ObtenerSummaryEndpoint`.

| Rol | Visibilidad |
|---|---|
| JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, AUDITOR_INTERNO, ALTA_DIRECCION | Sin filtro adicional |
| SUPERVISOR | `(origen.area_id = ANY(@AreaIds) OR ac.responsable_id = @UsuarioId)`. `@AreaIds` sale de `DashboardDataFetcher.FetchUsuarioAreaIdsAsync`, la misma fuente que el dashboard del supervisor |
| OPERARIO | `ac.responsable_id = @UsuarioId` |
| ADMINISTRADOR_EMPRESA, ADMINISTRADOR_SISTEMA, SUPERADMIN o sin rol | `ForbiddenBusinessException`, que se traduce en 403 |

La política es una clase pura, `AccionesCorrectivasVisibilidad`, testeable y reutilizada por el listado, el export y el origen.

**Filtro `areaId` del SUPERVISOR:** si pide un área que no es suya, el filtro se combina con la visibilidad (AND), así que solo ve las de esa área en las que es responsable. No es un 403.

### D4. Contadores sobre la base sin filtros de estado

Los filtros se dividen en dos grupos:

- **Filtros base:** `tipo`, `origenTipo`, `responsableId`, `areaId`, plazo, creación y `search`.
- **Filtros de estado:** `estado`, `vencida`, `porVencer` y el rango de cierre (`cerradaDesde` / `cerradaHasta`).

Los contadores se calculan sobre visibilidad + filtros base, e ignoran los filtros de estado. Así, tocar una tarjeta no hace cambiar las demás.

| Contador | Regla |
|---|---|
| `abiertas` | Normalizado ∈ {PENDIENTE, EN_EJECUCION} |
| `enEjecucion` | Normalizado = EN_EJECUCION |
| `pendientesVerificacion` | Normalizado = PENDIENTE_VERIFICACION |
| `vencidas` | `Vencida` |
| `porVencer` | `!Vencida && normalizado ∈ {PENDIENTE, EN_EJECUCION} && DiasHabilesRestantes <= 5`. Mismo criterio que `accionesCorrectivasPorVencer` del dashboard (excluye CERRADA y COMPLETADA), más la exclusión explícita de las vencidas |
| `cerradasPeriodo` | Normalizado = CERRADA y `FechaCierre` dentro de `[cerradaDesde, cerradaHasta]`. Sin rango, el período es el mes calendario actual en `America/Lima` (inicio del mes a las 00:00 de Lima, convertido a UTC, hasta el inicio del mes siguiente) |

El rango de cierre se trata como filtro de estado porque, si se aplicara a la base, pondría en 0 las abiertas, que no tienen fecha de cierre.

**Garantía:** el frontend, al hacer clic en "Cerradas", pone en la URL `estado=CERRADA` y el rango explícito del mes en curso en Lima. Con eso, `pagination.totalItems` coincide con el contador. Hay un test que lo verifica para los seis contadores.

### D5. Fechas de ejecución, verificación y cierre por tabla

| Campo | QE | NC e incidente |
|---|---|---|
| `EjecutadaEn` | `ejecutada_en` | `null` |
| `VerificadaEn` | `verificada_en` | `null` |
| `VerificadaPorNombre` | `verificada_por_nombre` | `null` |
| `FechaCierre` | `COALESCE(fecha_cierre, verificada_en)` | `fecha_cierre` |

En QE, la verificación cierra la AC; si `fecha_cierre` no se llenara, `verificada_en` es la fecha de cierre real. Al implementar se confirma en `VerificarAccionCorrectivaQEHandler` y, si `fecha_cierre` siempre se llena, se simplifica.

### D6. `DiasHabilesRestantes` con signo

- Si `plazo >= hoy`: `ContarDiasHabiles(hoy, plazo)`.
- Si el plazo ya pasó: `-ContarDiasHabiles(plazo, hoy)`.

El frontend muestra "vence en N d", "vence hoy" (0, no vencida) o "vencida hace N d" (usa `Vencida` y el valor absoluto). El color del semáforo sale de `calcularEstadoSemaforoFila` (`shared-semaforo-pendientes`), y para las CERRADA y PENDIENTE_VERIFICACION no se muestra semáforo.

### D7. Orden y paginación

- `orden=plazo` (por defecto): vencidas primero y luego `PlazoFecha` ascendente.
- `orden=creado`: `CreadoEn` descendente.
- `orden=estado`: orden del flujo (PENDIENTE → EN_EJECUCION → PENDIENTE_VERIFICACION → CERRADA) y luego plazo.
- `dir=asc|desc` opcional invierte el orden principal.
- `page` empieza en 1; `pageSize` vale 25 por defecto, con un máximo de 100 (valores mayores → 400).

**Respuesta:** `ApiResponse.Ok(new { items, pagination: { page, pageSize, totalItems, totalPages }, contadores })`.

**Divergencia:** la instrucción habla de `pagination.total`. Se usa `totalItems` porque así se llama el campo en el `ApiResponse` estándar del proyecto (CLAUDE.md).

### D8. Export a JSON y Excel en el frontend

`GET /api/acciones-correctivas/export` reutiliza la misma consulta y los mismos filtros de fila, sin paginar. Si hay más de 5.000 filas, lanza una excepción de negocio con `errorCode = EXPORT_DEMASIADAS_FILAS` y responde 422. El `.xlsx` lo arma el frontend con `xlsx`, que ya es dependencia y se usa en `dashboard/export/exportToExcel.ts`.

**Alternativa descartada:** OpenXML en el backend. Agrega una dependencia nueva y duplica el formateo de i18n.

**Formato de fechas en el Excel:** `dd/mm/aaaa`.

- Los timestamps (creación, ejecución, verificación y cierre) usan `Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima' })`.
- El plazo es una fecha de calendario (se guarda como medianoche UTC) y se formatea con el helper de fechas de calendario (`shared-calendar-date-format`), **sin** convertirla a Lima, para no correr un día.

**Nombre de archivo:** `acciones-correctivas-{empresa}-{yyyyMMdd}.xlsx`. `{empresa}` es el slug del nombre (o código) de la empresa activa del `authStore`, y la fecha se toma en hora de Lima.

### D9. Resolución del origen para `/acciones-correctivas/:id`

`GET /api/acciones-correctivas/{id}/origen` → `{ origenTipo, origenId }`.

- Busca el id en las tres tablas, acotado a la empresa activa y a orígenes no eliminados. Si no lo encuentra, responde 404.
- No aplica la visibilidad de D3: el destino ya tiene su propio `RoleGuard` y sus permisos, y saber a qué QE pertenece una AC de la propia empresa no expone datos.
- Los roles de administración igual reciben 403.

En el frontend, la ruta `/acciones-correctivas/:id` monta `AccionCorrectivaOrigenRedirect`:

1. resuelve el origen con `useQuery`;
2. hace `<Navigate replace>` a `/quality-events/{id}#qe-ac-section`, `/nonconformities/{id}` o `/incidents/{id}`;
3. si recibe 404, muestra un toast y navega a `/acciones-correctivas`.

### D10. Navegación desde la fila según el rol

El destino de cada fila se calcula con `rutaOrigenAC(origenTipo, origenId)`.

- La fila es clicable solo si `isRouteAllowedForRole(ruta, rol)`.
- Ejemplo: el OPERARIO no tiene acceso a `/nonconformities/:id`, así que sus AC de NC se muestran sin enlace, en vez de mandarlo a `/no-autorizado`.
- El ancla del QE es `#qe-ac-section`, el `id` que `QEACSection` ya tenía (ver "Divergencias encontradas al implementar").

### D11. Invalidación del listado

**Divergencia con la instrucción**, que pide invalidar `['acciones-correctivas']` desde cada mutación:

- Ese prefijo ya lo usan las queries de configuración y candidatos de responsables. Invalidarlas sin motivo dispararía refetches inútiles.
- El listado usa `['acciones-correctivas', 'listado', filtros]`.
- `invalidarDashboard(queryClient)` ya se llama en **todas** las mutaciones de AC (crear, actualizar, iniciar, ejecutar, verificar, devolver y cerrar, en QE, NC e incidente) y en cada notificación (`invalidarQueriesDeEntidad`).
- Por eso se agrega ahí una sola línea que también invalida `['acciones-correctivas', 'listado']`. No se tocan veinte hooks, y no hay riesgo de olvidar uno.

### D12. Índices

Las tablas de AC **no tienen `empresa_id`**: la empresa se resuelve por el origen, y `quality_events`, `no_conformidades` e `incidentes` ya tienen índice en `empresa_id`. Las FK al origen ya tienen índice.

**Divergencia con la instrucción**, que pide verificar índices en `empresa_id`: no aplica a estas tablas. Lo que falta es `responsable_id` en las tres, que es el filtro del OPERARIO y del SUPERVISOR. Se agrega con `HasIndex(e => e.ResponsableId)` en `ShacDbContext` y una migración que solo crea esos tres índices.

### D13. `AlertaCard` con nivel `success`

La tarjeta "Cerradas" necesita un tono distinto de error, warning e info. Se agrega `nivel: 'success'`:

- fondo `bg-success/10` (`dark:bg-success/15`);
- número `text-success`;
- anillo `ring-success`.

El resto de los dashboards no cambia.

### D14. Predicado de vencida compartido en MSW

`esAcVencida` hoy es privado de `dashboard.handlers.ts`. Se mueve a `mocks/utils/accionesCorrectivas.mock.ts`, junto con la unificación de las tres colecciones y la normalización, y lo importan los dos handlers. Así, en desarrollo, la tarjeta "Vencidas" y el anillo del KPI-08 coinciden igual que en el backend.

Los handlers leen los stores vivos de QE, NC e incidentes (los getters de `dashboard-msw-handlers`), no un fixture nuevo. Si los fixtures actuales no cubren algún caso (vencida, por vencer, pendiente de verificación o cerrada este mes en las tres fuentes), se agregan AC a los fixtures existentes.

**Divergencia:** no se crea un `accionesCorrectivas.fixtures.ts` aparte, porque duplicaría AC que ya existen dentro de cada origen.

## Risks / Trade-offs

- **Filtrar en memoria escala mal con decenas de miles de AC.** Se mitiga con los filtros base en SQL, los índices de D12 y el tope de 5.000 filas del export. Si crece, se migra `Vencida` a SQL con un test de paridad contra `EsAcVencida`.
- **"hoy" es UTC** (como el KPI-08) y el mes de "Cerradas" se calcula en Lima. Una AC con plazo hoy puede verse vencida algunas horas antes del fin del día en Lima. Es el mismo comportamiento que el KPI-08 y se mantiene a propósito, para no divergir.
- **El supervisor puede pedir `areaId` de otra área.** Solo ve sus AC de esa área como responsable, no hay fuga: la visibilidad siempre se aplica con AND.
- **El slug de la empresa puede no estar en `authStore`.** En ese caso se usa el id de la empresa activa.

## Migration Plan

1. Migración solo de índices (`AddIndicesResponsableAcciones`): `dotnet ef migrations add` y luego `dotnet ef database update`.
2. Desplegar el backend y después el frontend. Sin flags.
3. **Rollback:** revertir el frontend. El endpoint nuevo no afecta a nadie, y los índices se pueden quitar con la migración `Down`.

## Divergencias encontradas al implementar

- **D5, confirmado:** `VerificarAccionCorrectivaQEHandler` llena `FechaCierre` al verificar. El `COALESCE(fecha_cierre, verificada_en)` se mantiene como red para otras vías hacia CERRADA, por ejemplo `CambiarEstadoAccionCorrectivaQE`.
- **`VerificadaPorNombre`:** en `AccionCorrectivaQE` está `[NotMapped]`, sin columna. Se resuelve con `LEFT JOIN asp_net_users` sobre `verificada_por_id`, el mismo criterio que `AccionCorrectivaQELoader`.
- **Ancla del QE:** `QEACSection` ya tenía `id="qe-ac-section"`. Se usa ese id en vez de crear `#acciones-correctivas`, así que `rutaOrigenAC('QE', id)` devuelve `/quality-events/{id}#qe-ac-section`. El detalle del QE no se desplazaba con el hash (en una SPA el navegador no lo hace solo). Ahora `QEACSection` usa un *ref callback* estable (`useCallback` sin dependencias, no `useEffect`) que llama a `scrollIntoView` cuando `window.location.hash === '#qe-ac-section'`.
- **422 del export:** usa `BusinessRuleException(message, "EXPORT_DEMASIADAS_FILAS")`, que antepone el código al mensaje (`"EXPORT_DEMASIADAS_FILAS: …"`). Por eso el frontend no muestra `message`: con ese `errorCode` usa `t('accionesCorrectivas:errors.EXPORT_DEMASIADAS_FILAS')`, que además respeta el idioma.
- **Áreas del supervisor en el frontend:** el campo de `User` es `areaIds`, no `areasAsignadas` (CLAUDE.md usa el nombre viejo). El combo de área del SUPERVISOR y la visibilidad del mock usan `areaIds`.
- **Opciones del filtro de responsable:** salen de `GET /api/users/candidatos` con `ROLES_OPERATIVOS` (`useCandidatosUsuarios`), no de los candidatos por tipo de AC. Un responsable asignado con otra configuración de la empresa igual aparece.
- **Fixtures MSW:** las AC de QE salen del mapa `qeAccionesCorrectivas`, que pisa el arreglo inline. Todas tenían fechas fijas ya vencidas, así que "Por vencer" y "Cerradas este mes" daban 0. Se agregaron `ac-qe-013-01` (EN_EJECUCION, plazo hoy + 3) y `ac-qe-013-02` (CERRADA hace 1 h) a `qe-2026-013`, con fechas relativas al momento de carga.
- **KPI-08 en MSW frente a orígenes eliminados:** el listado mock excluye los orígenes con `deletedAt`, igual que el backend. `calcularKpi08` de `dashboard.handlers.ts` no los excluye (comportamiento previo del mock). Hoy ningún fixture tiene una AC vencida en un origen eliminado, y el test de paridad pasa. Si alguna vez lo tuviera, el mock del dashboard divergiría del backend, no el listado.
- **Hora de Lima en el frontend:** `limaFechas.ts` asume UTC−5 fijo, porque Perú no aplica horario de verano.
- **Verificación local:** el backend de desarrollo estaba corriendo (bloquea `bin/Debug`), así que la compilación, la migración y los tests se corrieron con `-c Release`.
- **Errores previos ajenos a este change:** `tsc -b` ya reportaba 18 errores en `documents.fixtures.ts`, `documents.handlers.ts`, `documents.types.test.ts` y `PanelPendientesAreaWidget.test.tsx` (vienen de `f409fba`, que quitó `archivoUrl` de `Documento`). `eslint` ya reportaba `react-refresh/only-export-components` en `router/index.tsx` por `DefaultRouteRedirect`. Este change no agrega errores.
