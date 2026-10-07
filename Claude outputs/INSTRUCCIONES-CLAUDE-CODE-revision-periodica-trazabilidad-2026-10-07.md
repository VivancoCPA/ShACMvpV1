# Instrucciones para Claude Code — Revisión periódica: trazabilidad del vencimiento, alertas por ciclo y aviso en el detalle

Fecha: 2026-10-07
Autor: Cowork (investigación sobre el código real)
Origen: Toño preguntó qué pasa cuando llega la fecha de revisión periódica. Hoy nada cambia ni queda registrado en el log del documento.
Change sugerido: `revision-periodica-trazabilidad`

Ciclo: `/opsx:sync` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

Si `revision-periodica-fecha-editable` todavía no está archivado, implementa este change **después**: los dos tocan `ConfirmarRevisionPeriodicaHandler` y el modal.

---

## Estado actual (confirmado leyendo el código)

`Features/Notifications/Shared/VencimientoScanner.cs` → `EscanearDocumentosAsync` (RN-DOC-006):
- Solo **notifica**: crea una `Notificacion` tipo `VENCIMIENTO` para el autor y todos los JCD/JCA activos de la empresa cuando faltan ≤ 30 días. **No cambia el estado ni escribe en el audit trail del documento.**
- **Idempotencia mal definida:** comprueba si existe **alguna** notificación `VENCIMIENTO` para ese documento, sin importar de qué ciclo sea. Por eso, después de confirmar la vigencia y fijar una fecha nueva, **nunca vuelve a alertar** en los ciclos siguientes.
- **No filtra por estado:** alerta también por documentos en BORRADOR, EN_REVISION, EN_APROBACION u OBSOLETO, aunque solo tiene sentido para un documento vigente.
- Calcula los días con `ahora.Date`, es decir, el día en UTC y no en Lima.
- Cuando la fecha **ya pasó**, no hace nada distinto: el "Vencido" solo existe en el semáforo del frontend y no queda evidencia.

`CambiarEstadoDocumentoHandler`, transición PUBLICADO → EN_REVISION_PERIODICA (manual, JCA/JCD): registra `ESTADO_CAMBIADO` **sin motivo**.

El detalle del documento no muestra ningún aviso de revisión pendiente o vencida. Solo aparece el semáforo en el encabezado y en la lista.

## Decisión de Toño

**D1 — ✅ DECIDIDO (2026-10-07): opción B. El inicio de la revisión periódica sigue siendo manual (PRD RN-DOC-006 sin cambios), pero el sistema deja constancia en el log cuando la fecha vence y avisa en el detalle del documento.** Se descartaron el cambio automático de estado (A) y el híbrido con cambio automático pasados X días (C).

---

## Qué implementar

### 1. Actor "Sistema" en el audit trail
Define en un solo lugar un actor de sistema para las entradas automáticas, por ejemplo `RealizadoPorId = "SISTEMA"` y `RealizadoPorNombre = "Sistema"`. Revisa si ya existe una convención en otro dominio (QE, NC, Incidentes) y reutilízala. El frontend debe mostrarlo bien, sin intentar resolverlo como usuario con `useUserNames`.

### 2. Escáner (`EscanearDocumentosAsync`)
1. **Solo documentos PUBLICADO**, no eliminados, con `FechaRevisionProxima` no nula. Un documento en EN_REVISION_PERIODICA ya está siendo atendido, así que no se alerta.
2. **"Hoy" en zona `America/Lima`**, como fecha de calendario, coherente con `fix-fechas-utc`.
3. **Aviso previo (≤ 30 días antes y > 0):** se mantiene la notificación `VENCIMIENTO` al autor y a JCD/JCA, con el texto "El documento {código} vence su revisión periódica el {dd/mm/aaaa}".
4. **Vencimiento (la fecha llegó o ya pasó):**
   - Escribe en el audit trail del documento **una** entrada `REVISION_PERIODICA_VENCIDA`, con el actor Sistema y la fecha de revisión que venció (en `ValorNuevo`, o en la columna `motivo` si `documentos-rechazo-visible` ya la agregó: "Fecha de revisión periódica alcanzada: dd/mm/aaaa").
   - Envía una segunda notificación a los mismos destinatarios: "La revisión periódica de {código} está vencida desde {fecha}. Debe iniciarse la revisión."
   - El estado **no cambia**: sigue PUBLICADO.
5. **Idempotencia por ciclo:** la clave de "ya avisado" debe incluir la **`FechaRevisionProxima` vigente**, además del documento y del tipo de aviso (previo o vencido). Así:
   - cada ciclo genera como máximo un aviso previo y un aviso de vencido;
   - al confirmar la vigencia o publicar una versión nueva con otra fecha, el ciclo siguiente vuelve a alertar.

   Revisa el índice único parcial actual (`EntidadTipo, EntidadId, UsuarioId`, design.md D9 de be-notificaciones): con la regla nueva bloquearía los avisos de ciclos siguientes. Ajústalo con una migración que agregue la fecha del ciclo, o usa otra estrategia equivalente, y documenta la elección en `design.md`. **No** borres notificaciones históricas.
