# INSTRUCCIONES PARA CLAUDE CODE — Solicitudes de AC que no se cierran y las AC del QE en el incidente y en la NC

- **Fecha:** 2026-11-10
- **Autor:** Cowork (para Toño)
- **Origen:** Toño observó dos cosas:
  1. Aunque ya cerró una AC en el QE, sigue apareciendo el aviso de "AC pendiente desde el origen del QE".
  2. En el incidente que dio origen al QE, la AC creada no aparece.
- **Change OpenSpec:** `solicitudes-ac-y-ac-del-qe-en-origen`
- **Flujo:** `/opsx:sync → /opsx:propose → /opsx:apply → /opsx:archive`
- **Dependencia:** va después de `ac-ejecucion-verificacion-evidencias`, porque usa sus estados de AC (COMPLETADA y CERRADA).
- **Sin migración.** La columna `solicitudes_ac` ya existe.

---

## 1. Diagnóstico confirmado leyendo el código

### 1.1 El contador de solicitudes solo sube

- Desde el detalle del incidente (`features/incidents/components/IncidentACSection.tsx:172–197`) o de la NC (`features/nonconformities/components/ACSection.tsx:174–195`), el botón "Solicitar AC en el QE" llama a `PATCH /api/quality-events/{id}/solicitar-ac`.
- `SolicitarACEnQEHandler.cs:17` hace `qe.SolicitudesAC += 1` y registra un audit trail.
- **En ningún lugar se descuenta:** ni al crear una AC (`CrearAccionCorrectivaQEHandler`), ni al cerrarla, ni con otra acción. Lo confirmé con grep de `SolicitudesAC` en `Features/`; solo aparece en el `+= 1`, en las lecturas y en la validación.
- **Consecuencias:**
  - el aviso `detail.acSection.solicitudesACBanner` (`QEACSection.tsx:638, 768`) y el badge de la lista (`QEList.tsx:471`) quedan para siempre;
  - **RN-QE-009** (`TransicionarEstadoQEHandler.cs:52` y `QEStatusTransitionPanel.tsx:67`) bloquea `EN_INVESTIGACION → ANALISIS_COMPLETADO` mientras `SolicitudesAC > 0`. Todo QE que recibió alguna solicitud queda **trabado** en EN_INVESTIGACION;
  - `SolicitarACEnQEEndpoint` solo tiene `.RequireAuthorization()`, sin validar el rol.

### 1.2 El incidente y la NC no muestran las AC del QE

- `IncidentACSection` recibe `accionesCorrectivas` del **incidente** (la entidad `AccionesCorrectivasIncidente`). La NC usa sus propias `AccionesCorrectivasNC`.
- Desde `incidentes-qe-estado-alertas`, el análisis y las AC se trabajan **en el QE**. Por eso esas secciones quedan vacías aunque el QE vinculado tenga AC.
- `GET /api/quality-events/{id}/acciones-correctivas` (`ListarAccionesCorrectivasQEEndpoint`) ya existe. Solo exige autenticación; el handler valida la empresa.

---

## 2. Decisiones de Toño

- **D1:** **crear una AC en el QE atiende una solicitud pendiente**, que se descuenta en 1. Además, el **JCA puede "Descartar solicitud"** con un motivo. Las dos cosas quedan en el audit trail. Los QE que hoy están trabados se destraban descartando.
- **D2:** el incidente y la NC con QE vinculado muestran **las AC del QE en solo lectura**: tipo, responsable, estado y plazo, con enlace al QE. Si el incidente o la NC tienen AC propias antiguas, se muestran debajo como "Anteriores".

---

## 3. Qué implementar

### 3.1 Backend (`ShcMvpEndPoint/Features/QualityEvents/`)

**a) Solicitar una AC** (`SolicitarACEnQE`)

- **Restringir quién puede solicitar:** los roles que pueden ver el origen y que tienen sentido operativo, es decir OPERARIO, SUPERVISOR, JEFE_CALIDAD_SYST y ALTA_DIRECCION. Cualquier otro rol recibe 403. Si el código o el PRD dicen otra cosa, anotarlo en `design.md`.
- Validar que el QE no esté CERRADO, en EN_VERIFICACION ni VERIFICADO; en esos estados, 422.

**b) Crear una AC descuenta una solicitud** (`CrearAccionCorrectivaQEHandler`)

