## 1. Backend — dominio y lectura

- [x] 1.1 Agregar `[NotMapped] string? ResponsableInvestigacionNombre` en `QualityEvent` y `HasIndex(e => e.ResponsableInvestigacionId)` en `ShacDbContext`
- [x] 1.2 `dotnet ef migrations add AddIndexResponsableInvestigacionQE` y verificar que solo crea el índice
- [x] 1.3 `ObtenerQualityEventHandler` y `ListarQualityEventsHandler`: `LEFT JOIN asp_net_users`, columnas y filtros calificados con alias, `ResponsableInvestigacionNombre`

## 2. Backend — candidatos y validación

- [x] 2.1 `Features/QualityEvents/Shared/ResponsableInvestigacionValidator.cs` (listar candidatos + validar id con `FieldValidationException`) y registrarlo en DI
- [x] 2.2 Slice `CandidatosResponsable/` con `GET /api/quality-events/candidatos-responsable` y registro en `Program.cs`

## 3. Backend — notificaciones

- [x] 3.1 `NotificarResponsableAsignadoAsync` y `NotificarCreacionAsync` en `IQualityEventNotificationSender` / `QualityEventNotificationSender` (y en los fakes de tests)

## 4. Backend — crear, asignar, transicionar

- [x] 4.1 `CrearQualityEventCommand.ResponsableInvestigacionId` opcional: validar, asignar, audit `RESPONSABLE_ASIGNADO` en la transacción, notificaciones post-commit (asignación + creación)
- [x] 4.2 Slice `AsignarResponsableQE/` con `PATCH /api/quality-events/{id}/responsable` (JCA, 404 tenancy, 422 `QE_CERRADO`, no-op sin cambio, audit con nombres, notificación)
- [x] 4.3 `TransicionarEstadoQEHandler`: 422 `QE_SIN_RESPONSABLE` hacia EN_INVESTIGACION sin responsable

## 5. Backend — tests

- [x] 5.1 Tests de candidatos (roles, inactivos, otra empresa)
- [x] 5.2 Tests de crear (válido / inválido / sin responsable; aviso de creación a JCA+SUP sin actor; fallo de notificación → 201)
- [x] 5.3 Tests de `PATCH /responsable` (asignar+cambiar con nombres, 403, 404, 422, no-op)
- [x] 5.4 Tests de transición (422 sin responsable, 200 con responsable) y de nombre en detalle/listado; ajustar tests existentes que transicionan a EN_INVESTIGACION sin responsable

## 6. Frontend — tipos, API, hooks, utilidades

- [x] 6.1 Tipos: `responsableInvestigacionNombre?`, `CandidatoResponsableQE`, `responsableInvestigacionId?` en el input de creación
- [x] 6.2 `quality-events.api.ts`: `getCandidatosResponsableQE`, `asignarResponsableQE`; hooks `useCandidatosResponsableQE`, `useAsignarResponsableQE`
- [x] 6.3 Mover `toDatetimeLocalValue`/`fromDatetimeLocalValue` a `src/utils/datetimeLocal.ts` y usarlo en `IncidentForm`
- [x] 6.4 `esResponsableInvestigacion` en `qualityEventPermissions.ts`; `useTransitionQEStatus` traduce `errorCode`

## 7. Frontend — formulario

- [x] 7.1 Precarga desde el incidente de la URL (`useIncident` antes de los returns, defaults del body)
- [x] 7.2 Precarga al elegir en el combo con `fetchQuery`, diálogo de confirmación si hay `dirtyFields`, nota `form.precargaIncidente`
- [x] 7.3 Campo opcional "Responsable de investigación" en alta (solo JCA), enviado solo si se elige
- [x] 7.4 Edición: `fechaHoraEvento` con `toDatetimeLocalValue` y comparación/envío convertidos

## 8. Frontend — detalle

- [x] 8.1 `QEAsignarResponsableModal`
- [x] 8.2 `QEHeaderSection`: fila del responsable (avatar/iniciales, "Sin asignar" en ámbar), botón Asignar/Cambiar para JCA en estados permitidos
- [x] 8.3 `QEStatusTransitionPanel`: `esResponsable` real, EN_INVESTIGACION deshabilitado sin responsable con tooltip y enlace para JCA

## 9. i18n

- [x] 9.1 Claves `qualityEvents` es-PE/en-US de la instrucción + `detail.auditTrail.acciones.RESPONSABLE_ASIGNADO` / `RESPONSABLE_CAMBIADO`

## 10. MSW

- [x] 10.1 Handlers: candidatos (antes de `/:id`), `PATCH /:id/responsable`, `responsableInvestigacionId` en POST, 422 `QE_SIN_RESPONSABLE`, `responsableInvestigacionNombre` en detalle/listado
- [x] 10.2 Fixtures actualizados (nombres de responsable)

## 11. Frontend — tests

- [x] 11.1 Formulario: precarga por URL (hora local), reemplazo directo, confirmación con cambios previos, campo responsable solo JCA, edición sin corrimiento
- [x] 11.2 Cabecera: "Sin asignar", botón solo JCA, nombre tras asignar
- [x] 11.3 Panel: EN_INVESTIGACION deshabilitado sin responsable; mensaje ante `QE_SIN_RESPONSABLE`

## 12. Verificación

- [ ] 12.1 Suite completa backend (`dotnet test`) y frontend (`npm test`)
- [ ] 12.2 `tsc --noEmit` y `npm run lint` con cero errores
