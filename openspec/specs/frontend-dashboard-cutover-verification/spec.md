# frontend-dashboard-cutover-verification

## Purpose

Verificación manual / API directa del ciclo de vida completo de Dashboard (M5) de `shc-controldoc` contra el backend .NET real + Postgres real, con `VITE_ENABLE_MSW=false` — sin tocar UI ni lógica de cliente, ya que la investigación previa no encontró ningún mismatch de contrato entre frontend y backend. Cubre la carga de `/dashboard` (summary + KPIs del periodo seleccionado) para los 6 roles con acceso (`OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO`, `ALTA_DIRECCION`), el 403 en `/api/dashboard/kpis` (y el comportamiento documentado de `/api/dashboard/summary`) para los roles sin mapeo en `DashboardRoleMapping`, al menos una exportación (Excel o PDF) armada a partir de datos de `summary`/`kpis` ya cargados en memoria sin llamada de red propia, los endpoints `SUPERADMIN`-only de carga manual (`CargarHorasTrabajadas`, `CargarKpi04AnioAnterior`) sin punto de entrada en la UI verificados por API directa, y la reversión de MSW a activo al cerrar. Equivalente de Dashboard a `frontend-usuarios-cutover-verification`.

## Requirements

### Requirement: El resumen de Dashboard funciona de punta a punta contra el backend .NET real sin MSW para los 6 roles con acceso

Con `VITE_ENABLE_MSW=false` y `VITE_API_BASE_URL` apuntando al backend .NET real corriendo localmente contra Postgres real, el sistema SHALL completar la carga de `/dashboard` para cada uno de los 6 roles con acceso (`OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO`, `ALTA_DIRECCION`), con el mismo comportamiento observable que hoy contra MSW.

#### Scenario: Carga de Dashboard con datos reales para cada rol con acceso

- **WHEN** un usuario autenticado con uno de los 6 roles con acceso navega a `/dashboard`
- **THEN** `GET /api/dashboard/summary` devuelve el DTO correspondiente al rol (unión discriminada por `rol`), y cada widget del dashboard de ese rol renderiza con datos reales, sin errores de consola ni campos `undefined`

#### Scenario: KPIs del periodo seleccionado contra el backend real

- **WHEN** un usuario con acceso a Dashboard selecciona un periodo (`YYYY-MM`) en la vista de KPIs
- **THEN** `GET /api/dashboard/kpis?periodo=YYYY-MM` devuelve los `KpiResult` reales calculados por el backend, coincidentes en forma con `KpiResult`/`getDashboardKpis()` del frontend

### Requirement: El acceso a Dashboard está restringido a los 6 roles mapeados, con 403 para el resto

`/api/dashboard/kpis` SHALL responder 403 para cualquier rol fuera de los 6 roles mapeados en `DashboardRoleMapping`. `/api/dashboard/summary` SHALL responder con el comportamiento observado (403 genérico, sin gate explícito por rol) para esos mismos roles sin mapeo.

#### Scenario: Rol sin acceso a Dashboard recibe 403 en KPIs

- **WHEN** un usuario autenticado como `ADMINISTRADOR_EMPRESA`, `ADMINISTRADOR_SISTEMA` o `SUPERADMIN` invoca `GET /api/dashboard/kpis`
- **THEN** el backend responde 403

#### Scenario: Rol sin acceso a Dashboard recibe el comportamiento documentado en summary

- **WHEN** un usuario autenticado como `ADMINISTRADOR_EMPRESA`, `ADMINISTRADOR_SISTEMA` o `SUPERADMIN` invoca `GET /api/dashboard/summary`
- **THEN** el backend responde con el comportamiento ya documentado para un rol sin mapeo en `DashboardRoleMapping`, confirmado por observación directa contra el backend real

### Requirement: Al menos una exportación de Dashboard funciona contra el backend real sin llamada de red propia

El sistema SHALL completar al menos una exportación (Excel o PDF) desde un dashboard con flujo de export existente (Alta Dirección o Jefe de Calidad), armando el archivo a partir de los datos de `summary`/`kpis` ya cargados en memoria, sin depender de un endpoint de red adicional con contrato propio.

#### Scenario: Exportación de Dashboard a partir de datos ya cargados

- **WHEN** un usuario con un flujo de exportación existente (`ALTA_DIRECCION` o `JEFE_CALIDAD_SYST`) dispara la exportación (Excel o PDF) desde su dashboard ya cargado
- **THEN** el archivo se genera correctamente a partir de los datos de `summary`/`kpis` en memoria, sin ninguna llamada de red adicional durante la exportación

### Requirement: Los endpoints de carga manual `SUPERADMIN`-only se verifican por API directa

Ningún punto de la UI invoca `CargarHorasTrabajadas` (`PUT /api/empresas/:empresaId/dashboard/horas-trabajadas`) ni `CargarKpi04AnioAnterior` (`PUT .../dashboard/kpi04-anio-anterior`) — las únicas dos funciones de `dashboard.api.ts` son `getDashboardKpis`/`getDashboardSummary`. El sistema SHALL completar la carga manual de ambos valores contra el backend real vía API directa, sin pasar por un punto de entrada de la UI. Construir esa UI queda fuera de alcance de este change (ver `design.md`).

#### Scenario: `SUPERADMIN` carga horas trabajadas y KPI-04 del año anterior por API directa

- **WHEN** se invocan `PUT /api/empresas/:empresaId/dashboard/horas-trabajadas` y `PUT .../dashboard/kpi04-anio-anterior` autenticado como `SUPERADMIN`
- **THEN** el backend real persiste ambos valores correctamente, confirmando que el contrato de estos dos endpoints sigue vigente aunque no tengan consumidor en la UI

### Requirement: MSW se revierte a activo al cerrar la verificación de Dashboard

El sistema SHALL dejar `shc-controldoc/.env.development` con `VITE_ENABLE_MSW=true` una vez completada la verificación de este change, para no bloquear el desarrollo diario de las capas transversales aún dependientes de MSW.

#### Scenario: Estado del entorno de desarrollo al cerrar el change

- **WHEN** se inspecciona `shc-controldoc/.env.development` después de cerrado este change
- **THEN** `VITE_ENABLE_MSW` es `true`, igual que antes de iniciar la verificación
