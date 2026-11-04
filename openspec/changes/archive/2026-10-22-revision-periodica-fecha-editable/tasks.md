## 1. Backend — constante de periodicidad compartida

- [x] 1.1 Extraer `PeriodicidadMeses` del handler a una clase compartida en `Features/Documentos/Shared/` (p.ej. `DocumentoPeriodicidadConstants.cs`), mismos valores, con comentario cruzado hacia `businessRules.config.ts` (frontend).

## 2. Backend — ConfirmarRevisionPeriodicaCommand + validator

- [x] 2.1 Crear `ConfirmarRevisionPeriodicaCommand(DateTime? FechaRevisionProxima)`.
- [x] 2.2 Crear `ConfirmarRevisionPeriodicaValidator`: si `FechaRevisionProxima` no es `null`, validar que sea ≥ "hoy en America/Lima + 30 días" (constante local `RevisionPeriodicaMinGapDays = 30`).

## 3. Backend — ConfirmarRevisionPeriodicaHandler

- [x] 3.1 Calcular "hoy en Lima" una vez al inicio (`TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("America/Lima")).Date`), mismo patrón que `DocumentoPdfGenerator`.
- [x] 3.2 Si `command.FechaRevisionProxima` no es `null`: usar esa fecha (normalizada a medianoche UTC) para todo tipo, incluyendo `REG`/`INF`.
- [x] 3.3 Si es `null`: `POL/PRC/PLAN/INS/MAT` usan "hoy en Lima + periodicidad del tipo" (desde `DocumentoPeriodicidadConstants`); `REG/INF` quedan `null`.
- [x] 3.4 Persistir siempre como `DateTime` con `Kind = Utc` y hora `00:00:00` (fecha de calendario, no timestamp).
- [x] 3.5 Capturar `FechaRevisionProxima` anterior ANTES de reasignarla; registrar `ValorAnterior`/`ValorNuevo` en el audit trail, formato `yyyy-MM-dd` (reemplaza el `"O"` actual).

## 4. Backend — Endpoint

- [x] 4.1 `ConfirmarRevisionPeriodicaEndpoint`: leer el body opcional (`ConfirmarRevisionPeriodicaCommand?`), pasar `command?.FechaRevisionProxima` al handler. Sin body, el comportamiento es idéntico al actual (compatibilidad).

## 5. Backend — Tests de integración

- [x] 5.1 Sin body en PRC → `fechaRevisionProxima` = hoy (Lima) + 12 meses, persistida como fecha de calendario (hora `00:00:00Z`).
- [x] 5.2 Con una fecha válida (hoy + 60 días) → se guarda exactamente esa fecha, no la sugerida.
- [x] 5.3 Con una fecha a hoy + 10 días → error de validación en `fechaRevisionProxima`, documento sin cambios.
- [x] 5.4 REG sin fecha → `fechaRevisionProxima: null`.
- [x] 5.5 REG con una fecha válida → se guarda esa fecha.
- [x] 5.6 El audit trail de `REVISION_PERIODICA_CONFIRMADA` tiene `ValorAnterior` (fecha previa) y `ValorNuevo` (fecha nueva), formato `yyyy-MM-dd`.

## 6. Frontend — schema y helpers de fecha

- [x] 6.1 Crear `confirmarRevisionPeriodica.schema.ts`: `fechaRevisionProxima: z.string().optional()` + `superRefine` que exige el mínimo de hoy+30 días solo si el valor no está vacío.
- [x] 6.2 Helper(s) en `date.utils.ts` (o nuevo): fecha de calendario de "hoy" (string `YYYY-MM-DD`) y "hoy + N días/meses", para precargar la sugerencia y el atributo `min` sin usar `new Date()` con zona local.

## 7. Frontend — DocumentRevisionPeriodicaModal

- [x] 7.1 Agregar el campo de fecha a la opción A: precargado con la sugerencia según `documento.tipo` (usando `DOC_PERIODICIDAD_POR_TIPO`), vacío para `REG`/`INF`.
- [x] 7.2 Atributo `min` = hoy + 30 días.
- [x] 7.3 Texto de ayuda con la periodicidad sugerida y el mínimo de 30 días.
- [x] 7.4 Mostrar el error del backend (si lo devuelve) en el campo, sin perder el valor ingresado.
- [x] 7.5 La opción B no cambia.

## 8. Frontend — API client y hook

- [x] 8.1 `confirmarRevisionPeriodica(id, payload?: { fechaRevisionProxima?: string | null })` envía el body.
- [x] 8.2 `useConfirmarRevisionPeriodica`: pasar el valor del formulario al mutationFn; el toast de éxito usa `formatCalendarDateMedium` (UTC), no el formateador de timestamp en zona local.

## 9. Frontend — i18n

- [x] 9.1 Agregar claves en `es-PE.json`/`en-US.json`: label del campo de fecha, texto de ayuda con la periodicidad sugerida y el mínimo de 30 días.

## 10. MSW

- [x] 10.1 Handler `PATCH /documents/:id/confirmar-revision`: aceptar el body opcional, aplicar la misma regla de margen mínimo (hoy + 30 días, calculado sin depender de la zona horaria local del entorno de test), usar la fecha sugerida por tipo cuando no se envía body, persistir como fecha de calendario.

## 11. Frontend — Tests

- [x] 11.1 `confirmarRevisionPeriodica.schema.test.ts`: rechaza fecha < hoy+30, acepta vacío/ausente, acepta fecha válida (incluido el límite exacto).
- [x] 11.2 `DocumentRevisionPeriodicaModal.test.tsx`: precarga la fecha sugerida según tipo (PRC/INS/MAT); REG sin sugerencia; `min` = hoy+30; no permite confirmar con fecha por debajo del mínimo; confirma con la sugerida sin tocarla.
- [x] 11.3 `useConfirmarRevisionPeriodica.test.tsx`: el toast no desfasa la fecha en UTC-5 (medianoche UTC del 1 de marzo no muestra "28 feb"); el payload enviado incluye `fechaRevisionProxima`.
- [x] 11.4 MSW: body con fecha válida se persiste tal cual; sin body usa la sugerida; fecha por debajo del mínimo es rechazada; REG sin body queda sin próxima revisión. (Durante la implementación: la detección por `content-length` no era confiable en el entorno de test de Node — se reemplazó por un `try/catch` directo sobre `request.json()`.)

## 12. Verificación

- [x] 12.1 Correr la suite completa del frontend (vitest) en `shc-controldoc`. 186 archivos / 1499 tests OK (1 expected fail preexistente, no relacionado).
- [x] 12.2 Correr los tests del backend (`dotnet test`) en `ShcMvpEndPoint`. 546/546 OK.
- [x] 12.3 Correr `tsc --noEmit` en `shc-controldoc`. Sin errores (verificado varias veces durante la implementación).
- [x] 12.4 Detener el backend en ejecución y correr `dotnet build` antes de la prueba manual. Hecho.
- [x] 12.5 Prueba manual con MSW apagado: desde el listado, en un PRC PUBLICADO, "Iniciar revisión" → opción A. Verificar la fecha sugerida, cambiarla y confirmar. El listado y el detalle deben mostrar exactamente esa fecha. Verificado por Toño.
- [x] 12.6 Intentar con una fecha a 10 días → debe dar error. Verificado por Toño.
- [x] 12.7 Repetir con un REG: sin fecha, y con fecha. Verificado por Toño.

## 13. Cierre

- [x] 13.1 Avisar "listo" para verificación de causa raíz releyendo el código real. Toño confirmó: "ya revise los changes y confirmo que estan ok".
