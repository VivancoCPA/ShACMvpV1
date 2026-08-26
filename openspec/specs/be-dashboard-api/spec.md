# be-dashboard-api

## Purpose

Backend .NET del módulo Dashboard (M5): dos endpoints de solo lectura, 100% Dapper con agregación en memoria, scoped a la empresa activa de la sesión. `GET /api/dashboard/kpis` calcula en vivo los 9 KPIs de SHAC-PRD-003 §5.2 (tasa de cierre de QE en plazo, tiempo promedio de cierre, tasa de reincidencia trimestral, índice de frecuencia de incidentes, eficacia de acciones correctivas, % documentos vigentes, tiempo promedio de investigación, AC vencidas activas, distribución de QE por área). `GET /api/dashboard/summary` devuelve un resumen cuyo shape depende del rol efectivo del usuario (OPERARIO/SUPERVISOR/JEFE_CALIDAD/JEFE_CONTROL_DOC/ALTA_DIRECCION/AUDITOR). Dado que `QualityEvent` no persiste columnas de fecha de cierre/análisis completado/verificación realizada, ambos endpoints las derivan de `QualityEventAuditTrail`; lo mismo aplica a la fecha real de cierre de `NoConformidad` (derivada de `NoConformidadAuditTrail`, distinta de la fecha límite esperada que sí persiste la entidad). Los puntos dependientes de Documentos (M1, no implementado en este backend) quedan explícitamente diferidos.

## Requirements

### Requirement: Cálculo de KPIs en vivo
El sistema SHALL exponer `GET /api/dashboard/kpis`, calculando los 9 KPIs (KPI-01 a KPI-09) en vivo en cada request, scoped a la empresa activa de la sesión, con query opcional `periodo` (`YYYY-MM`; si se omite, usa el mes actual del servidor). El sistema SHALL restringir el acceso a los 6 roles con acceso al dashboard (`OPERARIO, SUPERVISOR, JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, AUDITOR_INTERNO, ALTA_DIRECCION`).

#### Scenario: Cálculo con periodo por defecto
- **WHEN** un usuario con un rol con acceso al dashboard solicita `GET /api/dashboard/kpis` sin `periodo`
- **THEN** el sistema responde 200 con un arreglo de 9 `KpiResult`, cada uno calculado sobre el mes calendario actual

#### Scenario: Cálculo con periodo explícito
- **WHEN** se solicita `GET /api/dashboard/kpis?periodo=2026-05`
- **THEN** el sistema calcula los 9 KPIs sobre el mes 2026-05 (o el trimestre que lo contiene, para KPI-03)

#### Scenario: Rol sin acceso al dashboard
- **WHEN** un usuario con rol `SUPERADMIN`, `ADMINISTRADOR_EMPRESA` o `ADMINISTRADOR_SISTEMA` solicita `GET /api/dashboard/kpis`
- **THEN** el sistema responde 403

#### Scenario: Sin empresa activa
- **WHEN** la sesión no tiene `empresaActivaId` resuelto
- **THEN** el sistema responde 401

### Requirement: KPI-01 — Tasa de cierre de QE en plazo
El sistema SHALL calcular KPI-01 como el porcentaje de Quality Events con `estado` en `CERRADO`/`VERIFICADO` cuya fecha de cierre derivada (ver Requirement "Derivación de fechas de Quality Event no persistidas") cae dentro del mes de `periodo`, y cuya diferencia en días hábiles entre `fechaHoraReporte` y esa fecha de cierre es menor o igual al plazo máximo de su severidad (`BAJA=22, MEDIA=17, ALTA=14, CRITICA=10` días hábiles). Meta 90, `metaTipo: ABSOLUTO`, dirección `MAYOR_MEJOR`.

#### Scenario: QE cerrado en plazo
- **WHEN** un QE `severidad: ALTA` cierra a los 10 días hábiles de reportado, dentro del mes de `periodo`
- **THEN** ese QE cuenta como "en plazo" en el numerador de KPI-01

#### Scenario: QE cerrado fuera de plazo
- **WHEN** un QE `severidad: ALTA` cierra a los 20 días hábiles de reportado, dentro del mes de `periodo`
- **THEN** ese QE cuenta en el denominador pero no en el numerador de KPI-01

