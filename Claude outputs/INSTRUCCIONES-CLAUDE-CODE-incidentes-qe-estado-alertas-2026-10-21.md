# INSTRUCCIONES PARA CLAUDE CODE — Incidentes: el estado sigue al QE, plazo para vincular el QE, avisos y enlaces de notificaciones

- **Fecha:** 2026-10-21
- **Autor:** Cowork (para Toño)
- **Origen:** Toño preguntó qué pasa cuando un incidente supera su plazo sin QE, quién lo monitorea y qué ocurre si nunca se crea el QE. Al revisar el código aparecieron varios huecos, que se detallan en §1.
- **Change OpenSpec:** `incidentes-qe-estado-alertas`
- **Flujo:** `/opsx:sync → /opsx:propose → /opsx:apply → /opsx:archive`
- **Orden:**
  1. `fix-incidentes-detalle-nombres-ubicacion`
  2. `incidentes-ajustes-ui`
  3. `incidentes-edicion-campos-basicos` (Cowork lo escribe cuando el 1 esté "listo")
  4. **este change**

  Este change toca la máquina de estados, el escáner de vencimientos y las notificaciones. **Lleva migración**, solo de datos (ver §3.6).

---

## 1. Diagnóstico confirmado leyendo el código

### 1.1 El estado del incidente nunca avanza desde la interfaz

- Lo que existe en el backend:
  - `PATCH /api/incidents/{id}/status` (`Features/Incidentes/CambiarEstadoIncidente/`);
  - `IncidentStateMachine`, con el flujo ABIERTO → EN_INVESTIGACION → ANALISIS_COMPLETADO → EN_EJECUCION → PENDIENTE_CIERRE → CERRADO, y ABIERTO → ANULADO.
- Lo que falta:
  - En el frontend, `useUpdateIncidentStatus` (`hooks/useIncidents.ts:140`) **no lo usa ninguna pantalla**.
  - En los handlers de QE, ninguno toca `incidente.Estado`: el único que lo modifica es `CambiarEstadoIncidenteHandler`.
- **Resultado:** todo incidente queda en ABIERTO para siempre, aunque su QE avance o se cierre. Por eso la etiqueta "Sin QE vinculado" no se apaga nunca por cierre.

### 1.2 Vincular el QE no es atómico

- Al crear un QE con origen `O1_INCIDENTE_CAMPO`, `CrearQualityEventHandler` valida el incidente (líneas 27–33) y guarda `QualityEvent.IncidenteId`, pero **no** asigna `incidente.QeId`.
- La vinculación la hace el frontend en un segundo request (`useVincularQE` → `PATCH /api/incidents/{id}` con `{ qeId }`). Si ese segundo request falla, el QE queda creado y el incidente sin vincular.

### 1.3 El plazo para vincular el QE vence sin efecto

- La regla RN-INC-006 (`utils/incidentQEAlert.ts`, `PLAZO_QE_HORAS`) existe **solo en el frontend** y solo se muestra como etiqueta en la lista.
- `VencimientoScanner` (`Features/Notifications/Shared/`) escanea las acciones correctivas de incidentes, NC y QE, y la revisión periódica de documentos. **No escanea incidentes sin QE**: al vencer el plazo no hay notificación, ni audit trail, ni escalado.

### 1.4 No se avisa a nadie cuando se crea un incidente

- `CrearIncidenteHandler` no notifica. `IIncidenteNotificationSender` solo tiene `NotificarCambioEstadoAsync`.
- El PRD §3.3 pide un aviso inmediato según el tipo y la severidad.

### 1.5 Los enlaces de varias notificaciones llevan a "No encontrado"

| Origen del `Link` | Valor actual | Ruta real del frontend (`router/index.tsx`) |
|---|---|---|
| `IncidenteNotificationSender.cs` | `/incidentes/{id}` | `/incidents/:id` |
| Notificaciones de NC (2 lugares) | `/no-conformidades/{id}` | `/nonconformities/:id` |
| `VencimientoScanner.cs` y `AsignacionNotificationSender.cs` (acciones correctivas) | `/acciones-correctivas/{acId}` | **no existe**; cae en `path: '*'` → `NotFoundPage` |

