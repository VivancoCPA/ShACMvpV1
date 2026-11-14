# INSTRUCCIONES PARA CLAUDE CODE — Acciones correctivas: el responsable ejecuta, el JCA verifica, y la evidencia es un archivo

- **Fecha:** 2026-11-10
- **Autor:** Cowork (para Toño)
- **Origen:** Toño observó dos cosas:
  1. Quien crea una AC asignada a otro usuario igual puede cerrarla.
  2. Al cerrar, la evidencia solo admite una URL; no se pueden subir fotos ni documentos.
- **Change OpenSpec:** `ac-ejecucion-verificacion-evidencias`
- **Flujo:** `/opsx:sync → /opsx:propose → /opsx:apply → /opsx:archive`
- **Dependencia:** va después de `ac-tipo-responsables` y `ac-responsables-configurable-empresa`.
- **Lleva migración:** un estado nuevo y una tabla de evidencias.

---

## 1. Diagnóstico confirmado leyendo el código

### 1.1 Cualquiera puede iniciar y cerrar una AC del QE

- **Frontend.** En `shc-controldoc/src/features/quality-events/components/QEACSection.tsx:928–947`, los botones "Iniciar" (`ac.estado === 'PENDIENTE'`) y "Cerrar" (`ac.estado === 'EN_EJECUCION'`) solo dependen de `!readOnly`. **No** comparan con `ac.responsableId`. "Solicitar ajuste de plazo" sí lo hace (línea 871).
- **Backend.** `PATCH /api/quality-events/{id}/acciones-correctivas/{acId}/status` (`CambiarEstadoAccionCorrectivaQEEndpoint.cs:11–12`) solo tiene `.RequireAuthorization()`. `CambiarEstadoAccionCorrectivaQEHandler` valida la empresa y que la AC exista, pero **no** valida quién actúa: cualquier usuario autenticado de la empresa puede iniciar o cerrar cualquier AC.
- **PRD §2.2 / NC-AC-004.**
  - El responsable de ejecución recibe la AC y la ejecuta.
  - "Verificado por: … **El Jefe Calidad es quien cierra la AC con la evidencia**."
  - Para cerrar, la evidencia es obligatoria.

### 1.2 La evidencia es solo texto

- `CambiarEstadoAccionCorrectivaQECommand(Estado, DescripcionEvidencia, EvidenciaUrl)` y `schemas/cerrarQEAccion.schema.ts`: la descripción tiene `min(1)` y `evidenciaUrl` es un string opcional, sin archivo.
- **PRD §2.2.** La "Evidencia de cierre" es un **archivo adjunto (PDF, imagen o video)**, obligatorio para cerrar, de 50 MB como máximo, en los tipos PDF, JPG, PNG y MP4. La "Descripción de la evidencia" tiene de 50 a 300 caracteres.
- **Infraestructura que ya existe:**
  - `Features/Incidentes/Shared/IncidenteEvidenciaStorageService.cs` (`GuardarAsync(empresaId, IFormFile)` y `ResolveDiskPath`);
  - el almacenamiento privado de `proteccion-documental` (RN-DOC-031);
  - la validación de la firma real del archivo de `original-pdf-tipos-permitidos`.

### 1.3 Estados

- `QEAccionCorrectivaEstado` tiene `PENDIENTE`, `EN_EJECUCION` y `CERRADA`.
- Las AC de NC (`NCAccionCorrectivaEstado`) y de incidente (`AccionCorrectivaEstado`) **ya tienen `COMPLETADA`**.

---

## 2. Decisiones de Toño

- **D1, dos pasos como el PRD:**
  1. El **responsable** inicia la AC (`PENDIENTE → EN_EJECUCION`), la ejecuta y la marca como **ejecutada** con su evidencia (`EN_EJECUCION → COMPLETADA`, "Pendiente de verificación").
  2. El **JCA verifica**: la **cierra** (`COMPLETADA → CERRADA`) o la **devuelve** a `EN_EJECUCION` con un comentario obligatorio.
- **D2, archivo obligatorio:**
  - de 1 a 5 archivos de tipo PDF, JPG, PNG, MP4, DOCX o XLSX, de hasta 50 MB cada uno, en almacenamiento privado;
  - una descripción de 50 a 300 caracteres;
  - en el celular, la cámara se puede usar directamente;
  - **se quita el campo URL**.

