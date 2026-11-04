## Context

Confirmado leyendo el código real (2026-10-07):

- `VencimientoScanner.cs:63-125` (`EscanearDocumentosAsync`) — consulta `db.Documentos.Where(d => d.FechaRevisionProxima != null && d.DeletedAt == null)`, **sin filtro de `Estado`**: un documento en `BORRADOR`, `EN_REVISION_PERIODICA` u `OBSOLETO` con una `FechaRevisionProxima` heredada de antes también entra al escaneo.
- Línea 71: `diasRestantes = (doc.FechaRevisionProxima!.Value.Date - ahora.Date).Days` — `ahora` es el parámetro que le pasa `VencimientoScanService` (presumiblemente `DateTime.UtcNow`), nunca convertido a Lima.
- Línea 77-80: `yaExiste = AnyAsync(n => EntidadTipo==DOCUMENTO && EntidadId==doc.Id && Tipo==VENCIMIENTO)` — sin ninguna referencia a la fecha del ciclo. Una vez que existe una sola fila, el documento nunca vuelve a evaluarse, para siempre.
- No hay ninguna escritura a `DocumentoAuditTrail` en esta función — el vencimiento es 100% invisible fuera de una notificación que, además, solo llega una vez.
- `CambiarEstadoDocumentoHandler.cs:86-89,103-109` — la transición `(PUBLICADO, EN_REVISION_PERIODICA)` no tiene su propio `case` en el switch de acciones; cae en el `_ => "ESTADO_CAMBIADO"` default, con `Motivo = command.Motivo` (lo que el cliente mande, hoy siempre `null` porque la UI no pide motivo para esta transición).
- `ShacDbContext.cs:295-312` — índice único parcial `(EntidadTipo, EntidadId, UsuarioId)` filtrado por `tipo = 'VENCIMIENTO'`, sin ninguna noción de ciclo. Lo comparten los 3 bloques de AC (Incidente/NC/QE) y el bloque de Documentos.
- `CrearIncidenteHandler.cs:88-91` — convención ya existente de actor de sistema: `RealizadoPorId = "system"`, `RealizadoPorNombre = "Sistema"`, `GeneradoPorIA = true`. Se reutiliza tal cual (ver "Qué implementar" punto 1 del doc de Toño).
- `DocumentoAuditTrail.RealizadoPorId`/`RealizadoPorNombre` son `string` (no `Guid`/FK) — admite el sentinel `"system"` sin cambios de tipo.
- Frontend: `RevisionSemaforo.tsx` ya calcula `diasRestantes` con `calendarDaysUntil` + `DOC_REVISION_ALERT_DAYS` (30), con 4 niveles visuales (verde / ámbar ≥8 / rojo 1-7 / rojo-pulsante <1). `DocumentDetailHeader.tsx` ya tiene una sección de banners (OBSOLETO, QE-vinculados, RESTRINGIDO, rechazo, falta-asignación) con el mismo patrón visual — es donde van los nuevos avisos.
- `DocumentHistorial.tsx` filtra `documento.auditTrail` por un `Set` local `ACCIONES_RELEVANTES`; `DocumentAuditTrail.tsx` tiene su propio mapa `ACCION_ICONS` con fallback a un ícono genérico. Ninguno de los dos llama a `useUserNames` sobre `realizadoPorNombre` — se muestra tal cual viene, así que `"Sistema"` se ve bien sin tocar nada ahí.
- MSW (`notificationGeneration.ts:197-233`) replica el mismo bug: `buildVencimientoKey('DOCUMENTO', doc.id)` sin fecha de ciclo, `differenceInCalendarDays(new Date(doc.fechaRevisionProxima), now)` sin filtro de `estado`, sin escritura de audit trail (los documentos del mock no tienen una función de "escaneo" propia más allá de este generador de notificaciones).
- **Nota de orden:** `revision-periodica-fecha-editable` (en curso, pendiente de prueba manual/archivado) también toca `ConfirmarRevisionPeriodicaHandler` y `DocumentRevisionPeriodicaModal.tsx`. Este change no modifica ninguno de esos dos archivos directamente (toca `CambiarEstadoDocumentoHandler`, el escáner, y los componentes de detalle/historial), así que el solapamiento real es bajo, pero se implementa después para evitar cualquier conflicto de merge y para que el `design.md` de aquel quede como referencia estable de las decisiones de "hoy en Lima"/fecha de calendario que este change reutiliza.

## Goals / Non-Goals

**Goals:**
- Un documento `PUBLICADO` vencido deja una entrada visible en su propio audit trail, una sola vez por ciclo.
- Los avisos de preaviso y de vencido conviven en el mismo ciclo (dos notificaciones distintas) y se vuelven a generar en el ciclo siguiente tras confirmar una fecha nueva.
- El detalle del documento muestra el estado de la revisión periódica a cualquier lector, sin depender solo del semáforo visual.
- El escáner deja de alertar documentos que no están `PUBLICADO`.

