## 1. Types — extender nonconformity.types.ts

- [x] 1.1 Añadir `ANULADA` al union `NCStatus` en `src/features/nonconformities/types/nonconformity.types.ts`
- [x] 1.2 Añadir `NCDominio` union (`NC-CAL | NC-SST | NC-ADU | NC-OPE | NC-PRV`) al mismo archivo
- [x] 1.3 Añadir `ACStatus` union (`PENDIENTE | EN_EJECUCION | COMPLETADA | CERRADA | VENCIDA`)
- [x] 1.4 Definir interfaz `AccionCorrectiva` con campos requeridos y opcionales (spec `ac-section`)
- [x] 1.5 Definir tipos `CreateACInput`, `UpdateACInput`, `CerrarACInput`
- [x] 1.6 Extender interfaz `NoConformidad` con `dominio`, `titulo`, `detectadoPor`, `requiereIPER`, `justificacionAnulacion`, `fechaCierre`
- [x] 1.7 Extender interfaz `NCPermissions` con cuatro flags nuevos: `canAnular`, `canAsignarAC`, `canCerrarAC`, `canVerAuditTrail`

## 2. Permissions — actualizar getNCPermissions

- [x] 2.1 Actualizar `src/features/nonconformities/utils/ncPermissions.ts` para devolver los cuatro flags nuevos según la matriz de la spec `nonconformity-types`
- [x] 2.2 Actualizar tests existentes de `getNCPermissions` para incluir los cuatro flags nuevos en los objetos esperados

## 3. Schemas Zod — nuevos schemas para el formulario y ACs

- [x] 3.1 Actualizar `src/features/nonconformities/schemas/createNC.schema.ts` añadiendo `dominio` (NCDominio), `titulo` (string min 1), `detectadoPor` (optional string), `requiereIPER` (boolean, default false), `fechaCierre` (ISO 8601 date string), y validación `superRefine` que asegure `fechaCierre > fechaDeteccion`
- [x] 3.2 Crear `src/features/nonconformities/schemas/createAC.schema.ts` con `CreateACInput` (descripcion min 5, responsableId UUID, plazoFecha ISO date)
- [x] 3.3 Crear `src/features/nonconformities/schemas/cerrarAC.schema.ts` con `CerrarACInput` (descripcionEvidencia min 1, evidenciaUrl optional URL)
- [x] 3.4 Crear `src/features/nonconformities/schemas/anularNC.schema.ts` con `AnularNCInput` (justificacion min 20)

## 4. Constants — etiquetas legibles y constantes de dominio

- [x] 4.1 Añadir `NC_DOMINIO_LABELS` en `src/features/nonconformities/constants/nonconformity.constants.ts` mapeando `NCDominio` a etiquetas legibles en español
- [x] 4.2 Verificar que `src/constants/shared.constants.ts` existe y exporta `AREAS_SHAC`; crearlo si no existe con las áreas del operador logístico
- [x] 4.3 Añadir `AC_STATUS_LABELS` para las etiquetas de estado de AC

## 5. MSW — fixtures de usuarios y handler GET /api/users

- [x] 5.1 Crear `src/mocks/fixtures/users.fixtures.ts` con seis usuarios fixture (uno por rol: OPERARIO, SUPERVISOR, JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, AUDITOR_INTERNO, ALTA_DIRECCION)
- [x] 5.2 Añadir handler `GET /api/users` en `src/mocks/handlers/nonconformities.handlers.ts` (o en un nuevo `users.handlers.ts`) que retorna `ApiResponse<User[]>` con los seis usuarios fixture
- [x] 5.3 Extender el handler `POST /api/nonconformities` para aceptar y procesar el flag opcional `forzar: boolean` (skip duplicate check cuando `forzar === true`)
- [x] 5.4 Actualizar fixtures de NC en `src/mocks/fixtures/nonconformities.fixtures.ts` para incluir los nuevos campos `dominio`, `titulo`, `requiereIPER`, y al menos una NC con `estado === 'ANULADA'` y `justificacionAnulacion`
- [x] 5.5 Wiring: exportar nuevos handlers desde `src/mocks/handlers/index.ts` si se creó un archivo separado

## 6. Hook de usuarios — useUsers query hook

- [x] 6.1 Crear `src/features/nonconformities/hooks/useUsers.ts` (o en el archivo de hooks existente) con `useUsers()` que llama `GET /api/users` vía TanStack Query, staleTime 10 min

## 7. Componente NCForm