`NotificationList.tsx:27` hace `navigate(notificacion.link)` tal cual, así que el usuario termina en la pantalla de no encontrado.

### 1.6 Dónde cambia el estado de un QE hoy

La sincronización tiene que engancharse en todos estos lugares:

| Handler | Estado que asigna |
|---|---|
| `CrearQualityEventHandler` | ABIERTO |
| `TransicionarEstadoQEHandler:39` | `command.NuevoEstado` (genérico) |
| `CambiarEstadoAccionCorrectivaQEHandler:58` | PENDIENTE_CIERRE (automático) |
| `FirmarCierreQEHandler:81` | CERRADO |
| `VerificacionEficaciaQEHandler:26` | VERIFICADO |
| `QEReaperturaHelper:16` | EN_INVESTIGACION (reapertura) |

**Revisar también** `ForzarVencimientoVerificacion`, `ReactivarQualityEvent`, `EliminarQualityEvent` y cualquier paso CERRADO → EN_VERIFICACION que haga el sistema. **Buscar con grep todas las asignaciones a `.Estado` de un `QualityEvent`**, sin limitarse a esta tabla.

---

## 2. Decisiones de Toño

- **D1:** el QE es obligatorio para avanzar. Sin QE vinculado, el incidente no sale de ABIERTO. El análisis y las acciones correctivas se trabajan en el QE.
- **D2:** el escáner del backend detecta los incidentes activos sin QE y avisa en dos momentos:
  - **al 75 % del plazo:** notifica a los JEFE_CALIDAD_SYST y SUPERVISOR activos de la empresa;
  - **al vencer:** notifica a los mismos y además registra `PLAZO_QE_VENCIDO` en el audit trail del incidente, con actor "Sistema".
  
  Los avisos no se repiten.
- **D3:** al **crear** un incidente se notifica a los JEFE_CALIDAD_SYST y SUPERVISOR activos de la empresa, y también a los ALTA_DIRECCION si la severidad es ALTA o CRÍTICA. El rol RRHH no existe y queda fuera.
- **D4:**
  - la etiqueta "Sin QE vinculado" también aparece en el **detalle**, junto al botón "Crear QE";
  - el dashboard del **Jefe de Calidad** muestra "Incidentes sin QE vencidos".
- **D5:** el estado del incidente **sigue automáticamente al QE vinculado**, con registro en el audit trail (actor "Sistema").
- **D6:** mapeo de estados QE → incidente:

  | Estado del QE | Estado del incidente |
  |---|---|
  | ABIERTO | ABIERTO |
  | EN_INVESTIGACION | EN_INVESTIGACION |
  | ANALISIS_COMPLETADO | ANALISIS_COMPLETADO |
  | EN_EJECUCION | EN_EJECUCION |
  | PENDIENTE_CIERRE | PENDIENTE_CIERRE |
  | CERRADO, EN_VERIFICACION, VERIFICADO | CERRADO |
  | Reapertura (EN_VERIFICACION → EN_INVESTIGACION) | EN_INVESTIGACION |

- **D7:** se corrigen los tres enlaces de notificaciones (incidentes, NC y acciones correctivas), y también las notificaciones **ya guardadas**.

---

## 3. Qué implementar

### 3.1 Backend: el estado del incidente sigue al QE (D1, D5, D6)

**a) Helper compartido**

- Crear `Features/Incidentes/Shared/IncidenteQeSync.cs`, con un método que reciba el `ShacDbContext`, el `QualityEvent` ya modificado (sin `SaveChanges`) y la fecha:
  - si `qe.IncidenteId` es null, no hace nada;
  - carga el incidente de **la misma empresa** que el QE;
  - calcula el estado destino con la tabla D6;
  - si el estado es distinto, lo asigna, actualiza `ActualizadoEn` y agrega una entrada de audit trail con `Accion = "ESTADO_SINCRONIZADO_QE"`, `EstadoAnterior`, `EstadoNuevo`, `ValorNuevo = qe.Numero`, `RealizadoPorId = "system"`, `RealizadoPorNombre = "Sistema"` y `GeneradoPorIA = true` (igual que el patrón de `REPORTE_TARDIO`). Usar `db.IncidenteAuditTrail.Add(...)`, como ya lo hace `CambiarEstadoIncidenteHandler`;
  - **no** pasa por `IncidentStateMachine.EsTransicionValida`, porque una reapertura puede ir de CERRADO a EN_INVESTIGACION. El QE ya validó su propia transición.