---

## 3. Qué implementar

### 3.1 Backend (`ShcMvpEndPoint/`)

**a) Estado y migración**

- Agregar `COMPLETADA` a `QEAccionCorrectivaEstado`, entre `EN_EJECUCION` y `CERRADA`. Así queda alineado con NC e incidentes.
- Agregar a `AccionCorrectivaQE`:
  - `EjecutadaEn` (DateTime?);
  - `EjecutadaPorId` (Guid?);
  - `VerificadaEn` (DateTime?);
  - `VerificadaPorId` (Guid?), que es el "Verificado por" del PRD;
  - `MotivoDevolucion` (string?), el último motivo.
- Nueva entidad `EvidenciaAccionCorrectivaQE`, tabla `evidencias_ac_qe`, con:
  - `Id`, `AccionCorrectivaId` (FK), `EmpresaId`;
  - `NombreArchivo`, `ClaveAlmacenamiento`, `ContentType`, `TamanioBytes`;
  - `SubidoPorId`, `SubidoEn`.
- Migración `AcEjecucionVerificacionEvidencias`:
  - la columna del enum, si se guarda como texto, no necesita cambios;
  - columnas nuevas y tabla nueva;
  - **datos:** las AC `CERRADA` existentes quedan como están. Su `EvidenciaUrl` se conserva **solo para lectura**, como evidencia histórica.
  - **No** borrar la columna `evidencia_url`: queda en desuso para las nuevas.

**b) Almacenamiento**

- Crear `AccionCorrectivaEvidenciaStorageService` reutilizando el patrón de `IncidenteEvidenciaStorageService`. Si conviene, generalizar ese servicio y anotarlo en `design.md`.
- Los archivos van en almacenamiento privado, nunca en `wwwroot` (RN-DOC-031).
- **Validación:**
  - extensión y **firma real** del archivo, con el mismo enfoque que `original-pdf-tipos-permitidos`. Firmas esperadas:
    - PDF: `%PDF-`;
    - JPG: `FF D8 FF`;
    - PNG: `89 50 4E 47`;
    - MP4: `ftyp` en el offset 4;
    - DOCX/XLSX: contenedor ZIP;
  - 50 MB como máximo por archivo y 5 archivos como máximo por AC;
  - si no se cumple, 400 con un mensaje claro.
- Revisar que el límite de tamaño del request de Kestrel/IIS permita 50 MB en este endpoint (`RequestSizeLimit`).

**c) Endpoints nuevos** (slices en `Features/QualityEvents/`)

Todos validan que el QE sea de la empresa de la sesión (otra empresa → 404) y que la AC pertenezca al QE.

| Endpoint | Quién | Estado requerido | Efecto |
|---|---|---|---|
| `POST …/acciones-correctivas/{acId}/iniciar` | **Solo el responsable** (`actorId == ac.ResponsableId`) | PENDIENTE | → EN_EJECUCION. Audit `AC_INICIADA` |
| `POST …/acciones-correctivas/{acId}/evidencias` (multipart, 1 archivo por request) | Solo el responsable | EN_EJECUCION | Guarda el archivo y devuelve `{ id, nombreArchivo, contentType, tamanioBytes }`. Si ya hay 5, 422 |
| `DELETE …/acciones-correctivas/{acId}/evidencias/{evId}` | Solo el responsable | EN_EJECUCION | Borra la evidencia del almacenamiento y de la base |
| `GET …/acciones-correctivas/{acId}/evidencias/{evId}/archivo` | Cualquier usuario con lectura del QE | cualquiera | Sirve el archivo autenticado, con `Content-Disposition` y el nombre real (patrón de `fix-descarga-archivos-nombre`) |
| `POST …/acciones-correctivas/{acId}/ejecutar`, body `{ descripcionEvidencia }` (50 a 300 caracteres) | Solo el responsable | EN_EJECUCION y **al menos 1 evidencia** | → COMPLETADA. Guarda `EjecutadaEn`, `EjecutadaPorId` y la descripción. Audit `AC_EJECUTADA`. Notifica a los JCA activos: "La AC {desc} del {QE} está lista para verificación" |
| `POST …/acciones-correctivas/{acId}/verificar`, body `{ aprobada: bool, comentario?: string }` | **Solo el JCA** (rol global) | COMPLETADA | Si `aprobada`: → CERRADA, con `VerificadaEn`, `VerificadaPorId` y audit `AC_VERIFICADA_CERRADA`. Si no: comentario obligatorio de 20 a 500 caracteres, → EN_EJECUCION, `MotivoDevolucion` y audit `AC_DEVUELTA`, y se notifica al responsable con el motivo |