#### Scenario: Sin QEs cerrados en el periodo
- **WHEN** ningún QE de la empresa cierra dentro del mes de `periodo`
- **THEN** KPI-01 responde `valor: 0`

### Requirement: KPI-02 — Tiempo promedio de cierre de QE
El sistema SHALL calcular KPI-02 como el promedio en días hábiles entre `fechaHoraReporte` y la fecha de cierre derivada, sobre el mismo conjunto de QE cerrados en el mes de `periodo` que usa KPI-01. Meta 15 días, `metaTipo: ABSOLUTO`, dirección `MENOR_MEJOR`.

#### Scenario: Promedio sobre múltiples QE cerrados
- **WHEN** en el mes de `periodo` cierran 2 QE con 10 y 20 días hábiles de duración respectivamente
- **THEN** KPI-02 responde `valor: 15`

### Requirement: KPI-03 — Tasa de reincidencia trimestral
El sistema SHALL calcular KPI-03 como el porcentaje de QE con `ciclo > 1` sobre el total de QE con `estado` en `CERRADO`/`VERIFICADO` cuya fecha de cierre derivada cae dentro del **trimestre** calendario que contiene `periodo` (no el mes). La respuesta SHALL reportar `periodo` con formato `YYYY-QN`. Meta 5%, `metaTipo: ABSOLUTO`, dirección `MENOR_MEJOR`.

#### Scenario: QE reincidente en el trimestre
- **WHEN** un QE con `ciclo: 2` cierra dentro del trimestre de `periodo`
- **THEN** ese QE cuenta en el numerador de KPI-03

#### Scenario: Periodo distinto de mes, mismo trimestre
- **WHEN** se calcula KPI-03 con `periodo=2026-05` y con `periodo=2026-06`
- **THEN** ambos cálculos usan el mismo rango de fechas (Q2) y devuelven el mismo `periodo: "2026-Q2"` en la respuesta

### Requirement: KPI-04 — Índice de frecuencia de incidentes
El sistema SHALL calcular KPI-04 como `(número de Incidentes con huboLesionados=true y fechaEvento en el mes de periodo × 1 000 000) / horas trabajadas de la empresa en ese periodo` (suma de `HorasTrabajadas` de todas las áreas de la empresa activa para ese `periodo`; `0` si no hay horas cargadas). `metaTipo: REDUCCION_INTERANUAL`, meta 10 (% de reducción interanual). El semáforo SHALL comparar contra el valor de `Kpi04ValorAnioAnterior` para el mismo `periodo`: `VERDE` si la reducción real es ≥ 10%, `AMARILLO` si la reducción está entre 0% y 10%, `ROJO` si el valor empeoró o si no hay valor de año anterior cargado para ese `periodo`.

#### Scenario: Sin horas trabajadas cargadas
- **WHEN** no existe ninguna fila de `HorasTrabajadas` para la empresa y el `periodo` solicitado
- **THEN** KPI-04 responde `valor: 0`

#### Scenario: Reducción interanual que cumple la meta
- **WHEN** el valor actual de KPI-04 implica una reducción ≥10% respecto al `Kpi04ValorAnioAnterior` del mismo `periodo`
- **THEN** el semáforo responde `VERDE`

#### Scenario: Sin valor de año anterior cargado
- **WHEN** no existe fila de `Kpi04ValorAnioAnterior` para la empresa y el `periodo` solicitado
- **THEN** el semáforo responde `ROJO`, independientemente del valor actual

### Requirement: KPI-05 — Eficacia de acciones correctivas
El sistema SHALL calcular KPI-05 como el porcentaje de acciones correctivas de origen Quality Event o No Conformidad (excluyendo Incidente) en `estado: CERRADA`, cuyo padre (QE o NC) tiene `resultadoVerificacion` no nulo y cuya fecha de verificación (derivada del audit trail para QE, columna `FechaVerificacion` para NC) cae dentro del mes de `periodo`, que resultan `EFECTIVO`. Meta 85%, `metaTipo: ABSOLUTO`, dirección `MAYOR_MEJOR`.

#### Scenario: AC de Incidente excluida
- **WHEN** una acción correctiva de origen Incidente está `CERRADA` dentro del periodo
- **THEN** esa AC no participa ni en el numerador ni en el denominador de KPI-05

