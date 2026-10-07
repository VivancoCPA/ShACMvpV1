## 0. Prerrequisito

- [x] 0.1 Confirmar que `revision-periodica-fecha-editable` está archivado (o al menos aplicado y sin tareas pendientes que toquen `ConfirmarRevisionPeriodicaHandler`/`DocumentRevisionPeriodicaModal.tsx`) antes de empezar este change. Confirmado: 38/38 tareas completas (no archivado todavía, pero sin pendientes).

## 1. Backend — migración (Notificacion.CicloClave)

- [x] 1.1 Agregar `CicloClave` (`string`, default `""`) a `Notificacion` (`ShcMvpEndPoint.Domain/Entities/Notificacion.cs`).
- [x] 1.2 Actualizar la configuración del índice único parcial en `ShacDbContext.cs`: `(EntidadTipo, EntidadId, UsuarioId, CicloClave)` filtrado `tipo = 'VENCIMIENTO'` (antes de 3 columnas).
- [x] 1.3 Generar la migración (`dotnet ef migrations add AddNotificacionCicloClave`) y revisar el SQL generado: columna `NOT NULL DEFAULT ''`, índice recreado, sin pérdida de datos. Confirmado en `20261007151253_AddNotificacionCicloClave.cs`.

## 2. Backend — actor "Sistema" reutilizado

- [x] 2.1 Confirmar la convención ya existente (`RealizadoPorId: "system"`, `RealizadoPorNombre: "Sistema"`, `GeneradoPorIA: true`, de `CrearIncidenteHandler`) y reutilizarla literal en las nuevas entradas de audit trail de Documentos — sin introducir una constante nueva si no hace falta, o extrayéndola a un solo lugar compartido si se detecta más de un punto de uso tras este change. Confirmado durante el diagnóstico (design.md); se reutiliza literal en el escáner (grupo 3).

## 3. Backend — VencimientoScanner (RN-DOC-006)

- [x] 3.1 Agregar filtro `Estado == DocStatus.PUBLICADO` a la consulta de documentos en `EscanearDocumentosAsync`.
- [x] 3.2 Calcular `hoyLima` una vez al inicio de `EscanearDocumentosAsync` (`TimeZoneInfo.ConvertTimeFromUtc(ahora, "America/Lima").Date`), reemplazando `ahora.Date`.
- [x] 3.3 Separar la evaluación por documento en dos ramas excluyentes: preaviso (`0 < diasRestantes <= 30`) y vencido (`diasRestantes <= 0`); `diasRestantes > 30` → `continue`.
- [x] 3.4 Rama preaviso: misma lógica de destinatarios y mensaje que hoy, pero con `CicloClave = $"PREAVISO:{fecha:yyyy-MM-dd}"` en la verificación de idempotencia y en las notificaciones creadas.
- [x] 3.5 Rama vencido: mismos destinatarios, mensaje distinto ("La revisión periódica de {código} está vencida desde {fecha}. Debe iniciarse la revisión."), `CicloClave = $"VENCIDO:{fecha:yyyy-MM-dd}"`.
- [x] 3.6 Rama vencido: si no existe ya la entrada para este ciclo, agregar **una** `DocumentoAuditTrail` con `Accion: "REVISION_PERIODICA_VENCIDA"`, `RealizadoPorId: "system"`, `RealizadoPorNombre: "Sistema"`, `GeneradoPorIA: true`, y el detalle de la fecha vencida (`ValorNuevo` o `Motivo`, según lo que ya use el resto del dominio para este tipo de dato).
- [x] 3.7 Confirmar que la escritura de audit trail y las notificaciones de la rama vencido comparten el mismo `SaveChangesAsync` (atomicidad por documento), con el mismo `catch (DbUpdateException)` que ya existe para la carrera de idempotencia.

## 4. Backend — CambiarEstadoDocumentoHandler (REVISION_PERIODICA_INICIADA)

