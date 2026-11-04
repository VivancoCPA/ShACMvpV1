# INSTRUCCIONES PARA CLAUDE CODE — QE desde un incidente: precarga de datos y responsable de investigación

- **Fecha:** 2026-10-22
- **Autor:** Cowork (para Toño)
- **Origen:** observaciones de Toño al crear un QE desde un incidente:
  1. "Al preseleccionar el incidente, ¿no debería traer también sus datos? La descripción viene vacía; ¿no debería ser la misma del incidente? Lo mismo con la fecha y la hora."
  2. "No se nombra a ningún responsable. ¿Quién le hará seguimiento al QE?"
- **Change OpenSpec:** `qe-precarga-incidente-responsable`
- **Flujo:** `/opsx:sync → /opsx:propose → /opsx:apply → /opsx:archive`
- **Dependencia:** se aplica **después** de `incidentes-qe-estado-alertas`. Este change usa la vinculación atómica del QE con el incidente y la sincronización de estado que hace aquel. Si `incidentes-qe-estado-alertas` todavía no está archivado, esperar.
- **Lleva migración solo si** hace falta un índice o una FK para `ResponsableInvestigacionId` (ver §3.1). La columna ya existe.

---

## 1. Diagnóstico confirmado leyendo el código

### 1.1 El QE no copia los datos del incidente

- `shc-controldoc/src/features/incidents/pages/IncidentDetailPage.tsx:326`: el botón "Crear QE" navega a `/quality-events/nuevo?origen=O1_INCIDENTE_CAMPO&incidenteId=…&incidenteNumero=…&incidenteArea=…`. Solo viajan el id, el número y el área.
- `shc-controldoc/src/features/quality-events/pages/QualityEventForm.tsx`:
  - en los `defaultValues` de alta (líneas 143–156), solo `areaId` toma un valor del origen; `tipo`, `severidad`, `descripcion`, `turno` y `fechaHoraEvento` quedan en `''`;
  - al elegir un incidente en el `SearchableSelect` (líneas 452–456), solo hace `setValue('areaId', inc.areaId)`.
- El incidente sí tiene todo lo necesario: `descripcion`, `fechaEvento` (UTC), `turno` (`DIA`/`TARDE`/`NOCHE`, que es el mismo enum `IncidentTurno` que usa el QE), `areaId` y `severidad` (`BAJA`/`MEDIA`/`ALTA`/`CRITICA`, con los mismos nombres que `QESeveridad`).

### 1.2 El responsable de investigación no se asigna en ningún lado

- `QualityEvent.ResponsableInvestigacionId` (`ShcMvpEndPoint.Domain/Entities/QualityEvent.cs`) existe, y el frontend lo lee (`qualityEvent.types.ts:141`, `qualityEventPermissions.ts:170`).
- **Ningún endpoint lo escribe:**
  - no está en `CrearQualityEventCommand`;
  - no está en la whitelist de `ActualizarQualityEventCommand`;
  - `TransicionarEstadoQEHandler` no lo toca ni lo exige.
- **Resultado:** todos los QE quedan sin responsable. El permiso "SUPERVISOR responsable de la investigación" nunca se cumple. Además, nada impide pasar de ABIERTO a EN_INVESTIGACION sin investigador.
- El PRD §1.3 (estado 1 → 2) dice:
  - quién transiciona: "Jefe Calidad (asigna investigador)";
  - condición: "QE tiene responsable de investigación asignado";
  - notifica a: "Responsable investigador".

### 1.3 No se avisa a nadie cuando se crea un QE

- `QualityEventNotificationSender` solo tiene `NotificarSeveridadCriticaAsync`, `NotificarCierreAsync` y `NotificarVerificacionEfectivaAsync`.
- El PRD §1.3 (estado ABIERTO) pide notificar a "Supervisor área + Jefe Calidad + SyST".

---

## 2. Decisiones de Toño

