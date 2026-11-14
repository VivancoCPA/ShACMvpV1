## 1. Backend — modelo y migración

- [x] 1.1 Agregar `COMPLETADA` a `QEAccionCorrectivaEstado` (entre `EN_EJECUCION` y `CERRADA`).
- [x] 1.2 Agregar a `AccionCorrectivaQE`:
  - `EjecutadaEn`, `EjecutadaPorId`, `VerificadaEn`, `VerificadaPorId` y `MotivoDevolucion`;
  - `[NotMapped]`: `EjecutadaPorNombre`, `VerificadaPorNombre` y `Evidencias`.
- [x] 1.3 Crear la entidad `EvidenciaAccionCorrectivaQE` (tabla `evidencias_ac_qe`), con su DbSet y su configuración (FK con cascade e índice). `ClaveAlmacenamiento` y `EmpresaId` van con `[JsonIgnore]`.
- [x] 1.4 Crear la migración `AcEjecucionVerificacionEvidencias`, sin cambios de datos.

## 2. Backend — almacenamiento y validación

- [x] 2.1 `EvidenciaAcFormatos`: extensión, firma real, tamaño (50 MB) y `ContentType` derivado de la extensión.
- [x] 2.2 `AccionCorrectivaEvidenciaStorageService` (`GuardarAsync`, `Eliminar` y `ResolveDiskPath`) en la raíz privada; registrarlo en DI.

## 3. Backend — endpoints

- [x] 3.1 `AccionCorrectivaQEAcceso`, helper compartido que:
  - carga el QE y la AC con aislamiento por empresa (404);
  - exige que el actor sea el responsable (`SOLO_RESPONSABLE_AC`) o el JCA (`SOLO_JCA_VERIFICA`);
  - escribe la entrada de audit trail.
- [x] 3.2 Slice `IniciarAccionCorrectivaQE` (`POST …/iniciar`).
- [x] 3.3 Slice `EvidenciasAccionCorrectivaQE`: subir (multipart, `RequestSizeLimit` de 55 MB, máximo 5), eliminar y descargar.
- [x] 3.4 Slice `EjecutarAccionCorrectivaQE`: validador de la descripción (50 a 300 caracteres), al menos 1 evidencia → `COMPLETADA`, y aviso a los JCA.
- [x] 3.5 Slice `VerificarAccionCorrectivaQE`:
  - si aprueba → `CERRADA`, con la transición del QE a `PENDIENTE_CIERRE`, la sincronización del incidente y el aviso de "listo para cierre";
  - si devuelve → `EN_EJECUCION`, con `MotivoDevolucion` y aviso al responsable.
- [x] 3.6 `CambiarEstadoAccionCorrectivaQE`:
  - `CERRADA`, `COMPLETADA` o `PENDIENTE` → 422 `USAR_FLUJO_VERIFICACION`;
  - `EN_EJECUCION` → la misma lógica que iniciar.
- [x] 3.7 Notificaciones nuevas en `IQualityEventNotificationSender`: `NotificarAcListaParaVerificacionAsync` y `NotificarAcDevueltaAsync`.
- [x] 3.8 Mapear los endpoints en `EndpointExtensions` y registrar los handlers.

## 4. Backend — lecturas, dashboard, NC e incidentes

- [x] 4.1 `AccionCorrectivaQELoader`, que carga las AC con nombres, solicitudes y, opcionalmente, evidencias. Usarlo en el detalle de QE, en `GET …/acciones-correctivas` y en el listado de QE.
- [x] 4.2 `VencimientoScanner` excluye las AC de QE en `COMPLETADA`. Confirmar que `EsAcVencida` y KPI-05 no necesitan cambios.
- [x] 4.3 `…/cerrar` de NC e incidente: si el actor no es JCA → 403 `SOLO_JCA_VERIFICA`.

## 5. Backend — tests

- [x] 5.1 Permisos:
  - iniciar, subir evidencia y ejecutar con un usuario que no es el responsable → 403;
  - verificar con un SUPERVISOR → 403;
  - otra empresa → 404.
