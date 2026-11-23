## Context

Instrucción de Cowork del 2026-11-19 (`Claude outputs/INSTRUCCIONES-CLAUDE-CODE-qe-siguiente-paso-responsable-2026-11-19.md`), decisiones D1/D2 de Toño. El detalle del QE no dice qué falta ni quién debe hacerlo; en PENDIENTE_CIERRE sin `resultadoCierre` la sección de cierre queda vacía para todos menos el JCA (`showFirmas`, `QECierreSection.tsx:292`).

Lo que ya existe y se reutiliza (verificado en el código):
- `ObtenerQualityEventHandler` carga AC (con `ResponsableNombre`, `Estado`, `PlazoFecha`), audit trail completo, `ResponsableInvestigacionNombre/AvatarUrl`, `CerradoPorNombre`, `CierreFirmaSupervisorNombre` y `SupervisoresArea` (este último solo en PENDIENTE_CIERRE, vía `SupervisoresAreaResolver`, que ya filtra usuario activo + asignación SUPERVISOR ACTIVA + `AreaIds`).
- `AjustePlazoCalculator.ContarDiasHabiles` (lunes a viernes, sin feriados).
- `DashboardKpiConstants.PlazoMaximoQEPorEstado` ya tiene los plazos 15/10/7/3, 2, 5 y 10 días hábiles del PRD §1.3.
- `QEFechaDerivadaResolver.FechaEntradaEstado` (Dashboard).

## Goals / Non-Goals

**Goals:** paso pendiente + responsables con nombre + "desde" + plazo informativo con semáforo, para todos los usuarios, en el detalle; bloque de pasos de cierre siempre visible en PENDIENTE_CIERRE.

**Non-Goals:** avisos/notificaciones por vencimiento del plazo (D2); `siguientePaso` en el listado; tabla de feriados; migraciones.

## Decisions

**D1 — Resolver puro + una lectura extra en el handler.** `QESiguientePasoResolver.Resolver(qe, jcas, ahora)` es puro (testeable sin BD). El handler agrega una única consulta: JCA activos de la empresa con nombre/avatar (`usuarios_empresa` rol `JEFE_CALIDAD_SYST` estado ACTIVO + `asp_net_users.activo`). **Divergencia:** la instrucción pide reutilizar `RolNotificationHelper.ResolverDestinatariosPorRolAsync`, pero ese helper devuelve solo ids, excluye al actor (`UsuarioId != actorId`, correcto para notificaciones, incorrecto aquí: el JCA que mira debe verse a sí mismo para "Te toca a ti") y no filtra `ShacUser.Activo`. Se crea `JefesCalidadResolver.ResolverAsync` con el mismo filtro de asignación ACTIVA más usuario activo y proyección a nombre.

**D2 — `SupervisoresArea` se resuelve también fuera de PENDIENTE_CIERRE? No.** Solo se usa en `FIRMA_SUPERVISOR`, que ocurre únicamente en PENDIENTE_CIERRE, donde el handler ya lo carga. No se cambia el contrato existente de `supervisoresArea` (null fuera de PENDIENTE_CIERRE).

**D3 — `EstadoDesde` no reutiliza `QEFechaDerivadaResolver.FechaEntradaEstado`.** **Divergencia** con la idea de "reutilizar": ese helper filtra `Accion == "ESTADO_CAMBIADO"`, y en el código real varias entradas de entrada a un estado no usan esa acción: `FIRMA_CIERRE_SUPERVISOR` (→ CERRADO), `CIERRE_RECHAZADO` (→ EN_EJECUCION), `REABIERTO` (→ EN_INVESTIGACION), `VERIFICACION_EFICACIA` (→ VERIFICADO). Además su fallback es `FechaHoraReporte`, y la instrucción pide `CreadoEn`. Se usa "última entrada con `EstadoNuevo == qe.Estado`, cualquier acción". **Trampa encontrada:** las entradas de AC (`AC_INICIADA`, `AC_DEVUELTA`, `AC_EJECUTADA`, …, escritas por `AccionCorrectivaQEAcceso.RegistrarAudit` y `RevisarAjustePlazoAC`) guardan en `EstadoNuevo` el estado de la **AC** — y la AC tiene un estado `EN_EJECUCION` homónimo al del QE. Se excluyen las entradas con `Accion` que empieza con `AC_`. No se toca el helper del Dashboard (fuera de alcance; se anota como riesgo).

**D4 — Plazos.** Se reutiliza `DashboardKpiConstants.PlazoMaximoQEPorEstado` para EN_INVESTIGACION/ANALISIS_COMPLETADO/PENDIENTE_CIERRE/EN_VERIFICACION (misma tabla PRD §1.3, una sola fuente). ABIERTO usa 48 h corridas (no hábiles, PRD: "48 h"). FIRMA_SUPERVISOR: 3 días hábiles desde la **última** `FIRMA_CIERRE_JEFE_CALIDAD` (tras un rechazo puede haber varias); si no existe (dato legacy `FIRMA_REGISTRADA` con `campoModificado == 'cerradoPorId'` también se acepta), cae a `estadoDesde`. EJECUTAR_ACS: mayor `PlazoFecha` de las AC no CERRADA; si no hay AC abiertas, sin plazo.