6. La entrada `REVISION_PERIODICA_VENCIDA` también se escribe una sola vez por ciclo (documento + fecha).

### 3. Inicio manual con motivo (`PUBLICADO → EN_REVISION_PERIODICA`)
Registra la transición con una acción propia, `REVISION_PERIODICA_INICIADA` (con `EstadoAnterior` y `EstadoNuevo`), en lugar de un `ESTADO_CAMBIADO` genérico. El **motivo** se calcula automáticamente:
- "Revisión programada (fecha dd/mm/aaaa)" si faltan ≤ 30 días o la fecha ya pasó;
- "Revisión anticipada (programada para dd/mm/aaaa)" si faltan más de 30 días;
- "Revisión sin fecha programada" si el documento no tiene `FechaRevisionProxima` (REG/INF).

Revisa los consumidores de `ESTADO_CAMBIADO` igual que en `documentos-rechazo-visible`, para que nada deje de contar esta transición.

### 4. Aviso en el detalle del documento (frontend)
Muestra un aviso visible en la parte superior del detalle, para cualquier usuario que pueda leer el documento:

| Situación | Aviso |
|---|---|
| PUBLICADO, revisión en ≤ 30 días | Ámbar: "Pendiente de revisión periódica — vence el {fecha} (en N días)." |
| PUBLICADO, fecha alcanzada o pasada | Rojo: "Revisión periódica vencida desde el {fecha} (hace N días). Este documento sigue vigente, pero debe revisarse." |
| EN_REVISION_PERIODICA | Informativo: "En revisión periódica desde el {fecha de inicio}, iniciada por {nombre}." Toma la fecha y el nombre de la entrada `REVISION_PERIODICA_INICIADA`. |

- Para JCA/JCD, los avisos de PUBLICADO incluyen un botón **"Iniciar revisión periódica"**, la misma acción que ya existe.
- Usa los helpers de fecha de calendario (`formatCalendarDate`, `calendarDaysUntil`) y no `new Date()` con zona local. Los umbrales deben coincidir con el semáforo (`RevisionSemaforo`, `DOC_REVISION_ALERT_DAYS`), así que extrae la lógica de días a un helper compartido para no duplicarla.
- **Audit trail e historial:** agrega etiquetas i18n para `REVISION_PERIODICA_VENCIDA` ("Revisión periódica vencida") y `REVISION_PERIODICA_INICIADA` ("Revisión periódica iniciada"), muestra el motivo y agrega ambas acciones a `ACCIONES_RELEVANTES` de `DocumentHistorial`.

### 5. MSW
Si el mock simula el escaneo o las notificaciones de vencimiento, replica las reglas. Como mínimo, las fixtures deben incluir un documento PUBLICADO vencido y uno en EN_REVISION_PERIODICA, para que el aviso se pueda ver en modo mock.

---

## Tests
- **Escáner (backend):**
  - un PUBLICADO a 20 días genera un aviso previo (una sola vez);
  - un PUBLICADO vencido genera una entrada `REVISION_PERIODICA_VENCIDA` con el actor Sistema y la notificación de vencido, ambas una sola vez;
  - después de confirmar la vigencia con una fecha nueva, el ciclo siguiente vuelve a avisar;
  - BORRADOR, OBSOLETO y EN_REVISION_PERIODICA no generan avisos;
  - el corte de día usa la hora de Lima.
- **Transición manual:** `REVISION_PERIODICA_INICIADA` con el motivo correcto en los tres casos (programada, anticipada, sin fecha).
- **Frontend:**
  - el aviso del detalle se muestra en cada situación de la tabla;
  - el botón de inicio solo aparece para JCA/JCD;
  - el audit trail muestra las acciones nuevas con su motivo.

## Reglas de siempre
- El código real manda sobre este documento; cualquier divergencia va en `design.md`.
- Corre la suite completa del frontend, los tests del backend y `tsc`.
- Si hay migración: **detén el backend, ejecuta `dotnet ef database update` y `dotnet build`** antes de la prueba manual.
- Prueba manual con MSW apagado. Para no esperar al timer, cambia en la base la `fecha_revision_proxima` de un documento de prueba o ejecuta el escáner a demanda, si existe una forma de hacerlo en Development:
  1. con la fecha a 20 días → llega el aviso y el detalle muestra el aviso ámbar;
  2. con la fecha en el pasado → aparece la entrada en el log, la notificación y el aviso rojo en el detalle;
  3. un JCD inicia la revisión → el log muestra "Revisión periódica iniciada — programada" y el detalle muestra el aviso informativo;
  4. se confirma la vigencia con una fecha nueva y luego se acerca esa fecha → vuelve a avisar.
- Al terminar, Toño avisa con "listo". Cowork verifica releyendo el código real y actualiza `SHAC-Mapa-Proceso-Control-Documentario.md` (sección de revisión periódica).
