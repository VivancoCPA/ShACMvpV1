# be-dashboard-carga-manual

## Purpose

Dos tablas y endpoints de carga manual que alimentan KPI-04 (índice de frecuencia de incidentes) del módulo Dashboard: `HorasTrabajadas` (denominador) y `Kpi04ValorAnioAnterior` (comparación interanual para el semáforo). No hay integración con RR.HH. ni ningún sistema externo — son valores operacionales cargados a mano. Ambos endpoints (`PUT /api/empresas/{empresaId}/dashboard/horas-trabajadas`, `PUT /api/empresas/{empresaId}/dashboard/kpi04-anio-anterior`) están gateados a `SUPERADMIN`, mismo criterio que el resto de la administración organizacional existente (`ResetPin`, `CrearEmpresa`, etc.).

## Requirements

### Requirement: Carga manual de horas trabajadas
El sistema SHALL exponer un endpoint de carga/actualización para `HorasTrabajadas` (`empresaId`, `areaId`, `periodo` en formato `YYYY-MM`, `horas`), gateado al rol `SUPERADMIN`. El sistema SHALL hacer upsert por la clave natural `empresaId + areaId + periodo`: si ya existe una fila para esa combinación, la reemplaza; si no, la crea.

#### Scenario: Primera carga de un área y periodo
- **WHEN** un `SUPERADMIN` carga horas trabajadas para un área y periodo que no tenían fila previa
- **THEN** el sistema crea la fila y responde 200/201 con el valor cargado

#### Scenario: Corrección de un valor ya cargado
- **WHEN** un `SUPERADMIN` vuelve a cargar horas trabajadas para la misma empresa, área y periodo
- **THEN** el sistema reemplaza el valor anterior sin crear una fila duplicada

#### Scenario: Rol sin permiso
- **WHEN** un usuario que no es `SUPERADMIN` intenta cargar horas trabajadas
- **THEN** el sistema responde 403 sin modificar datos

#### Scenario: Periodo con formato inválido
- **WHEN** se envía `periodo` que no cumple el formato `YYYY-MM`
- **THEN** el sistema responde 400 sin crear ni modificar ninguna fila

### Requirement: Carga manual del valor de KPI-04 del año anterior
El sistema SHALL exponer un endpoint de carga/actualización para `Kpi04ValorAnioAnterior` (`empresaId`, `periodo` en formato `YYYY-MM`, `valor`), gateado al rol `SUPERADMIN`. El sistema SHALL hacer upsert por la clave natural `empresaId + periodo`.

#### Scenario: Primera carga de un periodo
- **WHEN** un `SUPERADMIN` carga el valor de KPI-04 del año anterior para un periodo sin fila previa
- **THEN** el sistema crea la fila y responde 200/201 con el valor cargado

#### Scenario: Corrección de un valor ya cargado
- **WHEN** un `SUPERADMIN` vuelve a cargar el valor para la misma empresa y periodo
- **THEN** el sistema reemplaza el valor anterior sin crear una fila duplicada

#### Scenario: Rol sin permiso
- **WHEN** un usuario que no es `SUPERADMIN` intenta cargar el valor de KPI-04 del año anterior
- **THEN** el sistema responde 403 sin modificar datos

### Requirement: Aislamiento multi-tenant de la carga manual
El sistema SHALL asociar cada fila de `HorasTrabajadas`/`Kpi04ValorAnioAnterior` a una `empresaId` específica, de forma que el cálculo de KPI-04 de una empresa nunca sume horas trabajadas ni compare contra el valor interanual de otra empresa.

#### Scenario: Dos empresas con datos distintos para el mismo periodo
- **WHEN** dos empresas distintas tienen horas trabajadas cargadas para el mismo `periodo` con valores diferentes
- **THEN** el cálculo de KPI-04 de cada empresa usa únicamente sus propias horas cargadas
