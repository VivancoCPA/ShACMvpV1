## Why

M2-S01 estableció la capa de tipos, schemas Zod, constantes y permisos para No Conformidades. El siguiente prerequisito para cualquier UI de M2 es la capa de datos: funciones API puras, fixtures realistas que cubran los cuatro dominios de negocio (Calidad, SST, Aduanero, Operacional), handlers MSW con enforcement de reglas de negocio, y hooks TanStack Query con invalidación de caché correcta. Sin esta capa, los componentes de Spec 3 no pueden construirse ni probarse.

## What Changes

- Extender `NoConformidad` con `AccionCorrectiva[]`, campos de dominio SST (`requiereIPER`) y Aduanero (`notificacionComercioExterior`), y un nuevo campo `dominio: NCDominio` que determina el prefijo del `numero` (NC-CAL, NC-SST, NC-ADU, NC-OPE).
- Nuevo tipo `NCDominio`: `'CALIDAD' | 'SST' | 'ADUANERO' | 'OPERACIONAL'`.
- Nueva interfaz `AccionCorrectiva` con campos `id`, `descripcion`, `responsableId`, `plazoFecha`, `estado` (`'PENDIENTE' | 'EN_EJECUCION' | 'COMPLETADA' | 'VENCIDA'`), `descripcionEvidencia?`, `evidenciaUrl?`, `fechaCierre?`, `creadoEn`, `actualizadoEn`.
- Nuevo `src/features/nonconformities/api/nonconformities.api.ts` — 8 funciones Axios puras para toda la operatoria NC + AC.
- Nuevo `src/mocks/fixtures/nonconformities.fixtures.ts` — 8 NCs que cubren los 4 dominios, 3 severidades y todos los estados del ciclo de vida, con 1–3 ACs cada una.
- Nuevo `src/mocks/handlers/nonconformities.handlers.ts` — 8 handlers MSW v2 con 400 ms de latencia, enforcement de RN-NC-001..007, detección de duplicados (RN-NC-005), y registro en `auditTrail`.
- 8 hooks TanStack Query v5 en `src/features/nonconformities/hooks/` con invalidación de caché y toasts Sonner.
- Wiring en `src/mocks/handlers/index.ts` y `src/mocks/fixtures/index.ts`.

## Capabilities

### New Capabilities
- `nc-api-client`: Funciones Axios puras que encapsulan todos los endpoints de No Conformidades y Acciones Correctivas. Única fuente de verdad para URLs y request shapes del dominio M2.
- `nc-msw-fixtures`: Dataset de 8 NCs estáticamente tipadas con ACs embebidas, cubriendo los 4 dominios (NC-CAL, NC-SST, NC-ADU, NC-OPE), las 3 severidades y todos los estados del ciclo de vida.
- `nc-msw-handlers`: Handlers MSW v2 que simulan el backend de M2 — paginación, filtros, máquina de estados NC, detección de posibles duplicados (RN-NC-005), anulación con justificación (RN-NC-003), y operatoria completa de ACs.
- `nc-query-hooks`: Wrappers TanStack Query v5 que conectan la UI al API client — 8 hooks con invalidación de caché correcta (lista + detalle) y feedback Sonner en onSuccess/onError.

### Modified Capabilities
- `nonconformity-types`: Añadir `NCDominio` union type, `AccionCorrectiva` interface, campo `dominio: NCDominio` y campos opcionales `requiereIPER?: boolean` y `notificacionComercioExterior?: NCNotificacionComercioExterior` a `NoConformidad`. Actualizar `numero` format a `NC-[DOMINIO_ABBR]-YYYY-NNN`.

## Impact

- Nuevo: `src/features/nonconformities/api/nonconformities.api.ts`
- Nuevo: `src/mocks/fixtures/nonconformities.fixtures.ts`
- Nuevo: `src/mocks/handlers/nonconformities.handlers.ts`
- Nuevo: `src/features/nonconformities/hooks/useNonconformities.ts`
- Modificación menor: `src/features/nonconformities/types/nonconformity.types.ts` (campos aditivos — sin breaking changes)
- Modificación: `src/mocks/handlers/index.ts` (una línea — agregar import + spread)
- Modificación: `src/mocks/fixtures/index.ts` (una línea — re-exportar fixtures NC)
- Depende de: `nonconformity-types`, `nonconformity-schemas`, `nonconformity-constants`, `nonconformity-permissions` (todos entregados en M2-S01)
- Sin cambios en rutas, componentes ni i18n de valores (claves declaradas aquí, valores en M2-S03)
