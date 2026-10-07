## 1. Backend — entidad y migración EF

- [x] 1.1 Agregar `public string? Motivo { get; set; }` a `ShcMvpEndPoint.Domain.Entities.DocumentoAuditTrail`, documentando en el comentario de cabecera las 3 acciones nuevas junto a las existentes.
- [x] 1.2 Crear la migración EF (`dotnet ef migrations add AddMotivoDocumentoAuditTrail`): columna `motivo` (`text`, nullable) en `documento_audit_trail`.
- [x] 1.3 En el mismo `Up()`, agregar el SQL de reclasificación de datos históricos (D3 de `design.md`): `ESTADO_CAMBIADO` + `EstadoNuevo='BORRADOR'` + `EstadoAnterior='EN_REVISION'` + `ValorAnterior IS NOT NULL` → `RECHAZADO_EN_REVISION` (mover `ValorAnterior` a `Motivo`, limpiar `ValorAnterior`); `EstadoAnterior='EN_APROBACION'` → `RECHAZADO_EN_APROBACION` (mismo traslado); `EstadoAnterior='EN_REVISION'` + `ValorAnterior IS NULL` → `REVISION_CANCELADA`.
- [x] 1.4 Escribir el `Down()` correspondiente (revertir las 3 acciones a `ESTADO_CAMBIADO` moviendo `Motivo` de regreso a `ValorAnterior`, luego eliminar la columna).
- [x] 1.5 Ejecutar la migración en el entorno local (`dotnet ef database update` con el backend detenido) y registrar en `design.md` cuántas filas migró cada caso.

## 2. Backend — handler y notificación de rechazo

- [x] 2.1 En `CambiarEstadoDocumentoHandler.HandleAsync`, reemplazar el único `db.DocumentoAuditTrail.Add(...)` por lógica que elija `Accion` según el caso (`RECHAZADO_EN_REVISION` / `RECHAZADO_EN_APROBACION` / `REVISION_CANCELADA` / `ESTADO_CAMBIADO` para el resto) y escriba `command.Motivo` en `Motivo`, nunca en `ValorAnterior`. Dejar `ValorAnterior` en `null` para las tres transiciones a `BORRADOR`.
- [x] 2.2 Agregar `string? Motivo` a `DocumentoRechazoNotificacion` (`IDocumentoNotificationSender.cs`) y pasar `command.Motivo` desde el call site en `CambiarEstadoDocumentoHandler`.
- [x] 2.3 En `DocumentoNotificationSender.NotificarRechazoAsync`, incluir un extracto del motivo (primeros 120 caracteres, con "…" si se truncó) en `Mensaje`, manteniendo el texto "...fue rechazado y vuelve a BORRADOR" como prefijo.
- [x] 2.4 Agregar `Motivo` a `DocumentoAuditTrailLoader.SelectColumns` (`motivo AS "Motivo"`) para que `GET /api/documents/:id` lo devuelva.

## 3. Backend — tests

- [x] 3.1 Test: rechazo en `EN_REVISION` con motivo → una entrada `RECHAZADO_EN_REVISION` con `Motivo` igual al texto enviado y `ValorAnterior` nulo.
- [x] 3.2 Test: rechazo en `EN_APROBACION` → una entrada `RECHAZADO_EN_APROBACION` con `Motivo`.
- [x] 3.3 Test: cancelación de revisión (sin motivo) → una entrada `REVISION_CANCELADA` sin `Motivo`.
- [x] 3.4 Test: `GET /api/documents/:id` después de un rechazo devuelve `motivo` en la entrada correspondiente del `auditTrail`.
- [x] 3.5 Test: la notificación de rechazo con un motivo de más de 120 caracteres trunca el mensaje y preserva el texto completo en el audit trail.
- [x] 3.6 Test de migración: verificación manual documentada en `design.md` (conteo real de filas reclasificadas en el entorno local) — el proyecto no tiene una suite de tests de migraciones EF dedicada.
- [x] 3.7 Correr toda la suite de `ShcMvpEndPoint.Tests` (521/521 ✓) y confirmar que ningún test existente que compare `Accion == "ESTADO_CAMBIADO"` para una transición a `BORRADOR` sigue asumiendo esa acción.

## 4. Frontend — tipos

- [x] 4.1 Agregar `motivo?: string` a `AuditTrailEntry` en `src/types/documents.types.ts`.

## 5. Frontend — componentes de audit trail

- [x] 5.1 En `DocumentAuditTrail.tsx`: agregar un ícono distinguible (ej. `XCircle`) para `RECHAZADO_EN_REVISION`, `RECHAZADO_EN_APROBACION` y `REVISION_CANCELADA` en `ACCION_ICONS`, distinto del ícono de `ESTADO_CAMBIADO`.
- [x] 5.2 En `DocumentAuditTrail.describeEntry`: mostrar la etiqueta i18n de la acción; cuando `entry.motivo` existe, mostrarlo como línea separada debajo de la descripción (no concatenado en el mismo string que el diff de `campoModificado`).
- [x] 5.3 En `DocumentHistorial.tsx`: agregar `RECHAZADO_EN_REVISION`, `RECHAZADO_EN_APROBACION` y `REVISION_CANCELADA` a `ACCIONES_RELEVANTES`, y mostrar `entry.motivo` debajo de la entrada cuando exista (mismo tratamiento que en 5.2).

