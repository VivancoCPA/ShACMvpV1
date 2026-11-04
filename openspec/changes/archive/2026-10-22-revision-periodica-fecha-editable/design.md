## Context

Confirmado leyendo el código real (2026-10-07):

- `ConfirmarRevisionPeriodicaEndpoint.cs:16-24` — `Handle(Guid id, ClaimsPrincipal user, ...)`, sin ningún parámetro de body. El cliente no puede enviar nada.
- `ConfirmarRevisionPeriodicaHandler.cs:35-39` — `var now = DateTime.UtcNow; ... documento.FechaRevisionProxima = meses is null ? null : now.AddMonths(meses.Value);`. Guarda un `DateTime` con hora real (`UtcNow`), no una fecha de calendario a medianoche — viola el criterio de `fix-fechas-utc` que sí siguen `CrearDocumentoHandler`/`EditarDocumentoHandler` para `FechaVigencia`/`FechaRevisionProxima`.
- `ConfirmarRevisionPeriodicaHandler.cs:43-55` — el audit trail solo registra `ValorNuevo` (la fecha nueva en formato `"O"`, con hora); no hay `ValorAnterior`.
- `DocumentRevisionPeriodicaModal.tsx` — la opción A (`handleOpcionA`) llama `confirmar.mutateAsync()` sin argumentos; no existe ningún `<input type="date">` en el componente.
- `useDocumentActions.ts:306-321` (`useConfirmarRevisionPeriodica`) — el toast de éxito formatea `updatedDoc.fechaRevisionProxima` con `new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(...))`, **sin `timeZone: 'UTC'`** — a diferencia de `formatCalendarDateMedium` (`date.utils.ts`), que sí lo hace. En UTC-5 (Lima) esto puede mostrar el día anterior al que realmente se guardó.
- MSW (`documents.handlers.ts:1170-1223`) — mismo patrón: ignora cualquier body, usa `new Date()` (hora/zona **local del navegador** en el entorno de test/dev, no UTC ni Lima) y arma la fecha con `new Date(year, month, day).toISOString()`, que puede desfasar el día según el offset local al convertir a UTC — doble violación de `fix-fechas-utc`.
- `businessRules.config.ts:4` (frontend) ya expone `DOC_REVISION_MIN_GAP_DAYS = 30` y `DOC_PERIODICIDAD_POR_TIPO` (`POL:12, PRC:12, INS:24, MAT:6, PLAN:12, REG:null, INF:null`) — coincide exactamente con `PeriodicidadMeses` del backend (`ConfirmarRevisionPeriodicaHandler.cs:15-24`). No hay una constante equivalente en el backend hoy (vive hardcodeada en el handler).
- `DocumentoPdfGenerator.cs:48-50` ya usa `TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("America/Lima"))` para timestamps de marca de agua — mismo patrón a reutilizar para calcular "hoy" en Lima.
- **Verificación pedida por el doc (qué fecha ve Toño hoy):** trazando el código, un `PRC` confirmado hoy guarda `hoy + 12 meses` (con hora), nunca literalmente "hoy". Un `REG`/`INF` guarda `null`. No se encontró ningún punto donde el valor persistido termine siendo la fecha del día de la confirmación — el síntoma real reportado ("no deja poner una fecha, la asigna automática") es el comportamiento ya confirmado arriba: el cálculo automático SIEMPRE gana porque no hay forma de anularlo, no un bug adicional de "se queda en hoy". No se abre ningún bug nuevo por este punto.

## Goals / Non-Goals

**Goals:**
- El usuario puede ver la fecha sugerida y cambiarla antes de confirmar la revisión periódica (opción A).
- La fecha elegida (o la sugerida, si no se envía ninguna) se persiste como fecha de calendario, sin hora, igual que `FechaVigencia`/`FechaRevisionProxima` en creación/edición.
- El margen mínimo de 30 días se calcula contra "hoy" en hora de Lima, no UTC del servidor — para que un usuario en Perú nunca vea rechazada una fecha que para él es válida (o aceptada una que no lo es) por el desfase UTC-5.
- El toast y el detalle muestran exactamente la fecha guardada, sin desfase de un día.

**Non-Goals:**
- No se cambia la opción B (crear nueva versión) del modal.
- No se cambia `PeriodicidadMeses`/`DOC_PERIODICIDAD_POR_TIPO` en sí (los valores por tipo ya coinciden entre frontend y backend) — solo se unifica dónde vive la constante en el backend para no tenerla hardcodeada dentro del handler.
- No se valida el margen mínimo contra `FechaVigencia` aquí — esa es la regla RN-DOC-020 ya existente en Crear/Editar Documento (margen entre `FechaVigencia` y `FechaRevisionProxima`). Esta es una regla nueva y distinta: margen entre **hoy** y la fecha elegida al confirmar revisión periódica.

