# INSTRUCCIONES PARA CLAUDE CODE — Módulo "Acciones correctivas": listado consolidado con contadores, filtros y exportación a Excel

- **Fecha:** 2026-11-19
- **Autor:** Cowork (para Toño)
- **Origen:** Toño preguntó si hay alguna forma de ver las acciones correctivas. Hoy no se ven en un solo lugar y no se sabe cuántas hay abiertas, cerradas o vencidas.
- **Change OpenSpec:** `modulo-acciones-correctivas`
- **Flujo:** `/opsx:sync → /opsx:propose → /opsx:apply → /opsx:archive`
- **Dependencias:** usa lo de `ac-tipo-responsables`, `ac-ejecucion-verificacion-evidencias` (estado COMPLETADA y verificador) y `dashboard-alertas-coherentes` (`EsAcVencida`). Todo eso ya está implementado.
- **Sin migración**: solo lecturas. Si hace falta un índice para el rendimiento, anotarlo en `design.md` y agregarlo como migración solo de índices.

---

## 1. Diagnóstico confirmado leyendo el código

- **No existe una pantalla de AC.** Las rutas de `shc-controldoc/src/router/index.tsx` no incluyen ninguna de acciones correctivas, y el menú (`components/layout/Sidebar.tsx`) tampoco.
- **Dónde se ven hoy las AC:**
  - dentro de cada QE (`QEACSection`);
  - en el incidente y la NC, las del QE vinculado (`solicitudes-ac-y-ac-del-qe-en-origen`);
  - en los widgets del dashboard (AC vencidas y por vencer).
- **No existe un endpoint que liste todas las AC de la empresa.** El único bajo `/api/acciones-correctivas` es `candidatos-responsable`.
- **Hay tres tablas de AC** con estados distintos:
  - `acciones_correctivas_qe` (`QEAccionCorrectivaEstado`: PENDIENTE, EN_EJECUCION, COMPLETADA, CERRADA);
  - `acciones_correctivas_nc` (`NCAccionCorrectivaEstado`: PENDIENTE, EN_EJECUCION, COMPLETADA, CERRADA, VENCIDA);
  - `acciones_correctivas_incidente` (`AccionCorrectivaEstado`: PENDIENTE, EN_EJECUCION, COMPLETADA, CERRADA).
- **Ya hay piezas para reutilizar:**
  - `DashboardSummaryBuilder` tiene un record `AcUnificada(OrigenTipo, OrigenId, Id, Descripcion, ResponsableId, ResponsableNombre, PlazoFecha, Estado)` que unifica las tres tablas;
  - `DashboardKpiCalculator.EsAcVencida(estado, plazo, hoy)` es la regla única de vencida;
  - `DashboardDataFetcher` ya lee las tres tablas.
- **Las AC no tienen número propio.** El PRD propone `AC-QE-NNN-01`, pero no está implementado. Se identifican por su origen y su descripción.
- **El frontend ya tiene la librería `xlsx`** (`package.json`: `"xlsx": "^0.18.5"`).

---

## 2. Decisiones de Toño

- **D1:** el listado incluye **todas** las AC: las de QE, las de NC y las de incidente (las antiguas). Lleva una columna de origen y se usa el **mismo criterio de vencida que el KPI-08** (`EsAcVencida`).
- **D2:** la visibilidad depende del rol y **se filtra en el servidor**:

  | Rol | Ve |
  |---|---|
  | JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, ALTA_DIRECCION, AUDITOR_INTERNO | Todas las AC de la empresa |
  | SUPERVISOR | Las AC cuyo origen es de **sus áreas** (`AreaIds`/`AreaId`) **más** las que tiene asignadas como responsable |
  | OPERARIO | Solo las suyas, como responsable. La pantalla se titula "Mis acciones correctivas" |

- **D3:** **exportación a Excel** de lo que esté filtrado en ese momento.

---

## 3. Qué implementar

### 3.1 Backend (`ShcMvpEndPoint/Features/AccionesCorrectivas/`)

**a) Consulta unificada** (`Shared/AccionesCorrectivasQuery.cs`)

