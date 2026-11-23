## Context

`QEReaperturaHelper.ReabrirAsync` (llamado por `VerificacionEficaciaQEHandler` con NO_EFECTIVO y por `ForzarVencimientoVerificacionHandler`, dev-only) solo cambia el estado a EN_INVESTIGACION, incrementa `Ciclo`, registra `REABIERTO` y sincroniza el incidente. Los datos del cierre, la verificación y la firma de causa raíz del ciclo anterior quedan cargados, y en el ciclo 2:

- `QECierreSection` no muestra ningún botón (`showClosureForm`, `showFirstSignature` y `showPendingSecondSignature` son falsos) y presenta las firmas viejas como confirmadas.
- `FirmarCierreQEHandler` respondería "el cierre ya tiene ambas firmas registradas".
- `QESiguientePasoResolver` en PENDIENTE_CIERRE no mira `CierreFirmaSupervisorId` y devuelve `FIRMA_SUPERVISOR`.
- RN-QE-002 dejaría pasar a EN_EJECUCION con la firma de causa raíz del ciclo 1.

## Goals / Non-Goals

**Goals:** cada ciclo arranca con cierre, verificación y aprobación de causa raíz en blanco, con trazabilidad completa (RN-QE-007); destrabar los QE ya afectados (QE-2026-006); que el indicador "Siguiente paso" y los botones del cierre usen la misma condición.

**Non-Goals:** cambiar el esquema (no se agrega una columna de ciclo a las AC), reasignar el responsable de investigación, tocar las AC del ciclo anterior, modelar un estado persistido `REABIERTO`.

## Decisions

### D1 — Reinicio en `QEReaperturaHelper`
Antes de cambiar el estado se agrega la entrada `CICLO_REINICIADO` (`CampoModificado = "cierre/verificacion/causaRaiz"`, `ValorAnterior` = resumen, `ValorNuevo = "Ciclo {N+1}"`, mismo actor), después `REABIERTO` y luego se ponen en `null` los ocho campos. El `Timestamp` de `CICLO_REINICIADO` es `now` (el mismo que `REABIERTO`); para el orden se usa el `Id` v7, que se crea primero.

El resumen se arma con nombres y fechas (hora de Lima, `dd/MM/yyyy`), nunca ids: "Ciclo 1 · Cierre: {resultado truncado a 100} · Firma JCA: {nombre} {fecha} · Firma supervisor: {nombre} {fecha} · Verificación: {resultado} {fecha} · Causa raíz aprobada por {nombre} {fecha}". Cada segmento solo aparece si el dato existe. Los nombres salen de las entradas de audit del ciclo (`FIRMA_CIERRE_JEFE_CALIDAD`/legacy, `FIRMA_CIERRE_SUPERVISOR`, `CAUSA_RAIZ_APROBADA`, `realizado_por_nombre`), con fallback a la tabla de usuarios por id y, si tampoco existe, "—". Para eso el helper carga el audit trail del QE (`db.QualityEventAuditTrail.Where(qe.Id)`), ya que los handlers llamantes no lo incluyen. La verificación usa `qe.ResultadoVerificacion` (en el camino NO_EFECTIVO ya vale NO_EFECTIVO al momento de reabrir) y la fecha `now`; en el forzado dev-only el resultado puede ser null y el segmento dice "Verificación: vencida".

`PlazoVerificacionDias` también se limpia: lo fija `CerrarQEHandler` al registrar el resultado (default 60) y el formulario lo vuelve a pedir.

### D2 — AC del ciclo actual (hallazgo)
- La transición **automática** a PENDIENTE_CIERRE solo ocurre en `VerificarAccionCorrectivaQEHandler` al verificar una AC COMPLETADA. En un ciclo N>1 esa AC tiene que ser nueva (todas las del ciclo anterior estaban CERRADA para que el QE pudiera cerrarse), así que hoy no puede saltar sin AC nuevas. Igual se le aplica el criterio por defensa.
- La transición **manual** (`TransicionarEstadoQEHandler`, `PATCH /status` EN_EJECUCION → PENDIENTE_CIERRE, RN-QE-003) **sí** pasaba con solo las AC del ciclo anterior. Se corrige.