## Decisions

**D1 — Constante de periodicidad: nueva clase compartida en el backend, sin tocar los valores.**
Se extrae `PeriodicidadMeses` del handler a `DocumentoPeriodicidadConstants.MesesPorTipo` (o nombre equivalente, misma carpeta `Features/Documentos/Shared/`), con los mismos valores que `DOC_PERIODICIDAD_POR_TIPO` del frontend (ya idénticos). El handler pasa a consumir esa constante en vez de la `Dictionary` privada. No se unifica un único archivo entre C# y TypeScript (no es posible sin una capa de codegen) — se deja documentado en el propio archivo de cada lado que ambos deben mantenerse sincronizados, mismo criterio que ya usa `DocumentoAsignacionRoles.cs` respecto a `constants.ts` del frontend.

**D2 — "Hoy" se calcula en `America/Lima`, reutilizando el patrón ya existente.**
Mismo mecanismo que `DocumentoPdfGenerator.cs` (`TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("America/Lima"))`), tomando solo la parte de fecha (`.Date`) del resultado. Se evalúa una sola vez por request, antes de cualquier cálculo de sugerencia o validación, para que ambos usen el mismo "hoy".

**D3 — Validación: nueva regla propia, no reutiliza el validator de RN-DOC-020 de Crear/Editar.**
El validator de `ConfirmarRevisionPeriodicaCommand` compara la fecha enviada contra `hoyLima + 30 días` — una comparación distinta a la de `CrearDocumentoValidator`/`EditarDocumentoValidator` (que comparan `FechaRevisionProxima` contra `FechaVigencia`, no contra "hoy"). Se define una constante local `RevisionPeriodicaMinGapDays = 30` en el nuevo validator, mismo patrón de constante-privada-duplicada que ya existe en los otros 3 validators/handlers de Documentos (`CrearDocumentoValidator`, `EditarDocumentoValidator`, `EditarDocumentoHandler`) — no se factoriza un único lugar para las 4 porque está fuera del alcance de este fix y no lo pide el reporte de Toño.

**D4 — Persistencia como fecha de calendario: mismo patrón que `CrearDocumentoHandler`.**
La fecha final (elegida o sugerida) se normaliza a `DateTime` con `Kind = Utc` y hora `00:00:00` antes de asignarla a `documento.FechaRevisionProxima` — igual que el valor que ya llega de `command.FechaVigencia`/`command.FechaRevisionProxima` en `CrearDocumentoCommand` (un `DateTime?` que el `ValidationFilter`/binding ya trata como fecha de calendario en los otros endpoints).

**D5 — Audit trail: agrega `ValorAnterior`, mismo formato `YYYY-MM-DD` que otras fechas en audit trail.**
`ValorAnterior = documento.FechaRevisionProxima?.ToString("yyyy-MM-dd")` (capturado ANTES de reasignar el campo), `ValorNuevo` en el mismo formato (reemplaza el `"O"` actual, que incluye hora).

**D6 — Frontend: Zod schema propio para el modal, no reutiliza `documentForm.schema.ts`.**
Un schema nuevo (`confirmarRevisionPeriodica.schema.ts`) con `fechaRevisionProxima: z.string().optional()` + `superRefine` que exige el mínimo de hoy+30 días solo cuando el valor no está vacío — igual de permisivo para `REG`/`INF` (campo vacío válido) y estricto para los demás tipos solo si el usuario decide tocarlo (nunca se exige que lo complete, porque siempre hay un valor sugerido precargado).

## Risks / Trade-offs

- [Riesgo] La constante de periodicidad queda duplicada entre backend (C#) y frontend (TS) — ya lo estaba, este cambio no lo empeora, solo le da un nombre propio en el backend en vez de dejarla anónima dentro del handler. → Mitigación: comentario cruzado en ambos archivos señalando al otro, mismo patrón que `DocumentoAsignacionRoles.cs`.
- [Riesgo] Cambiar el formato del audit trail (`"O"` con hora → `"yyyy-MM-dd"`) podría romper algún consumidor que ya parseara ese campo. → Mitigación: se revisa con grep que nada en frontend/backend parsea `ValorNuevo` de `REVISION_PERIODICA_CONFIRMADA` antes de este cambio (es de solo lectura en la UI de audit trail, se muestra como texto).
- [Riesgo] Documentos `EN_REVISION_PERIODICA` ya existentes no se ven afectados retroactivamente — solo la próxima confirmación usa el nuevo contrato. No requiere migración de datos.

## Migration Plan

Sin migración de datos. Cambio de contrato de body (nuevo campo opcional, compatible con clientes que no lo envían — mismo comportamiento que hoy). Rollback: revertir el commit.