- [x] 5.2 Flujo completo: iniciar → 2 archivos → ejecutar (aviso a los JCA) → devolver (aviso al responsable) → re-ejecutar → aprobar. El QE pasa a `PENDIENTE_CIERRE` y el incidente se sincroniza.
- [x] 5.3 Evidencias:
  - un `.exe` renombrado → 400;
  - un archivo de 51 MB → 400;
  - un sexto archivo → 422;
  - ejecutar sin archivos → 422;
  - una descripción de 49 caracteres → 400.
- [x] 5.4 Descarga sin sesión → 401; con sesión → 200 y el nombre real.
- [x] 5.5 `PATCH /status` con `CERRADA` → 422. Una AC histórica con `EvidenciaUrl` cuenta para `PENDIENTE_CIERRE`. KPI-08 no cuenta las `COMPLETADA`. Un operario no puede cerrar una AC de NC.
- [x] 5.6 Reescribir los tests existentes que cerraban por `PATCH /status` (`QualityEventsAccionesCorrectivasEndpointTests` e `IncidenteQeSyncTests`).

## 6. Frontend — tipos, API y hooks

- [x] 6.1 `AccionCorrectivaQE`: agregar el estado `COMPLETADA`, los campos de ejecución y verificación, y `evidencias: EvidenciaACQE[]`.
- [x] 6.2 API: `iniciarQEAccion`, `subirEvidenciaAC` (con progreso), `eliminarEvidenciaAC`, `getEvidenciaACBlob`, `ejecutarQEAccion` y `verificarQEAccion`. Eliminar `cerrarQEAccion`, `useCerrarQEAccion` y `cerrarQEAccion.schema.ts`.
- [x] 6.3 Hooks de mutación con invalidación del detalle del QE, la lista de QE y el dashboard (además de incidentes y NC al verificar).
- [x] 6.4 Schemas Zod: `ejecutarQEAccion.schema.ts` (50 a 300 caracteres) y `verificarQEAccion.schema.ts` (motivo de 20 a 500 caracteres al devolver).

## 7. Frontend — UI

- [x] 7.1 `EjecutarQEACModal`: zona de carga, "Tomar foto" en dispositivos táctiles, subida inmediata con progreso, ✕, validación en el cliente, miniaturas y contador.
- [x] 7.2 `VerificarQEACModal`: descripción, archivos que se abren como blob, "Aprobar y cerrar" y "Devolver" con motivo.
- [x] 7.3 `QEACSection`: botones por rol y estado (tabla del spec), aviso de devolución, "Verificada por", "Ver evidencias ({n})" y el enlace histórico.
- [x] 7.4 `ACSection` (NC) e `IncidentACSection`: el botón "Cerrar" se muestra solo al JCA.
- [x] 7.5 Dashboard: ajustar `AC_EJECUTAR` para las AC de QE y agregar el nuevo `AC_VERIFICAR`, en los tipos, en `TIPOS_APROBACIONES` y en i18n.
- [x] 7.6 i18n en es-PE y en-US: claves de `qualityEvents` (acSection, errores) y del audit trail; quitar las claves de URL de evidencia.

## 8. MSW

- [x] 8.1 Handlers en memoria para iniciar, evidencias (subir, borrar y archivo), ejecutar y verificar, con los 403, 400 y 422; `PATCH /status` responde 422 a `CERRADA`.
- [x] 8.2 Fixtures: una AC `COMPLETADA` con evidencias y una AC `CERRADA` histórica con `evidenciaUrl`; `evidencias: []` en el resto.

## 9. Frontend — tests y verificación

- [x] 9.1 `QEACSection.test.tsx`: botones por rol y estado (incluido el JCA que es responsable).
- [x] 9.2 Tests de los modales:
  - ejecución: "Confirmar" deshabilitado, subir y quitar un archivo, rechazo de archivos de más de 50 MB;
  - verificación: "Devolver" exige motivo, "Aprobar" cierra.
- [x] 9.3 Tests de `accionesRequeridas`: `AC_VERIFICAR` para el JCA y la tarjeta de aprobaciones.
- [x] 9.4 Tests de los handlers MSW del flujo nuevo.
- [ ] 9.5 Suite completa del frontend y del backend, `tsc --noEmit` y `npm run lint` con cero errores.
- [ ] 9.6 Prueba manual con MSW apagado: pasos 1 a 7 de las instrucciones (a cargo de Toño).