- Arma, con Dapper, una consulta `UNION ALL` de las tres tablas. Cada fila trae:

  | Campo | Fuente o regla |
  |---|---|
  | `Id`, `OrigenTipo` (`QE` / `NC` / `INCIDENTE`), `OrigenId`, `OrigenNumero` | Número del QE, de la NC o del incidente, con JOIN |
  | `Descripcion` | |
  | `Tipo` | CORRECTIVA, PREVENTIVA o MEJORA. Las tablas que no lo tengan devuelven `CORRECTIVA`, igual que la migración de `ac-tipo-responsables` |
  | `Prioridad` | |
  | `ResponsableId`, `ResponsableNombre` | |
  | `AreaId`, `AreaNombre` | El área **del origen** |
  | `PlazoFecha` | |
  | `EstadoNormalizado` | Ver la tabla siguiente |
  | `EstadoOriginal` | |
  | `EjecutadaEn`, `VerificadaEn`, `VerificadaPorNombre` | `null` donde no existan |
  | `CreadoEn`, `FechaCierre` | |
  | `Vencida` | Calculado **en C#** con `DashboardKpiCalculator.EsAcVencida`, no en SQL, para que nunca diverja del KPI-08 |
  | `DiasHabilesRestantes` | Calculado con el helper de días hábiles que ya existe (`AjustePlazoCalculator.ContarDiasHabiles` o el que use el dashboard) |

- **Estado normalizado:** cada estado original se mapea a uno común para filtrar y contar.

  | Estado normalizado | Viene de |
  |---|---|
  | `PENDIENTE` | PENDIENTE |
  | `EN_EJECUCION` | EN_EJECUCION |
  | `PENDIENTE_VERIFICACION` | COMPLETADA (en las tres tablas) |
  | `CERRADA` | CERRADA |

  El estado `VENCIDA` de NC **no** es un estado normalizado: se mapea a `EN_EJECUCION` (o `PENDIENTE` si nunca se inició, si puede saberse), y la condición de vencida la da el flag `Vencida`. Documentarlo en `design.md`.
- **Filtros obligatorios:**
  - `empresa_id` de la sesión en las tres partes del UNION;
  - excluir las AC cuyo origen está eliminado (`deleted_at` del QE, la NC o el incidente).
- **Filtro de visibilidad (D2)**, aplicado en el servidor según el rol de empresa de la sesión:
  - **SUPERVISOR:** `(origen.area_id IN @AreasDelUsuario) OR responsable_id = @UsuarioId`. Para las áreas, usar `DashboardDataFetcher.FetchUsuarioAreaIdsAsync`;
  - **OPERARIO:** `responsable_id = @UsuarioId`;
  - **resto de roles operativos:** sin filtro adicional;
  - **roles de administración** (ADMINISTRADOR_EMPRESA, ADMINISTRADOR_SISTEMA, SUPERADMIN): **403**.

**b) `GET /api/acciones-correctivas`** (slice `ListarAccionesCorrectivas`)

- **Query params**, todos opcionales:
  - `estado` (uno o varios estados normalizados), `vencida` (bool), `porVencer` (bool: no vencida, no cerrada y con 5 días hábiles o menos);
  - `tipo`, `origenTipo`, `responsableId`, `areaId`;
  - `plazoDesde` / `plazoHasta`, `creadaDesde` / `creadaHasta`, `cerradaDesde` / `cerradaHasta`;
  - `search` (descripción o número de origen, con ILIKE);
  - `orden` (`plazo`, `creado`, `estado`; por defecto `plazo` ascendente, con las vencidas primero);
  - `page` y `pageSize` (por defecto 25, máximo 100).
- **Respuesta:** `{ items, pagination, contadores }`.
  - `contadores` se calcula sobre el universo **visible para el usuario** (D2) con los filtros que **no** son de estado aplicados, y siempre devuelve los seis: `abiertas` (PENDIENTE + EN_EJECUCION), `enEjecucion`, `pendientesVerificacion`, `porVencer`, `vencidas` y `cerradasPeriodo`.
  - `cerradasPeriodo` cuenta las cerradas dentro de `cerradaDesde`/`cerradaHasta`. Si no se envía rango, el período es el mes actual en hora de Lima.
  - Así el número de cada contador coincide siempre con lo que muestra la tabla al hacer clic en él.
- **Exportación:** `GET /api/acciones-correctivas/export`, con los mismos filtros y sin paginar, hasta **5.000 filas**. Si hay más, responde 422 `EXPORT_DEMASIADAS_FILAS` y pide acotar los filtros.
  - Devuelve el mismo JSON de items; el `.xlsx` lo arma el frontend con `xlsx`.
  - Si se prefiere generarlo en el backend, se puede usar una librería OpenXML; anotar la elección en `design.md`.

**c) Rendimiento:** verificar que existan índices en `empresa_id` y `responsable_id` de las tres tablas de AC. Si faltan, agregarlos con una migración solo de índices.

### 3.2 Frontend (`shc-controldoc/src/features/acciones-correctivas/`)

**a) Ruta y menú**