- **D1:** al crear un QE desde un incidente, los datos llegan **precargados y editables**: descripción, fecha y hora del evento, turno, área, severidad y tipo SyST. Es igual si el incidente viene en la URL o si se elige en el combo.
- **D2:** el responsable se asigna **como dice el PRD**:
  - al crear es opcional;
  - es **obligatorio para pasar de ABIERTO a EN_INVESTIGACION**;
  - lo asigna o cambia el **JCA**, eligiendo entre SUPERVISOR y JEFE_CALIDAD_SYST activos de la empresa;
  - el asignado recibe un aviso;
  - su nombre se ve en la cabecera del QE;
  - cada asignación o cambio queda en el audit trail.
- **D3:** se agrega el **aviso al crear un QE** para los JCA y SUPERVISOR activos de la empresa. El aviso de "QE sin responsable a las 48 h" **no** entra.

---

## 3. Qué implementar

### 3.1 Backend (`ShcMvpEndPoint/`)

**a) Candidatos a responsable**

- Nuevo endpoint `GET /api/quality-events/candidatos-responsable`, en el slice `Features/QualityEvents/CandidatosResponsable/`. Toma como modelo `GET /api/documents/candidatos-asignacion` de M1.
- Devuelve los usuarios con asignación `ACTIVO` en la empresa de la sesión, con rol `SUPERVISOR` o `JEFE_CALIDAD_SYST`, que además estén activos (`ShacUser.Activo`). Para cada uno: `{ id, nombreCompleto, rol, avatarUrl }`.
- Requiere autenticación y empresa activa.

**b) Validación compartida**

- Crear el helper `Features/QualityEvents/Shared/ResponsableInvestigacionValidator.cs`. Comprueba que el id corresponda a un candidato válido de la empresa (misma regla que en (a)).
- Si no es válido, responde un **error de validación del campo** `responsableInvestigacionId` (400/422, con el patrón de `FieldValidationException`), **no** un 404. Es el mismo criterio que RN-DOC-021 en M1.

**c) Crear QE** (`CrearQualityEvent`)

- Agregar `Guid? ResponsableInvestigacionId` al command. Es opcional. Si viene, validarlo con (b) y asignarlo.
- Si viene, después del commit y en modo best-effort, notificar al responsable (ver (f)) y registrar `RESPONSABLE_ASIGNADO` en el audit trail del QE, dentro de la misma transacción.

**d) Asignar o cambiar el responsable**

- Nuevo endpoint `PATCH /api/quality-events/{id}/responsable`, con body `{ responsableInvestigacionId: Guid }`, en el slice `AsignarResponsableQE`.
- **Permiso:** solo `JEFE_CALIDAD_SYST` por rol global. Cualquier otro rol recibe 403. Un QE de otra empresa responde 404.
- **Estados permitidos:** cualquiera menos CERRADO, EN_VERIFICACION y VERIFICADO. En esos casos responde 422 con el código `QE_CERRADO`.
- Si el responsable no cambia, responde 200 sin audit trail ni notificación.
- **Audit trail:** `RESPONSABLE_ASIGNADO` la primera vez y `RESPONSABLE_CAMBIADO` cuando ya había uno. Guardar `ValorAnterior` y `ValorNuevo` con los **nombres** de las personas, no con los ids.
- Notificar al nuevo responsable (ver (f)).
- No agregar el campo a `ActualizarQualityEventCommand`: la asignación va solo por este endpoint.

**e) Transición ABIERTO → EN_INVESTIGACION** (`TransicionarEstadoQEHandler`)

- Si `command.NuevoEstado == EN_INVESTIGACION` y `qe.ResponsableInvestigacionId is null`, responder `BusinessRuleException("Asigna un responsable de investigación antes de iniciar la investigación", "QE_SIN_RESPONSABLE")`.
- Esta validación va junto a las de RN-QE-002 y RN-QE-009.
- La reapertura (`QEReaperturaHelper`, EN_VERIFICACION → EN_INVESTIGACION) **no** se bloquea, porque el QE ya tiene responsable. Si por algún dato viejo no lo tuviera, dejar que reabra y anotarlo en `design.md`.

