# Instrucciones para Claude Code — Documentos: el rechazo y su motivo deben quedar registrados y visibles

Fecha: 2026-10-06
Autor: Cowork (investigación sobre el código real)
Origen: Toño. Cuando un documento se rechaza en Revisión o en Aprobación, el motivo no se ve en ninguna parte, y el log no registra una acción "rechazado": solo muestra que el documento volvió a Borrador.
Change sugerido: `documentos-rechazo-visible`

Ciclo: `/opsx:sync` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

---

## Diagnóstico (confirmado leyendo el código)

1. **El motivo sí viaja y sí se guarda, pero en el lugar equivocado.**
   - `DocumentRejectModal` envía `PATCH /api/documents/{id}/status` con `{ estado: 'BORRADOR', motivo }`. El schema exige entre 20 y 500 caracteres y `CambiarEstadoDocumentoValidator` hace la misma validación.
   - `CambiarEstadoDocumentoHandler` registra **una sola** entrada `Accion = "ESTADO_CAMBIADO"` y guarda el motivo en **`ValorAnterior`**. Ese campo está pensado para el valor anterior de un campo editado (`CAMPO_EDITADO`), no para un motivo.
2. **No existe una acción de rechazo.** En el audit trail, un rechazo del revisor (EN_REVISION → BORRADOR con motivo), un rechazo del aprobador (EN_APROBACION → BORRADOR) y una cancelación de revisión del Jefe de Calidad (EN_REVISION → BORRADOR sin motivo) aparecen igual: "Cambio de estado: EN_REVISION → BORRADOR". El handler sí distingue los casos internamente (`esRechazo`), pero eso no queda registrado.
3. **El frontend nunca muestra el motivo.** `DocumentAuditTrail.describeEntry` solo usa `valorAnterior` cuando hay `campoModificado`. `DocumentHistorial` tampoco lo muestra. Para el `ESTADO_CAMBIADO` de un rechazo, el motivo existe en los datos pero nunca se pinta.
4. **Consecuencia:** el autor recibe la notificación "fue rechazado y vuelve a BORRADOR", entra al documento y no tiene forma de saber **qué** corregir. Para ISO 9001 §7.5 también queda incompleta la trazabilidad de quién rechazó y por qué.

## Decisión de Toño

**D1 — ✅ DECIDIDO (2026-10-06): acciones propias en el audit trail, columna `motivo` y migración de los rechazos existentes.** Se descartó leer el motivo de `valorAnterior` solo en el frontend, porque el log seguiría siendo semánticamente incorrecto.

---

## Qué implementar

### Backend
1. **Migración EF:** agrega a `documento_audit_trail` una columna `motivo` (texto nullable, hasta 500 caracteres) y la propiedad `Motivo` en `DocumentoAuditTrail`. Sigue siendo una tabla append-only: no agregues ninguna operación de edición.
2. **Nuevas acciones** (texto libre, igual que las actuales). Reemplazan a `ESTADO_CAMBIADO` en estas tres transiciones, siempre como **una sola** entrada por transición:
   - `RECHAZADO_EN_REVISION`: EN_REVISION → BORRADOR **con** motivo (revisor). `Motivo` = el texto.
   - `RECHAZADO_EN_APROBACION`: EN_APROBACION → BORRADOR (aprobador). `Motivo` = el texto.
   - `REVISION_CANCELADA`: EN_REVISION → BORRADOR **sin** motivo (Jefe de Calidad). Si en el futuro se agrega un motivo opcional, irá en `Motivo`.

   En las tres entradas se siguen llenando `EstadoAnterior` y `EstadoNuevo`, para que cualquier lógica que reconstruya estados siga funcionando. **No** uses más `ValorAnterior` para el motivo.
3. **Migración de datos** (en la misma migración o en un script idempotente documentado). Para cada `ESTADO_CAMBIADO` histórico con `EstadoNuevo = 'BORRADOR'`:
   - si viene de EN_REVISION y tiene `ValorAnterior` no nulo → `RECHAZADO_EN_REVISION`, mover `ValorAnterior` a `Motivo` y dejar `ValorAnterior` en null;
   - si viene de EN_APROBACION → `RECHAZADO_EN_APROBACION`, con el mismo traslado del motivo;
   - si viene de EN_REVISION y no tiene motivo → `REVISION_CANCELADA`.

   Ningún otro tipo de entrada se toca. Informa en `design.md` cuántas filas migró en tu base local.
