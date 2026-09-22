# Verificación independiente — Cutover: Dashboard

Fecha: 2026-09-22
Autor: Cowork, releyendo el código real (frontend `shc-controldoc`, backend `.NET`) vía device
bridge — sin confiar en el reporte de Claude Code ni en el de Toño ("listo, implementado").
Octavo y último módulo de dominio del roadmap de cutover.

**Veredicto: aprobado.** No se necesitó ningún cambio de código en este change — coincide con lo
predicho en las instrucciones (ninguna mismatch bloqueante encontrada en la investigación previa) —
y confirmé por lectura directa que la verificación reportada en `design.md`/`tasks.md` corresponde
al comportamiento real del código, no solo a lo escrito en el documento.

## 1. `openspec/changes/cutover-dashboard/` — confirmado, sin archivar

Listé `openspec/changes/` directamente en el repo: `cutover-dashboard` existe junto a
`cutover-no-conformidades`, `cutover-quality-events` y `cutover-usuarios` — los cuatro sin
archivar, mismo estado pendiente reportado en las tres verificaciones anteriores. Listé también
`openspec/changes/archive/` completo: no contiene ninguna entrada de `cutover-dashboard` — no
hubo ninguna afirmación de que ya estuviera archivado que debiera corregir esta vez.

## 2. `proposal.md`/`design.md`/`tasks.md` — leídos completos

Confirmé la narrativa central: a diferencia de los siete módulos anteriores, el backend de
Dashboard ya había sido implementado y verificado como puerto fiel del mock el 2026-08-21 — este
change cierra la comparación que faltaba, el contrato de red frontend real ↔ backend real. La
investigación previa (mi propio brief) no encontró ningún mismatch, y la verificación reportada en
`tasks.md` (secciones 1-9) confirma eso mismo contra Postgres real: los 6 roles con acceso
(`OPERARIO`, `SUPERVISOR`, `JEFE_CALIDAD_SYST`, `JEFE_CONTROL_DOCUMENTARIO`, `AUDITOR_INTERNO`,
`ALTA_DIRECCION`) reciben `summary`/`kpis` con la forma exacta esperada, sin campos `undefined`;
los 9 KPIs coinciden dígito por dígito con `kpi.constants.ts` incluso con `valor:0` (empresa QA
nueva sin datos); y los dos endpoints `SUPERADMIN`-only sin consumidor en la UI responden 200 por
API directa, confirmando que siguen sin ningún punto de entrada en `dashboard.api.ts`.

**Metodología, igual que en `cutover-usuarios`/`cutover-no-conformidades`**: sin herramienta de
automatización de navegador disponible en ese entorno, todo se verificó por `curl` con JWT real en
vez de clic en la UI. Es una limitación real, no una debilidad oculta — está documentada de forma
explícita en `tasks.md` 3.3 y en la nota de la sección 4, y el contrato de tipos ya se había
confirmado por lectura de código en el `design.md` original.

## 3. Único hallazgo real — verificado contra el código, no solo contra la prosa

`design.md` D3 documenta que `GET /api/dashboard/summary` responde **401** (no 403) para
`SUPERADMIN`, y que esto no es un bug de Dashboard sino un comportamiento estructural compartido
por `RequireEmpresaActivaFilter`. Releí el código citado directamente, sin confiar en la
explicación:

- `ObtenerSummaryEndpoint.cs:14-15` — `.AddEndpointFilter<RequireEmpresaActivaFilter>().RequireAuthorization()`,
  **sin** `RequireRole` a nivel de ruta — confirmado, el archivo real no tiene ningún gate de rol
  en el `Map()`.
- `ObtenerKpisEndpoint.cs:27-28` — `RequireAuthorization(p => p.RequireRole(RolesConAccesoDashboard))`
  sí está a nivel de ruta — confirmado, y el middleware de autorización de ASP.NET Core corre antes
  que cualquier `IEndpointFilter`, por lo que para `SUPERADMIN` este endpoint sí corta en 403 antes
  de llegar al filtro de empresa activa. Ambos archivos verificados tienen `mtime` de agosto — no
  fueron tocados por este cutover, consistente con "no se anticipa ningún cambio de código" del
  proposal.
- `RequireEmpresaActivaFilter.cs:15-21` — confirmado: si `GetEmpresaActivaId()` es `null`, responde
  `401` `"No hay una empresa activa en la sesión."` antes de ejecutar el handler.
- `SessionResolver.cs:39-40` — confirmado: `if (user.EsSuperadminMultiempresa) return new
  SessionResolution.Resolved(null, UserRole.SUPERADMIN, [])` — `EmpresaActivaId` es literalmente
  `null` para `SUPERADMIN`, por diseño, no por un descuido de Dashboard.

Los cuatro archivos citados en D3 coinciden exactamente con lo que describe — el 401 en vez de 403
para `SUPERADMIN` es un artefacto real y correcto de la arquitectura de autorización compartida,
no específico de este módulo. Acertadamente no se corrigió nada.

## 4. `.env.development`/`.env.production` — revertidos, confirmado por lectura directa

- `.env.development`: `VITE_API_BASE_URL=` (vacío), `VITE_ENABLE_MSW=true` — estado original
  restaurado, coincide con lo reportado en `tasks.md` 9.4.
- `.env.production`: sin cambios, `VITE_ENABLE_MSW=false`, mismo Open Question de hosting heredado
  de `cutover-auth` — coincide con `tasks.md` 9.5.

## 5. Lo que no re-verifiqué en esta pasada, y por qué no bloquea el cierre

No repetí la prueba de exportación (Excel/PDF) ni recorrí uno por uno los 25 widgets — el propio
`design.md`/`tasks.md` ya documenta que se verificó por lectura de código (`ExportButton.tsx`) que
la exportación es 100% client-side a partir de datos ya cargados, y el hallazgo de la sección 7.2
(el export también depende de los 5 endpoints ya cutover-eados de QE/NC/Incidentes/Documentos/
Locales) es consistente con el patrón ya confirmado módulo por módulo en las seis verificaciones
anteriores de esta serie — no hay señal de que alguno de esos cinco haya retrocedido. Tampoco
releí `DashboardDataFetcher.cs`/`DashboardSummaryBuilder.cs` línea por línea — ya fueron
confirmados estructuralmente correctos en mi propia verificación de agosto, y no se les hizo
ningún cambio en este cutover (nada que re-verificar).

## Conclusión

Con Dashboard cerrado y verificado, **los ocho módulos de dominio del roadmap de cutover original
quedan completos**: Auth, Catálogos, Incidentes, Documentos, No Conformidades, Quality Events,
Usuarios y Dashboard. Quedan pendientes, como trabajo de mantenimiento futuro (ninguno bloqueante):
archivar los cuatro `openspec/changes/` sin archivar (`cutover-no-conformidades`,
`cutover-quality-events`, `cutover-usuarios`, `cutover-dashboard`) cuando decidas hacerlo, y
resolver el Open Question de hosting/dominio de producción heredado de `cutover-auth`, que sigue
abierto en todos los changes de esta serie.
