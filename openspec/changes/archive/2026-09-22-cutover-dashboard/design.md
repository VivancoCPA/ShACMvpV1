## Context

`ShcMvpEndPoint` ya tiene Dashboard (M5) implementado (`Features/Dashboard/*`, archivado como `be-dashboards`): summary por rol y KPIs por periodo. A diferencia de los siete módulos anteriores, este módulo tuvo una ronda previa de verificación *distinta* de un cutover — el 2026-08-21 se confirmó independientemente que el backend es un puerto fiel de `dashboard.handlers.ts` (el mock), con `dotnet test` en 257/257, incluida una corrección real encontrada en ese momento (`accionesCorrectivasVencidas` del Supervisor no distinguía `PENDIENTE` de `EN_EJECUCION`) más un fix posterior de `NCFechaDerivadaResolver`. Lo que nunca se hizo es apuntar el frontend real contra este backend real con MSW apagado y verificar el contrato de red extremo a extremo — esa comparación (leyendo `dashboard.api.ts`, los tipos de ambos lados, y los archivos backend relevantes) es lo que motiva este change, y no encontró ningún mismatch.

Verificado contra el código real antes de proponer:

- `GET /api/dashboard/summary` ↔ `ObtenerSummaryHandler`: la unión discriminada por `rol` (`DashboardSummaryEnvelope(string Rol, object Data)`) coincide exactamente con `DashboardSummaryData` (frontend, unión por `rol: 'OPERARIO' | 'SUPERVISOR' | 'JEFE_CALIDAD' | 'ALTA_DIRECCION' | 'AUDITOR' | 'JEFE_CONTROL_DOC'`). Los 6 DTOs por rol (`OperarioDashboardData`, `SupervisorDashboardData`, `JefeCalidadDashboardData`, `AltaDireccionDashboardData`, `AuditorDashboardData`, `JefeControlDocDashboardData`) coinciden campo a campo con sus contrapartes TypeScript en `dashboardData.types.ts`/`dashboardSummary.types.ts`, incluidos los tipos compuestos anidados (`SemaforoPlazosCount`, `ResumenPorModulo`, `TendenciaMensualKpiEntry`, etc.).
- `GET /api/dashboard/kpis` (`?periodo=YYYY-MM`) ↔ `ObtenerKpisHandler` → `List<KpiResult>`: coincide con `KpiResult`/`getDashboardKpis()`. Restringido a los 6 roles con acceso a dashboard (`ObtenerKpisEndpoint.cs`, criterio ya confirmado en agosto) — a diferencia del mock, que no lo gateaba por rol.
- `DashboardRoleMapping.cs` (backend) ↔ `dashboardRoleMapping.ts` (frontend): mapeo idéntico de `UserRole` → rol de dashboard, sin entrada para `SUPERADMIN`/`ADMINISTRADOR_EMPRESA`/`ADMINISTRADOR_SISTEMA` en ninguno de los dos lados (403 esperado).
- `DashboardKpiConstants.cs` ↔ `kpi.constants.ts`: valores numéricos de las tres tablas (`PlazoMaximoQEDiasHabiles` 22/17/14/10, `PlazoMaximoQEPorEstadoDiasHabiles` por estado y severidad, metas de KPI-01 a KPI-09) coinciden dígito por dígito, confirmando el puerto ya validado en agosto.
- Las 4 rutas de `Features/Dashboard/` están registradas en `EndpointExtensions.cs` y sus 4 handlers también.
- `documentosPendientesLectura` (Operario) permanece siempre `[]` en ambos lados — Open Question explícito desde `be-documentos`, decisión deliberada documentada en el propio comentario de `DashboardSummaryDtos.cs`, no un olvido.
- `CargarHorasTrabajadas` (`PUT /api/empresas/:empresaId/dashboard/horas-trabajadas`) y `CargarKpi04AnioAnterior` (`PUT .../dashboard/kpi04-anio-anterior`) están registrados, restringidos a `SUPERADMIN`, y no tienen ningún punto de entrada en `dashboard.api.ts` ni en ningún componente del frontend — las únicas dos funciones de `dashboard.api.ts` son `getDashboardKpis`/`getDashboardSummary`.
- `shc-controldoc/.env.development` está hoy en `VITE_ENABLE_MSW=true`, `VITE_API_BASE_URL` vacío — estado esperado antes de abrir la ventana de verificación. `.env.production` ya tiene `VITE_ENABLE_MSW=false` desde `cutover-auth`, mismo Open Question de hosting pendiente (no se toca en este change).

