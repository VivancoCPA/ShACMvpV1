## Context

`POST /api/documents` responde 500 contra Postgres real al enviar `fechaVigencia`/`fechaRevisionProxima` como `"YYYY-MM-DD"`: `System.Text.Json` deserializa eso como `DateTimeKind.Unspecified`, y Npgsql 6+ rechaza escribir un `DateTime` `Unspecified` en una columna `timestamp with time zone`. `ShacDbContext` no tiene hoy ningún `ConfigureConventions` ni converter de fecha (confirmado leyendo `ShacDbContext.cs` completo). Ninguna entidad usa `HasColumnType` para forzar `timestamp without time zone` (confirmado por grep en migraciones): **todas** las columnas `DateTime`/`DateTime?` del modelo son `timestamp with time zone`, así que un converter global no necesita excepciones.

Esto no es exclusivo de Documentos: cualquier campo `DateTime`/`DateTime?` enviado desde un `<input type="date">` sin offset sufre el mismo 500 en cuanto se guarda contra Postgres real, esté o no vacío. Precedente real en el propio repo: `IncidentForm.tsx` ya documenta (comentario en el código) que se encontró y parchó a mano el mismo bug para `Incidente.fechaEvento` (un `datetime-local`), con un comentario explícito: *"un `<input type="datetime-local">` siempre opera en hora LOCAL sin offset... Npgsql rechaza escribirlo... (falla dura, 500)"*. Eso confirma el patrón y da un segundo caso real para los tests (task 5).

## Goals / Non-Goals

**Goals:**
- Que ningún campo de fecha, en ningún módulo, produzca 500 contra Postgres real por `DateTimeKind.Unspecified`.
- Que una fecha de calendario (sin hora significativa) se muestre siempre igual sin importar la zona horaria del navegador.
- Que los timestamps reales (con hora significativa) sigan mostrándose en hora local, sin cambios.

**Non-Goals:**
- Migrar columnas de fecha a `date`/`DateOnly` (descartado por Toño, D1).
- Arreglar solo en el frontend (descartado por Toño, D1: dejaría expuesto cualquier otro formulario).
- Corregir campos de fecha que hoy no tienen ningún formulario real que los alcance (se listan, no se tocan).

## Decisions

**D1 — Normalizar a UTC en el backend con un convertidor global de EF Core (decidido por Toño, 2026-09-29).**
Opciones evaluadas:
- (a) Migrar a `date`/`DateOnly`: más correcto semánticamente, pero exige migración de esquema, cambios en cada acceso Dapper y en el contrato, y solo cubriría Documentos.
- (b) **Elegida — convertidor global en `ShacDbContext.ConfigureConventions`.** Un solo punto de cambio cubre todas las entidades sin tocar cada `OnModelCreating` por separado ni el contrato JSON.
- (c) Arreglar solo en el frontend: dejaría expuesto cualquier formulario de fecha futuro o no revisado.

Implementación: en `ConfigureConventions(ModelConfigurationBuilder builder)`,
```csharp
var utcConverter = new ValueConverter<DateTime, DateTime>(
    v => v.Kind switch {
        DateTimeKind.Utc => v,
        DateTimeKind.Unspecified => DateTime.SpecifyKind(v, DateTimeKind.Utc),
        _ => v.ToUniversalTime(),
    },
    v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
builder.Properties<DateTime>().HaveConversion(typeof(...)); // + el equivalente DateTime?
```
No debe generar migración: el tipo de columna Postgres no cambia (`timestamp with time zone` en ambos casos), solo cambia qué `Kind` ve EF antes de mandarlo a Npgsql. Se verifica con `dotnet ef migrations add --dry-run`-equivalente (revisar el modelo generado) antes de dar la tarea por completa.

**Dapper/SQL crudo:** revisado — las únicas escrituras Dapper/SQL crudo del backend son los generadores de secuencia atómica (`DocumentoCodigoGenerator`, `IncidenteNumeroGenerator`, `LocalZonaNumeroGenerator`, `NoConformidadNumeroGenerator`, `QualityEventNumeroGenerator`), que no reciben ningún `DateTime` de cliente (usan contadores enteros). **No hay ninguna escritura Dapper de fecha de cliente que normalizar.**

**D2 — Categorización "fecha de calendario" vs. "timestamp real".** Con D1, una fecha de calendario como `"2026-09-29"` se persiste como `2026-09-29T00:00:00Z`. En `UTC-5`, `new Date(iso)` + `Intl.DateTimeFormat` sin `timeZone` explícito la muestra como 28. La regla: un campo es **fecha de calendario** si se captura con `<input type="date">` (sin control de hora) — se muestra leyendo el prefijo `YYYY-MM-DD` del ISO, nunca con conversión de zona. Es **timestamp real** si se captura con `<input type="datetime-local">` o lo genera el servidor (`DateTime.UtcNow`) — se sigue mostrando en hora local, sin cambios. Esto se documenta como contrato explícito en la nueva capability `shared-calendar-date-format`.