- Ruta `/acciones-correctivas`, con `RoleGuard` para los roles operativos (OPE, SUP, JCA, JCD, AUD y DIR).
- Entrada en `Sidebar.tsx`, con el ícono `ListChecks` (o el equivalente de lucide que ya use el proyecto) y los mismos roles.
- El título es "Acciones correctivas" para todos los roles, salvo el OPERARIO, que ve "Mis acciones correctivas".
- **Redirección vieja:** agregar `/acciones-correctivas/:id` → la ruta del **origen** de la AC (por ejemplo, `/quality-events/{origenId}`). Esto completa D7 de `incidentes-qe-estado-alertas`. Si resolverlo exige un endpoint `GET /api/acciones-correctivas/{id}/origen`, agregarlo.

**b) Página `AccionesCorrectivasPage`**

- **Franja de contadores**, con el mismo componente `AlertaCard` del dashboard, en grilla responsive:

  | Contador | Nivel | Filtro que aplica |
  |---|---|---|
  | Abiertas | info | `estado=PENDIENTE,EN_EJECUCION` |
  | En ejecución | info | `estado=EN_EJECUCION` |
  | Pendientes de verificación | warning | `estado=PENDIENTE_VERIFICACION` |
  | Por vencer (5 días hábiles) | warning | `porVencer=true` |
  | Vencidas | error | `vencida=true` |
  | Cerradas (período) | success/neutral | `estado=CERRADA`, con rango de cierre |

  - Al hacer clic en un contador se aplica su filtro y la tarjeta queda **activa** (`aria-pressed`). Un segundo clic lo quita.
  - El número de cada tarjeta sale de `contadores` del backend, que usa el mismo criterio que el filtro.
- **Barra de filtros:**
  - estado (multi), tipo, origen (QE, NC o Incidente), responsable (combo con búsqueda; para el OPERARIO no aparece), área (para el SUP, solo sus áreas), plazo y fechas, y búsqueda de texto;
  - un botón "Limpiar filtros";
  - **todos los filtros van en la URL** (`useSearchParams`), para que sobrevivan a F5 y se puedan compartir.
- **Tabla:**

  | Columna | Detalle |
  |---|---|
  | Origen | Badge QE / NC / INC, con el número enlazado al detalle del origen (QE → `/quality-events/{id}`, que hace scroll a la sección de AC si existe el ancla) |
  | Descripción | Truncada, con tooltip |
  | Tipo | Badge |
  | Responsable | Avatar o iniciales y nombre |
  | Área | |
  | Plazo | Fecha y semáforo de días hábiles: "vence en N d", "vence hoy" o "vencida hace N d". Usar el componente o el helper de semáforo del dashboard |
  | Estado | Badge normalizado: Pendiente, En ejecución, Pendiente de verificación, Cerrada |
  | Verificada por | Nombre y fecha, solo si está CERRADA |

  - Paginada, de 25 en 25, con orden por columna (plazo, creado, estado).
  - Al hacer clic en la fila se navega al origen.
  - En móvil, la tabla pasa a tarjetas apiladas.
- **Estado vacío:** "No hay acciones correctivas con estos filtros."
- **Exportar a Excel:** botón en el encabezado (`PageWrapper` → `actions`).
  - Llama a `/export` con los filtros actuales y arma el `.xlsx` con `xlsx`, en una hoja "Acciones correctivas" con las columnas de la tabla más el estado original, la fecha de creación, la fecha de ejecución y la fecha de cierre.
  - Las fechas van en hora de Lima, en formato `dd/mm/aaaa`.
  - El nombre del archivo es `acciones-correctivas-{empresa}-{yyyyMMdd}.xlsx`.
  - Ante `EXPORT_DEMASIADAS_FILAS`, mostrar un toast con el mensaje del servidor.

**c) Dashboard**

- Las alertas de AC del dashboard ("AC vencidas", "Mis AC vencidas", etc.) pueden llevar además el enlace "Ver todas" a `/acciones-correctivas?vencida=true`. Sus números ya salen de la misma regla `EsAcVencida`, así que coinciden.

**d) Refresco:** las mutaciones de AC (crear, iniciar, ejecutar, verificar, devolver) y el hub de notificaciones invalidan también `['acciones-correctivas']`.

**e) i18n (namespace nuevo `accionesCorrectivas`, es-PE y en-US)**

