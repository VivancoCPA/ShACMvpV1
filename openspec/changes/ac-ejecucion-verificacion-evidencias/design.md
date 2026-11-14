## Context

Hoy una AC de QE tiene 3 estados (`PENDIENTE`, `EN_EJECUCION`, `CERRADA`) y una sola vía de cambio: `PATCH /api/quality-events/{id}/acciones-correctivas/{acId}/status`. Esa vía no comprueba quién actúa, y la evidencia es solo texto más una URL opcional.

El PRD §2.2 / NC-AC-004 pide dos cosas: que el responsable ejecute la AC con una evidencia de archivo y que el Jefe de Calidad la verifique y la cierre.

Infraestructura que se reutiliza:

- el almacenamiento privado `FileStorageRoot` (RN-DOC-031, `proteccion-documental`);
- el patrón de `IncidenteEvidenciaStorageService`;
- la validación por firma binaria de `DocumentoFormatosPermitidos` (`original-pdf-tipos-permitidos`);
- la descarga con nombre real (`fix-descarga-archivos-nombre`);
- el patrón blob de `useEvidenciaBlob` (incidentes).

## Goals / Non-Goals

**Goals:**
- Solo el responsable inicia, sube evidencias y marca la AC como ejecutada; solo el JCA la verifica.
- La evidencia es de 1 a 5 archivos privados, validados por extensión, firma y tamaño.
- La transición automática del QE a `PENDIENTE_CIERRE`, la sincronización del incidente y el aviso de "listo para cierre" se mantienen; ahora ocurren al verificar.
- Mantener la paridad del flujo con MSW.

**Non-Goals:**
- El flujo de dos pasos para las AC de NC e incidentes, que solo reciben el bloqueo de "solo el JCA cierra" (D10).
- Segregación de funciones cuando el JCA es el responsable (D4).
- Antivirus o recompresión de video.

## Decisions

### D1 — `COMPLETADA` como estado nuevo, guardado como texto
`QEAccionCorrectivaEstado` agrega `COMPLETADA` entre `EN_EJECUCION` y `CERRADA`. La columna `estado` ya es `varchar(20)` con `HasConversion<string>()`, así que la migración no toca valores. Se eligió `COMPLETADA` en lugar de un nombre nuevo porque las AC de NC (`NCAccionCorrectivaEstado`) y de incidente (`AccionCorrectivaEstado`) ya lo usan, y `DashboardKpiCalculator.EsAcVencida` ya lo excluye.

### D2 — Entidad `EvidenciaAccionCorrectivaQE` y columnas de trazabilidad
- **Tabla `evidencias_ac_qe`:**
  - columnas `Id`, `AccionCorrectivaId` (FK con cascade), `EmpresaId`, `NombreArchivo`, `ClaveAlmacenamiento`, `ContentType`, `TamanioBytes`, `SubidoPorId` y `SubidoEn`;
  - un índice por `AccionCorrectivaId`;
  - `ClaveAlmacenamiento` y `EmpresaId` llevan `[JsonIgnore]`, porque nunca salen al cliente.
- **Columnas nuevas en `acciones_correctivas_qe`:** `ejecutada_en`, `ejecutada_por_id`, `verificada_en`, `verificada_por_id` y `motivo_devolucion`.
- **Columnas que se conservan:** `evidencia_url`, solo para lectura histórica, y `descripcion_evidencia`, que pasa a ser la descripción del paso "ejecutar".
- **Lectura sin ids:** `EjecutadaPorNombre`, `VerificadaPorNombre` y `Evidencias` son `[NotMapped]` en la entidad y se llenan con JOIN a `asp_net_users` en un único cargador, `AccionCorrectivaQELoader`. Lo usan el detalle de QE, `GET …/acciones-correctivas` y el listado de QE (D9). El frontend nunca resuelve los ids.

### D3 — Almacenamiento: servicio propio, no generalizado
`AccionCorrectivaEvidenciaStorageService` copia el patrón de `IncidenteEvidenciaStorageService`:

- usa la misma raíz privada `FileStorageRoot.Resolve`;
- guarda en `acciones-correctivas/{empresaId}/{acId}/{guid}.{ext}`;
- ofrece `GuardarAsync`, `Eliminar` y `ResolveDiskPath`.

**Por qué no se generaliza:** el servicio de incidentes mapea la extensión desde el `ContentType` declarado, y aquí se usa la extensión validada por firma. Generalizarlo habría obligado a tocar M7 (incidentes offline) sin necesidad.

### D4 — Permisos
- **"Responsable":** `actorId == ac.ResponsableId`.
- **"JCA":** el rol efectivo de la sesión (`GetRolEfectivo()`) es `JEFE_CALIDAD_SYST`, el mismo criterio que el resto de los gates de QE.
- **Respuestas:**
  - si el actor no tiene permiso, 403 con `SOLO_RESPONSABLE_AC` o `SOLO_JCA_VERIFICA` (`ForbiddenBusinessException`);
  - si el QE es de otra empresa, 404 uniforme.
- **Cuando el JCA es el responsable:** puede ejecutar y verificar su propia AC. El PRD no pide segregación para las AC. Si Toño la quiere, basta con agregar `actorId != accion.EjecutadaPorId` en `VerificarAccionCorrectivaQEHandler`.

### D5 — Validación de archivos
`EvidenciaAcFormatos.Validar(nombre, primerosBytes, tamanio)` comprueba la extensión permitida y la firma:

| Formato | Firma esperada |
|---|---|
| PDF | `%PDF-` |
| JPG / JPEG | `FF D8 FF` |
| PNG | `89 50 4E 47` |
| MP4 | `ftyp` en el offset 4 |
| DOCX / XLSX | `PK` (contenedor ZIP) |

- Un archivo de más de 50 MB o vacío → 400.
- Si ya hay 5 evidencias → 422 `MAX_EVIDENCIAS_AC`.
- El `ContentType` guardado se deriva de la extensión validada, nunca del que declara el cliente.
- El endpoint de subida lleva `RequestSizeLimit(55 MB)`, porque el límite por defecto de Kestrel (30 MB) no alcanza para 50 MB más el overhead multipart.
- **IIS:** si se despliega en IIS, hay que subir `maxAllowedContentLength` en `web.config`. Queda anotado para el despliegue; hoy se corre con Kestrel.

### D6 — Ciclo de vida de las evidencias
- **Subida inmediata:** las evidencias se suben al seleccionarlas y quedan asociadas a la AC mientras está en `EN_EJECUCION`; no hay un estado "borrador" aparte. El responsable puede subir y quitar archivos solo en `EN_EJECUCION`.
- **Ejecutar:** exige al menos 1 evidencia y una descripción de 50 a 300 caracteres (FluentValidation, 400).
- **Devolución:** las evidencias se conservan. El responsable puede agregar o quitar archivos, siempre con un máximo de 5, y vuelve a ejecutar.
- **Auditoría:** cada subida o borrado registra `AC_EVIDENCIA_AGREGADA` o `AC_EVIDENCIA_ELIMINADA` (regla 12). Además se agregan `AC_INICIADA`, `AC_EJECUTADA`, `AC_VERIFICADA_CERRADA` y `AC_DEVUELTA`.

### D7 — `PATCH …/status` heredado
Consumidores encontrados con grep:

- `updateQEAccion`, usado solo por "Iniciar" en `QEACSection`;
- `cerrarQEAccion`;
- los tests de integración (`QualityEventsAccionesCorrectivasEndpointTests` e `IncidenteQeSyncTests`).

Se toman estas decisiones:

- el frontend pasa a `POST /iniciar` y se eliminan `cerrarQEAccion` y `useCerrarQEAccion`;
- el endpoint sigue existiendo por compatibilidad, pero:
  - `CERRADA` o `COMPLETADA` → 422 `USAR_FLUJO_VERIFICACION`;
  - `EN_EJECUCION` delega en la misma lógica de `iniciar`, con el mismo permiso (solo el responsable, desde `PENDIENTE`);
  - `PENDIENTE` → 422 `USAR_FLUJO_VERIFICACION`.
- los tests que cerraban por esta vía se reescriben con el flujo nuevo.

### D8 — Transición del QE a `PENDIENTE_CIERRE`
La regla se mueve de `CambiarEstadoAccionCorrectivaQEHandler` a `VerificarAccionCorrectivaQEHandler`, en la rama `aprobada`. La condición es:

- todas las AC están `CERRADA`;
- cada una tiene `descripcionEvidencia` y, además, al menos un archivo o una `evidenciaUrl` histórica.

`CerrarQEHandler` y `TransicionarEstadoQEHandler` mantienen su chequeo (`CERRADA` y descripción): una AC solo llega a `CERRADA` por la verificación, que ya exige archivos, y las históricas cuentan como evidencia. Se mantienen `IncidenteQeSync` y `NotificarListoParaCierreAsync`.

### D9 — El listado de QE incluye sus AC
`useAccionesRequeridas` arma los pendientes de AC a partir de `qe.accionesCorrectivas` del listado de QE. Con el backend real, `ListarQualityEventsHandler` no cargaba las AC, así que los pendientes de AC de QE solo funcionaban con MSW.

Ahora el listado las carga con `AccionCorrectivaQELoader`, en una sola consulta con `ANY(@QeIds)` para la página. Las evidencias se cargan solo en el detalle y en `GET …/acciones-correctivas` (`incluirEvidencias`), para no inflar el listado.

### D10 — AC de NC e incidentes
Su UI existe: `ACSection` (NC) e `IncidentACSection` (incidentes) tienen un botón "Cerrar" con evidencia de texto. Se hace lo mínimo:

- los endpoints `…/cerrar` de NC e incidente responden 403 `SOLO_JCA_VERIFICA` si el actor no es JCA;
- la evidencia ya era obligatoria por su validador;
- el botón "Cerrar" de las dos UI se muestra solo al JCA.

**Pendiente** para cuando se rediseñen esas UI: el flujo responsable → `COMPLETADA` → JCA y las evidencias de archivo.

### D11 — Dashboard y vencimientos
- **KPI-08 / `EsAcVencida`:** ya excluía `COMPLETADA`. Se decide mantenerlo: una AC ejecutada que espera verificación no está vencida.
- **`VencimientoScanner`:** ahora también ignora las AC de QE en `COMPLETADA`, porque el responsable ya cumplió.
- **KPI-05:** cuenta solo las `CERRADA`, sin cambios, porque `COMPLETADA` aún no está verificada.
- **`DashboardSummaryBuilder.accionesCorrectivasPendientesArea`:** sigue contando `COMPLETADA` como pendiente, porque para el área la AC no está cerrada.

### D12 — Notificaciones
`IQualityEventNotificationSender` agrega dos métodos:

- **`NotificarAcListaParaVerificacionAsync`:** avisa a todos los JCA activos de la empresa, excluido el actor, con el mensaje "La AC {desc} del {QE} está lista para verificación". Tipo `CAMBIO_ESTADO`.
- **`NotificarAcDevueltaAsync`:** avisa al responsable con el motivo. Tipo `CAMBIO_ESTADO`.

Las dos van dentro de un try/catch con log, igual que las demás: un fallo del aviso no hace fallar la operación.