- Llamarlo en **cada** handler de §1.6 justo antes de su `SaveChangesAsync`, para que entre en la misma transacción.
- Después de la sincronización, enviar a los destinatarios actuales la notificación best-effort de cambio de estado (la misma lógica de `CambiarEstadoIncidenteHandler`). Esto es opcional: si complica, dejarlo anotado en `design.md`.

**b) Vinculación atómica**

- En `CrearQualityEventHandler`, con origen `O1_INCIDENTE_CAMPO`: asignar `incidente.QeId = qe.Id` **en la misma transacción**, con la validación actual de "el incidente ya está vinculado".
- En el frontend, dejar de llamar a `useVincularQE` después de crear el QE (ver §3.5), e invalidar la caché del incidente.
- En `ActualizarInvestigacionHandler`: **ignorar** `command.QeId`. Si viene distinto del actual, responder 422 con el código `QE_VINCULO_GESTIONADO_POR_QE`. Verificar con grep que nada más dependa de ese camino.

**c) El endpoint manual de estado del incidente** (`CambiarEstadoIncidenteHandler`)

- Solo acepta `ABIERTO → ANULADO` y solo si el incidente no tiene QE. Lo usa la acción de anular.
- Cualquier otra transición responde 422 con el código `ESTADO_GOBERNADO_POR_QE`: "El estado del incidente lo determina su Quality Event."
- La UI para anular **no** entra en este change. Si hoy no existe, anotarlo en `design.md`.

**d) Si se elimina el QE** (`EliminarQualityEvent`)

- El incidente vuelve a quedar **sin QE** (`QeId = null`) y en **ABIERTO**, con `ESTADO_SINCRONIZADO_QE` y un motivo que diga "QE {numero} eliminado".
- Si el código muestra que eliminar un QE con incidente ya está bloqueado, respetarlo y anotarlo en `design.md`.

**e) Migración de datos para incidentes que ya tienen QE**

- En la misma migración de §3.6, alinear `incidentes.estado` con su QE usando la tabla D6. Se hace con SQL (`UPDATE … FROM quality_events`), solo donde `qe_id IS NOT NULL` y `deleted_at IS NULL`.
- No escribe audit trail; anotarlo en `design.md`.

### 3.2 Backend: plazo para vincular el QE (D2)

- Crear `Features/Incidentes/Shared/IncidentePlazoQe.cs`, el puerto de `PLAZO_QE_HORAS` del frontend: ACCIDENTE 24, INCIDENTE 48, CUASI_ACCIDENTE 72, CONDICION_INSEGURA 48 y umbral de preaviso 0,75. Las horas se cuentan desde `FechaEvento` en UTC. Son horas corridas, no hábiles; mantener el criterio del frontend.
- En `VencimientoScanner.ScanAsync`, agregar `EscanearIncidentesSinQeAsync(db, ahora, ct)`, con el mismo patrón que `EscanearDocumentosAsync`:
  - **Universo:** incidentes con `QeId == null`, `DeletedAt == null` y estado ABIERTO. Por D1, sin QE el incidente no puede estar en otro estado activo; filtrar igual por todos los estados activos, por las dudas.
  - **Ramas excluyentes:**
    - preaviso, cuando lo transcurrido es ≥ 75 % y < 100 %, con `CicloClave = "QE_PREAVISO"`;
    - vencido, cuando lo transcurrido es ≥ 100 %, con `CicloClave = "QE_VENCIDO"`.
  - **Idempotencia** por incidente y ciclo, antes de generar el lote. Es el mismo `AnyAsync` y el mismo manejo de `DbUpdateException` que en documentos.
  - **Destinatarios:** `UsuariosEmpresa` de la empresa del incidente, con `Estado == ACTIVO` y `Rol` JEFE_CALIDAD_SYST o SUPERVISOR. Sin duplicados.
  - **Notificación:** `Tipo = VENCIMIENTO`, `EntidadTipo = INCIDENTE`, `EntidadCodigo = Numero` y `Link = "/incidents/{id}"`. Mensajes:
    - preaviso: `El incidente {numero} ({tipo}) vence en {X} h su plazo para vincular un Quality Event.`
    - vencido: `El incidente {numero} ({tipo}) superó su plazo de {plazo} h para vincular un Quality Event.`
  - **Audit trail**, solo en la rama de vencido: `Accion = "PLAZO_QE_VENCIDO"`, `ValorNuevo = "{plazo} h"`, actor "Sistema" y `GeneradoPorIA = true`.