- Si quien actúa no tiene permiso, la respuesta es **403** con un código claro: `SOLO_RESPONSABLE_AC` o `SOLO_JCA_VERIFICA`.
- **Cuando el JCA es el responsable:** si `ac.ResponsableId` es un JCA, puede ejecutar **y** verificar su propia AC. Sin segregación, porque el PRD no la pide para las AC; anotarlo en `design.md` como decisión. Si Toño quiere segregación, se cambia en la verificación (`actorId != EjecutadaPorId`).
- **PENDIENTE_CIERRE del QE:** la regla actual de `CambiarEstadoAccionCorrectivaQEHandler:63–65` (todas las AC `CERRADA` con evidencia y QE en EN_EJECUCION → PENDIENTE_CIERRE) se mueve al endpoint `verificar` cuando aprueba. "Con evidencia" pasa a significar "con descripción **y** al menos 1 archivo"; las AC históricas con `EvidenciaUrl` cuentan como evidencia. Mantener la sincronización del incidente (`IncidenteQeSync`) y la notificación de "listo para cierre".
- **Endpoint viejo `PATCH …/status`:**
  - dejar de aceptar `CERRADA` (422 `USAR_FLUJO_VERIFICACION`);
  - restringir `EN_EJECUCION` al responsable, o retirarlo si el frontend deja de usarlo;
  - buscar con grep a los consumidores y anotar en `design.md` lo que se haga.
- **Lectura:** las AC devuelven:
  - `estado`, `ejecutadaEn`, `ejecutadaPorNombre`, `verificadaEn`, `verificadaPorNombre` y `motivoDevolucion`;
  - `evidencias: [{ id, nombreArchivo, contentType, tamanioBytes, subidoEn }]`;
  - `evidenciaUrl` **solo** si hay un valor histórico.
  
  Usar nombres, nunca ids, con el patrón `[NotMapped]` + `JOIN`.

**d) NC e incidentes:** sus AC no tienen UI de creación ni de cierre en el frontend, pero sus endpoints existen. Revisar `Features/NoConformidades/CerrarAccionCorrectiva/` y `Features/Incidentes/CerrarAccionCorrectiva/`, y como mínimo validar que **solo el JCA cierra** y que se exige evidencia. Anotar en `design.md` lo que quede pendiente para cuando se construya su UI.

**e) Dashboard y pendientes**

- KPI-08 (AC vencidas) y `EsAcVencida`: una AC en **COMPLETADA** **no** cuenta como vencida, porque ya fue ejecutada y espera verificación. Documentar la decisión.
- Revisar el KPI-05 (eficacia de AC) y cualquier filtro por `CERRADA` o `EN_EJECUCION` en `DashboardKpiCalculator` y `DashboardSummaryBuilder` para considerar el estado nuevo.

### 3.2 Frontend (`shc-controldoc/src/features/quality-events/`)

**a) Botones por rol** (`components/QEACSection.tsx`)

| Estado | Responsable | JCA (no responsable) | Otros |
|---|---|---|---|
| PENDIENTE | "Iniciar" | — | — |
| EN_EJECUCION | "Marcar como ejecutada" (abre el modal de evidencia) | — | — |
| COMPLETADA | Badge "Pendiente de verificación" | "Verificar" (abre el modal de verificación) | Badge |
| CERRADA | "Verificada por {nombre}, {fecha}" | igual | igual |

- Si el JCA también es el responsable, ve los botones de las dos columnas según el estado.
- Si hay `motivoDevolucion` y el estado es EN_EJECUCION, mostrar un aviso ámbar: "Devuelta por {JCA}: {motivo}".

**b) Modal "Marcar como ejecutada"** (reemplaza el modal de cierre actual)