- [x] 4.1 Agregar un `case (DocStatus.PUBLICADO, DocStatus.EN_REVISION_PERIODICA)` al switch de `accionAuditTrail` → `"REVISION_PERIODICA_INICIADA"`.
- [x] 4.2 Calcular el `Motivo` server-side para esa transición (ignorando `command.Motivo`): "Revisión sin fecha programada" / "Revisión programada (fecha dd/mm/aaaa)" (≤30 días o vencida) / "Revisión anticipada (programada para dd/mm/aaaa)" (>30 días) — mismo cálculo de "hoy en Lima" que el escáner (duplicado puntual, ver comentario D6 en el código: no se factorizó para no acoplar `CambiarEstadoDocumento` a `Features.Notifications`).
- [x] 4.3 Confirmar que las notificaciones best-effort existentes para esta transición (tabla H1) no cambian. Confirmado — el bloque de notificaciones no se tocó.

## 5. Backend — Tests de integración

- [x] 5.1 Escáner: un `PUBLICADO` a 20 días genera el preaviso una sola vez.
- [x] 5.2 Escáner: un `PUBLICADO` vencido genera la notificación de vencido y una entrada `REVISION_PERIODICA_VENCIDA` con actor `"system"`/`"Sistema"`, ambas una sola vez.
- [x] 5.3 Escáner: tras confirmar la vigencia con una fecha nueva, el ciclo siguiente vuelve a avisar (preaviso) sin que se haya borrado nada del ciclo anterior.
- [x] 5.4 Escáner: documentos en `BORRADOR`, `OBSOLETO` y `EN_REVISION_PERIODICA` con `fechaRevisionProxima` en la ventana no generan avisos ni entrada de audit trail.
- [x] 5.5 Escáner: el corte de día usa `America/Lima` (test con una fecha/hora UTC que cruza la medianoche de Lima pero no la de UTC, o viceversa). Caso diseñado para fallar con el código viejo (UTC) y pasar con el nuevo (Lima).
- [x] 5.6 Escáner: preaviso y vencido pueden coexistir como 2 notificaciones distintas para el mismo documento dentro del mismo ciclo (si el escaneo corre primero en preaviso y después, ya vencido, sin confirmar la revisión entre medio).
- [x] 5.7 `CambiarEstadoDocumentoHandler`: `REVISION_PERIODICA_INICIADA` con el motivo correcto en los 3 casos (programada, anticipada, sin fecha); el `motivo` enviado por el cliente se ignora.

## 6. Frontend — helper compartido de nivel de alerta

- [x] 6.1 Extraer `getRevisionPeriodicaNivel(diasRestantes): 'ok' | 'proximo' | 'vencido'` a un módulo nuevo (`features/documents/utils/revisionPeriodica.ts`), usando `DOC_REVISION_ALERT_DAYS`.
- [x] 6.2 `RevisionSemaforo.tsx`: usar el helper para el corte verde/no-verde, sin cambiar su subdivisión visual de 4 niveles ni su comportamiento observable.

## 7. Frontend — DocumentDetailHeader (avisos de revisión periódica)

- [x] 7.1 Banner ámbar para `PUBLICADO` con `getRevisionPeriodicaNivel === 'proximo'`: fecha + "en N días".
- [x] 7.2 Banner rojo para `PUBLICADO` con `getRevisionPeriodicaNivel === 'vencido'`: fecha + "hace N días".
- [x] 7.3 Banner informativo (teal) para `EN_REVISION_PERIODICA`: fecha y `realizadoPorNombre` de la entrada `REVISION_PERIODICA_INICIADA` más reciente del `auditTrail`.
- [x] 7.4 Confirmar que ninguno de los 3 banners aparece fuera de `PUBLICADO`/`EN_REVISION_PERIODICA`, y que no incluyen un botón propio (el de `DocumentActionPanel` ya está visible junto al título).

## 8. Frontend — DocumentHistorial / DocumentAuditTrail

- [x] 8.1 Agregar `REVISION_PERIODICA_INICIADA` y `REVISION_PERIODICA_VENCIDA` a `ACCIONES_RELEVANTES` en `DocumentHistorial.tsx`.
- [x] 8.2 Agregar ambas acciones al fallback de ícono genérico en `DocumentAuditTrail.tsx` (comentario, no necesitan ícono dedicado).
- [x] 8.3 Confirmar que `realizadoPorNombre: "Sistema"` se muestra tal cual en ambos componentes (ninguno llama a `useUserNames` sobre este campo — ya confirmado al diagnosticar, sin cambios esperados).