- Verificar que el índice único parcial de notificaciones (`EntidadTipo, EntidadId, UsuarioId, CicloClave`) cubra este caso. Si no lo cubre, ajustarlo en la migración.

### 3.3 Backend: aviso al crear el incidente (D3)

- Agregar a `IIncidenteNotificationSender` el método `NotificarCreacionAsync(...)` e implementarlo en `IncidenteNotificationSender`.
- En `CrearIncidenteHandler`, **después** del `CommitAsync`, en modo best-effort (try/catch con `LogWarning`, igual que `CambiarEstadoIncidenteHandler`):
  - **Destinatarios:** JEFE_CALIDAD_SYST y SUPERVISOR activos de la empresa; además ALTA_DIRECCION si `Severidad` es ALTA o CRITICA. Se excluye al actor y no se repite a nadie.
  - **Tipo:** `SEVERIDAD_CRITICA` si es CRITICA; `CAMBIO_ESTADO` en los demás casos.
  - **Mensaje:** `Nuevo {tipo} {numero} reportado (severidad {severidad}).`
  - **Link:** `/incidents/{id}`.
- Como la sincronización offline usa el mismo endpoint, también queda cubierta.

### 3.4 Backend: dashboard del Jefe de Calidad (D4)

- En `DashboardSummaryDtos.cs`, agregar a `JefeCalidadDashboardData` el campo `IncidentesSinQeVencidos` (`List<IncidenteResumen>`, como máximo 10, del más vencido al menos) y un `IncidentesSinQeVencidosTotal` (int).
- Calcularlo en `DashboardSummaryBuilder` con `IncidentePlazoQe`, filtrando por la empresa de la sesión.

### 3.5 Frontend (`shc-controldoc/src/`)

**Detalle del incidente** (`features/incidents/pages/IncidentDetailPage.tsx`)
- Mostrar `IncidentSinQEBadge`, con el tooltip del change `incidentes-ajustes-ui`, junto al botón "Crear QE" (alrededor de la línea 312).
- **El hook va antes de cualquier `return`** (lección del bug de `usePlanoBlob`).
- Si el incidente tiene QE, mostrar un aviso informativo: "El estado de este incidente se actualiza con el QE {número}", con enlace al QE.

**Crear QE desde el incidente**
- Quitar la llamada a `useVincularQE` posterior a la creación (ver §3.1b).
- Invalidar `INCIDENT_QUERY_KEYS.detail(id)` y `.all`. Revisar si `useVincularQE` queda sin uso y, en ese caso, eliminarlo.

**Estado y caché**
- Las mutaciones de QE que cambian estado (transicionar, firmar cierre, verificar eficacia, cambiar estado de AC) deben invalidar también `INCIDENT_QUERY_KEYS.all` cuando el QE tiene `incidenteId`. `useFirmarCierre` ya lo hace; replicar ese patrón en las demás.

**Dashboard**
- Crear `features/dashboard/components/IncidentesSinQeVencidosWidget.tsx`, con número, tipo, horas vencido y enlace a `/incidents/{id}`. Agregarlo a `JefeCalidadDashboard`.
- Actualizar los tipos del summary.

**Router** (`router/index.tsx`): redirecciones para notificaciones viejas que no cubra la migración y para enlaces externos:
- `/incidentes/:id` → `/incidents/:id`
- `/no-conformidades/:id` → `/nonconformities/:id`