- **Zona de carga:**
  - con arrastrar y soltar, y con el botón "Elegir archivos";
  - con `accept=".pdf,.jpg,.jpeg,.png,.mp4,.docx,.xlsx"` y además `capture="environment"` en un segundo botón "Tomar foto", visible solo en móvil (`pointer: coarse`);
  - cada archivo se sube **al seleccionarlo**, con barra de progreso y botón ✕ para quitarlo (llama al `DELETE`);
  - en el cliente se valida el tamaño (50 MB) y el máximo de 5;
  - las imágenes muestran miniatura y los demás tipos un ícono por tipo.
- **Descripción:** textarea con contador de 50 a 300 caracteres.
- **"Confirmar ejecución":** se habilita con al menos 1 archivo subido y la descripción válida.
- **Quitar** el campo URL y su clave i18n.

**c) Modal "Verificar AC"** (solo el JCA)

- Muestra la descripción de la evidencia y la **lista de archivos**. Al hacer clic se abren en una pestaña nueva con el blob autenticado (usar el patrón de `usePlanoBlob` / `useEvidenciaBlob` de incidentes). Las imágenes van en miniatura.
- Botones:
  - **"Aprobar y cerrar"**;
  - **"Devolver"**, que exige un comentario de 20 a 500 caracteres y vuelve la AC a EN_EJECUCION.

**d) Lista de AC:** las CERRADAS muestran "Verificada por {nombre} · {fecha}" y un enlace "Ver evidencias ({n})". Las históricas con URL muestran el enlace tal cual.

**e) Pendientes del dashboard** (`features/dashboard/utils/accionesRequeridas.utils.ts`)

- **El responsable:** `AC_EJECUTAR` con la AC en PENDIENTE o EN_EJECUCION (hoy `acPendienteSinEvidencia`; ajustar la condición al flujo nuevo).
- **El JCA:** nuevo `AC_VERIFICAR` ("Verificar acción correctiva") para las AC de QE en COMPLETADA. Agregarlo al conjunto de la tarjeta "Aprobaciones y cierres pendientes" de `dashboard-alertas-coherentes`, para que el número y la lista sigan coincidiendo.
- Invalidar el dashboard (`['dashboard']`) y la lista de QE en `onSuccess` de iniciar, ejecutar y verificar.

**f) i18n (`qualityEvents`, es-PE y en-US)**

| Clave | es-PE | en-US |
|---|---|---|
| `detail.acSection.actions.marcarEjecutada` | Marcar como ejecutada | Mark as done |
| `detail.acSection.actions.verificar` | Verificar | Verify |
| `detail.acSection.estado.COMPLETADA` | Pendiente de verificación | Pending verification |
| `detail.acSection.evidencias.titulo` | Evidencias | Evidence |
| `detail.acSection.evidencias.elegir` | Elegir archivos | Choose files |
| `detail.acSection.evidencias.tomarFoto` | Tomar foto | Take photo |
| `detail.acSection.evidencias.ayuda` | PDF, JPG, PNG, MP4, DOCX o XLSX · máx. 50 MB · hasta 5 archivos | PDF, JPG, PNG, MP4, DOCX or XLSX · max 50 MB · up to 5 files |
| `detail.acSection.evidencias.descripcion` | Describe qué demuestra la evidencia (50–300 caracteres) | Describe what the evidence shows (50–300 characters) |
| `detail.acSection.verificar.aprobar` | Aprobar y cerrar | Approve and close |
| `detail.acSection.verificar.devolver` | Devolver | Return |
| `detail.acSection.verificar.motivo` | Motivo de la devolución | Reason for return |
| `detail.acSection.devuelta` | Devuelta por {{nombre}}: {{motivo}} | Returned by {{nombre}}: {{motivo}} |
| `detail.acSection.verificadaPor` | Verificada por {{nombre}} · {{fecha}} | Verified by {{nombre}} · {{fecha}} |
| `errors.SOLO_RESPONSABLE_AC` | Solo el responsable asignado puede realizar esta acción. | Only the assigned owner can do this. |
| `errors.SOLO_JCA_VERIFICA` | Solo el Jefe de Calidad puede verificar y cerrar la acción. | Only the Quality Manager can verify and close the action. |
| `dashboard:accionesRequeridas.tipo.AC_VERIFICAR` | Verificar acción correctiva | Verify corrective action |