#### Scenario: AC cerrada cuyo padre aún no fue verificado
- **WHEN** una AC de QE/NC está `CERRADA` pero su padre tiene `resultadoVerificacion` nulo
- **THEN** esa AC no participa en el denominador de KPI-05

### Requirement: KPI-06 — Diferido por dependencia de Documentos
El sistema SHALL calcular KPI-06 como `(documentos en estado PUBLICADO cuya FechaRevisionProxima es nula o futura) / (documentos no eliminados, excluyendo estado OBSOLETO) × 100`, con semáforo calculado igual que cualquier otro KPI absoluto contra su meta de 100. La deferencia original ("Documentos no existe en este backend") queda resuelta por `be-documentos-api`; el nombre del requirement se conserva por trazabilidad histórica del cambio que lo introdujo.

#### Scenario: Solicitud de KPI-06 con documentos vigentes
- **WHEN** se solicita `GET /api/dashboard/kpis` y la empresa activa tiene 8 documentos no eliminados (2 `OBSOLETO`, 6 activos en otros estados) de los cuales 5 están `PUBLICADO` con `FechaRevisionProxima` futura o nula
- **THEN** el `KpiResult` de `kpiId: 'KPI-06'` responde `valor: 83.33` (5/6 × 100, `OBSOLETO` excluido del denominador) con el semáforo correspondiente contra la meta de 100

#### Scenario: Sin documentos activos
- **WHEN** la empresa activa no tiene ningún documento no eliminado fuera de `OBSOLETO`
- **THEN** KPI-06 responde `valor: 0` sin error de división por cero

### Requirement: KPI-07 — Tiempo promedio de investigación
El sistema SHALL calcular KPI-07 como el promedio en días hábiles entre `fechaHoraReporte` y la fecha derivada de transición a `ANALISIS_COMPLETADO` (ver Requirement "Derivación de fechas de Quality Event no persistidas"), para los QE cuya transición a ese estado cae dentro del mes de `periodo`. Meta 7 días, `metaTipo: ABSOLUTO`, dirección `MENOR_MEJOR`.

#### Scenario: QE reabierto y reanalizado en el mismo mes
- **WHEN** un QE tiene más de una entrada `ESTADO_CAMBIADO` con `estadoNuevo: ANALISIS_COMPLETADO` en su audit trail (por una reapertura previa)
- **THEN** el sistema usa la entrada más reciente para el cálculo

### Requirement: KPI-08 — Acciones correctivas vencidas activas
El sistema SHALL calcular KPI-08 en tiempo real (sin filtrar por `periodo`, respondiendo `periodo: "TIEMPO_REAL"`) como el conteo de acciones correctivas de QE, NC e Incidentes cuyo `estado` no es terminal (no `CERRADA` ni `COMPLETADA`) y cuyo `plazoFecha` ya pasó. El semáforo SHALL ser `VERDE` si el conteo es 0, `AMARILLO` si está entre 1 y 3, `ROJO` si es mayor a 3 — no el semáforo genérico de desviación ±20%.

#### Scenario: Sin acciones vencidas
- **WHEN** ninguna acción correctiva de la empresa está vencida
- **THEN** KPI-08 responde `valor: 0` y `semaforo: 'VERDE'`

#### Scenario: Más de 3 acciones vencidas
- **WHEN** hay 4 o más acciones correctivas vencidas activas
- **THEN** KPI-08 responde `semaforo: 'ROJO'`

### Requirement: KPI-09 — Distribución de QE por área
El sistema SHALL calcular KPI-09 como el conteo de Quality Events cuya `fechaHoraReporte` cae dentro del mes de `periodo`, agrupado por `areaId` y ordenado descendentemente por conteo. La respuesta SHALL incluir `semaforo: 'INFORMATIVO'` y el arreglo completo `distribucion: { area, valor }[]`, no solo el máximo.

#### Scenario: Distribución con múltiples áreas
- **WHEN** en el periodo se reportaron QE en 3 áreas distintas con conteos 5, 3 y 1
- **THEN** `distribucion` responde las 3 entradas ordenadas de mayor a menor conteo, y `valor` (del `KpiResult`) es 5

