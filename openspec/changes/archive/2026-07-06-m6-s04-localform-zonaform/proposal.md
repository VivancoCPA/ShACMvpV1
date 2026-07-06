## Why

M6-S01 a M6-S03 ya entregaron los tipos, permisos, schemas Zod, cliente Axios, hooks de TanStack Query y el listado expandible (`LocalList`) de Locales/Zonas — pero las rutas de creación/edición (`/admin/locales/new`, `/admin/locales/:id/editar`, `/admin/locales/:localId/zonas/new`, `/admin/locales/:localId/zonas/:zonaId/editar`) siguen mostrando un placeholder "Próximamente" (`ComingSoonPages.tsx`). Sin estos formularios, `ADMINISTRADOR_SISTEMA` no puede completar el CRUD de Locales/Zonas que el resto de M6 ya soporta a nivel de API/hooks, dejando el catálogo administrado inoperable end-to-end.

## What Changes

- Reemplazar `LocalNewComingSoon` y `LocalEditComingSoon` por un único componente `LocalForm` (modo creación/edición determinado por presencia de `:id` en la ruta) con campos nombre, dirección y plano PNG (validación en vivo de tipo/tamaño, preview genérico sin thumbnail real).
- Reemplazar `ZonaNewComingSoon` y `ZonaEditComingSoon` por un `ZonaForm` presentado como modal/panel superpuesto al listado de Locales (las rutas dedicadas ya existentes se conservan para direccionabilidad, pero la UI se percibe como un panel modal, no una página independiente), con campos nombre y descripción; `localId` se pasa implícitamente y no es editable.
- Ambos formularios usan React Hook Form + los schemas Zod ya existentes (`localForm.schema.ts`, `zonaForm.schema.ts`) sin duplicarlos.
- Manejo explícito e inline del error de negocio RN-LOC-001 (máximo 5 locales activos) al enviar el formulario de creación de Local, sin depender de que el hook `useCrearLocal` cambie su comportamiento (permanece sin modificar).
- Invalidar cache de TanStack Query tras guardar (ya cubierto por los hooks existentes) y navegar/cerrar con confirmación visual (toast ya emitido por los hooks).
- Actualizar únicamente las 4 entradas de routing en `router/index.tsx` para apuntar a los componentes reales, y el callback de edición/creación de Zona en `LocalList` si es necesario para abrir el nuevo flujo modal.

## Capabilities

### New Capabilities
- `location-form`: Formularios de creación/edición de Local (página completa) y Zona (modal/panel), validación de plano PNG en vivo (RN-LOC-003), manejo de error de límite de locales activos (RN-LOC-001) al enviar, y carga/guardado vía los hooks y API ya existentes de M6-S02.

### Modified Capabilities
(ninguna — no cambian requisitos de `location-schemas`, `location-admin-api`, `location-admin-hooks`, `location-business-rules`, `location-permissions` ni `location-list-view`; esta spec solo consume esos contratos ya definidos)

## Impact

- **Nuevos archivos**: `src/features/locations/components/LocalForm.tsx`, `src/features/locations/components/ZonaForm.tsx`, `src/features/locations/components/ZonaFormModal.tsx`, `src/features/locations/components/PlanoUploadField.tsx`, `src/features/locations/pages/LocalFormPage.tsx`, `src/features/locations/pages/ZonaFormPage.tsx` (nombres orientativos, ver `design.md`).
- **Archivos modificados**: `src/router/index.tsx` (reemplaza los 4 placeholders `ComingSoon*` por los componentes reales), `src/i18n/es-PE.json` y `src/i18n/en-US.json` (nuevas claves bajo el namespace `locations`), posiblemente `src/features/locations/components/LocalList.tsx` únicamente en el callback/enlace que abre estos formularios.
- **Sin cambios**: `src/features/locations/schemas/*`, `src/features/locations/hooks/useLocales.ts`, `src/features/locations/api/locales.api.ts`, `src/mocks/handlers/locales.handlers.ts`, `src/features/locations/permissions/localesPermissions.ts`, `src/features/locations/utils/localesBusinessRules.ts`.
- **Dependencias externas**: ninguna nueva — usa React Hook Form, Zod, TanStack Query, react-i18next y Sonner ya presentes en el stack.
