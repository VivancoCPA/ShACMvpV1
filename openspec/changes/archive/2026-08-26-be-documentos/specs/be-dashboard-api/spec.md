## MODIFIED Requirements

### Requirement: KPI-06 — Diferido por dependencia de Documentos
El sistema SHALL calcular KPI-06 como `(documentos en estado PUBLICADO cuya FechaRevisionProxima es nula o futura) / (documentos no eliminados, excluyendo estado OBSOLETO) × 100`, con semáforo calculado igual que cualquier otro KPI absoluto contra su meta de 100. La deferencia original ("Documentos no existe en este backend") queda resuelta por `be-documentos-api`; el nombre del requirement se conserva por trazabilidad histórica del cambio que lo introdujo.

#### Scenario: Solicitud de KPI-06 con documentos vigentes
- **WHEN** se solicita `GET /api/dashboard/kpis` y la empresa activa tiene 8 documentos no eliminados (2 `OBSOLETO`, 6 activos en otros estados) de los cuales 5 están `PUBLICADO` con `FechaRevisionProxima` futura o nula
- **THEN** el `KpiResult` de `kpiId: 'KPI-06'` responde `valor: 83.33` (5/6 × 100, `OBSOLETO` excluido del denominador) con el semáforo correspondiente contra la meta de 100

#### Scenario: Sin documentos activos
- **WHEN** la empresa activa no tiene ningún documento no eliminado fuera de `OBSOLETO`
- **THEN** KPI-06 responde `valor: 0` sin error de división por cero

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