**f) Notificaciones** (`IQualityEventNotificationSender` / `QualityEventNotificationSender`)

- `NotificarResponsableAsignadoAsync`:
  - para: el responsable, salvo que sea el actor;
  - `Tipo = ASIGNACION`, `EntidadTipo = QE`;
  - mensaje: `Fuiste asignado como responsable de investigación del {numero}.`;
  - `Link = /quality-events/{id}`.
- `NotificarCreacionAsync` (D3):
  - para: JCA y SUPERVISOR activos de la empresa, sin el actor y sin duplicados. Reutilizar `RolNotificationHelper`, que ya resuelve los destinatarios por rol;
  - `Tipo = CAMBIO_ESTADO`;
  - mensaje: `Nuevo Quality Event {numero} ({tipo}, severidad {severidad}).` Si viene de un incidente, agregar ` — origen {incidenteNumero}`;
  - `Link = /quality-events/{id}`.
  - Si el QE es CRÍTICO, sigue saliendo también `NotificarSeveridadCriticaAsync`, como hoy.
- Las dos son best-effort, después del commit, con try/catch y `LogWarning`. Si fallan, la respuesta no cambia.

**g) Lectura**

- `ObtenerQualityEventHandler` y `ListarQualityEventsHandler` (Dapper): devolver `ResponsableInvestigacionId` y `ResponsableInvestigacionNombre`, con un `LEFT JOIN asp_net_users` y `TRIM(nombre || ' ' || apellido)`.
- `ResponsableInvestigacionNombre` es una propiedad `[NotMapped]` en la entidad, igual que los nombres de `fix-incidentes-detalle-nombres-ubicacion`. **No debe aparecer en la migración.**
- Calificar con alias todas las columnas del SQL al agregar el JOIN, para evitar ambigüedades.

**h) Migración:** no hace falta, salvo que no exista índice sobre `responsable_investigacion_id`. Si se agrega, que sea `migrations add AddIndexResponsableInvestigacionQE`, con el índice solamente.

### 3.2 Frontend (`shc-controldoc/src/`)

**a) Precarga desde el incidente** (`features/quality-events/pages/QualityEventForm.tsx`) (D1)

- Cuando el origen es `O1_INCIDENTE_CAMPO` y hay `incidenteId`, ya sea en la URL o elegido en el combo, obtener el incidente con `useIncident(incidenteId)` de `features/incidents`. **Ese hook va antes de cualquier `return`.** Luego completar el formulario con `setValue`:

  | Campo del QE | Valor |
  |---|---|
  | `descripcion` | `incidente.descripcion` |
  | `fechaHoraEvento` | `incidente.fechaEvento` en hora **local** de `datetime-local` (`yyyy-MM-ddTHH:mm`), con el mismo helper `toDatetimeLocalValue` de `IncidentForm`. **No usar `.slice(0, 16)` sobre el ISO UTC**, porque deja la hora corrida 5 horas. Si conviene, mover el helper a `utils/` compartido. |
  | `turno` | `incidente.turno` |
  | `areaId` | `incidente.areaId` |
  | `severidad` | `incidente.severidad` |
  | `tipo` | `'SST'` |

- **Al cambiar el incidente en el combo:** si el usuario ya modificó alguno de esos campos (`formState.dirtyFields`), pedir confirmación ("¿Reemplazar los datos con los del incidente {numero}?") antes de sobrescribirlos. Si no los tocó, reemplazar directamente.
- Todos los campos siguen **editables**. Debajo de la descripción, mostrar la nota `form.precargaIncidente`: "Datos copiados del incidente {{numero}}. Puedes ajustarlos."
- Corregir también el modo edición: en la línea 134, `qe.fechaHoraEvento.slice(0, 16)` tiene el mismo problema de zona horaria, así que debe usar el mismo helper. En el submit de edición (línea 275), comparar contra el valor convertido.
- Validación existente: la fecha no puede ser futura; con la precarga, eso no cambia.