### Requirement: Semáforo genérico de desviación
Para KPI-01, KPI-02, KPI-03, KPI-05, KPI-06 y KPI-07 (todos `metaTipo: ABSOLUTO`), el sistema SHALL calcular el semáforo como `VERDE` si el valor cumple la meta según su dirección (`MAYOR_MEJOR` o `MENOR_MEJOR`), `AMARILLO` si la desviación relativa respecto a la meta es ≤20%, `ROJO` en cualquier otro caso.

#### Scenario: Desviación dentro del margen de alerta
- **WHEN** KPI-02 (`MENOR_MEJOR`, meta 15) da `valor: 17` (13.3% de desviación)
- **THEN** el semáforo responde `AMARILLO`

#### Scenario: Desviación fuera del margen de alerta
- **WHEN** KPI-01 (`MAYOR_MEJOR`, meta 90) da `valor: 60` (33% de desviación)
- **THEN** el semáforo responde `ROJO`

### Requirement: Derivación de fechas de Quality Event no persistidas
Dado que la entidad `QualityEvent` no persiste columnas para la fecha de cierre, la fecha de entrada a `ANALISIS_COMPLETADO` ni la fecha de verificación de eficacia realizada, el sistema SHALL derivarlas de `QualityEventAuditTrail` en cada cálculo: la fecha de cierre es el timestamp de la entrada más reciente con `accion: ESTADO_CAMBIADO, estadoNuevo: CERRADO`; la fecha de análisis completado es el timestamp de la entrada más reciente con `accion: ESTADO_CAMBIADO, estadoNuevo: ANALISIS_COMPLETADO`; la fecha de verificación realizada es el timestamp de la entrada más reciente con `accion: VERIFICACION_EFICACIA`, o con `accion: REABIERTO` y `valorNuevo: NO_EFECTIVO` (excluyendo explícitamente las reaperturas por vencimiento de plazo, que no representan una verificación realizada).

#### Scenario: QE sin verificación de eficacia
- **WHEN** un QE nunca pasó por `VerificacionEficaciaQE` ni fue reabierto por resultado `NO_EFECTIVO`
- **THEN** su fecha de verificación derivada es indefinida, y no participa en el numerador ni denominador de KPI-05

#### Scenario: QE reabierto por vencimiento de plazo (RN-QE-008)
- **WHEN** un QE fue reabierto automáticamente por vencimiento del plazo de verificación, sin que se haya registrado un resultado de verificación
- **THEN** esa reapertura no se usa como fecha de verificación realizada

### Requirement: Resumen de dashboard por rol efectivo
El sistema SHALL exponer `GET /api/dashboard/summary`, cuyo shape de `data` depende del rol efectivo del usuario autenticado en la empresa activa: `OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD` (rol interno `JEFE_CALIDAD_SYST`), `JEFE_CONTROL_DOC` (rol interno `JEFE_CONTROL_DOCUMENTARIO`), `ALTA_DIRECCION`, `AUDITOR` (rol interno `AUDITOR_INTERNO`). Roles sin mapeo (`SUPERADMIN`, `ADMINISTRADOR_EMPRESA`, `ADMINISTRADOR_SISTEMA`) SHALL recibir 403.

#### Scenario: Rol sin acceso
- **WHEN** un usuario `ADMINISTRADOR_SISTEMA` solicita `GET /api/dashboard/summary`
- **THEN** el sistema responde 403 con `data: null`

#### Scenario: Sin empresa activa
- **WHEN** la sesión no tiene `empresaActivaId` resuelto
- **THEN** el sistema responde 401

### Requirement: Resumen OPERARIO
Para rol `OPERARIO`, el sistema SHALL responder `{ misIncidentesReportados, misQEReportados, accionesCorrectivasAsignadas, documentosPendientesLectura }`: los dos primeros filtrados por `reportadoPorId === usuario.id`; `accionesCorrectivasAsignadas` incluye acciones correctivas de QE, NC e Incidente cuyo `responsableId === usuario.id`; `documentosPendientesLectura` SHALL responder siempre `[]` (dependencia de Documentos, ver KPI-06).

#### Scenario: Operario con QE e incidentes propios
- **WHEN** un OPERARIO que reportó 2 QE y 1 Incidente solicita el resumen
- **THEN** `misQEReportados` tiene 2 elementos y `misIncidentesReportados` tiene 1, excluyendo cualquier QE/Incidente reportado por otro usuario

