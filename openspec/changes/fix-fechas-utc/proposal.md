## Why

Contra el backend real (MSW apagado), `POST /api/documents` responde **500** al guardar un documento con Fecha de Vigencia o Próxima Revisión: `System.ArgumentException: Cannot write DateTime with Kind=Unspecified to PostgreSQL type 'timestamp with time zone'`. La causa es genérica, no exclusiva de Documentos: cualquier `<input type="date">` del sistema envía `"YYYY-MM-DD"` sin offset, System.Text.Json lo deserializa como `DateTimeKind.Unspecified`, y Npgsql 6+ rechaza escribir eso en una columna `timestamp with time zone` — todas las columnas `DateTime`/`DateTime?` del modelo lo son. El mismo patrón ya se había encontrado y parcheado a mano para `Incidente.fechaEvento` (comentario en `IncidentForm.tsx`); sin un fix central, cada formulario de fecha puede fallar igual contra Postgres real sin que ningún test lo detecte (los tests de integración envían ISO completo con `Z`).

## What Changes

- **Backend:** convertidor global de EF Core en `ShacDbContext.ConfigureConventions` para todo `DateTime`/`DateTime?`: `Unspecified` → `SpecifyKind(Utc)` (sin desplazar la hora), `Local` → `ToUniversalTime()`, `Utc` sin cambios; simétrico en lectura. No genera migración (mismo tipo de columna). No hay escrituras Dapper/SQL crudo con `DateTime` de cliente a normalizar aparte (confirmado: las únicas escrituras Dapper son secuencias atómicas con `DateTime.UtcNow` interno).
- **Frontend — Documentos:** `useDocumentForm.onSubmit` deja de enviar `fechaVigencia`/`fechaRevisionProxima` como `''`; se omiten (`undefined`) si el campo quedó vacío, igual que ya se hace con `revisorId`/`aprobadorId`.
- **Frontend — visualización sin desfase:** nuevo helper de "fecha sin zona" en `utils/date.utils.ts` para fechas de calendario (sin hora significativa: `fechaVigencia`, `fechaRevisionProxima`, `fechaEmision`, `plazoFecha`/`fechaCierre` de ACs, `fechaDeteccion` de NC). Se aplica en `DocumentDetailHeader`, `DocumentRevisionPeriodicaModal`, `RevisionSemaforo` (cálculo de días restantes) y en `DeadlineBadge` (compartido por ACs de Incidentes/NC/QE) y `NCList`. Los timestamps reales con hora significativa (`creadoEn`/`actualizadoEn`/auditTrail, `fechaEvento`/`fechaReporte` de Incidente/NC/QE, `fechaHoraEvento`/`fechaHoraReporte`) no se tocan: siguen convirtiéndose a hora local.
- **Barrido:** inventario en `design.md` de todo formulario/vista con fechas de calendario, con su estado real (guardado, envío de `''`, desfase de visualización) confirmado leyendo el código. Se corrige en este change lo confirmado y alcanzable desde la UI actual; lo no alcanzable (código sin formulario que lo use hoy) queda listado, no corregido.

## Capabilities

### New Capabilities
- `shared-calendar-date-format`: helper de formateo/cálculo para fechas de calendario sin conversión de zona horaria, y su contrato de uso (qué campos lo usan, cuáles quedan excluidos).

### Modified Capabilities
- `be-documentos-api`: `POST`/`PUT /api/documents` aceptan fechas de calendario (`"YYYY-MM-DD"` sin offset) sin fallar; persisten como UTC.
- `document-form`: `fechaVigencia`/`fechaRevisionProxima` vacíos no viajan como `''`.
- `deadline-badge`: el cálculo de días restantes y la fecha mostrada usan la fecha de calendario sin desfase de zona horaria.
- `nc-list-view`: `fechaDeteccion` se muestra sin desfase de zona horaria.

## Impact

- Backend: `ShacDbContext.cs` (un solo punto de cambio, cubre todas las entidades sin excepción — no hay columnas `timestamp without time zone`); tests de integración nuevos en Documentos y en un segundo módulo del barrido (NC).
- Frontend: `useDocumentForm.ts`, `utils/date.utils.ts`, `DocumentDetailHeader.tsx`, `DocumentRevisionPeriodicaModal.tsx`, `RevisionSemaforo.tsx`, `DeadlineBadge.tsx`, `NCList.tsx`.
- Sin cambios de esquema de base de datos ni de contrato de API (mismo shape JSON; cambia solo qué valores acepta sin 500).
- Desbloquea la tarea 6.3 de `documentos-revisor-aprobador-reales` (prueba manual con MSW apagado), que estaba parada por este bug.
