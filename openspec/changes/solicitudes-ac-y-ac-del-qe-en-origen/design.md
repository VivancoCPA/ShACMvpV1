## Context

- `QualityEvent.SolicitudesAC` es un contador entero:
  - se incrementa en `SolicitarACEnQEHandler` con el audit `AC_SOLICITADA`, que guarda el `RealizadoPorId`;
  - lo leen el aviso de `QEACSection`, el badge de `QEList` y RN-QE-009 (`TransicionarEstadoQEHandler` y `QEStatusTransitionPanel`);
  - nada lo descuenta.
- `GET /api/quality-events/{id}/acciones-correctivas`:
  - devuelve las AC desde `AccionCorrectivaQELoader`, con `responsableNombre`, `ejecutadaPorNombre` y `verificadaPorNombre` resueltos por JOIN;
  - valida la empresa (404) y no valida el rol.
- `GET /api/quality-events/{id}` tampoco valida el rol. En el frontend, `qualityEventsView` incluye al OPERARIO.
- `IncidentDetailPage` ya llama a `useQualityEvent(incident.qeId)` para el aviso "el estado lo gobierna el QE".
- `ACSection` de NC resuelve el número del QE por fila importando `qualityEventFixtures` de MSW, lo que viola la regla 13 y no funciona contra el backend real.

## Goals / Non-Goals

**Goals**
- El contador de solicitudes baja al atender una solicitud (crear una AC) o al descartarla, y cada caso queda en el audit trail.
- Los QE trabados hoy se destraban descartando, sin migración ni script.
- El incidente y la NC muestran el trabajo real, que son las AC del QE.

**Non-Goals**
- Modelar cada solicitud como una entidad, con su autor y su vínculo a la AC que la atiende. Sigue siendo un contador; ver D2.
- Cambiar el flujo de las AC propias del incidente o de la NC sin QE.
- Cambiar quién ve el botón "Solicitar AC en el QE" en el frontend. Sigue gateado por `canAddAC` y `canAsignarAC` (SUPERVISOR y JCA); ver D1.

## Decisions

### D1 — Roles que pueden solicitar
El backend permite OPERARIO, SUPERVISOR, JEFE_CALIDAD_SYST y ALTA_DIRECCION, según la instrucción. Cualquier otro rol efectivo recibe 403 `SOLICITUD_AC_ROL_NO_PERMITIDO`, usando `user.GetRolEfectivo()`, igual que en `VerificarAccionCorrectivaQEEndpoint`.

**Divergencia con el código:** en el frontend el botón solo lo ven SUPERVISOR y JCA (`incidentPermissions.canAddAC`, `ncPermissions.canAsignarAC`). El OPERARIO y ALTA_DIRECCION no lo ven, aunque el backend los acepte. No se amplía el botón porque las matrices de permisos de incidentes y NC son specs vigentes y la instrucción no pide cambiarlas. El backend queda como techo permisivo.

### D2 — Los N pendientes y el orden FIFO
Los N pendientes son las últimas N entradas `AC_SOLICITADA` del QE, ordenadas por `Timestamp`. La solicitud que se atiende o descarta es la **más antigua de esas N** (FIFO). Así se identifica al solicitante sin agregar una columna.

**Divergencia:** la instrucción habla de audit `SOLICITUD_AC`, pero el código real usa `AC_SOLICITADA`, y se conserva ese código para no romper el historial existente.

### D3 — Crear una AC atiende una solicitud
`CrearAccionCorrectivaQEHandler` descuenta 1 si `SolicitudesAC > 0`, en el mismo `SaveChangesAsync`, y registra `SOLICITUD_AC_ATENDIDA`:
- `CampoModificado` = `solicitudesAC`;
- `ValorAnterior` = `n`;
- `ValorNuevo` = `n-1 — {título de la AC}`.

`QualityEventAuditTrail` no tiene columna de motivo ni de comentario, y agregarla requeriría migración (fuera de alcance). Por eso el texto va como sufijo de `ValorNuevo`, con el mismo formato en D4.

Con el contador en 0 no hace nada, así que nunca queda negativo. No hay forma de crear una AC "sin atender" una solicitud: la instrucción lo pide explícitamente.

### D4 — Descartar una solicitud
Es un slice nuevo, `DescartarSolicitudAC`, con un command, un validator FluentValidation (motivo de 20 a 500 caracteres recortado, que responde 400 vía `ValidationFilter`), un handler y un endpoint.

**Orden de validación:**
1. empresa (404);
2. rol JCA (403 `SOLO_JCA_DESCARTA_SOLICITUD`);
3. `SolicitudesAC == 0` (422 `SIN_SOLICITUDES_PENDIENTES`).

**Efecto:** descuenta 1 y registra `SOLICITUD_AC_DESCARTADA` con `ValorAnterior` = `n` y `ValorNuevo` = `n-1 — {motivo}` (ver D3). Devuelve el QE (`ApiResponse.Ok(qe)`), igual que `solicitar-ac`.

