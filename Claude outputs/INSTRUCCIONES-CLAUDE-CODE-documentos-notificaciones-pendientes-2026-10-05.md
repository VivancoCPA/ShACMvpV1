# Instrucciones para Claude Code — Documentos: notificar a quien le toca y corregir "pendientes"

Fecha: 2026-10-05
Autor: Cowork (investigación sobre el código real)
Origen: Toño creó PRC-CD-013 con revisor y aprobador asignados y "el documento se queda en el aire". Al armar el mapa de proceso (`SHAC-Mapa-Proceso-Control-Documentario.md`) se confirmó la causa: nadie se entera de que le toca actuar.
Change sugerido: `documentos-notificaciones-pendientes`

Ciclo: `/opsx:sync` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

---

## Hallazgos (confirmados leyendo el código)

### H1. Las transiciones del flujo no notifican a quien le toca
`DocumentoNotificationSender` solo tiene dos métodos, y solo se usan en tres lugares:
- `NotificarAsignacionAsync`: en `CrearDocumentoHandler` y `EditarDocumentoHandler`. Avisa al revisor y al aprobador **al crear el documento**, cuando todavía no pueden hacer nada porque el documento está en BORRADOR.
- `NotificarRechazoAsync`: en `CambiarEstadoDocumentoHandler`, **solo** en un rechazo y **solo** si `NotificarAutor = true`.

**No** se notifica en ninguno de estos momentos:

| Transición | Quién debería enterarse | Dónde vive |
|---|---|---|
| BORRADOR → EN_REVISION | Revisor asignado | `CambiarEstadoDocumentoHandler` |
| EN_REVISION → EN_APROBACION | Aprobador asignado (y autor, informativo) | `CambiarEstadoDocumentoHandler` |
| EN_APROBACION → PUBLICADO | Autor y revisor (informativo) | `FirmarPublicarDocumentoHandler` |
| EN_REVISION → BORRADOR (cancelar revisión, sin motivo) | Autor y revisor | `CambiarEstadoDocumentoHandler` |
| PUBLICADO → EN_REVISION_PERIODICA | Autor | `CambiarEstadoDocumentoHandler` |
| Nueva versión creada | Revisor y aprobador heredados (es una asignación nueva) | `NuevaVersionDocumentoHandler` |

### H2. El contador y el filtro de "pendientes" usan reglas obsoletas
`DocumentoSqlHelpers.BuildPendientesClause` alimenta **tanto** `ContarPendientesHandler` (el badge) **como** el filtro `pendientes=true` de `ListarDocumentosHandler`. Sus reglas son anteriores a la decisión D1 de `documentos-revisor-aprobador-reales` (revisor ∈ JCA, JCD, AUD, DIR; aprobador ∈ JCD, DIR):

- La revisión asignada solo se cuenta si el rol es **SUPERVISOR**, que ya **no** puede ser revisor.
- La aprobación asignada se excluye para **ALTA_DIRECCION** y **AUDITOR_INTERNO**. Alta Dirección es el aprobador típico, y su contador siempre queda en 0.
- `ContarPendientesHandler` además corta antes con `NonPendingRoles = {OPERARIO, AUDITOR_INTERNO, ALTA_DIRECCION}` y devuelve 0 sin consultar.
- JEFE_CALIDAD_SYST cuenta **todos** los EN_REVISION de la empresa, aunque no sea el revisor. JEFE_CONTROL_DOCUMENTARIO no cuenta sus revisiones asignadas.
- El autor **no** ve sus propios BORRADORES pendientes de enviar, que es justo el caso de PRC-CD-013.

### H3. Restaurar no valida permisos en el backend
`RestaurarDocumentoEndpoint` solo exige `RequireAuthorization()`, y `RestaurarDocumentoHandler` no comprueba el rol: cualquier usuario autenticado de la empresa puede restaurar un documento eliminado. El frontend solo muestra el botón a `JEFE_CALIDAD_SYST` y `ALTA_DIRECCION` (`DocumentActionPanel.tsx`, `canRestore`).

---

## Decisiones de Toño

- **D1 — ✅ DECIDIDO (2026-10-05): "pendientes" = solo lo asignado, igual para todos los roles.** Se descarta que el Jefe de Calidad vea además todos los EN_REVISION de la empresa; la supervisión general se hace con los filtros de la lista.
- **D2 — ✅ DECIDIDO (2026-10-05): incluir en este change el permiso de Restaurar.** Roles permitidos: `JEFE_CALIDAD_SYST` y `ALTA_DIRECCION`, que es lo que ya hace el frontend (el código es la fuente de verdad). La Matriz de Responsabilidades M1 se contradice: la tabla marca también a JCD, pero su nota dice "Solo JCA y DIR". Anota esa divergencia en `design.md` como pregunta abierta para Toño y **no** agregues JCD por tu cuenta.

---

## Qué implementar

### 1. Notificaciones (backend)
1. Agrega a `IDocumentoNotificationSender` / `DocumentoNotificationSender` lo necesario para notificar cambios de estado a uno o varios destinatarios. Puede ser un método genérico de transición con un mensaje por caso.
   - Usa los tipos existentes de `NotificacionTipo`: `ASIGNACION` cuando a alguien le toca actuar y `CAMBIO_ESTADO` cuando es informativo. **No** agregues valores al enum. Si crees que hace falta uno nuevo, anótalo en `design.md` y consúltalo.
   - Link al detalle (`/documentos/{id}`), igual que las notificaciones actuales. Revisa que esa ruta exista en el router del frontend: hoy coexisten `/documents` y `/documentos`. Si no existe, corrígelo y anótalo.
