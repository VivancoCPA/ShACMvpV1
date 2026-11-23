## 1. Backend — reapertura y AC por ciclo

- [x] 1.1 `QEReaperturaHelper.ReabrirAsync`: entrada `CICLO_REINICIADO` con resumen legible (nombres desde el audit / usuarios), luego limpiar los ocho campos (D1)
- [x] 1.2 `AccionCorrectivaQEAcceso.TieneAccionDelCicloActualAsync` y su uso en `TransicionarEstadoQEHandler` (422 `RN-QE-003-CICLO`) y en `VerificarAccionCorrectivaQEHandler` (sin transición) (D2)
- [x] 1.3 `QESiguientePasoResolver`: paso `CIERRE_INCONSISTENTE` antes de `FIRMA_SUPERVISOR` (D3)

## 2. Backend — migración

- [x] 2.1 `dotnet ef migrations add FixReaperturaCicloCierre` con SQL en `Up()` (CTE + INSERT audit + UPDATE … FROM) y `Down()` vacío (D4)
- [x] 2.2 Listar en `design.md` los QE afectados en la base de desarrollo (QE-2026-006 debe aparecer)

## 3. Backend — tests

- [x] 3.1 Reapertura NO_EFECTIVO: estado, ciclo, campos en null, análisis conservado, AC CERRADA, `CICLO_REINICIADO` con nombres
- [x] 3.2 Ciclo 2 completo: 422 RN-QE-002 sin aprobar → aprobar, AC nueva, PENDIENTE_CIERRE, resultado, firma JCA, firma supervisor → CERRADO
- [x] 3.3 QE reabierto sin AC nuevas no pasa a PENDIENTE_CIERRE (manual 422)
- [x] 3.4 Resolver: dos firmas en PENDIENTE_CIERRE → `CIERRE_INCONSISTENTE`
- [x] 3.5 Migración: ciclo 2 con firmas viejas (limpia + audit), firma JCA posterior (se conserva), ciclo 1 y ciclo 2 CERRADO (sin cambios)

## 4. Frontend

- [x] 4.1 Tipo `QESiguientePasoCodigo` con `CIERRE_INCONSISTENTE`; ícono en `QESiguientePasoBanner`
- [x] 4.2 `QECierreSection`: entradas de audit solo del ciclo actual (después del último `REABIERTO`)
- [x] 4.3 `QEHeaderSection`: badge `detail.header.ciclo`
- [x] 4.4 i18n es-PE / en-US: `detail.siguientePaso.paso.CIERRE_INCONSISTENTE`, `detail.header.ciclo`, `detail.auditTrail.acciones.CICLO_REINICIADO` / `CORRECCION_DATOS_REAPERTURA`
- [x] 4.5 Tests: coherencia banner ↔ botones (sin resultado, resultado sin firmas, con firma JCA; JCA y supervisor), badge "Ciclo 2", filas de firma ignoran entradas del ciclo anterior

## 5. MSW

- [x] 5.1 Reapertura (NO_EFECTIVO y forzado) limpia los campos y agrega `CICLO_REINICIADO`; `buildSiguientePaso` con `CIERRE_INCONSISTENTE`
- [x] 5.2 Fixture: QE ciclo 2, PENDIENTE_CIERRE, con resultado y sin firmas
- [x] 5.3 Test del handler: NO_EFECTIVO deja el cierre en blanco

## 6. Verificación

- [ ] 6.1 Suite completa backend (`dotnet test`) y frontend (`npm test`)
- [ ] 6.2 `tsc --noEmit` y `npm run lint` con cero errores
- [ ] 6.3 Prueba manual con MSW apagado (QE-2026-006, firma del supervisor, reapertura NO_EFECTIVO) — la hace Toño