- Si `qe.SolicitudesAC > 0`, hacer `qe.SolicitudesAC -= 1` en la misma transacción.
- Registrar en el audit trail `SOLICITUD_AC_ATENDIDA`, con `ValorAnterior` y `ValorNuevo` del contador y el número o la descripción de la AC creada.
- Esto también aplica a "Crear AC" desde el asistente de IA, porque usa el mismo endpoint.

**c) Descartar una solicitud**

- Nuevo endpoint `POST /api/quality-events/{id}/solicitudes-ac/descartar`, en el slice `DescartarSolicitudAC`, con body `{ motivo: string }` de 20 a 500 caracteres.
- **Validaciones:**
  - solo el JCA (rol global); cualquier otro, 403;
  - un QE de otra empresa, 404;
  - si `SolicitudesAC == 0`, 422 `SIN_SOLICITUDES_PENDIENTES`.
- **Efecto:** `SolicitudesAC -= 1` y audit `SOLICITUD_AC_DESCARTADA` con el motivo.
- **Aviso** (best-effort): a quienes solicitaron, si se pueden identificar por el audit trail `SOLICITUD_AC` del QE. Si no se puede saber quién hizo cada solicitud, avisar al último solicitante y anotarlo en `design.md`.

**d) Lectura de las AC del QE desde el origen**

- `GET /api/quality-events/{id}/acciones-correctivas` ya existe. **Verificar** que:
  - valida la empresa de la sesión (otra empresa → 404);
  - lo pueden usar los roles que ven incidentes y NC (`incidentsView` y el equivalente de NC), **incluido el OPERARIO**. Si hoy pide un permiso de QE que el OPERARIO no tiene, permitir la lectura de las AC cuando el usuario puede ver el incidente o la NC de origen. Anotar en `design.md` cómo se resolvió;
  - devuelve lo necesario para la vista de solo lectura: `id`, `descripcion`, `tipo`, `responsableNombre`, `estado`, `plazoFecha`, `verificadaPorNombre` y `verificadaEn`, **siempre con nombres y nunca con ids**.

### 3.2 Frontend (`shc-controldoc/src/`)

**a) QE** (`features/quality-events/components/QEACSection.tsx`)

- El aviso de solicitudes se mantiene mientras `solicitudesAC > 0`, ahora con dos acciones para el JCA:
  - **"Crear AC"**, que abre el formulario de alta (crearla ya descuenta la solicitud);
  - **"Descartar solicitud"**, que abre un modal con el motivo (20 a 500 caracteres) y llama al nuevo `useDescartarSolicitudAC`.
- Al crear o descartar, invalidar el detalle y la lista de QE y `['dashboard']`, para que el aviso, el badge de la lista y RN-QE-009 se actualicen al momento.

**b) Incidente** (`features/incidents/components/IncidentACSection.tsx`)

- **Si `qeId` existe:**
  - el título pasa a ser "Acciones correctivas del {qeNumero}", con enlace al QE;
  - la lista sale de `useAccionesCorrectivasQE(qeId)` (nuevo hook o el existente) y es de **solo lectura**: descripción, badge de tipo, responsable, badge de estado (PENDIENTE, EN_EJECUCION, Pendiente de verificación, CERRADA) y plazo con semáforo;
  - cada fila enlaza al QE (`/quality-events/{qeId}`), y si el detalle del QE admite pestaña o ancla, directamente a la sección de AC;
  - el botón "Solicitar AC en el QE" se mantiene, y debajo se muestra "Solicitudes pendientes en el QE: {n}" si `n > 0`;
  - **si el incidente tiene AC propias antiguas** (`accionesCorrectivas.length > 0`), se muestran debajo, colapsadas, como "Acciones correctivas anteriores (registradas en el incidente)", también en solo lectura;
  - **si no hay ninguna AC**, el texto vacío dice "El QE aún no tiene acciones correctivas".
- **Sin `qeId`:** el comportamiento no cambia.

**c) NC** (`features/nonconformities/components/ACSection.tsx`): el mismo tratamiento, con `qeGeneradoId`.

**d) Componente compartido:** extraer la fila de solo lectura de AC a `components/shared/AccionCorrectivaReadOnlyRow.tsx` (o donde estén los compartidos), para usarla en el incidente y en la NC.

**e) i18n (es-PE y en-US)**

