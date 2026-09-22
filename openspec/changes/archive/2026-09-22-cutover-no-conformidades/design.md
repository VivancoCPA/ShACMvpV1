## Context

`ShcMvpEndPoint` ya tiene No Conformidades (M2) implementado (`be-no-conformidades-api`, archivado como `2026-08-22-be-no-conformidades`): CRUD, anulación, acciones correctivas, vinculación con Quality Event (`qeGeneradoId`) y con Documentos, multi-tenancy. A diferencia de Incidentes/Documentos, esta investigación (repetida y verificada en esta sesión, no solo heredada) no encontró ningún mismatch de contrato entre frontend y backend.

Verificado contra el código real antes de proponer (grep + lectura directa, esta sesión):

- `ncPermissions.ts` calcula `canIniciarInvestigacion`, `canRegistrarCorreccion`, `canSolicitarCierre` (confirmado: los tres símbolos solo aparecen en `nonconformity.types.ts`, `ncPermissions.ts` y `ncPermissions.test.ts` — cero consumidores en componentes de página).
- `NonconformityDetailPage.tsx` solo consume `canCrearQE`, `canAnular` y `canAsignarAC` (pasado a `ACSection`) — confirmado por grep, ningún botón de transición de estado presente.
- `cambiarEstadoNCSchema`/`CambiarEstadoNCInput` (`cambiarEstadoNC.schema.ts`) solo aparecen en su propio archivo y su propio test — cero consumidores reales.
- `updateNC.schema.ts` no tiene campo `estado` (confirmado por grep) — el único hook de mutación PATCH wireado (`useUpdateNonconformity`, tipado con `UpdateNCInput`) no puede cambiar el estado de una NC.
- `ActualizarNoConformidadCommand.cs` (backend) SÍ acepta `Estado` (`NCEstado?`) como uno más de los campos del PATCH genérico — confirmado leyendo el archivo completo: el comentario en el propio código documenta la decisión ("NC solo tiene un PATCH /:id que cubre ambos casos [edición y cambio de estado], a diferencia de Incidentes"). `ActualizarNoConformidadHandler.cs` bloquea con `ConflictException` (409) si la NC está en `CERRADA`/`ANULADA`, y dispara notificación best-effort (`NotificarCambioEstadoAsync`, capturada en `try/catch`, nunca bloquea la respuesta 200) cuando `estadoCambio` es `true`.
- Las 10 rutas de `Features/NoConformidades/` están registradas en `Extensions/EndpointExtensions.cs` (`CrearNoConformidadEndpoint.Map`, `ListarNoConformidadesEndpoint.Map`, `ObtenerNoConformidadEndpoint.Map`, `ActualizarNoConformidadEndpoint.Map`, `AnularNoConformidadEndpoint.Map`, `EliminarNoConformidadEndpoint.Map`, `RestaurarNoConformidadEndpoint.Map`, más los aliases de Acciones Correctivas y la vinculación Documento↔NC) y coinciden 1:1 con las funciones de `nonconformities.api.ts` (confirmado leyendo ambos archivos completos).
- `shc-controldoc/.env.development` está hoy en `VITE_ENABLE_MSW=true`, `VITE_API_BASE_URL` vacío — estado esperado antes de abrir la ventana de verificación. `.env.production` ya tiene `VITE_ENABLE_MSW=false` desde `cutover-auth`, con el mismo Open Question de hosting pendiente (no se toca en este change).

## Goals / Non-Goals

**Goals:**
- Apuntar el frontend en desarrollo al backend .NET real y verificar, en navegador y/o por API directa: CRUD completo de No Conformidad, anulación, acciones correctivas (crear/actualizar/cerrar), vinculación con QE y con Documentos.
- Verificar las transiciones de estado principales de la NC por API directa (no hay UI para ellas hoy) y documentar el hallazgo con precisión.
- Diagnosticar y corregir, con causa raíz confirmada, cualquier discrepancia real que aparezca durante la verificación — sin asumir de antemano que existe ninguna, dado que la investigación previa no encontró mismatches.
- Inspeccionar los tests de No Conformidades antes de asumir que dependen de MSW.