### D13 — Frontend
- **Hooks:** `useIniciarQEAccion`, `useSubirEvidenciaAC`, `useEliminarEvidenciaAC`, `useEjecutarQEAccion` y `useVerificarQEAccion`. Todos invalidan el detalle del QE, la lista de QE (`QE_QUERY_KEYS.all`) y el dashboard; ejecutar y verificar también invalidan incidentes y NC, como antes.
- **Subida:** `subirEvidenciaAC` usa `onUploadProgress` de axios para la barra de progreso.
- **Descarga:** `getEvidenciaACBlob` usa `responseType: 'blob'`. La vista previa de imágenes y el "abrir en pestaña" usan `URL.createObjectURL`, igual que `useEvidenciaBlob`.
- **Modales:** son componentes nuevos en `features/quality-events/components/`, `EjecutarQEACModal.tsx` y `VerificarQEACModal.tsx`, para no seguir engordando `QEACSection.tsx`.
- **Formularios:** RHF y Zod (`ejecutarQEAccion.schema.ts` y `verificarQEAccion.schema.ts`).
- **"Tomar foto":** se muestra solo si `matchMedia('(pointer: coarse)')` y usa `capture="environment"`.

## Divergencias con las instrucciones (registradas al implementar)

- **Clave i18n del estado:** la instrucción pedía `detail.acSection.estado.COMPLETADA`; los estados de AC ya viven en `detail.acSection.acStatus.*`, así que se agregó `acStatus.COMPLETADA` ("Pendiente de verificación") para no duplicar el mapa.
- **Aviso de devolución:** "Devuelta por {{nombre}}: {{motivo}}" pasó a "Devuelta por el Jefe de Calidad: {{motivo}}". La AC solo guarda el último motivo, no quién la devolvió (ese dato está en el audit trail `AC_DEVUELTA`); agregar `DevueltaPorId` no se justificaba para un texto.
- **NC:** `ACSection` ya mostraba "Cerrar" solo al JCA (`ncPermissions.canCerrarAC`); no requirió cambios de UI, solo el 403 del backend.
- **Incidentes:** `incidentPermissions` daba `canCerrarAC` también al SUPERVISOR; se dejó en `false` para alinearlo con el 403 del backend.
- **Cierre por PATCH de NC/incidente:** además de `…/cerrar`, los `PATCH` genéricos de AC de NC e incidente aceptaban `estado: CERRADA`; también exigen JCA cuando el estado pedido es `CERRADA`, para que no quede una vía lateral.
- **Audit de evidencias:** se agregaron `AC_EVIDENCIA_AGREGADA`/`AC_EVIDENCIA_ELIMINADA` (regla 12, toda mutación se audita) además de las cuatro acciones pedidas.
- **`DeadlineBadge`:** `COMPLETADA` se trata como estado cerrado (no se pinta como vencida), coherente con `EsAcVencida`.
- **MSW en Node:** el nombre de archivo llega como `blob` tras el multipart en tests; el handler cae al MIME declarado (mismo criterio que `validateArchivoOriginalFormato` de documentos). En el navegador la extensión sí llega. El mock no valida la firma binaria (sí el backend).
- **Fixture:** se agregó `ac-qe-005-3` (COMPLETADA, 2 evidencias) a `qe-2026-005`; las AC CERRADA históricas con `evidenciaUrl` ya existían.

## Risks / Trade-offs

- **Videos de 50 MB en conexiones móviles lentas.** Mitigación: barra de progreso y subida por archivo; si una subida falla, solo se reintenta ese archivo.
- **Archivos huérfanos en disco** si el borrado del archivo falla después de borrar la fila. Se acepta: el borrado en disco es best-effort, con log.
- **AC `EN_EJECUCION` heredadas con descripción y sin archivos.** Para ejecutarlas se necesita al menos un archivo, que es lo que se busca.
- **Quitar el cierre por `PATCH /status` rompe clientes viejos.** Mitigación: hay un solo cliente, que se actualiza en este mismo cambio.

## Migration Plan

1. Migración `AcEjecucionVerificacionEvidencias`: crea las columnas y la tabla nuevas, sin tocar datos.
2. Detener el backend, correr `dotnet ef database update`, luego `dotnet build` y `dotnet run`.
3. Rollback: revertir la migración. Las AC en `COMPLETADA` tendrían que volver antes a `EN_EJECUCION` a mano.