| Clave | es-PE | en-US |
|---|---|---|
| `qualityEvents:detail.acSection.descartarSolicitud` | Descartar solicitud | Dismiss request |
| `qualityEvents:detail.acSection.motivoDescarte` | Motivo del descarte | Reason for dismissal |
| `qualityEvents:detail.acSection.crearDesdeSolicitud` | Crear AC | Create CA |
| `incidents:acSection.delQE` | Acciones correctivas del {{numero}} | Corrective actions of {{numero}} |
| `incidents:acSection.anteriores` | Acciones correctivas anteriores (registradas en el incidente) | Earlier corrective actions (logged on the incident) |
| `incidents:acSection.qeSinAC` | El QE aún no tiene acciones correctivas. | The QE has no corrective actions yet. |
| `incidents:acSection.solicitudesPendientes` | Solicitudes pendientes en el QE: {{n}} | Pending requests in the QE: {{n}} |
| `nonconformities:…` | (las equivalentes para la NC) | |
| `qualityEvents:errors.SIN_SOLICITUDES_PENDIENTES` | No hay solicitudes pendientes. | No pending requests. |

Agregar también las etiquetas del audit trail `SOLICITUD_AC_ATENDIDA` ("Solicitud de AC atendida") y `SOLICITUD_AC_DESCARTADA` ("Solicitud de AC descartada").

### 3.3 MSW

- Crear una AC del QE descuenta `solicitudesAC`.
- Nuevo handler para `POST …/solicitudes-ac/descartar`.
- `GET …/acciones-correctivas` devuelve las AC con nombres.
- Los fixtures incluyen un incidente con QE que tiene 2 AC y 1 solicitud pendiente.

---

## 4. Tests

**Backend**
- Solicitar → `SolicitudesAC = 1`. Crear una AC → 0, con audit `SOLICITUD_AC_ATENDIDA`.
- Con `SolicitudesAC = 0`, crear una AC no deja el contador en negativo.
- Descartar:
  - el JCA con un motivo válido → 0, con audit;
  - un SUPERVISOR → 403;
  - un motivo de menos de 20 caracteres → 400;
  - sin solicitudes → 422.
- **RN-QE-009:** con 1 solicitud, la transición a ANALISIS_COMPLETADO → 422; después de crear la AC (o descartar), → 200.
- Solicitar con el QE CERRADO → 422; un rol que no está permitido → 403.
- Leer las AC del QE como OPERARIO que puede ver el incidente de origen → 200 con nombres; desde otra empresa → 404.

**Frontend**
- Aviso del QE: el JCA ve "Crear AC" y "Descartar solicitud"; al descartar, el aviso desaparece sin recargar.
- `IncidentACSection` con `qeId`: lista las AC del QE con sus badges, enlaza al QE y muestra el contador de solicitudes. Con AC antiguas propias, aparece la sección "anteriores". Sin `qeId`, el comportamiento es el de siempre.
- `ACSection` de NC con `qeGeneradoId`: el mismo tratamiento.

---

## 5. Reglas de siempre

- Toda divergencia entre esta instrucción y el código real va en `design.md`, con su motivo.
- Correr la **suite completa** (frontend y backend) + `tsc --noEmit` + **`npm run lint` con cero errores**.
- Antes de la prueba manual: **detener el backend → `dotnet build`** (sin migración) → `dotnet run` → Ctrl+F5. Si un endpoint nuevo responde 404, cerrar el `ShcMvpEndPoint.exe` que quedó colgado.
- **Prueba manual con MSW apagado:**
  1. Abrir el QE que hoy muestra el aviso de solicitudes. Como JCA, "Descartar solicitud" con un motivo: el aviso desaparece y el QE ya puede pasar a ANÁLISIS COMPLETADO.
  2. Desde un incidente con QE, "Solicitar AC en el QE". En el QE aparece el aviso con 1. Crear la AC desde el aviso: el aviso desaparece.
  3. Volver al incidente: la sección muestra "Acciones correctivas del QE-xxx" con la AC recién creada (tipo, responsable, estado y plazo), y la fila lleva al QE.
  4. Avanzar la AC por el flujo (ejecutar y verificar) y volver al incidente: el estado se ve actualizado.
  5. Repetir el paso 3 con una NC que tenga QE.
  6. Como OPERARIO que reportó el incidente: ve las AC del QE en solo lectura, sin botones de edición.
- Toño avisa con **"listo"** para que Cowork verifique.