## Goals / Non-Goals

**Goals:**
- Apuntar el frontend en desarrollo al backend .NET real y verificar `summary`/`kpis` para los 6 roles con acceso a Dashboard, confirmando que cada widget renderiza con datos reales sin errores de consola ni campos `undefined`.
- Verificar el 403 en `/api/dashboard/kpis` para los roles sin acceso, y confirmar que el comportamiento observado de `/api/dashboard/summary` (403 genérico para cualquier rol sin mapeo, sin gate explícito) coincide con lo documentado.
- Probar al menos una exportación (Excel o PDF) y confirmar que no depende de una llamada de red adicional con contrato propio.
- Verificar por API directa la excepción `SUPERADMIN` de los dos endpoints de carga manual (`CargarHorasTrabajadas`, `CargarKpi04AnioAnterior`) — sin UI que los ejercite, ver D2 de este documento.
- Diagnosticar y corregir, con causa raíz confirmada, cualquier discrepancia real que aparezca durante la verificación — sin asumir de antemano que existe ninguna.
- Inspeccionar los tests de Dashboard antes de asumir que dependen de MSW.

**Non-Goals:**
- No se construye ninguna UI de administración para `CargarHorasTrabajadas`/`CargarKpi04AnioAnterior` — es trabajo de producto nuevo, no una corrección de contrato.
- No se resuelve el Open Question de `documentosPendientesLectura` (Operario) — decisión de producto pendiente, sin relación con el contrato de red verificado en este change.
- No se re-audita `DashboardDataFetcher.cs`/`DashboardSummaryBuilder.cs` línea por línea — ya confirmados estructuralmente correctos en la verificación de agosto; la verificación de este change se enfoca en el contrato de red observable, no en la lógica interna de agregación.
- No se resuelve el Open Question de hosting/dominio de producción heredado de `cutover-auth`.
- No se toca `.env.production`.

## Decisions

### D1 — Se confía en la verificación de agosto para la lógica interna de agregación; este change se enfoca en el contrato de red
El 2026-08-21 ya se verificó independientemente que `DashboardDataFetcher.cs`/`DashboardSummaryBuilder.cs` calculan los mismos valores que `dashboard.handlers.ts` (el mock), con `dotnet test` 257/257 y dos fixes reales ya aplicados. Releer esos ~36KB línea por línea en este change sería duplicar trabajo ya hecho sin una señal concreta de que algo cambió en el contrato de Dashboard desde entonces (los mtimes recientes de esos archivos corresponden a cutovers de otros módulos que tocan datos que Dashboard consume, no a Dashboard en sí). Este change verifica el contrato observable end-to-end (frontend real → backend real → Postgres real), que es lo que nunca se había hecho.

**Alternativa descartada**: releer ambos archivos línea por línea antes de proponer. Se descarta por no aportar señal nueva sobre el riesgo real de este change (contrato de red), y por precedente de otros cutovers que tampoco re-auditan lógica ya verificada sin motivo concreto.

### D2 — Los dos endpoints `SUPERADMIN`-only sin consumidor en la UI se verifican por API directa
`CargarHorasTrabajadas`/`CargarKpi04AnioAnterior` no tienen ningún punto de entrada en el frontend — confirmado por grep, las únicas dos funciones de `dashboard.api.ts` son `getDashboardKpis`/`getDashboardSummary`. Se verifican por `curl`/API directa como `SUPERADMIN`, mismo patrón ya validado en `cutover-usuarios` D2 para la excepción `SUPERADMIN` de `GET /api/users`.

**Alternativa descartada**: construir una UI de administración para estos dos endpoints como parte de este change. Se descarta porque el proposal es explícito en que esto es trabajo de producto nuevo, no una corrección de contrato — mezclar ambos alcances dificultaría revisar cada uno por separado.

### D3 — `GET /api/dashboard/summary` responde 401 (no 403) para `SUPERADMIN`, por diseño compartido de toda la app, no un bug de Dashboard
**Hallazgo confirmado durante la verificación de este change, refina la Sección 4 del handoff** ("confirmá que el comportamiento observado coincide" con un 403 genérico). El comportamiento real depende de qué gate de la ruta se ejecuta primero:

- `ObtenerKpisEndpoint.cs:28` — `RequireAuthorization(p => p.RequireRole(RolesConAccesoDashboard))` — el middleware de autorización de ASP.NET Core corre antes que cualquier endpoint filter. Para `SUPERADMIN`/`ADMINISTRADOR_EMPRESA`/`ADMINISTRADOR_SISTEMA` (ninguno en la lista de 6 roles), esto corta con 403 antes de llegar a `RequireEmpresaActivaFilter`.
- `ObtenerSummaryEndpoint.cs:14-15` — `.AddEndpointFilter<RequireEmpresaActivaFilter>().RequireAuthorization()` (sin `RequireRole`) — cualquier usuario autenticado pasa la autorización; el filtro de empresa activa (`RequireEmpresaActivaFilter.cs:15-21`) corre primero, y solo si hay `empresaActivaId` se llega al chequeo de rol del propio handler (`ObtenerSummaryEndpoint.cs:23`, `ForbiddenBusinessException` → 403 "Rol sin acceso al dashboard.").
- `SUPERADMIN` nunca tiene `empresaActivaId` (confirmado en `POST /api/auth/login`: `empresaActivaId: null`, `esSuperadminMultiempresa: true`) — es una característica estructural del rol en toda la app (opera cross-empresa), no algo específico de Dashboard. Por eso `GET /api/dashboard/summary` como `SUPERADMIN` responde **401** `"No hay una empresa activa en la sesión."`, nunca llega al 403 del handler.
- `ADMINISTRADOR_EMPRESA` y `ADMINISTRADOR_SISTEMA` sí tienen `empresaActivaId` (son roles por-empresa) — para ambos, verificado en esta sesión, `GET /api/dashboard/summary` responde 403 `"Rol sin acceso al dashboard."`, coincidente con lo ya documentado.

No es un bug de Dashboard ni de este change: `RequireEmpresaActivaFilter` es infraestructura compartida por cualquier endpoint que requiera empresa activa, y la ausencia de `empresaActivaId` en `SUPERADMIN` es la misma característica ya confirmada en `cutover-auth`/`cutover-usuarios` (D9: `GET /api/users` como `SUPERADMIN` funciona precisamente porque ese endpoint no exige empresa activa). No se corrige nada — se documenta el 401 como el comportamiento real y correcto de `SUPERADMIN` contra `/api/dashboard/summary`.

**Alternativa descartada**: uniformar `ObtenerSummaryEndpoint` para que devuelva 403 en todos los casos (agregando `RequireRole` a nivel de ruta, igual que `ObtenerKpisEndpoint`). Se descarta porque cambiaría un contrato ya en producción sin ningún defecto funcional que lo justifique — el mock tampoco distinguía este caso, y ningún consumidor real (frontend) depende del código de status exacto aquí más allá de "no es 200"; es una discrepancia de forma, no de comportamiento observable para un usuario real (`SUPERADMIN` no tiene ninguna UI de Dashboard que lo invoque).

## Risks / Trade-offs

- **[Riesgo] Confiar en la verificación de agosto para la lógica interna de agregación sin releerla en esta sesión** → Mitigación: D1 — el riesgo real de este change es el contrato de red end-to-end, no la lógica de agregación ya validada con 257/257 tests; si la verificación en navegador muestra un valor incorrecto en algún widget, se re-audita el archivo de agregación correspondiente en ese momento, con causa raíz confirmada.
- **[Riesgo] Los 25 componentes de widgets no se revisan uno por uno antes de proponer** → Mitigación: el contrato de tipos ya coincide (Context); el riesgo real está en errores de renderizado/UX, cubierto por la verificación funcional en navegador (tasks.md), no en mismatches de red.
- **[Riesgo] Los archivos de exportación podrían depender de una llamada de red adicional con contrato propio, no detectada por lectura de `dashboard.api.ts`** → Mitigación: precedente de Quality Events (`exportQualityEventPdf` resultó más roto de lo esperado) — se prueba al menos una exportación real durante la verificación (tasks.md) para confirmar que arma el archivo desde datos ya en memoria.
- **[Riesgo] Si aparece un mismatch no detectado durante la verificación real** → Mitigación: mismo protocolo de diagnóstico-antes-de-fix que todos los cutovers anteriores — causa raíz confirmada (archivo + línea) documentada en este `design.md` antes de aplicar cualquier corrección.

## Migration Plan

