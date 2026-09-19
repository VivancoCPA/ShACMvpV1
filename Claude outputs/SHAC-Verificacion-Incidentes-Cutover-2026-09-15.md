# Verificación — Cutover: Incidentes

Fecha: 2026-09-15
Autor: Cowork, verificación independiente vía device bridge (fallback `device_list_dir` +
`device_stage_files`/`Read` — `device_bash` sigue caído por el tema de Windows del 8 de
septiembre, sin fecha de resolución confirmada).

Conclusión: **aprobado**. Los tres hallazgos de las instrucciones originales
(`INSTRUCCIONES-CLAUDE-CODE-cutover-incidentes-2026-09-15.md`) están resueltos y documentados
correctamente en `design.md`, y los 5 bugs reales que reportaste haber encontrado durante la
verificación están confirmados uno por uno contra el código real, con causa raíz y fix coherentes
con lo que describiste. No encontré discrepancias entre "lo que se reportó" y "lo que hay".

## 1. Hallazgo bloqueante (campos offline/mobile) — resuelto

`Domain/Entities/Incidente.cs` (leído completo, mtime 2026-09-15) ahora tiene: `Testigos`,
`PersonalInvolucrado`, `EquiposInvolucrados`, `AtencionMedicaRequerida`,
`AtencionMedicaDescripcion`, `NotificacionAmbientalRequerida`, `GeoLat`/`GeoLng`/`GeoCapturadoEn`
(expuestos como `geoUbicacion` anidado vía propiedad computada), y `Evidencias` (relación a la
tabla nueva `IncidenteEvidencia`, no una columna JSON — coincide con lo documentado en D1).
Migración EF Core real confirmada: `Migrations/20260915092058_AddIncidentesInvestigacionExtendida.cs`
existe junto a su `.Designer.cs` y el `ShacDbContextModelSnapshot.cs` está actualizado a la misma
fecha.

`CrearIncidenteCommand` y `ActualizarInvestigacionCommand` (ambos leídos completos) reparten los
campos exactamente como dice D1/D1-revisada: `GeoUbicacion`/`Evidencias` en creación,
`Testigos`/`PersonalInvolucrado`/`EquiposInvolucrados`/`AtencionMedica*` en investigación, y
`Evidencias` en **ambos** (la corrección D1-revisada, motivada por que `IncidentForm.tsx` permite
adjuntar evidencia en modo `create` y `edit` con el mismo componente — bien razonada, no es un
parche).