### Requirement: Resumen SUPERVISOR
Para rol `SUPERVISOR`, el sistema SHALL responder `{ kpisArea, qePorEstado, qeAbiertosPorTipo, qesEnVerificacionArea, accionesCorrectivasPendientesArea, accionesCorrectivasVencidas, incidentesRecientes, semaforoPlazos }`, todo filtrado a los `areaIds` del usuario (`QE.AreaId`/`NC.AreaId`/`Incidente.AreaId` incluidos en `usuario.AreaIds`). `kpisArea` SHALL incluir únicamente `KPI-02, KPI-03, KPI-04, KPI-05, KPI-07`. `accionesCorrectivasVencidas` SHALL incluir cualquier acción no terminal (`PENDIENTE` o `EN_EJECUCION`) cuyo `plazoFecha` ya pasó — **corrección post-propuesta**: el brief original de Cowork afirmaba que `PENDIENTE` se excluye deliberadamente, pero al implementar se releyó `dashboard.handlers.ts` línea por línea y el filtro real (`ac.estado !== 'CERRADA' && ac.estado !== 'COMPLETADA' && plazoFecha < hoy`, aplicado sobre `pendientes` que ya excluye solo `CERRADA`) no distingue `PENDIENTE` de `EN_EJECUCION`; se implementa fiel al código real, no al brief. `incidentesRecientes` SHALL limitarse a los 10 más recientes por `fechaEvento`.

#### Scenario: Supervisor sin áreas asignadas
- **WHEN** un SUPERVISOR sin `areaIds` (o vacío) solicita el resumen
- **THEN** todas las colecciones filtradas por área responden vacías

#### Scenario: AC vencida en estado PENDIENTE
- **WHEN** una acción correctiva del área del Supervisor está vencida y en `estado: PENDIENTE`
- **THEN** esa AC aparece tanto en `accionesCorrectivasPendientesArea` como en `accionesCorrectivasVencidas`

### Requirement: Resumen JEFE_CALIDAD
Para rol `JEFE_CALIDAD_SYST` (mapeado a `rol: 'JEFE_CALIDAD'` en la respuesta), el sistema SHALL responder con alcance organizacional completo (toda la empresa activa, sin filtro de área): `{ kpis, qeCriticosAbiertos, ncPendientesVerificacion, distribucionQEPorTipo, qePorEstado, accionesCorrectivasPorVencer, tendenciaMensualVolumen, tendenciaMensualKpis }`. `qePorEstado` SHALL inicializar los 8 estados persistibles de QE en 0 aunque no haya datos. `tendenciaMensualVolumen` SHALL cubrir los últimos 12 meses (`abiertos`/`cerrados` por mes). `tendenciaMensualKpis` SHALL cubrir KPI-01/KPI-04/KPI-05 × 12 meses.

#### Scenario: Estado sin QE
- **WHEN** ningún QE de la empresa está en `estado: EN_VERIFICACION`
- **THEN** `qePorEstado.EN_VERIFICACION` responde `0`, no una clave ausente

### Requirement: Resumen ALTA_DIRECCION
Para rol `ALTA_DIRECCION`, el sistema SHALL responder con alcance organizacional completo: `{ kpisEstrategicos, resumenPorModulo, alertasCriticas, tendenciaTrimestral, comparativaMensual, reaperturas, acsConSolicitudAjustePlazo }`. `resumenPorModulo.documentos` SHALL responder `{ total, publicados, vencidosRevision }` calculado sobre documentos reales de la empresa activa: `total` = documentos no eliminados; `publicados` = documentos con `estado: PUBLICADO`; `vencidosRevision` = documentos `PUBLICADO` cuya `fechaRevisionProxima` ya pasó. `tendenciaTrimestral.ncCerradas` SHALL contar las No Conformidades cuya fecha real de transición a `CERRADA` (derivada de `NoConformidadAuditTrail`, última entrada con `campoModificado: "estado"` y `valorNuevo: "CERRADA"` — **no** la columna `NoConformidad.fechaCierre`, que es una fecha límite esperada fijada en la creación y nunca sincronizada automáticamente con el cierre real) cae dentro de ese trimestre. `comparativaMensual` SHALL comparar KPI-01/KPI-04/KPI-05 entre el mes actual y el mes anterior, clasificando la tendencia como `SUBE`/`BAJA`/`ESTABLE` (diferencia absoluta menor a 2 puntos se considera `ESTABLE`). `reaperturas` SHALL listar QE con `ciclo > 1`, ordenados por fecha de reapertura más reciente. `acsConSolicitudAjustePlazo` SHALL incluir solo acciones correctivas de QE `ALTA`/`CRITICA` con al menos una solicitud de ajuste de plazo en estado `PENDIENTE`.

