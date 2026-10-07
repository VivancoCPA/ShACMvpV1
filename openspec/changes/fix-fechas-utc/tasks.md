## 1. Backend — convertidor global de EF Core

- [x] 1.1 Agregar `ConfigureConventions` a `ShacDbContext` con un `ValueConverter` para `DateTime` y otro para `DateTime?`: al escribir, `Unspecified` → `SpecifyKind(Utc)` (sin desplazar la hora), `Utc` sin cambios, `Local` → `ToUniversalTime()`; al leer, `SpecifyKind(Utc)`
- [x] 1.2 Confirmar que no se genera migración (el tipo de columna Postgres no cambia); si `dotnet ef migrations add` detecta cambios, detenerse y anotarlo en `design.md`
- [x] 1.3 Confirmar (ya hecho en design.md, revalidar si el código cambió) que no hay escrituras Dapper/SQL crudo con `DateTime` de cliente que normalizar aparte

## 2. Frontend — Documentos: no enviar fechas vacías como `''`

- [x] 2.1 En `useDocumentForm.onSubmit`, omitir (`undefined`) `fechaVigencia`/`fechaRevisionProxima` cuando estén vacíos, en creación y edición
- [x] 2.2 Revisado `QualityEventForm`: no hay bug real (ver design.md) — `fechaHoraEvento` es requerido en el schema Zod, el fallback `''` en creación es código muerto, y en edición ya cae al valor original si el campo queda vacío. Sin cambios.

## 3. Frontend — helper de fecha de calendario sin zona horaria

- [x] 3.1 Agregar a `utils/date.utils.ts` un helper de formateo y otro de diferencia en días de calendario que lean el prefijo `YYYY-MM-DD` del ISO, sin construir un `Date` en la zona horaria del navegador para ese propósito
- [x] 3.2 Aplicar el helper en `DocumentDetailHeader.tsx` (`fechaEmision`, `fechaVigencia`, `fechaRevisionProxima`) y `DocumentRevisionPeriodicaModal.tsx`
- [x] 3.3 Aplicar el helper en `RevisionSemaforo.tsx` (cálculo de días restantes)
- [x] 3.4 Aplicar el helper en `DeadlineBadge.tsx` (formateo y cálculo de días restantes) — cubre Incidentes, NC y QE con un solo cambio
- [x] 3.5 Aplicar el helper en `NCList.tsx` para la columna `fechaDeteccion`
- [x] 3.6 No tocar el formateo de timestamps reales (`creadoEn`/`actualizadoEn`/audit trail, `fechaEvento`/`fechaReporte` de Incidente, `fechaHoraEvento`/`fechaHoraReporte` de QE) — deben seguir mostrándose en hora local

## 4. Tests

- [x] 4.1 Backend: tests de integración de Documentos con fechas date-only (`"2026-09-29"`) y vacías en crear y editar — `201`/`200`, no `500`, fecha guardada `2026-09-29T00:00:00Z`
- [x] 4.2 Backend: un caso equivalente en NC (crear con `fechaDeteccion`/`fechaCierre` date-only) — `201`, no `500`
- [x] 4.3 Frontend: test del helper de fecha de calendario cubriendo el caso `UTC-5` (formateo y diferencia en días)
- [x] 4.4 Frontend: test de `useDocumentForm.onSubmit` verificando que `fechaVigencia`/`fechaRevisionProxima` vacíos no viajan como `''`
- [x] 4.5 Frontend: test de `DeadlineBadge` y/o `RevisionSemaforo` cubriendo el caso de no desfase en `UTC-5`

## 5. Verificación

- [x] 5.1 Suite completa de tests del frontend, tests del backend y `tsc` (backend 476/476; frontend 175 archivos, 1349/1350 — el único fallo es `JefeCalidadDashboard.test.tsx`, preexistente y ya verificado contra el baseline en el change anterior; `tsc` falla solo en `IncidentForm.tsx:377`, mismo error preexistente y no relacionado)
- [x] 5.2 Backend detenido (con tu autorización) y recompilado en el sitio normal (`dotnet build` limpio, sin bloqueo de archivos) — queda apagado, listo para que lo levantes para la prueba manual
- [x] 5.3 Prueba manual con MSW apagado hecha por Claude vía navegador (empresa/usuario de prueba propios): crear documento sin fechas -> antes rompía la lista, con el fix se ve `—` sin crash; crear documento con fechas (vigencia 01/09/2026, próx. revisión 03/10/2026) -> semáforo rojo "Próximo" con 4 días de calendario, sin desfase. Bug #1 reportado ("la fecha no aparece") confirmado como diseño existente (RevisionSemaforo solo muestra el punto de color, nunca el texto — ver document-list-view spec.md:113), no un defecto de este change.
- [ ] 5.4 Confirmar en la prueba manual las filas "a confirmar" de la tabla de `design.md` (NC, ACs de los 3 dominios, `reporteExternoRef.fechaRecepcion`) y actualizar la tabla con el resultado real
- [ ] 5.5 Avisar a Toño ("listo"); retomar la tarea 6.3 de `documentos-revisor-aprobador-reales`. Cowork verifica releyendo el código real y escribe `SHAC-Verificacion-Fix-Fechas-UTC-<fecha>.md`