### D5 — Aviso al solicitante
Se agrega el método `NotificarSolicitudAcDescartadaAsync` al `IQualityEventNotificationSender`:
- tipo `CAMBIO_ESTADO`;
- destinatario: el autor de la solicitud descartada (D2), salvo que sea el actor;
- best-effort, con try/catch y log, como `NotificarAcDevueltaAsync`.

Si el audit no permite identificar al autor (registros previos sin `RealizadoPorId` válido), no se avisa a nadie. Es más seguro que avisar a un tercero. El "último solicitante" que menciona la instrucción como alternativa no hace falta, porque D2 siempre identifica a alguien cuando hay un audit.

### D6 — Estados en que no se puede solicitar
Con el QE en `CERRADO`, `EN_VERIFICACION` o `VERIFICADO`, solicitar responde 422 `SOLICITUD_AC_ESTADO_INVALIDO`. Descartar no se restringe por estado, para poder limpiar contadores en QE ya avanzados.

### D7 — Leer las AC del QE desde el origen
`GET …/acciones-correctivas` ya cumple lo que se pide:
- valida la empresa (404);
- no exige un rol de QE, así que el OPERARIO, AUDITOR_INTERNO y ALTA_DIRECCION la usan sin cambios;
- devuelve nombres, no ids.

No se agrega una restricción "puede ver el incidente o la NC", porque hoy cualquier usuario de la empresa ya puede leer el QE completo (`GET /api/quality-events/{id}`) y endurecer solo la sublista no protegería nada. Se agrega un test de integración como OPERARIO para fijar este comportamiento.

### D8 — Frontend del origen
`IncidentACSection` y `ACSection` reciben el mismo tratamiento cuando hay un QE vinculado:
- llaman a `useQEAcciones(qeId)`, que ya existe con la key `['quality-events','acciones',qeId]` y que se invalida con `QE_QUERY_KEYS.all` desde los hooks del flujo de AC;
- llaman a `useQualityEvent(qeId)` para obtener `numero` y `solicitudesAC`. En el incidente está en caché gracias a la página.

Cada fila usa la nueva `components/shared/AccionCorrectivaReadOnlyRow` y enlaza a `/quality-events/{qeId}#qe-ac-section`; la sección de AC del QE recibe el id `qe-ac-section`.

Las AC propias del incidente o de la NC se muestran debajo, en un `<details>` colapsado, como "anteriores", en solo lectura y sin botones de transición.

**Divergencia:** con un QE vinculado ya no se ofrecen "Iniciar" ni "Cerrar" sobre las AC propias antiguas. Antes tampoco: la condición `!isQELinked` ya los ocultaba. Sin QE, todo queda igual.

El número del QE en la NC sale de `useQualityEvent`, y se elimina el import de fixtures.

### D9 — Invalidaciones
- `useCreateQEAccion` pasa a invalidar `QE_QUERY_KEYS.all`, en vez de solo el detalle, para que también se actualicen la lista (badge) y la sublista de AC.
- `useDescartarSolicitudAC` invalida `QE_QUERY_KEYS.all`, el audit trail y `['dashboard']`.
- `useSolicitarACEnQE` agrega `QE_QUERY_KEYS.all` y el dashboard, para que el contador del incidente o la NC se actualice al momento.

### D10 — "Crear AC" desde el aviso
Abre el mismo modal de alta (`setShowAddModal(true)`). Solo se ofrece si `canAsignarAC`, es decir, si el estado admite crear AC. "Descartar solicitud" se ofrece al JCA siempre que no sea `readOnly`.

### D11 — Fixture y componente compartido (divergencias menores)
- **Fixture:** se reutiliza `qe-2026-005`, ya vinculado a `inc-001`, y se le agrega `solicitudesAC: 1` con su audit `AC_SOLICITADA` (de `user-supervisor-001`). Tiene **3 AC** (EN_EJECUCION, PENDIENTE y COMPLETADA), no las 2 que pide la instrucción. No se quitó una para no desarmar fixtures que usan otros tests y el dashboard.
- **Componente:** además de la fila `AccionCorrectivaReadOnlyRow`, toda la sección "AC del QE" (título, lista, contador, vacío y "anteriores") vive en `components/shared/AccionesCorrectivasDelQE.tsx`, parametrizada por namespace (`incidents` / `nonconformities`), para no duplicarla entre el incidente y la NC.
- **Enlace por AC en la NC sin QE:** el enlace "Ver QE → {numero}" de las AC con `qeId` resuelve el número con `useQualityEvent` (componente `VerQELink`), en lugar de importar `qualityEventFixtures`.

## Risks / Trade-offs

- **[Un JCA crea una AC que no responde a ninguna solicitud y "consume" una igual]** → Es la decisión D1 de Toño. Queda visible en el audit (`SOLICITUD_AC_ATENDIDA` con el título de la AC). Si molesta, el siguiente paso es modelar las solicitudes como entidad.
- **[FIFO sobre el audit trail como fuente del autor]** → Es una lectura acotada (las últimas N entradas `AC_SOLICITADA`) y solo se usa para el aviso best-effort, nunca para permisos.
- **[Botón visible solo para SUPERVISOR y JCA aunque el backend acepte más roles]** → Documentado en D1. El backend sigue rechazando a JCD, AUDITOR y ADMINISTRADOR.