2. Dispara una notificación en cada transición de la tabla H1, con mensajes claros en español que digan qué hacer. Por ejemplo: "PRC-CD-013 está listo para tu revisión", "PRC-CD-013 espera tu firma de aprobación", "PRC-CD-013 fue publicado (v1.0)".
3. **Ajuste de la notificación al crear:** al crear o editar en BORRADOR, el revisor y el aprobador hoy reciben "Se te asignó a una revisión/aprobación". Mantén ese aviso, pero cambia el texto para que diga que fueron **designados** y que recibirán otro aviso cuando sea su turno. Así no entran a un documento en el que todavía no pueden hacer nada.
4. Reglas comunes:
   - Nunca notificar al propio actor de la transición.
   - Sin duplicados: una sola notificación por persona por transición.
   - Si un destinatario es nulo (por ejemplo, un documento sin revisor), no se envía nada.
   - Solo destinatarios de la misma empresa.
5. **Best-effort**, igual que el resto del sistema: en `try/catch` y **después** de `SaveChangesAsync`. Una notificación que falla nunca rompe ni revierte la transición.
6. **Rechazo:** hoy depende de `NotificarAutor`. Revisa en el frontend de dónde sale ese flag y si el usuario lo puede desmarcar. Recomendación de Cowork: el autor **siempre** se entera de un rechazo, porque su documento vuelve a BORRADOR y le toca corregir. Si cambiar esto implica tocar el contrato o la UI, anótalo como decisión abierta en `design.md` y no lo cambies sin consultar.
7. **Tiempo real:** con el diseño actual de `notificaciones-real-time`, solo `SEVERIDAD_CRITICA` y `CIERRE` se envían por SignalR; el resto llega por polling cada 60 s. **No** cambies eso aquí. Solo confirma que estas notificaciones aparecen en la campana dentro de ese plazo.

### 2. Pendientes (backend)
1. Reescribe `BuildPendientesClause` para que **no dependa del rol global** (D1). Un documento es pendiente para el actor si se cumple alguna de estas condiciones:
   - `estado = 'BORRADOR' AND autor_id = @ActorId`: tiene que enviarlo a revisión.
   - `estado = 'EN_REVISION' AND revisor_id = @ActorId`
   - `estado = 'EN_APROBACION' AND aprobador_id = @ActorId`
   - `estado = 'EN_REVISION_PERIODICA'` y el actor es JEFE_CALIDAD_SYST o JEFE_CONTROL_DOCUMENTARIO. Es el único caso que depende del rol, porque esa etapa no tiene un asignado individual.
2. Elimina el corte anticipado por `NonPendingRoles` en `ContarPendientesHandler`. El rol ya no decide si alguien puede tener pendientes.
3. Mantén `deleted_at IS NULL` y la **confidencialidad** (`DocumentoSqlHelpers.ConfidencialidadClause`) en el filtro de la lista, y aplícalos también en el contador, para que el número del badge coincida con lo que muestra la lista filtrada. Revisa si el contador hoy aplica confidencialidad y anota lo que encuentres.
4. Actualiza también el handler MSW de pendientes (`documents.handlers.ts`) con la misma regla.

### 3. Restaurar (backend y MSW)
1. `RestaurarDocumentoEndpoint` o su handler: solo `JEFE_CALIDAD_SYST` y `ALTA_DIRECCION` (D2). Cualquier otro rol recibe 403, igual que las demás reglas de rol del módulo.
2. El handler MSW de restaurar debe aplicar la misma regla.

### 4. Frontend
1. Revisa que la campana, la lista de notificaciones y el toast muestren bien estas notificaciones nuevas (tipo, texto y link). Ajusta los textos i18n si se arman en el frontend.
2. Si existe algún "panel de pendientes" o un filtro "Mis pendientes" en Documentos o en el Dashboard, verifica que use el endpoint corregido y que los textos no sugieran que solo ciertos roles tienen pendientes.

---

## Tests
- **Backend, notificaciones:** una por cada transición de H1, con el destinatario correcto. Además: el actor nunca se notifica a sí mismo; un destinatario nulo no envía nada; una falla del sender no revierte la transición.
- **Backend, pendientes:**
  - El autor ve su BORRADOR.
  - Un AUDITOR_INTERNO revisor ve su EN_REVISION.
  - Una ALTA_DIRECCION aprobadora ve su EN_APROBACION.
  - Un JCA que no es el revisor **no** ve un EN_REVISION ajeno.
  - JCA y JCD ven EN_REVISION_PERIODICA.
  - El contador coincide con `GET /api/documents?pendientes=true`.
  - No se cuentan documentos de otra empresa, eliminados ni ocultos por confidencialidad.
- **Backend, restaurar:** JCA y DIR → 200; JCD, OPERARIO y AUTOR → 403; documento de otra empresa → 404.
- **Frontend:** actualiza los tests del handler MSW de pendientes y de restaurar.

## Reglas de siempre
- El código real manda sobre este documento; cualquier divergencia va en `design.md`.
- Suite completa del frontend, tests del backend y `tsc`.
- **Detén el backend y ejecuta `dotnet build` antes de la prueba manual.**
- Prueba manual con MSW apagado, recorriendo PRC-CD-013 (o un documento nuevo) con tres sesiones (autor, revisor y aprobador). En cada paso, el siguiente responsable debe ver la notificación en la campana y el documento en sus pendientes, hasta llegar a PUBLICADO. Después, prueba un rechazo y una cancelación de revisión.
- Al terminar, Toño avisa con "listo". Cowork verifica releyendo el código real y actualiza `SHAC-Mapa-Proceso-Control-Documentario.md`, agregando "quién recibe aviso" en cada paso.