Usar un componente chico con `useParams` + `<Navigate replace>`.

**i18n (es-PE y en-US)**

| Clave | es-PE | en-US |
|---|---|---|
| `incidents:detail.qeGobiernaEstado` | El estado de este incidente se actualiza con el QE {{numero}}. | This incident's status follows QE {{numero}}. |
| `incidents:errors.ESTADO_GOBERNADO_POR_QE` | El estado del incidente lo determina su Quality Event. | The incident status is determined by its Quality Event. |
| `dashboard:incidentesSinQeVencidos.title` | Incidentes sin QE vencidos | Overdue incidents without QE |
| `dashboard:incidentesSinQeVencidos.empty` | No hay incidentes con el plazo vencido. | No overdue incidents. |
| `dashboard:incidentesSinQeVencidos.vencidoHace` | Vencido hace {{duracion}} | Overdue by {{duracion}} |

Agregar también la etiqueta de las acciones del audit trail del incidente (`ESTADO_SINCRONIZADO_QE`, `PLAZO_QE_VENCIDO`) donde estén las demás.

### 3.6 Enlaces de notificaciones (D7) y migración

**Backend**
- `IncidenteNotificationSender.cs`: `Link = $"/incidents/{id}"`.
- Notificaciones de NC: `$"/nonconformities/{id}"`.
- Acciones correctivas (`VencimientoScanner.EvaluarYNotificarAsync` y `AsignacionNotificationSender`): enlazar a la **entidad de origen**:
  - AC de incidente → `/incidents/{incidenteId}`
  - AC de NC → `/nonconformities/{ncId}`
  - AC de QE → `/quality-events/{qeId}`
  
  El escáner ya tiene el origen en los `Join`: pasarlo como parámetro. En `AsignacionNotificationSender`, resolverlo según el tipo de AC.
- Si en el frontend el detalle de NC o de QE tiene una pestaña de acciones correctivas que se pueda abrir por URL, agregar `?tab=…`. Si no, enlazar al detalle sin pestaña.

**Migración** (`dotnet ef migrations add FixLinksNotificacionesYEstadoIncidentes`), **solo con SQL de datos**, sin cambios de esquema salvo el índice de §3.2 si hiciera falta:
1. `UPDATE notificaciones SET link = replace(link, '/incidentes/', '/incidents/') WHERE link LIKE '/incidentes/%';`
2. Lo mismo para `/no-conformidades/` → `/nonconformities/`.
3. `/acciones-correctivas/{acId}` → la ruta del origen, con tres `UPDATE … FROM acciones_correctivas_incidente / _nc / _qe`, emparejando por el id que va al final del link. Usar los nombres reales de las columnas.
4. Alinear el estado de los incidentes con su QE (§3.1e).

El `Down()` puede quedar vacío, con un comentario.

### 3.7 MSW

- Replicar en los handlers lo siguiente:
  - el 422 `ESTADO_GOBERNADO_POR_QE` en `PATCH /api/incidents/:id/status`;
  - la vinculación atómica al crear un QE O1;
  - la sincronización de estado cuando cambia el QE;
  - los links nuevos en los fixtures de notificaciones;
  - el campo nuevo del dashboard summary.
- No hace falta simular el escáner.

---

## 4. Tests

**Backend**
- `IncidenteQeSync`:
  - cada estado del QE produce el estado de incidente de la tabla D6;
  - el audit trail registra `ESTADO_SINCRONIZADO_QE`;
  - un QE sin incidente no hace nada;
  - un QE de otra empresa no toca el incidente.
- **Integración**, con un QE O1 recorriendo su ciclo:
  1. crearlo: el incidente tiene `QeId` en la misma respuesta y sigue ABIERTO;
  2. transicionar el QE: el incidente lo sigue;
  3. firmar el cierre: el incidente queda CERRADO;
  4. verificar la eficacia: sigue CERRADO;
  5. reabrir: vuelve a EN_INVESTIGACION.