**D5 — `DiasHabiles.Sumar(desde, dias)`** en `Features/QualityEvents/Shared/DiasHabiles.cs`: convierte a hora de Lima (`TimeZoneInfo` "America/Lima", fallback "SA Pacific Standard Time" en Windows, fallback final UTC-5 fijo — Lima no tiene horario de verano), avanza día a día saltando sábado/domingo y vuelve a UTC conservando la hora. Sin feriados: limitación hasta que exista la tabla de feriados (RNG-003). Mismo criterio que `ContarDiasHabiles`.

**D6 — Orden de evaluación en EN_INVESTIGACION.** `APROBAR_CAUSA_RAIZ` se evalúa antes que `COMPLETAR_ANALISIS`: con causa raíz ≥ 100 caracteres sin firmar, el paso es del JCA. El plazo en ese caso es el de EN_INVESTIGACION por severidad (instrucción). "Firmada" = `CausaRaizFirmadaEn != null` (lo que escribe `AprobarCausaRaizQEHandler`).

**D7 — Responsables.** Se deduplican por id conservando el orden (primero el responsable "natural" del paso, luego el JCA). Rol: el del contexto (`JEFE_CALIDAD_SYST`, `SUPERVISOR`; responsable de investigación y responsables de AC se informan con el rol de su asignación en la empresa si está disponible, si no `null`). **Divergencia menor:** para evitar más consultas, el `Rol` de responsables de investigación/AC se resuelve en la misma consulta de JCA ampliada a "asignaciones activas de los ids involucrados"; un responsable de AC inactivo o sin asignación activa en la empresa se excluye (regla "excluir inactivos").

**D8 — Auditor de verificación.** No existe un auditor asignado persistido en el modelo real (`AuditorAsignadoId` solo aparece como parámetro de `ForzarVencimientoVerificacionCommand`, y el campo `auditorAsignadoId` del tipo frontend no lo llena el backend). `VERIFICAR_EFICACIA` → JCA.

**D9 — REABIERTO.** El enum `QEEstado` del backend no tiene `REABIERTO` (la reapertura va directo a EN_INVESTIGACION, `QEReaperturaHelper`), así que el resolver no lo contempla; la reapertura cae en `COMPLETAR_ANALISIS` con `estadoDesde` = entrada `REABIERTO` (que escribe `EstadoNuevo = EN_INVESTIGACION`). El mock MSW sí trata `REABIERTO` como EN_INVESTIGACION por completitud del tipo frontend.

**D10 — Frontend.** `QESiguientePasoBanner` recibe `qe` y lee `qe.siguientePaso`; si es null/undefined no renderiza nada (respuestas de escritura no lo traen; el detalle se re-consulta tras cada mutación por invalidación de query). Semáforo: ámbar si `contarDiasHabiles(ahora, plazo) <= 1` (helper existente en `qualityEventHelpers`), rojo si `plazo < ahora`. "Hace N días" = días corridos. La fila Paso 1 de `QECierreSection` toma la fecha de la última `CIERRE_INICIADO`. `showFirmas = estado === 'PENDIENTE_CIERRE' || showSummary`.

**D11 — El badge existente `plazoPendienteCierreLabel` de `QEHeaderSection`** (cuenta 5 días desde una entrada `TRANSICION_AUTOMATICA` que solo escribe el mock) queda igual: no es parte de esta instrucción y con backend real nunca aparece. Anotado para limpieza futura.

**D12 — MSW.** `buildSiguientePaso(qe)` simplificado en `mocks/handlers/shared/qeSiguientePaso.ts`: misma tabla, JCA = usuarios del store con rol efectivo JEFE_CALIDAD_SYST activos, días hábiles sin zona horaria. No se agregaron fixtures: ya existían `qe-2026-022` (PENDIENTE_CIERRE sin resultado) y `qe-2026-003` (firma del JCA, sin la del supervisor).

**D13 — Divergencia de nombre.** La tarea 1.4 hablaba de `JefesCalidadResolver`; se implementó como `ResponsablesPasoLoader` (una sola consulta para JCA activos + responsables de investigación/AC activos con su rol en la empresa). Se agregó la clave i18n `detail.siguientePaso.masResponsables` ("+{{count}}") y `detail.siguientePaso.paso.FINALIZADO`, no listadas en la instrucción.

**D14 — Línea base de lint/tsc.** El repo ya tenía errores ajenos a este change (≈53 errores de lint y 18 de `tsc`, en `documents`, `users`, `router`, etc.; en `QEHeaderSection.tsx:84` un `Date.now` previo). Ninguno lo introduce este change; no se corrigieron por estar fuera de alcance.

## Risks / Trade-offs

- [Sin feriados] → plazo puede caer en feriado; informativo, documentado (RNG-003).
- [`QEFechaDerivadaResolver` del Dashboard sigue filtrando solo `ESTADO_CAMBIADO`] → puede calcular "desde" distinto al banner para CERRADO/VERIFICADO/EN_EJECUCION tras rechazo. No se corrige aquí (fuera de alcance); candidato a change propio.
- [Una consulta más en el detalle] → mínima (índice por empresa/rol).