**Non-Goals:**
- No se construye la UI de transición de estados de la NC (botones "Iniciar investigación", "Registrar corrección", "Solicitar cierre") — es trabajo de producto nuevo, no una corrección de contrato. Si el usuario decide que se construya, es una decisión explícita fuera del alcance actual de este change.
- No se elimina el código muerto identificado (`cambiarEstadoNCSchema`/`CambiarEstadoNCInput`, el campo `documentosVinculados` vestigial en `createNCSchema`, `NCFilters.origen`/`NCFilters.reportadoPorId` sin control de UI) — es opcional, sin riesgo, se puede hacer en el mismo change si resulta cómodo durante la implementación pero no es requisito para cerrarlo.
- No se resuelve el Open Question de hosting/dominio de producción heredado de `cutover-auth`.
- No se toca `.env.production`.

## Decisions

### D1 — Sin cambios de contrato anticipados; verificar primero, corregir solo si aparece una discrepancia real
A diferencia de `cutover-incidentes`/`cutover-documentos` (que sí requirieron extender el modelo de datos backend antes de verificar), esta investigación no encontró ningún campo, ruta o tipo que difiera entre frontend y backend. La estrategia es apuntar directo al backend real y verificar; cualquier discrepancia que aparezca se diagnostica con causa raíz confirmada (archivo + línea) antes de corregirla, igual que el resto de hallazgos de los cutovers anteriores — no se escribe código de antemano para un problema no confirmado.

### D2 — Las transiciones de estado principales se verifican por API directa, no por clic en la UI
`NonconformityDetailPage.tsx` no tiene ningún botón que invoque `PATCH /:id` con `estado` en el payload — `useUpdateNonconformity()` está wireado en la página pero solo para el flujo de edición general (título, descripción, etc. — a confirmar el shape exacto del formulario de edición durante la verificación), nunca con `estado`. Se verifica el ciclo completo (`ABIERTA → EN_INVESTIGACION → ANALISIS_COMPLETADO → EN_EJECUCION → PENDIENTE_CIERRE → CERRADA`, transiciones inválidas, y el bloqueo 409 en estados terminales) enviando `PATCH /api/nonconformities/:id { estado: '<siguiente>' }` directo contra el backend real, mismo criterio ya usado para `PATCH /status` de Incidentes en `cutover-incidentes`.

**Alternativa descartada**: construir los tres botones de transición (`canIniciarInvestigacion`/`canRegistrarCorreccion`/`canSolicitarCierre`) como parte de este change para poder verificar por clic. Se descarta porque el proposal es explícito en que construir esa UI es trabajo de producto nuevo, no una corrección de contrato — mezclar ambos alcances en el mismo change dificultaría revisar cada uno por separado. Queda como hallazgo informativo para que el usuario decida si amerita su propio change futuro.

### D3 — Código muerto identificado: se documenta, no se elimina por defecto
`cambiarEstadoNCSchema`, el campo `documentosVinculados` vestigial en `createNCSchema` (siempre viaja `[]`, sin control de UI, y `CrearNoConformidadCommand` ni siquiera lo tiene) y `NCFilters.origen`/`NCFilters.reportadoPorId` (sin control de UI, tampoco soportados por `ListarNoConformidadesQuery`) son código sin riesgo — no bloquean el cutover ni generan comportamiento incorrecto. Se dejan documentados como hallazgo informativo, mismo criterio que la limpieza opcional de `cutover-documentos`; se pueden eliminar dentro de este mismo change si resulta cómodo durante la implementación, sin que sea un requisito de cierre.

## Risks / Trade-offs