- `PATCH /status`:
  - a EN_INVESTIGACION → 422 `ESTADO_GOBERNADO_POR_QE`;
  - a ANULADO sin QE → 200;
  - a ANULADO con QE → 422.
- `PATCH /api/incidents/{id}` con un `qeId` distinto → 422 `QE_VINCULO_GESTIONADO_POR_QE`.
- **Escáner**, con `ahora` fijo:
  - ACCIDENTE con 19 h → preaviso a JCA y SUP, sin audit;
  - ACCIDENTE con 25 h → vencido con audit `PLAZO_QE_VENCIDO`;
  - una segunda corrida no duplica;
  - un incidente con QE, eliminado o ANULADO no genera nada;
  - los usuarios inactivos o de otra empresa no reciben nada.
- **Creación:**
  - severidad MEDIA → JCA y SUP, sin ALTA_DIRECCION;
  - severidad CRITICA → también ALTA_DIRECCION, con tipo `SEVERIDAD_CRITICA`;
  - el actor no se notifica a sí mismo;
  - si el envío de la notificación falla, la respuesta igual es 201.
- **Dashboard:** el JCA recibe `IncidentesSinQeVencidos`, ordenado y limitado a 10.
- **Links:** las notificaciones nuevas de incidente, NC y AC llevan rutas válidas.

**Frontend**
- Detalle:
  - sin QE y vencido, muestra el badge junto a "Crear QE";
  - con QE, muestra el aviso "se actualiza con el QE …" y no muestra el badge.
- Crear QE desde el incidente: no hay un segundo PATCH y se invalida la caché del incidente.
- Router: `/incidentes/abc` redirige a `/incidents/abc` y `/no-conformidades/abc` a `/nonconformities/abc`.
- Widget del dashboard: con datos, vacío y enlace.

---

## 5. Fuera de alcance (anotar en `design.md`)

- La sección de acciones correctivas propias del incidente (`IncidentACSection`) queda **como está**. Con D1, las acciones se trabajan en el QE. Decidir más adelante si se retira; Cowork se lo plantea a Toño.
- La UI para **anular** un incidente.
- El escalado de PRD §3.3 para CONDICIÓN INSEGURA ("si no se asigna AC en 48 h, escala al Jefe SyST"): este change lo cubre en la práctica con D2 (48 h sin QE).
- El email (P-08).

---

## 6. Reglas de siempre

- Toda divergencia entre esta instrucción y el código real va en `design.md`, con su motivo.
- Correr la **suite completa** (frontend y backend), `tsc --noEmit` y **`npm run lint` con cero errores**.
- Antes de la prueba manual: **detener el backend → `dotnet ef database update`** (hay migración) **→ `dotnet build`** → `dotnet run` → Ctrl+F5. Si aparece un 404 o un comportamiento viejo, cerrar el `ShcMvpEndPoint.exe` que quedó colgado.
- **Prueba manual con MSW apagado:**
  1. Entrar como SUPERVISOR y crear un incidente ACCIDENTE con severidad CRÍTICA. El JCA y la ALTA_DIRECCION reciben la notificación, y al hacer clic **abre el detalle**, no "No encontrado".
  2. Crear un incidente con `fechaEvento` de hace 30 h, tipo ACCIDENTE. En el siguiente escaneo, que corre según `VencimientoScanIntervalMinutes`, el JCA y el SUP reciben "superó su plazo", el audit trail del incidente muestra `PLAZO_QE_VENCIDO` (Sistema) y el dashboard del JCA lo lista.
  3. En ese incidente, hacer clic en "Crear QE": el detalle del incidente ya muestra el QE vinculado, sin el badge y con el aviso "se actualiza con el QE …".
  4. Avanzar el QE hasta EN_INVESTIGACION: el incidente pasa a EN_INVESTIGACION y el audit trail muestra `ESTADO_SINCRONIZADO_QE`.
  5. Cerrar el QE con la firma dual: el incidente queda CERRADO y la etiqueta desaparece de la lista.
  6. Abrir desde la campana una notificación vieja de NC y otra de AC: las dos llevan a la pantalla correcta.
- Toño avisa con **"listo"** para que Cowork verifique.