**b) Responsable al crear** (D2)

- Agregar al formulario de alta un `SearchableSelect` **opcional**, "Responsable de investigación", con los datos de `GET /api/quality-events/candidatos-responsable` (hook `useCandidatosResponsableQE`). Mostrar el nombre y, al lado, el rol.
- El campo se muestra **solo si el usuario es JCA**. Para el resto de roles no aparece, y la asignación queda para el JCA.
- Enviar `responsableInvestigacionId` solo si se eligió.

**c) Cabecera del QE** (`components/QEHeaderSection.tsx`)

- Agregar la fila "Responsable de investigación", con foto o iniciales y el nombre. Si no hay responsable, mostrar "Sin asignar" en ámbar.
- Si el usuario es JCA y el estado lo permite, agregar el botón "Asignar" o "Cambiar". Abre un modal con el `SearchableSelect` de candidatos, llama a `PATCH /api/quality-events/{id}/responsable` e invalida el detalle y el audit trail.

**d) Transición a EN_INVESTIGACION** (`components/QEStatusTransitionPanel.tsx`)

- Si el QE no tiene responsable, deshabilitar el botón "EN_INVESTIGACION" con el tooltip "Asigna un responsable de investigación primero". Si el usuario es JCA, ofrecer un enlace que abra el modal de (c).
- Si el servidor responde `QE_SIN_RESPONSABLE`, mostrar ese mismo mensaje.

**e) Permisos** (`utils/qualityEventPermissions.ts`)

- Revisar de dónde sale hoy `esResponsable`. Tiene que calcularse como `qe.responsableInvestigacionId === usuario.id`.
- Dejar en `design.md` cualquier comportamiento que cambie por eso; por ejemplo, el SUPERVISOR responsable ahora sí puede editar la cabecera en ABIERTO.
- **No** cambiar quién puede avanzar de ABIERTO: el SUPERVISOR sigue pudiendo, pero ahora con responsable asignado.

**f) Tipos:** agregar `responsableInvestigacionNombre?: string` en `qualityEvent.types.ts`. Agregar también el tipo del candidato.

**g) i18n (`qualityEvents`, es-PE y en-US)**

| Clave | es-PE | en-US |
|---|---|---|
| `form.fields.responsableInvestigacion` | Responsable de investigación | Investigation lead |
| `form.precargaIncidente` | Datos copiados del incidente {{numero}}. Puedes ajustarlos. | Data copied from incident {{numero}}. You can adjust it. |
| `form.confirmReemplazoIncidente` | ¿Reemplazar los datos con los del incidente {{numero}}? | Replace the data with incident {{numero}}'s? |
| `detail.responsable.label` | Responsable de investigación | Investigation lead |
| `detail.responsable.sinAsignar` | Sin asignar | Unassigned |
| `detail.responsable.asignar` | Asignar | Assign |
| `detail.responsable.cambiar` | Cambiar | Change |
| `errors.QE_SIN_RESPONSABLE` | Asigna un responsable de investigación antes de iniciar la investigación. | Assign an investigation lead before starting the investigation. |

Agregar también las etiquetas del audit trail `RESPONSABLE_ASIGNADO` ("Responsable asignado") y `RESPONSABLE_CAMBIADO` ("Responsable cambiado").

### 3.3 MSW

- Implementar en los handlers:
  - `GET /api/quality-events/candidatos-responsable`;
  - `PATCH /api/quality-events/:id/responsable`, con 403 para quien no es JCA;
  - el 422 `QE_SIN_RESPONSABLE` en la transición a EN_INVESTIGACION;
  - aceptar `responsableInvestigacionId` en `POST /api/quality-events`;
  - devolver `responsableInvestigacionNombre` en el detalle y en el listado.
- Actualizar los fixtures.

---

## 4. Tests