**Non-Goals:**
- No se cambia el estado automáticamente (opciones A/C descartadas por Toño) — el inicio de `EN_REVISION_PERIODICA` sigue siendo manual.
- No se toca `ConfirmarRevisionPeriodicaHandler`, `ConfirmarRevisionPeriodicaValidator` ni `DocumentRevisionPeriodicaModal.tsx` — eso es `revision-periodica-fecha-editable`.
- No se corrige la misma falta de idempotencia-por-ciclo en los bloques de AC/Incidente/NC/QE (su `PlazoFecha` también puede cambiar — ver `QualityEventsAjustePlazoEndpointTests` — y el escáner tampoco los revalida tras un ajuste). Es un bug de la misma familia, pero fuera del alcance que pidió Toño; la migración de este change está diseñada explícitamente para no alterar su comportamiento actual (ver Decisión D1).
- No se agrega un botón de "Iniciar revisión periódica" dentro del aviso del detalle — ya existe en `DocumentActionPanel`, que se renderiza junto al título, inmediatamente visible junto al aviso.

## Decisions

**D1 — Nueva columna `CicloClave` (string, default `""`), no una tabla nueva ni un tipo de notificación nuevo.**
Se agrega `Notificacion.CicloClave` (string, no nulo, default `""`) y el índice único parcial pasa a `(EntidadTipo, EntidadId, UsuarioId, CicloClave)` filtrado por `tipo = 'VENCIMIENTO'`. Los 3 bloques existentes (AC/Incidente/NC/QE) nunca asignan `CicloClave` explícitamente → siguen generando siempre `""`, exactamente el mismo comportamiento de "una sola notificación para siempre por entidad" que tienen hoy. Para Documentos, se asignan dos valores distintos por ciclo: `$"PREAVISO:{fechaCiclo:yyyy-MM-dd}"` y `$"VENCIDO:{fechaCiclo:yyyy-MM-dd}"` (`fechaCiclo` = la `FechaRevisionProxima` vigente en el momento del escaneo). Esto permite que preaviso y vencido coexistan dentro del mismo ciclo (claves distintas) y que un ciclo nuevo (otra `FechaRevisionProxima`) vuelva a generar ambos avisos.

*Alternativa descartada:* usar `NULL` como valor por defecto para los 3 bloques existentes — en Postgres, dos filas con `NULL` en una columna de un índice único NO violan la restricción (`NULL <> NULL`), así que habría roto silenciosamente la idempotencia de AC/Incidente/NC/QE (podrían volver a notificar sin límite). Un default no nulo (`""`) evita esto por construcción.

**D2 — "Hoy" en Lima, calculado una vez por corrida del escáner, no por documento.**
`VencimientoScanner.ScanAsync` ya recibe `ahora` como parámetro (inyectado por el caller, sea el `BackgroundService` o un test). Se agrega, al inicio de `EscanearDocumentosAsync`, `var hoyLima = TimeZoneInfo.ConvertTimeFromUtc(ahora.ToUniversalTime(), TimeZoneInfo.FindSystemTimeZoneById("America/Lima")).Date;` (mismo patrón que `DocumentoPdfGenerator`/`ConfirmarRevisionPeriodicaHandler` de `revision-periodica-fecha-editable`) y se compara contra ese valor, no contra `ahora.Date`. Los 3 bloques de AC/Incidente/NC/QE no cambian — siguen usando días hábiles vía `AjustePlazoCalculator`, una unidad y un cálculo totalmente distintos (confirmado por el comentario ya existente en el archivo).

**D3 — Filtro por Estado: `PUBLICADO` únicamente, antes de cualquier otro cálculo.**
`.Where(d => d.Estado == DocStatus.PUBLICADO && d.FechaRevisionProxima != null && d.DeletedAt == null)`. Un documento en `EN_REVISION_PERIODICA` ya está siendo atendido (hay alguien trabajándolo); `BORRADOR`/`EN_REVISION`/`EN_APROBACION`/`OBSOLETO` no tienen una "próxima revisión" vigente en el sentido de RN-DOC-006 aunque el campo no esté `null` (dato heredado de un ciclo anterior).

**D4 — Dos ramas mutuamente excluyentes por documento, no una cascada de ifs.**
```
diasRestantes = (FechaRevisionProxima.Date - hoyLima).Days
si diasRestantes <= 0:              rama "vencido"
sino si diasRestantes <= 30:        rama "preaviso"
sino:                                continue (fuera de la ventana, nada que hacer)
```
Cada rama resuelve su propia `CicloClave`, hace su propio `AnyAsync` de idempotencia, y si no existe: genera las notificaciones a los destinatarios (autor + JCA/JCD activos, igual que hoy) y — solo la rama "vencido" — agrega la entrada de audit trail `REVISION_PERIODICA_VENCIDA` una vez (no una por destinatario). El cálculo de destinatarios se reutiliza sin cambios entre ambas ramas.

