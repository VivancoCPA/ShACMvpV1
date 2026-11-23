## 1. Backend — cálculo

- [x] 1.1 `Features/QualityEvents/Shared/DiasHabiles.cs` con `Sumar(desde, dias)` (hora de Lima, salta sábado/domingo, sin feriados)
- [x] 1.2 Records `QESiguientePaso` y `ResponsablePaso` en `ShcMvpEndPoint.Domain/Common/` y propiedad `[NotMapped] SiguientePaso` en `QualityEvent`
- [x] 1.3 `Features/QualityEvents/Shared/QESiguientePasoResolver.cs`: `EstadoDesde` (D3), tabla de pasos, plazos (D4), responsables deduplicados (D7), progreso de AC
- [x] 1.4 Lectura de JCA activos con nombre (`JefesCalidadResolver`, D1) y filtrado de responsables de AC/investigación inactivos
- [x] 1.5 `ObtenerQualityEventHandler` pobla `SiguientePaso` (solo detalle)

## 2. Backend — tests

- [x] 2.1 Tests unitarios del resolver: cada fila de la tabla, CRITICA con fin de semana, EN_EJECUCION 3 AC, PENDIENTE_CIERRE sin resultado / FIRMA_SUPERVISOR, área sin supervisor, `EstadoDesde` (última entrada, `CreadoEn`, exclusión `AC_*`), VERIFICADO
- [x] 2.2 Tests de `DiasHabiles.Sumar`
- [ ] 2.3 Test de endpoint: el detalle devuelve `siguientePaso`, inactivos excluidos, listado sin `siguientePaso`

## 3. Frontend

- [x] 3.1 Tipos `QESiguientePaso`/`ResponsablePasoQE` y `siguientePaso?` en `QualityEvent`
- [x] 3.2 i18n `qualityEvents` es-PE / en-US: `detail.siguientePaso.*` y `detail.cierre.paso1`
- [x] 3.3 `components/QESiguientePasoBanner.tsx` (paso, responsables máx. 3 + "+N", desde, plazo con semáforo y tooltip, progreso AC, finalizado, "Te toca a ti") e integración en `QEHeaderSection`
- [x] 3.4 `QECierreSection`: bloque de pasos siempre en PENDIENTE_CIERRE con la fila Paso 1; `showFirmas` actualizado
- [x] 3.5 Tests: banner (paso/responsables/desde/plazo/semáforo, "Te toca a ti", "+N", vacío, vencido, finalizado) y cierre (SUPERVISOR ve los tres pasos sin resultado)

## 4. MSW

- [x] 4.1 `buildSiguientePaso` simplificado en el handler del detalle
- [x] 4.2 Fixtures: un QE en PENDIENTE_CIERRE sin resultado y otro esperando la firma del supervisor (ya existían: `qe-2026-022` y `qe-2026-003`)
- [x] 4.3 Test del handler: detalle en PENDIENTE_CIERRE sin resultado → `REGISTRAR_RESULTADO_CIERRE`

## 5. Verificación

- [ ] 5.1 Suite completa backend (`dotnet test`) y frontend (`npm test`)
- [ ] 5.2 `tsc --noEmit` y `npm run lint` con cero errores
- [ ] 5.3 Prueba manual con MSW apagado (QE-2026-006 como no-JCA y como JCA, otros estados, plazo vencido) — la hace Toño