**Backend**
- Candidatos: solo SUP y JCA, activos y de la empresa de la sesión. No aparecen OPE, AUD, inactivos ni usuarios de otra empresa.
- Crear:
  - con un responsable válido, lo guarda, deja `RESPONSABLE_ASIGNADO` en el audit trail y notifica;
  - con un responsable inválido (por ejemplo, un OPERARIO o alguien de otra empresa), devuelve un error de validación del campo;
  - sin responsable, devuelve 201.
- Aviso de creación: llega a JCA y SUP, nunca al actor. Si la notificación falla, la respuesta sigue siendo 201.
- `PATCH /responsable`:
  - JCA → 200 con `RESPONSABLE_ASIGNADO` y luego `RESPONSABLE_CAMBIADO` (audit con nombres);
  - SUPERVISOR → 403;
  - otra empresa → 404;
  - QE CERRADO → 422;
  - mismo responsable → 200 sin audit.
- Transición: ABIERTO → EN_INVESTIGACION sin responsable da 422 `QE_SIN_RESPONSABLE`; con responsable, 200.
- Detalle y listado traen `responsableInvestigacionNombre`.

**Frontend**
- Formulario desde un incidente:
  - con `?incidenteId=…` precarga descripción, fecha (en hora local, sin corrimiento), turno, área, severidad y tipo SST;
  - al elegir otro incidente sin cambios previos, reemplaza directamente;
  - con cambios previos, pide confirmación.
- El campo de responsable aparece solo para el JCA.
- Cabecera: muestra "Sin asignar"; el JCA ve "Asignar" y otro rol no lo ve. Al asignar, se ve el nombre.
- Panel de transición: el botón a EN_INVESTIGACION queda deshabilitado sin responsable, y aparece el mensaje cuando llega `QE_SIN_RESPONSABLE`.
- Edición: `fechaHoraEvento` se muestra en hora local, sin corrimiento de 5 h.

---

## 5. Fuera de alcance

- El aviso de "QE sin responsable a las 48 h": Toño decidió no incluirlo por ahora.
- El alta de QE desde una NC (O2) también solo precarga el área. Si se quiere el mismo tratamiento, va en otro change; anotarlo en `design.md`.

---

## 6. Reglas de siempre

- Toda divergencia entre esta instrucción y el código real va en `design.md`, con su motivo.
- Correr la **suite completa** (frontend y backend) + `tsc --noEmit` + **`npm run lint` con cero errores**.
- Antes de la prueba manual: **detener el backend → `dotnet ef database update`** (si se agregó el índice) **→ `dotnet build`** → `dotnet run` → Ctrl+F5. Si aparece un 404 en un endpoint nuevo, cerrar el `ShcMvpEndPoint.exe` que quedó colgado.
- **Prueba manual con MSW apagado:**
  1. Como JCA, abrir un incidente sin QE y hacer clic en "Crear QE". El formulario viene con la descripción, la fecha y la hora (**la misma hora que muestra el incidente**), el turno, el área, la severidad y el tipo SyST. Se puede editar la descripción.
  2. Elegir un responsable (un SUPERVISOR) y guardar. El supervisor recibe "Fuiste asignado…", y los JCA y SUP reciben "Nuevo Quality Event…". La cabecera muestra al responsable.
  3. Crear otro QE sin responsable. La cabecera dice "Sin asignar" y el botón para pasar a EN_INVESTIGACION queda deshabilitado. Asignar desde la cabecera; el botón se habilita, y al avanzar el incidente vinculado pasa a EN_INVESTIGACION (por `incidentes-qe-estado-alertas`).
  4. Cambiar el responsable. El audit trail muestra "Responsable cambiado: {anterior} → {nuevo}", y el nuevo recibe el aviso.
  5. Como SUPERVISOR, el botón "Asignar" no aparece.
  6. Editar un QE existente: la fecha y la hora del evento se ven igual que en el detalle, sin corrimiento.
- Toño avisa con **"listo"** para que Cowork verifique.