4. **Respuesta del detalle:** `GET /api/documents/:id` ya carga el audit trail desde `fix-detalle-documento-historial-audit`. Agrega `motivo` a la proyección Dapper de ese audit trail y al tipo TS `AuditTrailEntry`.
5. **Notificación de rechazo:** si cabe en el modelo `Notificacion`, incluye un extracto del motivo en el mensaje que recibe el autor (por ejemplo, los primeros 120 caracteres) y deja el texto completo en el detalle. Revisa el largo máximo de `Mensaje` antes de truncar.
6. **Busca los consumidores de `ESTADO_CAMBIADO`** en el backend (dashboard, KPIs, pendientes, generadores de PDF, tests) y confirma que ninguno deja de contar rechazos o cancelaciones por el cambio de nombre de la acción. Lista lo que encuentres en `design.md`.

### Frontend
1. **`DocumentAuditTrail`:**
   - etiquetas i18n para `RECHAZADO_EN_REVISION` ("Rechazado en revisión"), `RECHAZADO_EN_APROBACION` ("Rechazado en aprobación") y `REVISION_CANCELADA` ("Revisión cancelada");
   - un ícono distinguible para los rechazos;
   - mostrar el **motivo** debajo de la entrada cuando exista.
2. **`DocumentHistorial`:** agrega las tres acciones a `ACCIONES_RELEVANTES` y muestra el motivo en los rechazos.
3. **Aviso en el detalle:** si el documento está en BORRADOR y la última entrada de cambio de estado es un rechazo, muestra arriba del detalle un aviso visible con este contenido: "Rechazado en revisión/aprobación por {nombre} el {fecha}. Motivo: {motivo}".
   - El aviso desaparece cuando el documento se vuelve a enviar a revisión.
   - Visible para el autor y para el Jefe de Calidad / Jefe de Control Documentario. El resto de los roles con acceso de lectura también lo ve, porque es información del propio documento.
4. **MSW:** el handler de cambio de estado debe registrar las nuevas acciones y el campo `motivo` igual que el backend. Actualiza las fixtures que tengan rechazos.
5. **Busca los consumidores de `'ESTADO_CAMBIADO'`** en el frontend (`DocumentVersionesTab.getPublisher`, dashboard y otros) y ajústalos si corresponde.

## Tests
- **Backend:**
  - rechazo en revisión → una entrada `RECHAZADO_EN_REVISION` con `Motivo`, sin `ValorAnterior`;
  - rechazo en aprobación → `RECHAZADO_EN_APROBACION`;
  - cancelación → `REVISION_CANCELADA`;
  - el detalle devuelve `motivo`;
  - la migración de datos convierte correctamente un `ESTADO_CAMBIADO` histórico con motivo.
- **Frontend:**
  - el audit trail y el historial muestran la etiqueta y el motivo;
  - el aviso aparece en BORRADOR después de un rechazo y desaparece después de reenviar;
  - una cancelación no muestra el aviso de rechazo.

## Reglas de siempre
- El código real manda sobre este doc; cualquier divergencia va en `design.md`.
- Un cambio de contrato (`motivo` en `AuditTrailEntry` y las nuevas acciones) se aplica a la vez en backend, MSW, tipos TS y tests.
- Corre la suite completa del frontend, los tests del backend y `tsc`.
- **Detén el backend, aplica la migración (`dotnet ef database update`) y ejecuta `dotnet build` antes de la prueba manual.**
- Prueba manual con MSW apagado:
  1. El revisor rechaza con motivo → el autor recibe la notificación, entra y ve el aviso con el motivo, y el audit trail muestra "Rechazado en revisión" con el motivo.
  2. El autor corrige y reenvía → el aviso desaparece.
  3. El aprobador rechaza → mismo resultado, con "Rechazado en aprobación".
  4. El Jefe de Calidad cancela una revisión → aparece "Revisión cancelada", sin aviso de rechazo.
- Al terminar, Toño avisa con "listo". Cowork verifica releyendo el código real y actualiza el mapa de proceso.