## 9. Frontend — i18n

- [x] 9.1 Agregar claves en `es-PE.json`/`en-US.json`: `auditTrail.actions.REVISION_PERIODICA_INICIADA`, `auditTrail.actions.REVISION_PERIODICA_VENCIDA`, y las 3 claves de banner (ámbar/rojo/informativo) de revisión periódica.

## 10. MSW

- [x] 10.1 `buildVencimientoKey`: agregar parámetro opcional `cicloClave`, sin cambiar el valor devuelto cuando se omite (AC/INCIDENTE no cambian).
- [x] 10.2 `generateVencimientoNotifications`: filtrar documentos por `estado === 'PUBLICADO'`; calcular "hoy" en `America/Lima`; separar preaviso/vencido con sus propias `cicloClave`.
- [x] 10.3 Agregar 2 fixtures nuevas a `documents.fixtures.ts`: un documento `PUBLICADO` con `fechaRevisionProxima` vencida, y uno en `EN_REVISION_PERIODICA` con una entrada `REVISION_PERIODICA_INICIADA` en su `auditTrail`.

## 11. Frontend — Tests

- [x] 11.1 `revisionPeriodica.test.ts` (helper): los 3 niveles (`ok`/`proximo`/`vencido`) en sus límites exactos.
- [x] 11.2 `DocumentDetailHeader.test.tsx`: los 3 banners aparecen en su situación correspondiente; ninguno aparece fuera de `PUBLICADO`/`EN_REVISION_PERIODICA`.
- [x] 11.3 `DocumentHistorial.test.tsx` / `DocumentAuditTrail.test.tsx`: las 2 acciones nuevas se muestran con su motivo/detalle y el actor "Sistema".
- [x] 11.4 MSW (`documents.handlers.test.ts` o `notificationGeneration` si tiene test propio): preaviso/vencido coexisten como notificaciones distintas; re-ejecutar no duplica; documento no-PUBLICADO no genera nada.

## 12. Verificación

- [x] 12.1 Correr la suite completa del frontend (vitest) en `shc-controldoc`. 187/187 archivos, 1518/1518 tests (+1 expected fail preexistente).
- [x] 12.2 Correr los tests del backend (`dotnet test`) en `ShcMvpEndPoint`. 559/559 passed.
- [x] 12.3 Correr `tsc --noEmit` en `shc-controldoc`. Sin errores.
- [x] 12.4 Detener el backend, correr `dotnet ef database update` y `dotnet build` antes de la prueba manual. Backend no estaba corriendo; migración `20261007151253_AddNotificacionCicloClave` ya estaba aplicada (de una corrida anterior de esta misma sesión); build limpio (0 errores).
- [x] 12.5 Prueba manual con MSW apagado (ajustando `fecha_revision_proxima` directo en la base, o ejecutando el escáner a demanda si existe una forma de hacerlo en Development):
  1. documento a 20 días → llega el aviso y el detalle muestra el aviso ámbar;
  2. documento con fecha pasada → aparece la entrada en el log, la notificación, y el aviso rojo en el detalle;
  3. un JCD inicia la revisión → el log muestra "Revisión periódica iniciada — programada" (o el motivo que corresponda) y el detalle muestra el aviso informativo;
  4. se confirma la vigencia con una fecha nueva y se vuelve a acercar esa fecha → vuelve a avisar.
  Verificado por Toño ("ahora si quedo bien") tras corregir un typo de año en `fecha_revision_proxima` de PRC-CD-016 (2027 en vez de 2026) que causaba el falso síntoma inicial — no era un bug de la app.

## 13. Cierre

- [x] 13.1 Avisar "listo" para verificación de causa raíz releyendo el código real; actualizar `SHAC-Mapa-Proceso-Control-Documentario.md` (sección de revisión periódica) si existe. Doc actualizado (sección 3) con la nueva trazabilidad; "listo" avisado a Toño, pendiente solo su verificación manual (12.5).