Agregar también las etiquetas del audit trail (`AC_INICIADA`, `AC_EJECUTADA`, `AC_VERIFICADA_CERRADA` y `AC_DEVUELTA`).

### 3.3 MSW

- Implementar los endpoints nuevos en memoria, con la subida multipart simulada y con los 403 por rol o responsable.
- `PATCH …/status` con `CERRADA` responde 422.
- Los fixtures incluyen AC en COMPLETADA con evidencias, y una AC CERRADA histórica con `evidenciaUrl`.

---

## 4. Tests

**Backend**
- **Permisos:**
  - iniciar: un usuario que no es el responsable → 403 `SOLO_RESPONSABLE_AC`;
  - subir evidencia: otro usuario → 403;
  - ejecutar: otro usuario → 403;
  - verificar: un SUPERVISOR → 403 `SOLO_JCA_VERIFICA`;
  - otra empresa → 404.
- **Flujo completo:**
  1. el responsable inicia, sube 2 archivos y ejecuta → COMPLETADA, y los JCA reciben el aviso;
  2. el JCA devuelve con un motivo → EN_EJECUCION y aviso al responsable;
  3. el responsable vuelve a ejecutar y el JCA aprueba → CERRADA con verificador.
  
  Si era la última AC, el QE pasa a PENDIENTE_CIERRE y el incidente se sincroniza.
- **Evidencias:**
  - un `.exe` renombrado a `.pdf` → 400;
  - un archivo de 51 MB → 400;
  - un sexto archivo → 422;
  - ejecutar sin archivos → 422;
  - una descripción de 49 caracteres → 400.
- Descargar una evidencia sin sesión falla; con sesión de la misma empresa funciona y llega con el nombre real.
- `PATCH /status` con `CERRADA` → 422.
- Una AC histórica CERRADA con `EvidenciaUrl` cuenta como "con evidencia" para PENDIENTE_CIERRE.
- KPI-08 no cuenta las AC en COMPLETADA.

**Frontend**
- Los botones según el rol y el estado coinciden con la tabla de §3.2a, incluido el caso del JCA que es responsable.
- Modal de ejecución:
  - "Confirmar" está deshabilitado sin archivos o con una descripción corta;
  - subir y quitar archivos actualiza la lista;
  - un archivo de más de 50 MB se rechaza en el cliente.
- Modal de verificación: "Devolver" exige el motivo; "Aprobar" cierra la AC.
- Dashboard: el JCA ve `AC_VERIFICAR` y lo cuenta la tarjeta de aprobaciones.

---

## 5. Reglas de siempre

- Toda divergencia entre esta instrucción y el código real va en `design.md`, con su motivo.
- Correr la **suite completa** (frontend y backend) + `tsc --noEmit` + **`npm run lint` con cero errores**.
- Antes de la prueba manual: **detener el backend → `dotnet ef database update`** (hay migración) **→ `dotnet build`** → `dotnet run` → Ctrl+F5. Si un endpoint nuevo responde 404, cerrar el `ShcMvpEndPoint.exe` que quedó colgado.
- **Prueba manual con MSW apagado:**
  1. Como JCA, crear una AC Correctiva asignada a un OPERARIO. El JCA **no** ve "Iniciar" ni "Marcar como ejecutada".
  2. Como el OPERARIO (de ser posible, desde el celular): ver la AC en sus pendientes e iniciarla. En "Marcar como ejecutada", tomar una foto con la cámara y subir un PDF. Escribir la descripción y confirmar. La AC queda en "Pendiente de verificación".
  3. Como JCA: llega el aviso y aparece "Verificar acción correctiva" en los pendientes y en la tarjeta. Abrir las evidencias: la foto y el PDF se ven. Devolver con un motivo.
  4. Como el OPERARIO: aparece el aviso ámbar con el motivo. Agregar otro archivo y volver a ejecutar.
  5. Como JCA, aprobar y cerrar: se ve "Verificada por {JCA}". Si era la última AC, el QE pasa a PENDIENTE_CIERRE y llega el aviso de "listo para cierre".
  6. Intentar subir un `.exe` renombrado y un archivo de más de 50 MB: los dos se rechazan con un mensaje claro.
  7. Una AC antigua cerrada con URL sigue mostrando su enlace.
- Toño avisa con **"listo"** para que Cowork verifique.