**D3 — Frontend: enviar `undefined` en vez de `''`.** Mismo patrón que ya usa `useDocumentForm.onSubmit` para `revisorId`/`aprobadorId` (`data.revisorId || undefined`). Se aplica a `fechaVigencia`/`fechaRevisionProxima`.

## Barrido — inventario de campos de fecha (confirmado leyendo el código real)

| Campo | Formulario / vista | Captura | Categoría (D2) | Guardado (antes de D1) | Vacío viaja como `''` | Desfase de visualización | Acción en este change |
|---|---|---|---|---|---|---|---|
| `Documento.fechaVigencia` | `DocumentForm` (crear/editar) | `type="date"`, opcional | Calendario | **500 confirmado** (síntoma reportado) | **Sí** | Sí — `DocumentDetailHeader`, `DocumentRevisionPeriodicaModal` | Corregido: D1 (backend) + D3 (frontend) + helper en ambos componentes |
| `Documento.fechaRevisionProxima` | `DocumentForm` | `type="date"`, opcional | Calendario | **500 confirmado** | **Sí** | Sí — ídem + `RevisionSemaforo` (cálculo de días) + `DocumentListRow` (vía `RevisionSemaforo`) | Corregido: D1 + D3 + helper en los 3 componentes |
| `Documento.fechaEmision` | Sin formulario que lo capture hoy (se ve, no se edita) | — | Calendario | N/A (no se envía desde UI) | N/A | Sí — `DocumentDetailHeader` usa el mismo `formatDate` local | Corregido junto con los dos anteriores (mismo `formatDate` local del componente) |
| `NoConformidad.fechaDeteccion` | `NCForm` (crear) | `type="date"`, **requerido** | **Confirmado con `POST /api/nonconformities` real, date-only**: `201`, sin 500 | No aplica (requerido, `.min(1)`) | Sí — `NCList` columna `fechaDeteccion` vía `formatShortDate` (zona horaria) | Corregido: D1 (backend, confirmado) + nuevo helper en `NCList` |
| `NoConformidad.fechaCierre` | `NCForm` (crear) | `type="date"`, requerido | **Confirmado**: mismo `POST` real, `fechaCierre` date-only, `201` sin 500 | No aplica | Sí — vía `DeadlineBadge` | Corregido: D1 + `DeadlineBadge` (helper compartido, cubre también Incidentes y QE) |
| `AccionCorrectivaIncidente.plazoFecha` | `IncidentACSection` | `type="date"`, requerido | No confirmado directamente (mismo mecanismo que `AccionCorrectivaNC`, sí confirmado) | No aplica | Sí — vía `DeadlineBadge` | Corregido por D1 + fix de `DeadlineBadge` (componente compartido, un solo cambio cubre los 3 dominios) |
| `AccionCorrectivaNC.plazoFecha` | NC AC form (`createACSchema`) | `type="date"`, requerido | **Confirmado con `POST /api/nonconformities/:id/acciones-correctivas` real, `plazoFecha` date-only**: `201`, sin 500 | No aplica | Sí — vía `DeadlineBadge` | Corregido: D1 (confirmado) + `DeadlineBadge` |
| `AccionCorrectivaQE.plazoFecha` | `QEACSection` | `type="date"`, requerido | No confirmado directamente (mismo mecanismo que `AccionCorrectivaNC`, sí confirmado) | No aplica | Sí — vía `DeadlineBadge` | Corregido por D1 + `DeadlineBadge` |
| `SolicitudAjustePlazoAC.fechaSolicitada` | `QEACSection` (modal de ajuste) | `type="date"`, requerido | Calendario | A confirmar | No aplica | Indirecto: `contarDiasHabiles(new Date(ac.plazoFecha), new Date(fechaSolicitada))` usa `new Date` sobre ambas fechas de calendario — mismo desfase potencial en el conteo de días hábiles | **No corregido en este change** (no reportado, requiere tocar `shared-business-days`; se lista como hallazgo para decidir aparte — ver Riesgos) |
| `Incidente.fechaEvento` / `fechaReporte` | `IncidentForm` | `type="datetime-local"`, requerido | Timestamp real | **Ya arreglado client-side** (`toDatetimeLocalValue`/`fromDatetimeLocalValue`, hallazgo previo documentado en el propio código) | No aplica | No — ya se muestra en hora local correctamente (es el comportamiento correcto para un timestamp real) | Sin cambios — D1 es no-op aquí (el valor ya llega con `Kind=Utc`) |
| `QualityEvent.fechaHoraEvento` | `QualityEventForm` | `type="datetime-local"`, **requerido** (`qualityEventCreate.schema.ts`: `.min(1)`) | Timestamp real | Sin problema — Zod bloquea el submit antes de que se envíe vacío | **Falso positivo corregido**: `onSubmitCreate` tiene un fallback `: ''` en el payload, pero es código muerto inalcanzable (Zod ya exige `.min(1)`); en edición (`onSubmitEdit`) el ternario cae al valor original (`qe.fechaHoraEvento`) cuando el campo queda vacío, nunca envía `''` | No aplica | **Sin cambios** — no hay bug real; se revisó el código de ambos handlers línea por línea para confirmarlo (ver tasks.md 2.2) |
| `QualityEvent.reporteExternoRef.fechaRecepcion` | `QualityEventForm` (origen `O4_REPORTE_EXTERNO`) | `type="date"`, requerido cuando el campo aparece | **Confirmado con `POST /api/quality-events` real, `origen: O4_REPORTE_EXTERNO`, `fechaRecepcion` date-only**: `201`, sin 500 | Posible si se cambia de origen tras haberlo llenado | No confirmado — no se encontró un lugar del detalle/export que lo muestre distinto de la creación | Guardado confirmado; sin desfase de visualización conocido que arreglar |
| `NoConformidad.accionInmediataFecha` | Existe en `updateNC.schema.ts`, sin componente de formulario real que lo use hoy | — | Calendario | N/A — no alcanzable desde la UI actual | N/A | N/A | **No corregido** (código muerto desde la UI; nada que probar) |
| `NoConformidad.notificacionComercioExterior.fecha` | Tipo existe (`NCNotificacionComercioExterior`), sin formulario UI encontrado que lo capture | — | Calendario | N/A | N/A | N/A | **No corregido** (mismo motivo) |
| `creadoEn`/`actualizadoEn`/audit trail (todas las entidades) | — | Generado por el servidor | Timestamp real | Sin problema (siempre `DateTime.UtcNow`, `Kind=Utc`) | No aplica | No — correcto mostrar en hora local | Sin cambios |