**D5 — Motivo de `REVISION_PERIODICA_INICIADA`: calculado en el handler, ignorando `command.Motivo` para esta transición.**
`CambiarEstadoDocumentoHandler` gana un `case (DocStatus.PUBLICADO, DocStatus.EN_REVISION_PERIODICA)` que calcula el motivo así (mismo corte de "hoy en Lima" que el escáner, vía un helper compartido — ver D6):
- `FechaRevisionProxima is null` → `"Revisión sin fecha programada"`.
- `diasRestantes <= 30` (incluye vencida) → `"Revisión programada (fecha dd/mm/aaaa)"`.
- `diasRestantes > 30` → `"Revisión anticipada (programada para dd/mm/aaaa)"`.
El `Motivo` del `CambiarEstadoDocumentoCommand` (si el cliente lo manda) se ignora para esta transición específica — nunca tuvo un campo de UI para esto, y el valor calculado es más útil que un texto libre opcional.

**D6 — Helper compartido de "días hasta la revisión" y "nivel de alerta", nuevo en el backend; en el frontend se extrae del `RevisionSemaforo` existente.**
Backend: un método estático simple (p.ej. `DocumentoRevisionPeriodicaHelper.DiasHastaRevision(fechaRevisionProxima, hoyLima)`) usado tanto por el escáner como por `CambiarEstadoDocumentoHandler`, para no calcular "hoy en Lima" de dos formas distintas. Frontend: se extrae de `RevisionSemaforo.tsx` una función pura `getRevisionPeriodicaNivel(diasRestantes: number): 'ok' | 'proximo' | 'vencido'` (umbral único: `DOC_REVISION_ALERT_DAYS` para ok/proximo, `0` para proximo/vencido) a un módulo compartido (`features/documents/utils/revisionPeriodica.ts`); `RevisionSemaforo` la usa para sus primeros dos niveles (verde si `'ok'`) y mantiene su propia subdivisión visual de 4 colores para los niveles `'proximo'`/`'vencido'` (8+/1-7/<1 días) — el nuevo aviso del detalle solo necesita los 2 niveles de `getRevisionPeriodicaNivel`, no la subdivisión de 4.

**D7 — El aviso del detalle es puramente informativo; el botón de acción no se duplica.**
`DocumentActionPanel` ya renderiza "Iniciar revisión periódica" (gateado a JCA/JCD) en el header de la página, junto al título — el mismo lugar donde `DocumentDetailHeader` pone sus banners. El nuevo aviso no incluye un botón propio; both aparecen juntos en la misma vista, suficiente para la usabilidad pedida ("los avisos... incluyen un botón") sin duplicar la lógica de permiso que ya vive en `DocumentActionPanel`.

**D8 — Las 2 acciones nuevas usan el ícono genérico de fallback, sin ícono dedicado.**
Igual que `REVISION_PERIODICA_CONFIRMADA` hoy: no hay un ícono semánticamente mejor disponible en el set ya usado por `ACCION_ICONS`, y el doc de Toño no lo pide explícitamente — solo pide las etiquetas i18n y que ambas acciones entren a `ACCIONES_RELEVANTES`.

## Risks / Trade-offs

- [Riesgo] La migración (nueva columna + índice recreado) requiere que no haya filas duplicadas preexistentes que violen el nuevo índice único al aplicarse — como el default es `""` para todas las filas existentes y el índice viejo ya garantizaba unicidad de `(EntidadTipo, EntidadId, UsuarioId)`, agregar una cuarta columna constante no puede crear un duplicado nuevo. → Verificado por construcción, sin necesidad de script de limpieza.
- [Riesgo] Un documento con un ciclo de revisión muy largo (`FechaRevisionProxima` a varios años) nunca entra en la ventana de 30 días hasta que realmente se acerca — comportamiento idéntico al actual, no es una regresión.
- [Riesgo] El escáner ahora hace una escritura adicional (audit trail) en la rama "vencido" — mismo patrón transaccional que ya usa el resto del handler (un `SaveChangesAsync` con `catch (DbUpdateException)` para la carrera de idempotencia); se agrega la entrada de audit trail al mismo `SaveChangesAsync`, no en una transacción separada, para que ambas escrituras (audit trail + notificaciones) sean atómicas por documento.

## Migration Plan

Migración EF Core (`dotnet ef migrations add AddNotificacionCicloClave`): agrega la columna `ciclo_clave` (`text`, `NOT NULL`, `DEFAULT ''`) a `notificaciones`, recrea el índice único parcial con la columna nueva. Reversible (`dotnet ef database update <migración anterior>`). Sin pérdida de datos — ninguna fila existente cambia de significado.