| Clave | es-PE | en-US |
|---|---|---|
| `title` | Acciones correctivas | Corrective actions |
| `titleMias` | Mis acciones correctivas | My corrective actions |
| `contadores.abiertas` | Abiertas | Open |
| `contadores.enEjecucion` | En ejecución | In progress |
| `contadores.pendientesVerificacion` | Pendientes de verificación | Pending verification |
| `contadores.porVencer` | Por vencer (5 días hábiles) | Due soon (5 business days) |
| `contadores.vencidas` | Vencidas | Overdue |
| `contadores.cerradasPeriodo` | Cerradas este mes | Closed this month |
| `columnas.*` | Origen, Descripción, Tipo, Responsable, Área, Plazo, Estado, Verificada por | Origin, Description, Type, Owner, Area, Due date, Status, Verified by |
| `estado.PENDIENTE` | Pendiente | Pending |
| `estado.EN_EJECUCION` | En ejecución | In progress |
| `estado.PENDIENTE_VERIFICACION` | Pendiente de verificación | Pending verification |
| `estado.CERRADA` | Cerrada | Closed |
| `filtros.limpiar` | Limpiar filtros | Clear filters |
| `exportar` | Exportar a Excel | Export to Excel |
| `vacio` | No hay acciones correctivas con estos filtros. | No corrective actions match these filters. |
| `errors.EXPORT_DEMASIADAS_FILAS` | Hay demasiadas filas para exportar. Acota los filtros. | Too many rows to export. Narrow the filters. |

Agregar también la entrada del menú (`nav.accionesCorrectivas`).

### 3.3 MSW

- `GET /api/acciones-correctivas` y `/export`, con fixtures de las tres tablas (con AC vencidas, por vencer, pendientes de verificación y cerradas), aplicando la misma visibilidad por rol y devolviendo los contadores.

---

## 4. Tests

**Backend**
- **Unificación:** el listado incluye AC de QE, de NC y de incidente, cada una con su número de origen y su área.
- **Normalización:** COMPLETADA (en las tres tablas) → `PENDIENTE_VERIFICACION`; `VENCIDA` de NC → no es un estado aparte, sino `Vencida = true`.
- **Coherencia con el KPI-08:** `contadores.vencidas` es igual al KPI-08 para el mismo set de datos y el mismo usuario JCA.
- **Visibilidad:**
  - el JCA ve todas;
  - el SUP ve las de su área más las suyas de otra área, pero no las de otra área en las que no es responsable;
  - el OPE ve solo las suyas;
  - el ADMIN_EMPRESA recibe 403;
  - otra empresa nunca aparece.
- **Contadores:** cada número es igual a `pagination.total` con el filtro equivalente.
- **Filtros y paginación:** combinaciones de estado, vencida, tipo, origen, área y responsable.
- Se excluyen las AC con el origen eliminado.
- **Export:** respeta los filtros y la visibilidad; con más de 5.000 filas → 422.

**Frontend**
- Al hacer clic en "Vencidas", la tabla muestra exactamente esa cantidad de filas (paginando si hace falta) y la URL tiene `vencida=true`.
- Los filtros persisten con F5.
- El OPERARIO ve "Mis acciones correctivas", sin el filtro de responsable.
- Al hacer clic en una fila de origen QE, se navega a `/quality-events/{id}`.
- El Excel se arma con las columnas y fechas correctas (test del helper que arma la hoja).

---

## 5. Reglas de siempre

- Toda divergencia entre esta instrucción y el código real va en `design.md`, con su motivo.
- Correr la **suite completa** (frontend y backend) + `tsc --noEmit` + **`npm run lint` con cero errores**.
- Antes de la prueba manual: **detener el backend → `dotnet build`** (y `dotnet ef database update` si se agregaron índices) → `dotnet run` → Ctrl+F5. Si un endpoint nuevo responde 404, cerrar el `ShcMvpEndPoint.exe` que quedó colgado.
- **Prueba manual con MSW apagado:**
  1. Como JCA, en el menú aparece "Acciones correctivas". Los contadores muestran los totales de la empresa, y "Vencidas" coincide con el anillo del KPI-08 del dashboard.
  2. Hacer clic en "Pendientes de verificación": la tabla filtra. Hacer clic en una fila: lleva al QE.
  3. Filtrar por origen "Incidente": aparecen las AC antiguas de incidentes, si las hay.
  4. Exportar a Excel: el archivo se abre con las mismas filas que la tabla filtrada y las fechas en formato dd/mm/aaaa.
  5. Como SUPERVISOR: ve solo las de su área y las suyas.
  6. Como OPERARIO: ve "Mis acciones correctivas", con solo sus AC.
  7. Abrir una notificación vieja con un enlace `/acciones-correctivas/{id}`: redirige al origen.
  8. F5 con filtros aplicados: se mantienen.
- Toño avisa con **"listo"** para que Cowork verifique.