## Riesgos / Trade-offs

- El converter global cambia el comportamiento de **toda** columna de fecha del sistema. Mitigado por: (a) no hay columnas `timestamp without time zone` que pudieran interpretarse distinto: confirmado por grep en migraciones; (b) los tests de integración existentes ya usan ISO con `Z` (`Kind=Utc`), así que el converter es no-op para ellos — no deberían cambiar de resultado.
- `SolicitudAjustePlazoAC` / `contarDiasHabiles` (conteo de días hábiles) queda con el mismo tipo de desfase potencial sin corregir en este change — no fue el bug reportado y tocar `shared-business-days` amplía el alcance; se dejó como hallazgo explícito para que Toño decida si abre un change aparte.
- Los campos "no alcanzables desde la UI" (`accionInmediataFecha`, `notificacionComercioExterior.fecha`) quedan con el bug latente si algún día se les agrega un formulario; quien lo haga debe usar el helper de `shared-calendar-date-format` o el patrón `fromDatetimeLocalValue`/`toDatetimeLocalValue` de Incidentes, según corresponda.
- La prueba manual (tasks.md 6) confirmó contra Postgres real (backend levantado, empresa/usuarios de prueba propios vía API) las filas de NC, `AccionCorrectivaNC` y `QualityEvent.reporteExternoRef` que antes decían "a confirmar" — todas dieron `201` sin 500. `AccionCorrectivaIncidente`/`AccionCorrectivaQE.plazoFecha` no se probaron por separado, pero comparten el mismo patrón de endpoint/validador/entidad `DateTime` que `AccionCorrectivaNC` — no hay razón estructural para que se comporten distinto.

## Hallazgo adicional (encontrado en la prueba manual, no bloqueante): el Kind no se normaliza en la respuesta de creación

El converter global normaliza `Kind` en cada escritura/lectura que pasa por Npgsql — pero un handler `Crear*` que retorna la misma entidad en memoria que acaba de construir (sin volver a leerla de la base, p.ej. `CrearNoConformidadHandler.cs:104: return nc;`) nunca pasa esa propiedad por la conversión de lectura. Confirmado en vivo: `POST /api/nonconformities` con `fechaDeteccion: "2026-09-30"` devuelve `"fechaDeteccion": "2026-09-30T00:00:00"` (sin `Z`, `Kind=Unspecified` tal como llegó del request), mientras que el mismo campo leído de una fila ya existente en la base (la lista `NcsSimilares` de esa misma respuesta, que sí viene de una consulta EF real) muestra `"2026-09-30T00:00:00Z"`. Mismo patrón confirmado en `AccionCorrectivaNC` y `QualityEvent.reporteExternoRef`.

**Por qué no es un problema práctico hoy:** ningún flujo del frontend revisado (Documentos, NC, AC, QE) renderiza los campos de fecha de la respuesta de creación directamente — todos navegan a otra vista que vuelve a pedir los datos con `GET` (que sí pasa por la conversión de lectura). **Riesgo latente:** si algún código futuro mostrara una fecha directamente desde la respuesta de un `POST`/`PUT` sin volver a consultarla, heredaría el `Kind` original del request, sin el "Z". No se corrige aquí (cambiaría el patrón de todos los handlers `Crear*`/`Editar*` del backend, fuera de alcance); queda documentado para quien lo encuentre.