- **[Riesgo] Verificar transiciones de estado por API directa, sin cobertura de UI real** → Mitigación: mismo patrón ya validado en `cutover-incidentes` para `PATCH /status`; el contrato backend (incluida la notificación best-effort y el bloqueo 409 en estados terminales) se confirma igual de rigurosamente que si hubiera un botón, solo cambia el mecanismo de invocación.
- **[Riesgo] La investigación previa se hizo con el bridge de shell caído (sin `grep`/`git log`), pudo haberse escapado algo** → Mitigación: esta sesión repitió los hallazgos clave con grep y lectura directa de archivo completo (`ncPermissions.ts`, `cambiarEstadoNC.schema.ts`, `updateNC.schema.ts`, `ActualizarNoConformidadCommand.cs`, `ActualizarNoConformidadHandler.cs`, `EndpointExtensions.cs`, `nonconformities.api.ts`) antes de escribir este documento — todos los hallazgos reportados se confirmaron sin discrepancias. La verificación en navegador/API (sección de tasks) sigue siendo la validación final.
- **[Riesgo] Si aparece un mismatch no detectado durante la verificación real** → Mitigación: mismo protocolo de diagnóstico-antes-de-fix que todos los cutovers anteriores — causa raíz confirmada (archivo + línea) documentada en este `design.md` antes de aplicar cualquier corrección.

## Migration Plan

1. Backend local (`dotnet run` + Postgres dev) arriba y sano.
2. `shc-controldoc/.env.development`: `VITE_ENABLE_MSW=false`, apuntar a backend local.
3. Verificar: CRUD completo de NC (crear, listar con filtros reales, detalle, editar, eliminar/restaurar), anular, acciones correctivas (crear/actualizar/cerrar), vinculación con QE y con Documentos.
4. Verificar las transiciones de estado principales por API directa (D2): ciclo completo válido, una transición inválida, y el bloqueo 409 en un estado terminal (`CERRADA`/`ANULADA`).
5. Diagnosticar y documentar (causa raíz, archivo + línea) cualquier discrepancia real encontrada antes de corregirla.
6. Inspeccionar los tests de No Conformidades — documentar si alguno depende de `msw/node`/`setupServer` testeando los handlers mismos (no migrables sin perder su propósito, mismo criterio que `cutover-incidentes`/`cutover-auto` 10.1) vs. tests que sí dependían de MSW como capa de red de la app.
7. Revertir `shc-controldoc/.env.development` a `VITE_ENABLE_MSW=true` al terminar.
8. No tocar `.env.production`.

**Rollback:** revertir `VITE_ENABLE_MSW` a `true` restaura el comportamiento anterior de inmediato en el frontend. Si apareciera algún cambio de backend no anticipado, sería aditivo (nueva columna/endpoint nullable u opcional), revertible con el rollback estándar de EF Core sin pérdida de datos existentes.

## Hallazgos de verificación

### Hallazgo real — el backend no valida el orden de la secuencia de estados de la NC
Confirmado en verificación (tasks.md 6.3): `PATCH /api/nonconformities/:id { estado }` acepta cualquier valor de `NCEstado` no terminal sin validar que respete el orden `ABIERTA → EN_INVESTIGACION → ANALISIS_COMPLETADO → EN_EJECUCION → PENDIENTE_CIERRE → CERRADA` — una NC en `ABIERTA` aceptó `PENDIENTE_CIERRE` directamente (200), saltando los estados intermedios. Verificado contra `be-no-conformidades-api` spec.md ("Edición parcial bloqueada en estados terminales"): el único requisito documentado es el bloqueo 409 en `CERRADA`/`ANULADA`, nunca se especificó una máquina de estados server-side que valide el orden — a diferencia de Quality Event, cuya máquina de estados sí es "estricta" según `CLAUDE.md`. No es un mismatch de contrato introducido por este change: el backend implementa exactamente lo que su spec ya documentaba. Se registra como hallazgo informativo, no bloqueante — coherente con que tampoco existe ninguna UI que intente restringir las transiciones a las válidas (ver hallazgo principal del proposal). Si se decide en el futuro que la NC debe tener una máquina de estados estricta como QE, es una decisión de producto nueva fuera de alcance de este change.

## Open Questions

Ninguna pendiente de decisión de producto a esta fecha. Si la verificación revela que el usuario quiere construir la UI de transición de estados de la NC (D2), es una decisión de producto nueva y explícita — no bloquea el cierre de este change.
