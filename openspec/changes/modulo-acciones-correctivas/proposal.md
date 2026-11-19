## Why

Hoy las acciones correctivas (AC) solo se ven dentro de cada QE, en el incidente o la NC de origen y en los widgets del dashboard. No hay un lugar donde ver todas ni saber cuántas hay abiertas, pendientes de verificación, vencidas o cerradas. Tampoco existe un endpoint que liste las AC de la empresa: el único bajo `/api/acciones-correctivas` es `candidatos-responsable`. Toño lo pidió el 2026-11-19.

## What Changes

- **Backend:** nuevo `GET /api/acciones-correctivas`. Unifica las tres tablas de AC (`acciones_correctivas_qe`, `_nc` e `_incidente`) y devuelve un estado normalizado (`PENDIENTE`, `EN_EJECUCION`, `PENDIENTE_VERIFICACION`, `CERRADA`).
  - Calcula `Vencida` con `DashboardKpiCalculator.EsAcVencida`, la misma regla que el KPI-08, y los días hábiles restantes.
  - Acepta filtros, orden y paginación (25 por página por defecto, máximo 100).
  - Devuelve seis contadores calculados sobre el universo visible: abiertas, en ejecución, pendientes de verificación, por vencer, vencidas y cerradas en el período.
- **Backend:** la visibilidad se filtra en el servidor según el rol:
  - JCA, JCD, AUD y DIR ven toda la empresa;
  - el SUPERVISOR ve las AC de sus áreas más las que tiene asignadas como responsable;
  - el OPERARIO ve solo las suyas;
  - los roles de administración reciben 403.
- **Backend:** `GET /api/acciones-correctivas/export` aplica los mismos filtros sin paginar, con un tope de 5.000 filas (422 `EXPORT_DEMASIADAS_FILAS` si se supera).
- **Backend:** `GET /api/acciones-correctivas/{id}/origen` resuelve el origen de una AC, para los enlaces viejos `/acciones-correctivas/{id}`.
- **Backend:** migración solo de índices, para `responsable_id` en las tres tablas de AC.
- **Frontend:** nueva pantalla `/acciones-correctivas` con:
  - una franja de seis `AlertaCard` que filtran al hacer clic;
  - barra de filtros sincronizada con la URL;
  - tabla paginada y ordenable, que en móvil pasa a tarjetas;
  - exportación a Excel con `xlsx`.
- **Frontend:** título según el rol: "Acciones correctivas" para todos, salvo el OPERARIO, que ve "Mis acciones correctivas" y no tiene filtro de responsable.
- **Frontend:** entrada en el menú, `RoleGuard` con los seis roles operativos y la ruta `/acciones-correctivas/:id`, que redirige al origen de la AC.
- **Frontend:** `AlertaCard` agrega el nivel `success`, para la tarjeta "Cerradas".
- **Frontend:** el widget de AC vencidas del JCA lleva el enlace "Ver todas" a `/acciones-correctivas?vencida=true`.
- **Frontend:** las mutaciones de AC y las notificaciones también refrescan el listado.
- **Frontend:** nuevo namespace i18n `accionesCorrectivas` (es-PE y en-US) y clave `nav.accionesCorrectivas`.
- **MSW:** handlers de listado, export y origen, con la misma visibilidad, los mismos contadores y el mismo predicado de vencida que el dashboard mock.

## Capabilities

### New Capabilities
- `be-acciones-correctivas-api`: listado unificado de AC (QE, NC e incidente), con estado normalizado, visibilidad por rol, filtros, contadores, exportación, resolución de origen e índices.
- `acciones-correctivas-list-view`: pantalla `/acciones-correctivas`, con contadores, filtros en la URL, tabla y tarjetas, exportación a Excel, hooks, tipos e i18n.
- `acciones-correctivas-msw`: handlers MSW de listado, export y origen, con paridad de visibilidad y contadores.

### Modified Capabilities
- `app-navigation`: el Sidebar suma el ítem "Acciones correctivas" para los seis roles operativos.
- `routing`: se registran `/acciones-correctivas` (con `RoleGuard`) y su entrada en `ROUTE_ACCESS_TABLE`.
- `notification-links`: `/acciones-correctivas/:id` redirige al detalle del origen de la AC.
- `dashboard-layout`: `AlertaCard` admite el nivel `success`.
- `dashboard-jefecalidad-view`: el widget de AC vencidas enlaza "Ver todas" al listado filtrado.
- `dashboard-query-hooks`: la invalidación por notificación y por mutación también alcanza el listado de AC.

## Impact

- **Backend:** `ShcMvpEndPoint/Features/AccionesCorrectivas/` (nuevos `Shared/AccionesCorrectivasQuery.cs`, `ListarAccionesCorrectivas/`, `ExportarAccionesCorrectivas/` y `ObtenerOrigenAccionCorrectiva/`), registro en `Program.cs`, `ShacDbContext` (índices) y una migración nueva solo de índices. También tests de integración en `ShcMvpEndPoint.Tests/Features/AccionesCorrectivas/`.
- **Frontend:** `src/features/acciones-correctivas/` (api, hooks, types, utils, components, pages), `router/index.tsx`, `router/routeAccess.ts`, `components/layout/Sidebar.tsx`, `features/dashboard/components/layout/AlertaCard.tsx`, `features/dashboard/utils/invalidarDashboard.ts`, el widget de AC vencidas del JCA, `i18n/*.json` e `i18n/index.ts`.
- **MSW:** `mocks/handlers/acciones-correctivas.handlers.ts` y el predicado `esAcVencida`, que se extrae a un módulo compartido con `dashboard.handlers.ts`.
- **Sin cambios de esquema de datos** (solo índices) y **sin dependencias nuevas** (`xlsx` ya está instalado).