1. Backend local (`dotnet run` + Postgres dev) arriba y sano.
2. `shc-controldoc/.env.development`: `VITE_ENABLE_MSW=false`, apuntar a backend local.
3. Verificar, para cada uno de los 6 roles con acceso (`OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO`, `ALTA_DIRECCION`), que `/dashboard` renderiza con datos reales, sin errores de consola ni campos `undefined`.
4. Confirmar el 403 en `/api/dashboard/kpis` para los roles sin acceso (`ADMINISTRADOR_EMPRESA`/`ADMINISTRADOR_SISTEMA`/`SUPERADMIN`), y el comportamiento de `/api/dashboard/summary` para esos mismos roles.
5. Probar al menos una exportación (Excel o PDF) desde el dashboard de Alta Dirección o Jefe de Calidad.
6. Verificar por API directa (D2) los dos endpoints `SUPERADMIN`-only sin consumidor en la UI.
7. Diagnosticar y documentar (causa raíz, archivo + línea) cualquier discrepancia real encontrada antes de corregirla.
8. Inspeccionar los tests de Dashboard — documentar si algún test depende de `msw/node` (mismo criterio que cutovers anteriores para tests que testean los handlers MSW mismos).
9. Revertir `shc-controldoc/.env.development` a `VITE_ENABLE_MSW=true` al terminar.
10. No tocar `.env.production`.

**Rollback:** revertir `VITE_ENABLE_MSW` a `true` restaura el comportamiento anterior de inmediato en el frontend. Si apareciera algún cambio de backend no anticipado, sería aditivo o un fix acotado a `Features/Dashboard/*`, revertible con el rollback estándar de EF Core sin pérdida de datos existentes.

## Open Questions

Ninguna pregunta bloqueante para iniciar la verificación. Quedan, sin resolver en este change: (1) la semántica de `documentosPendientesLectura` (Operario, siempre `[]`, Open Question heredado de `be-documentos`), (2) si algún día hace falta una UI de administración para `CargarHorasTrabajadas`/`CargarKpi04AnioAnterior`, y (3) el Open Question de hosting/dominio de producción heredado de `cutover-auth`. Ninguna de las tres bloquea el cierre de este change ni del roadmap de cutover de los ocho módulos de dominio.

## Hallazgos de verificación

Verificado por API directa contra el backend real (`http://localhost:5072`) + Postgres dev, con `VITE_ENABLE_MSW=false`. **Sin herramienta de automatización de navegador disponible en este entorno** (sin Playwright/similar, mismo aviso de metodología que los cutovers anteriores) — todo el contrato (secciones 4-8 de `tasks.md`) se verificó por `curl` con JWT real obtenido por login, en vez de clic en la UI. Se creó una empresa QA dedicada ("Cutover Dashboard QA S.A.C.") con un usuario nuevo por cada uno de los 6 roles con acceso a Dashboard, más `ADMINISTRADOR_SISTEMA`, reutilizando `multi.empresa.qa@shac.dev` como `ADMINISTRADOR_EMPRESA` y `superadmin@shac.dev` como `SUPERADMIN`.

Confirmado sin discrepancias bloqueantes: `GET /api/dashboard/summary` para los 6 roles (forma exacta coincidente con `DashboardSummaryData` y sus 6 DTOs por rol, sin ningún campo `undefined`); `GET /api/dashboard/kpis` (9 `KpiResult` con `meta`/`metaTipo` coincidentes dígito por dígito con `kpi.constants.ts`); 403 para `ADMINISTRADOR_EMPRESA`/`ADMINISTRADOR_SISTEMA` en ambos endpoints; el pipeline completo de datos del export de Alta Dirección/Jefe de Calidad (`dashboard.api.ts` + los 5 endpoints ya cutover-eados de QE/NC/Incidentes/Documentos/Locales que alimentan `useAccionesRequeridas`/`useHeatmapPorLocal`); y los dos endpoints `SUPERADMIN`-only sin consumidor en la UI, verificados por API directa.

Dos hallazgos reales documentados (ninguno bloqueante, ninguno corregido — ver D3 y sección 7.2 de `tasks.md`): (1) `GET /api/dashboard/summary` responde 401 en vez de 403 para `SUPERADMIN`, por diseño compartido de `RequireEmpresaActivaFilter` con el resto de la app, no un bug de Dashboard; (2) el export de Alta Dirección/Jefe de Calidad depende de más endpoints que los dos propios de `dashboard.api.ts` (ya cutover-eados independientemente), refinamiento informativo del proposal, no un mismatch.