**`informeMedicoAdjunto` sigue sin modelarse** — coincide con D6 del `design.md`: no se encontró
ningún formulario/schema que lo escriba hoy (solo existe como campo de lectura en el tipo del
frontend), así que no implementarlo es la decisión correcta según el criterio del proyecto ("no
inventar sin consumidor confirmado"), no un olvido. Documentado explícitamente, no es un gap.

**Endpoint de evidencias real** (`POST /api/incidents/evidencias`, `SubirEvidenciaEndpoint.cs`):
confirmado multipart puro (sin `ValidationFilter<T>`, coherente con el comentario que dice por
qué), valida tipo (`IncidenteEvidenciaValidator`: JPEG/PNG/WEBP/PDF — la unión de los sets de
mobile y desktop, con nota explicando por qué desktop necesita PDF también) y tamaño (10 MB),
guarda en disco vía `IncidenteEvidenciaStorageService` (mismo patrón dev-only que
`PlanoStorageService`/`DocumentoStorageService`, como se pidió), y está registrado en
`EndpointExtensions.cs` (`SubirEvidenciaEndpoint.Map(app)`, línea 191) con su servicio como
`Scoped` (línea 338). El frontend (`incidents.api.ts`, `subirEvidencia()`) sube el archivo real vía
`FormData`/`/api/incidents/evidencias` antes de armar el payload — confirmado en código, no solo
en el reporte.

## 2. Hallazgo bloqueante (excepción `empresaId`) — resuelto según la decisión que confirmaste

`CrearIncidenteCommand.EmpresaId` es ahora un `Guid?` opcional. En `CrearIncidenteEndpoint.Handle`
(leído completo): si viene presente, se resuelve el rol efectivo del actor en esa empresa vía
`sessionResolver.GetRolEfectivoAsync(...)` antes de confiarlo — `403 Forbid()` si no hay membresía
válida; si está ausente, comportamiento sin cambios (`GetEmpresaActivaId()` de la sesión). Esto es
exactamente la opción que elegiste en el `AskUserQuestion` durante `/opsx:propose` (preservar la
excepción con validación de membresía, no descartarla) — `design.md` D4 lo registra explícitamente
como "decisión de producto ya confirmada por el usuario", con la alternativa descartada also
documentada. Sigue siendo la única excepción de multi-tenancy basada en body en todo el backend,
señalada como tal en el propio código para que no se copie como patrón.

## 3. Hallazgo menor (ruta `/cerrar`) — resuelto con el endpoint delgado

`CerrarAccionCorrectivaEndpoint.cs` (nuevo) mapea
`PATCH /api/incidents/{incidenteId}/acciones/{acId}/cerrar`, arma internamente un
`ActualizarAccionCorrectivaCommand` con `Estado=CERRADA` y delega al handler ya existente — cero
lógica de negocio duplicada, cero cambios en `cerrarAC()`/`cerrarAC.schema.ts` del frontend, tal
como se recomendó. Registrado en `EndpointExtensions.cs` bajo el alias `IncCerrarAccionCorrectivaEndpoint`
(línea 190) — nombre distinto al `CerrarAccionCorrectivaEndpoint` de No Conformidades para evitar
la colisión de nombres entre ambos módulos, consistente con el patrón de alias ya usado en el
archivo para otros choques de nombres.

## 4. Los 5 bugs reportados — confirmados contra el código, uno por uno

Todos están documentados en `design.md` con causa raíz, stack trace o comportamiento observado, y
el fix aplicado — no como hallazgos genéricos, sino con cita de archivo/línea real:

1. **`fechaEvento` crasheaba contra Postgres (500)**: `datetime-local` sin offset se deserializaba
   como `DateTimeKind.Unspecified`, que Npgsql rechaza en una columna `timestamptz`. Fix en
   `IncidentForm.tsx`: conversión explícita hora-local↔UTC en el límite del formulario (no un
   relabel de `Kind`, que hubiera sido incorrecto). Nota: preexistente, nunca se había disparado
   porque Incidentes vivió 100% en MSW hasta este cutover — coherente con el resto del proyecto.
2. **`isDeleted` con comparación estricta contra `undefined`**: confirmado en
   `incidentPermissions.ts` (leído completo) — el fix real es `deletedAt != null` (comparación
   débil), con el comentario explicando por qué (el backend .NET serializa `null` explícito, MSW
   omitía la clave). Coincide exactamente con la descripción del reporte y con `design.md`.
3. **`ubicacion`/`geoUbicacion` no llegaban anidados**: confirmado en `Incidente.cs` — las columnas
   planas (`UbicacionX/Y`, `GeoLat/Lng/CapturadoEn`) pasaron a `[JsonIgnore]` y se agregaron
   propiedades computadas `Ubicacion`/`GeoUbicacion` con `[JsonPropertyName]` que arman el objeto
   anidado. Documentado que el mismo defecto ya existía para `ubicacion` desde
   `be-incidentes-catalogos` (no introducido por este change) — dato que el propio `design.md`
   verifica con honestidad en vez de atribuírselo a otro módulo.
4. **Deduplicación de evidencias al editar**: confirmado en `ActualizarInvestigacionHandler.cs` —
   compara `ev.Url` contra las URLs ya persistidas antes de insertar, con el comentario explicando
   la causa raíz (el frontend manda el arreglo completo, no solo lo nuevo).
5. **Bug de QE (`fechaHoraEvento`) señalado para el futuro, no corregido acá**: confirmado que
   `design.md` lo documenta como "hallazgo informativo" fuera de alcance de este change (Quality
   Events no tiene su propio cutover todavía) — correcto no tocarlo acá.

## 5. Estado real de archivo y entorno

- **`openspec/changes/cutover-incidentes/` sigue activo, no archivado** — confirmado listando
  `openspec/changes/` (solo contiene `archive/` y `cutover-incidentes/`). Coincide con tu reporte
  ("Ready to archive whenever you'd like") — no archives hasta confirmarlo vos.
- **`.env.development` restaurado a baseline**: `VITE_ENABLE_MSW=true`, `VITE_API_BASE_URL` vacío —
  confirmado, coincide con "environment restored to baseline".
- **`.env.production` no tocado** (mtime sin cambios desde `cutover-catalogos`) — coincide con el
  Non-Goal explícito del `design.md` ("no se toca `.env.production`, Open Question de hosting sigue
  pendiente").
- No verifiqué en vivo el ciclo offline con Service Worker real (no tengo forma de ejercitar el
  navegador vía este bridge) — confío en tu narrativa de verificación porque el resto de lo
  verificable en código es consistente y detallado, pero si querés que lo re-confirme en algún
  momento con Claude Code en Chrome, avisame.

No encontré nada pendiente de corregir. El único punto abierto es tuyo: decidir cuándo archivar.

## 6. Qué sigue

Con Auth, Catálogos e Incidentes cutover-eados y verificados, quedan sin cutover: No Conformidades,
Quality Events, Documentos, Notificaciones, Dashboard y Usuarios — más los dos pendientes
históricos sin resolver (`documentosPendientesLectura` sin definición de producto, y el gap de UI
de CA-34 para descarga de documentos OBSOLETO). No asumo cuál seguís vos — decímelo cuando quieras
continuar.
