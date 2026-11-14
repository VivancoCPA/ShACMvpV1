## Why

Toño observó dos problemas en las acciones correctivas (AC) de un QE:

1. Quien crea una AC asignada a otro usuario igual puede iniciarla y cerrarla. En el frontend, los botones "Iniciar" y "Cerrar" de `QEACSection` solo dependen de `!readOnly`. En el backend, `PATCH …/acciones-correctivas/{acId}/status` no valida quién actúa.
2. Al cerrar una AC, la evidencia es solo texto y una URL opcional. No se pueden subir fotos ni documentos.

El PRD §2.2 y NC-AC-004 definen otro flujo:

- el responsable ejecuta la AC y adjunta la evidencia: un archivo PDF, imagen o video de hasta 50 MB, con una descripción de 50 a 300 caracteres;
- el Jefe de Calidad la verifica y la cierra ("Verificado por").

## What Changes

- **Estado nuevo `COMPLETADA`** ("Pendiente de verificación") en `QEAccionCorrectivaEstado`, entre `EN_EJECUCION` y `CERRADA`. Queda alineado con las AC de NC e incidentes.
- **Flujo en dos pasos:**
  - el **responsable** inicia la AC (`PENDIENTE → EN_EJECUCION`), sube sus evidencias y la marca como ejecutada (`EN_EJECUCION → COMPLETADA`);
  - el **JCA** la verifica: la cierra (`COMPLETADA → CERRADA`) o la devuelve a `EN_EJECUCION` con un motivo obligatorio.
- **Evidencias como archivos:**
  - nueva entidad `EvidenciaAccionCorrectivaQE` (tabla `evidencias_ac_qe`) en almacenamiento privado;
  - de 1 a 5 archivos de tipo PDF, JPG, PNG, MP4, DOCX o XLSX, de hasta 50 MB cada uno;
  - se valida la extensión y la **firma real** del archivo.
- **Endpoints nuevos:**
  - `POST …/iniciar`;
  - `POST …/evidencias`, `DELETE …/evidencias/{evId}` y `GET …/evidencias/{evId}/archivo`;
  - `POST …/ejecutar` y `POST …/verificar`.
  
  Si quien actúa no tiene permiso, la respuesta es 403 con el código `SOLO_RESPONSABLE_AC` o `SOLO_JCA_VERIFICA`.
- **BREAKING:** `PATCH …/acciones-correctivas/{acId}/status` deja de cerrar ACs (422 `USAR_FLUJO_VERIFICACION`) y solo acepta `EN_EJECUCION` del responsable.
- **Paso a `PENDIENTE_CIERRE`:** la transición automática del QE se mueve a la verificación aprobada. "Con evidencia" pasa a significar "descripción y al menos un archivo"; la `evidenciaUrl` histórica también cuenta.
- **Lecturas:** las AC devuelven `ejecutadaEn`, `ejecutadaPorNombre`, `verificadaEn`, `verificadaPorNombre`, `motivoDevolucion` y `evidencias[]`. El listado de QE también incluye sus AC, para los pendientes del dashboard.
- **Frontend:**
  - botones según el rol y el responsable;
  - modal "Marcar como ejecutada" con carga de archivos (y cámara en el celular) en lugar del campo URL;
  - modal "Verificar AC" para el JCA;
  - aviso ámbar si la AC fue devuelta y "Verificada por" cuando está cerrada.
- **Dashboard:**
  - `AC_EJECUTAR` se muestra para las AC en `PENDIENTE` o `EN_EJECUCION`;
  - nuevo `AC_VERIFICAR` para el JCA, contado en la tarjeta "Aprobaciones y cierres pendientes";
  - el escáner de vencimientos y KPI-08 ignoran las AC en `COMPLETADA`.
- **NC e incidentes:** solo el JCA puede cerrar sus AC (403 `SOLO_JCA_VERIFICA`), y el botón "Cerrar" de su UI se oculta a los demás roles.
- **MSW:** replica todo el flujo en memoria.

## Capabilities

### New Capabilities
- `ac-ejecucion-verificacion`: flujo de ejecución por el responsable y verificación por el JCA de las AC de QE, evidencias de archivo (almacenamiento, validación, descarga), permisos, notificaciones y migración.

### Modified Capabilities
- `quality-event-ac-section`: botones por rol y estado, modales de ejecución y verificación, y endpoints MSW (el cierre ya no pasa por `PATCH /status`).
- `dashboard-acciones-requeridas`: condición de `AC_EJECUTAR` y nuevo ítem `AC_VERIFICAR` del JCA.

## Impact

- **Backend:**
  - `Domain/Entities/AccionCorrectivaQE.cs`, el enum `QEAccionCorrectivaEstado` y la nueva `EvidenciaAccionCorrectivaQE`;
  - migración `AcEjecucionVerificacionEvidencias`;
  - los nuevos slices en `Features/QualityEvents/` y `CambiarEstadoAccionCorrectivaQE`;
  - las lecturas de AC (detalle, listado de AC y listado de QE);
  - `VencimientoScanner`, `IQualityEventNotificationSender` y el cierre de AC de NC e incidentes.
- **Frontend:**
  - `QEACSection.tsx`, los hooks y la API de AC del QE, y los tipos;
  - `accionesRequeridas.utils.ts` y `JefeCalidadDashboard.tsx`;
  - `ACSection.tsx` (NC) e `IncidentACSection.tsx`;
  - i18n de `qualityEvents`, `dashboard` y el audit trail.
- **MSW:** `quality-events.handlers.ts` y los fixtures de QE.
- **Datos:** las AC `CERRADA` existentes quedan igual y su `evidencia_url` se conserva solo para lectura. La columna no se elimina.