Regla: si existe una entrada `REABIERTO`, debe haber al menos una AC con `CreadoEn > max(REABIERTO.Timestamp)`; si no, 422 `RN-QE-003-CICLO` ("el ciclo actual necesita al menos una acción correctiva nueva antes de pasar a PENDIENTE_CIERRE"). Se implementa una vez en `AccionCorrectivaQEAcceso.TieneAccionDelCicloActualAsync(db, qe, ct)` (consulta del último `REABIERTO`, sin columnas nuevas). En la verificación automática, si no se cumple simplemente no se transiciona.

### D3 — `CIERRE_INCONSISTENTE`
En PENDIENTE_CIERRE, si `CerradoPorId` y `CierreFirmaSupervisorId` existen a la vez, el resolver devuelve `CIERRE_INCONSISTENTE` (responsables: JCA, sin plazo ni regla). Se evalúa antes de `FIRMA_SUPERVISOR`. Correspondencia paso ↔ botón en `QECierreSection`: `REGISTRAR_RESULTADO_CIERRE` ↔ `showClosureForm`, `FIRMA_JCA` ↔ `showFirstSignature`, `FIRMA_SUPERVISOR` ↔ `showSecondSignature` (este último además depende de `resolveRolSegundaFirma` y de que el usuario esté en `supervisoresArea`, que son los mismos responsables del resolver). Se cubre con un test de coherencia en el frontend que usa el `buildSiguientePaso` de MSW (espejo del resolver) contra la sección.

### D4 — Migración `FixReaperturaCicloCierre`
SQL en `Up()` sobre `quality_events` y `quality_event_audit_trail` (nombres confirmados en `ShacDbContextModelSnapshot.cs`). Alcance: `deleted_at IS NULL`, `ciclo > 1`, `estado IN ('EN_INVESTIGACION','ANALISIS_COMPLETADO','EN_EJECUCION','PENDIENTE_CIERRE')`, con al menos un `REABIERTO`. Un campo se limpia si su última entrada de respaldo es anterior al último `REABIERTO` o no existe:

| Campo(s) | Respaldo |
|---|---|
| `resultado_cierre`, `plazo_verificacion_dias` | `CIERRE_INICIADO`, o `CAMPO_EDITADO` con `campo_modificado = 'resultadoCierre'` |
| `cerrado_por_id` | `FIRMA_CIERRE_JEFE_CALIDAD`, o `FIRMA_REGISTRADA` con `campo_modificado = 'cerradoPorId'` |
| `cierre_firma_supervisor_id`, `fecha_verificacion_programada` | `FIRMA_CIERRE_SUPERVISOR`, o `FIRMA_REGISTRADA` con `campo_modificado = 'cierreFirmaSupervisorId'` |
| `causa_raiz_aprobada_por_id`, `causa_raiz_firmada_en` | `CAUSA_RAIZ_APROBADA` |
| `resultado_verificacion` | `VERIFICACION_EFICACIA` (nunca puede ser del ciclo actual en estos estados) |

Por cada QE con al menos un campo limpiado (y no nulo antes), se inserta `CORRECCION_DATOS_REAPERTURA` (`realizado_por_id = 'system'`, `realizado_por_nombre = 'Sistema'`, `generado_por_ia = true`, `campo_modificado = 'cierre/verificacion/causaRaiz'`, `valor_anterior` = lista de campos limpiados, `timestamp = now() at UTC`, `id = gen_random_uuid()`). Se ejecuta en un solo bloque: CTE con el último `REABIERTO` y las banderas por campo → `INSERT` del audit → `UPDATE … FROM`. `Down()` vacío con comentario (corrección irreversible de datos).

### D5 — Frontend
- `QECierreSection`: las filas de Paso 1 / Firma 1 / Firma 2 buscan su entrada de audit solo **después** del último `REABIERTO` (helper `entradasDelCicloActual`). La lógica de visibilidad no cambia.
- `QEHeaderSection`: el badge que hoy dice "Reincidencia ×{n}" pasa a `detail.header.ciclo` ("Ciclo {n}"), mismo estilo ámbar. La clave `list.reincidencia` del listado no se toca. **Divergencia**: la instrucción pedía agregar el badge "si todavía no se muestra"; ya existía con otro texto, así que se reemplaza el texto en vez de duplicar badges.
- `QESiguientePasoBanner`: `CIERRE_INCONSISTENTE` usa ícono de alerta; el texto viene de `detail.siguientePaso.paso.CIERRE_INCONSISTENTE`.
- Etiquetas del audit trail: `detail.auditTrail.acciones.CICLO_REINICIADO` / `CORRECCION_DATOS_REAPERTURA`.