## 6. Frontend — banner de rechazo visible

- [x] 6.1 En `DocumentDetailHeader.tsx` (requirement "DocumentDetailHeader contextual banners"), agregar la derivación (cálculo directo sobre `documento.auditTrail` ya cargado — sin `useEffect`) de la última entrada entre `RECHAZADO_EN_REVISION`/`RECHAZADO_EN_APROBACION`/`REVISION_CANCELADA`, y renderizar el banner rojo solo cuando `documento.estado === 'BORRADOR'` y esa entrada es una de las dos acciones de rechazo (no `REVISION_CANCELADA`).
- [x] 6.2 El banner muestra: quién rechazó (`realizadoPorNombre`), cuándo (`Intl.DateTimeFormat` con locale), y el `motivo` completo — todo vía claves `t('namespace:clave')`, visible para cualquier rol con acceso de lectura al documento (sin gating adicional de rol — no hay chequeo de `user.rol` en el banner).

## 7. Frontend — i18n

- [x] 7.1 Agregar a `es-PE.json` y `en-US.json`, namespace `documents`, bajo `auditTrail.actions`: `RECHAZADO_EN_REVISION`, `RECHAZADO_EN_APROBACION`, `REVISION_CANCELADA`. También `auditTrail.motivo` para la línea de motivo en AuditTrail/Historial.
- [x] 7.2 Agregar a `es-PE.json` y `en-US.json`, namespace `documents`, bajo `detail.banners`: `rechazadoEnRevision`/`rechazadoEnAprobacion` (texto con interpolación de nombre, fecha y motivo).

## 8. MSW — handlers y fixtures

- [x] 8.1 En `mocks/handlers/documents.handlers.ts`, handler `PATCH /api/documents/:id/status`: reemplazar `makeAuditEntry(doc.id, 'ESTADO_CAMBIADO', { ..., valorAnterior: motivo })` por la lógica de selección de acción (igual que 2.1) y el campo `motivo` en vez de `valorAnterior`, para las tres transiciones a `BORRADOR`.
- [x] 8.2 En `mocks/fixtures/documents.fixtures.ts`: no había ninguna fixture existente con un rechazo/cancelación que migrar (ningún entry tenía `estadoNuevo: 'BORRADOR'` desde `EN_REVISION`/`EN_APROBACION`). Se agregó un ejemplo nuevo en `doc-003` (`RECHAZADO_EN_REVISION` con motivo) para poder probar el banner y el audit trail manualmente.

## 9. Frontend — tests

- [x] 9.1 `DocumentAuditTrail.test.tsx` (nuevo archivo): entrada `RECHAZADO_EN_REVISION`/`RECHAZADO_EN_APROBACION` con motivo muestra la etiqueta y el motivo; `REVISION_CANCELADA` muestra su etiqueta sin motivo.
- [x] 9.2 `DocumentHistorial.test.tsx`: mismas tres acciones aparecen en el historial filtrado, con motivo cuando corresponde.
- [x] 9.3 `DocumentDetailHeader.test.tsx`: el banner aparece en `BORRADOR` tras un rechazo (ambos casos) y no aparece tras una cancelación ni tras reenviar a revisión (estado ya no `BORRADOR`); visible para un rol de solo lectura.
- [x] 9.4 Verificado: ningún test existente (`DocumentHistorial.test.tsx`, `documents.handlers.test.ts`) fijaba `accion: 'ESTADO_CAMBIADO'` sobre un rechazo/cancelación real — las referencias existentes son transiciones hacia adelante (`BORRADOR → EN_REVISION`) o no verifican `accion`. No se necesitaron cambios.

## 10. Verificación final

- [x] 10.1 Correr la suite completa del frontend (`npx vitest run` en `shc-controldoc`: 182/182 archivos, 1453 tests ✓) y `tsc --noEmit` (0 errores).
- [x] 10.2 Correr la suite completa del backend (`dotnet test` en `ShcMvpEndPoint`: 521/521 ✓).
- [ ] 10.3 Con MSW apagado: detener el backend, aplicar la migración (`dotnet ef database update`), `dotnet build`, levantar backend y frontend.
- [ ] 10.4 Prueba manual: (a) revisor rechaza con motivo → autor ve notificación, entra y ve el banner + motivo, audit trail muestra "Rechazado en revisión" con motivo; (b) autor corrige y reenvía → banner desaparece; (c) aprobador rechaza → mismo resultado con "Rechazado en aprobación"; (d) Jefe de Calidad cancela una revisión → aparece "Revisión cancelada", sin banner de rechazo.
- [ ] 10.5 Avisar "listo" para que se releea el código real y se actualice el mapa de proceso.