- [x] 7.1 Crear `src/features/nonconformities/components/NCForm.tsx` con todos los campos según la spec `nc-form`
- [x] 7.2 Implementar lógica reactiva: forzar `requiereIPER=true` y deshabilitar checkbox cuando `dominio === 'NC-SST'`
- [x] 7.3 Implementar aviso inline para `NC-SST` (warning IPER) y `NC-ADU` (warning notificación aduanera)
- [x] 7.4 Implementar `DuplicateModal` inline (puede ser un componente local dentro del mismo archivo o separado como `DuplicateNCModal.tsx`) que se abre cuando `onSuccess` recibe `warning === 'POSIBLE_DUPLICADO'`
- [x] 7.5 Implementar los dos CTA del modal duplicado: "Vincular a NC existente" y "Guardar como nueva NC" (re-submit con `forzar: true`)
- [x] 7.6 Añadir todos los keys i18n necesarios para `NCForm` en `src/i18n/es-PE.json` y `src/i18n/en-US.json`

## 8. Página NonconformityNewPage

- [x] 8.1 Crear `src/features/nonconformities/pages/NonconformityNewPage.tsx` envolviendo `NCForm` en `PageWrapper` con breadcrumb "No Conformidades > Nueva NC"

## 9. Componente ACSection

- [x] 9.1 Crear `src/features/nonconformities/components/ACSection.tsx` con la lista de ACs recibida por props, usando `DeadlineBadge` para `plazoFecha`
- [x] 9.2 Implementar botones de transición por estado de AC: "Iniciar" (PENDIENTE→EN_EJECUCION), "Completar" (EN_EJECUCION→COMPLETADA), "Cerrar con evidencia" (COMPLETADA→CERRADA, solo `canCerrarAC`)
- [x] 9.3 Implementar formulario inline "Agregar AC" con campos `descripcion`, `responsableId` (select de `useUsers()`), `plazoFecha`; oculto cuando `canAsignarAC === false` o NC en estado terminal
- [x] 9.4 Implementar `EvidenciaModal` (modal de cierre con evidencia) dentro de `ACSection` o como componente separado `CerrarACModal.tsx`
- [x] 9.5 Añadir keys i18n para `ACSection` en `es-PE.json` y `en-US.json`

## 10. Componente AnularNCModal

- [x] 10.1 Crear `src/features/nonconformities/components/AnularNCModal.tsx` con textarea `justificacion` (min 20 chars, Zod), botones "Confirmar anulación" y "Cancelar"

## 11. Página NonconformityDetailPage

- [x] 11.1 Crear `src/features/nonconformities/pages/NonconformityDetailPage.tsx` con `useNonconformity(id)` donde `id` viene de `useParams()`
- [x] 11.2 Implementar estado skeleton (carga) con al menos tres filas de placeholder
- [x] 11.3 Implementar estado de error con botón "Reintentar" que llama `refetch()`
- [x] 11.4 Renderizar cabecera readonly de la NC con todos los campos de la spec `nc-detail-page`
- [x] 11.5 Renderizar bloque de alerta con `justificacionAnulacion` cuando `estado === 'ANULADA'`
- [x] 11.6 Renderizar botones de acción contextuales via `getNCPermissions`
- [x] 11.7 Integrar `AnularNCModal` como portal controlado por `useState<boolean>`; navegar a `/nonconformities` en éxito
- [x] 11.8 Integrar `ACSection` pasando `nc.accionesCorrectivas` y `ncId`
- [x] 11.9 Implementar sección colapsable de audit trail (solo para `canVerAuditTrail=true`), ordenada cronológicamente descendente
- [x] 11.10 Añadir keys i18n para `NonconformityDetailPage` en `es-PE.json` y `en-US.json`

## 12. Routing — registrar nuevas rutas

- [x] 12.1 Registrar ruta `/nonconformities/new` con `<RoleGuard requiredRoles={['SUPERVISOR', 'JEFE_CALIDAD_SYST']}>` renderizando `NonconformityNewPage` (antes del patrón dinámico `:id` para evitar colisión)
- [x] 12.2 Registrar ruta `/nonconformities/:id` con `<RoleGuard>` para todos los roles autenticados, renderizando `NonconformityDetailPage`
- [x] 12.3 Verificar que el click en una fila de `NCList` navega a `/nonconformities/:id`; actualizar el handler del click si hace falta
- [x] 12.4 Verificar que el botón "Nueva NC" en `NonconformityListPage` navega a `/nonconformities/new`

## 13. Tests

- [x] 13.1 Test unitario de `getNCPermissions` para los cuatro flags nuevos (al menos JEFE_CALIDAD_SYST y OPERARIO en dos estados distintos)
- [x] 13.2 Test unitario del schema `createNC.schema.ts` — validación de `fechaCierre > fechaDeteccion`
- [x] 13.3 Test unitario del schema `anularNC.schema.ts` — rechazo de justificacion < 20 chars
- [x] 13.4 Test de `NCForm` — render del warning IPER cuando dominio es NC-SST