### D6 — MSW
Los dos handlers que reabren (verificación NO_EFECTIVO y forzado) limpian los mismos campos y agregan la entrada `CICLO_REINICIADO`. `buildSiguientePaso` agrega `CIERRE_INCONSISTENTE`. Fixture nuevo en ciclo 2, PENDIENTE_CIERRE, con `resultadoCierre` y sin firmas (espera la firma del JCA), con su `CICLO_REINICIADO` y `REABIERTO` (`qe-2026-024`).

## Risks / Trade-offs

- [Un QE con ciclo > 1 cuyo `REABIERTO` no está en el audit (datos sembrados a mano)] → la migración lo ignora (sin `REABIERTO` no hay corte); se lista aparte si aparece.
- [`CreadoEn` de una AC igual al timestamp del `REABIERTO`] → se usa `>` estricto; imposible en la práctica porque la AC se crea en otra request.
- [El resumen de `CICLO_REINICIADO` usa nombres del momento] → es el comportamiento deseado para un registro histórico.

## Migration Plan

1. Detener el backend → `dotnet ef database update` → `dotnet build` → `dotnet run`.
2. Antes de dar por buena la migración, listar en este archivo los QE afectados en la base de desarrollo (sección siguiente). QE-2026-006 debe aparecer.
3. Rollback: no hay; los valores limpiados quedan descritos en `CORRECCION_DATOS_REAPERTURA`.

## QE afectados en desarrollo

Dry-run del criterio de D4 contra `shac_dev` (2026-11-20), excluyendo las empresas generadas por los tests (`razon_social ~ '^Empresa [0-9a-f]{32}$'`, ~50 mil):

| Empresa | QE | Ciclo | Estado | Campos limpiados |
|---|---|---|---|---|
| Impala Terminals Callao | QE-2026-003 | 2 | EN_INVESTIGACION | resultado del cierre + plazo, firma JCA, firma supervisor + fecha de verificación, aprobación de la causa raíz |
| Impala Terminals Callao | **QE-2026-006** | 2 | PENDIENTE_CIERRE | resultado del cierre + plazo, firma JCA, firma supervisor + fecha de verificación, aprobación de la causa raíz |
| QA Empresa Beta S.A.C. | QE-2026-008 | 2 | EN_INVESTIGACION | los anteriores + resultado de la verificación |
| QA Empresa Beta S.A.C. | QE-2026-010 | 2 | EN_INVESTIGACION | resultado del cierre + plazo, firma JCA, firma supervisor + fecha de verificación, aprobación de la causa raíz |

QE-2026-006 pierde también el resultado del cierre del ciclo 1 (su `CIERRE_INICIADO` es anterior al `REABIERTO`), así que el siguiente paso pasa a ser `REGISTRAR_RESULTADO_CIERRE` (JCA). Ningún QE real conserva campos del ciclo actual.

**Hallazgo (preexistente, fuera de alcance):** `AddInfrastructure` lee `ConnectionStrings:ShacDb` mientras se construye el host, antes de que `ShacWebApplicationFactory` aplique su `ConfigureAppConfiguration`, así que los tests de integración escriben en `shac_dev` (el contenedor de Testcontainers arranca pero no se usa). Por eso el test de la migración ejecutó `FixReaperturaCicloCierreSql` sobre `shac_dev` y los 4 QE de la tabla ya quedaron corregidos (122 entradas `CORRECCION_DATOS_REAPERTURA` en total, contando QE de tests) antes de `dotnet ef database update`. Como el SQL es idempotente, la migración no cambia nada más al aplicarse y queda registrada en `__EFMigrationsHistory`. Conviene corregir el factory en un change aparte (p. ej. leer la cadena con `IOptions`/al resolver el `DbContext`, o `builder.UseSetting("ConnectionStrings:ShacDb", …)`).

## Open Questions

Ninguna.