#### Scenario: Módulo Documentos calculado sobre datos reales
- **WHEN** un ALTA_DIRECCION solicita el resumen y la empresa activa tiene 10 documentos no eliminados, 6 `PUBLICADO` (2 con `fechaRevisionProxima` ya vencida)
- **THEN** `resumenPorModulo.documentos` responde `{ total: 10, publicados: 6, vencidosRevision: 2 }`

#### Scenario: Sin documentos en la empresa
- **WHEN** un ALTA_DIRECCION solicita el resumen y la empresa activa no tiene ningún documento
- **THEN** `resumenPorModulo.documentos` responde `{ total: 0, publicados: 0, vencidosRevision: 0 }`

#### Scenario: NC cerrada con fecha límite en un trimestre distinto al de su cierre real
- **WHEN** una No Conformidad tiene `fechaCierre` (deadline) en un trimestre futuro lejano, pero transicionó a `CERRADA` (vía `PATCH /api/nonconformities/:id`) dentro del trimestre actual
- **THEN** `tendenciaTrimestral` cuenta esa NC en `ncCerradas` del trimestre actual, no del trimestre de su `fechaCierre`

### Requirement: Resumen AUDITOR
Para rol `AUDITOR_INTERNO` (mapeado a `rol: 'AUDITOR'`), el sistema SHALL responder con alcance organizacional completo sobre Quality Events de `origen: O3_HALLAZGO_AUDITORIA`: `{ hallazgosPorNorma, hallazgosPorEstado, evidenciasHallazgos, tasaCierreEnPlazoPorArea }`. `hallazgosPorEstado` SHALL inicializar los 8 estados persistibles de QE en 0. `evidenciasHallazgos` SHALL responder siempre `{ conEvidencia: 0, sinEvidencia: <total de hallazgos O3> }` (dependencia de Documentos — vinculación QE↔Documento no existe en este backend). `tasaCierreEnPlazoPorArea` SHALL listar solo áreas con al menos un hallazgo cerrado en el mes actual, ordenadas ascendentemente por tasa de cierre en plazo.

#### Scenario: Sin hallazgos de auditoría
- **WHEN** la empresa no tiene ningún QE con `origen: O3_HALLAZGO_AUDITORIA`
- **THEN** todas las colecciones del resumen responden vacías o en cero, sin error

### Requirement: Resumen JEFE_CONTROL_DOC
Para rol `JEFE_CONTROL_DOCUMENTARIO` (mapeado a `rol: 'JEFE_CONTROL_DOC'`), el sistema SHALL responder `data: {}` (objeto vacío, intencional — depende enteramente de Documentos).

#### Scenario: Jefe de Control Documentario solicita el resumen
- **WHEN** un usuario `JEFE_CONTROL_DOCUMENTARIO` solicita `GET /api/dashboard/summary`
- **THEN** el sistema responde 200 con `data: {}`

### Requirement: Aislamiento multi-tenant de los endpoints de Dashboard
El sistema SHALL scopear toda agregación (KPIs y resumen) exclusivamente a datos (`QualityEvent`, `NoConformidad`, `Incidente`, sus acciones correctivas, `HorasTrabajadas`, `Kpi04ValorAnioAnterior`) cuya `empresaId` coincide con la empresa activa de la sesión, sin excepción por rol.

#### Scenario: Datos de otra empresa nunca se filtran
- **WHEN** la empresa activa de la sesión tiene 0 Quality Events pero otra empresa en la misma base de datos tiene varios
- **THEN** KPI-01 a KPI-09 y el resumen del rol responden como si no hubiera datos, sin filtrar información de la otra empresa
