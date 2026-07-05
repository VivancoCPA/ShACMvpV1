## 1. Tipos y rol de sistema

- [x] 1.1 Agregar `'ADMINISTRADOR_SISTEMA'` al union type `UserRole` en `src/types/auth.types.ts`.
- [x] 1.2 Ejecutar `tsc --noEmit` y localizar todos los `switch` exhaustivos sobre `UserRole`/`rol` que rompan (p. ej. `src/features/incidents/utils/incidentPermissions.ts`, `src/features/nonconformities/utils/ncPermissions.ts`, `src/features/quality-events/utils/qualityEventPermissions.ts`, `src/features/documents/permissions.ts`, `src/features/documents/components/DocumentListRow.tsx`).
- [x] 1.3 Agregar el caso `'ADMINISTRADOR_SISTEMA'` a cada switch localizado en 1.2, retornando el equivalente "sin permisos"/deny-all de ese dominio, sin usar `default` genérico que oculte futuros roles faltantes.
- [x] 1.4 Confirmar que `tsc --noEmit` pasa sin errores tras 1.1–1.3.

## 2. Feature folder locations — permisos

- [x] 2.1 Crear `src/features/locations/permissions/localesPermissions.ts`.
- [x] 2.2 Implementar `puedeAdministrarLocales(usuario: User): boolean`.
- [x] 2.3 Implementar `puedeConsultarLocales(usuario: User): boolean`.
- [x] 2.4 Crear `src/features/locations/permissions/localesPermissions.test.ts` cubriendo todos los escenarios de `location-permissions` spec (ADMINISTRADOR_SISTEMA, JEFE_CALIDAD_SYST, y el resto de roles para ambos helpers).

## 3. Feature folder locations — reglas de negocio

- [x] 3.1 Crear `src/features/locations/utils/localesBusinessRules.ts` importando `Local`, `Zona`, `Incidente` desde `src/features/incidents/types/incident.types.ts`.
- [x] 3.2 Implementar `puedeCrearLocalActivo(locales: Local[]): boolean` (RN-LOC-001).
- [x] 3.3 Implementar `puedeDesactivarLocal(local: Local, incidentes: Incidente[]): { permitido: boolean; incidentesBloqueantes: number }` (RN-LOC-002).
- [x] 3.4 Implementar `puedeDesactivarZona(zona: Zona, incidentes: Incidente[]): { permitido: boolean; incidentesBloqueantes: number }` (RN-ZON-002).
- [x] 3.5 Crear `src/features/locations/utils/localesBusinessRules.test.ts` cubriendo todos los escenarios de `location-business-rules` spec, incluyendo el límite exacto (4 vs 5 locales activos) y el conteo de incidentes bloqueantes por estado.

## 4. Schemas Zod

- [x] 4.1 Crear `src/features/locations/schemas/localForm.schema.ts` con `localFormSchema` (`nombre`, `direccion`, `planoUrl` con validación PNG ≤2MB, `planoAncho`, `planoAlto`) y exportar el tipo inferido `LocalFormInput`.
- [x] 4.2 Crear `src/features/locations/schemas/zonaForm.schema.ts` con `zonaFormSchema` (`nombre`, `descripcion` opcional) y exportar el tipo inferido `ZonaFormInput`.
- [x] 4.3 Crear tests unitarios para ambos schemas cubriendo los escenarios de `location-schemas` spec (incluyendo el límite exacto de 2MB en `planoUrl`).

## 5. Rutas protegidas

- [x] 5.1 Registrar la ruta `/admin/locales` en el router con `<RoleGuard requiredRoles={['ADMINISTRADOR_SISTEMA', 'JEFE_CALIDAD_SYST']}>`, renderizando un placeholder mínimo de página (la UI real es M6-S03).
- [x] 5.2 Registrar la ruta `/admin/locales/:id` bajo el mismo `RoleGuard`, con `:id` disponible via `useParams()`, renderizando un placeholder mínimo de página (la UI real es M6-S04).
- [x] 5.3 Verificar manualmente (o con test de router) que ambas rutas redirigen a `/no-autorizado` para roles fuera de `['ADMINISTRADOR_SISTEMA', 'JEFE_CALIDAD_SYST']` y a `/login` para usuarios no autenticados.

## 6. Verificación final

- [x] 6.1 Ejecutar la suite de tests completa (`npm test` o equivalente) y confirmar que todos los tests nuevos y existentes pasan. (35 tests nuevos pasan; 2 fallas preexistentes en `qualityEventCreate.schema.test.ts` y errores de transform en `DeadlineBadge.test.tsx`/`Pagination.test.tsx` confirmados como preexistentes en master vía `git stash`, no relacionados a este cambio)
- [x] 6.2 Ejecutar `tsc --noEmit` y el linter del proyecto sin errores. (tsc limpio; lint sin errores nuevos — `router/index.tsx` mantiene el mismo error preexistente de `react-refresh/only-export-components` que ya existía en master)
- [x] 6.3 Revisar que ningún archivo de esta spec importe o modifique `src/features/incidents/types/incident.types.ts`, `src/api/endpoints/locales.api.ts`, `src/mocks/handlers/locales.handlers.ts` ni `src/mocks/fixtures/locales.fixtures.ts` (fuera de alcance). (confirmado sin diffs; `incident.types.ts` solo se importa como tipo desde `localesBusinessRules.ts`)
