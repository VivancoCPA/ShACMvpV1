## Why

Tras probar el módulo Empresas contra el backend .NET real (MSW desactivado) aparecieron cuatro problemas: la lista de empresas no tiene paginación ni filtros, actualizar una empresa deja la pantalla "congelada" sin explicación, la pantalla "Usuarios de la empresa" no tiene forma de volver a la lista, y "Quitar logo" no funciona contra el backend real (el campo omitido se interpreta como "no cambiar"). Además el logo se guarda como data URI base64 en `logo_url` y viaja completo en cada listado y cada PATCH, lo que hay que dejar documentado.

## What Changes

- `EmpresaList`: paginación (`PAGE_SIZE = 10`, componente `Pagination`) y filtros con `FilterBar` (texto por razón social o RUC, y estado Todas/Activas/Inactivas), en cliente, siguiendo el patrón de `UserList`. El cambio de filtro vuelve a la página 1. El estado vacío distingue "no hay empresas" de "ningún resultado coincide".
- Bug "pantalla congelada" al actualizar: reproducir primero contra backend real (editar sin logo, editar con logo, desactivar/reactivar con cascada RN-EMP-005), documentar la causa real en `design.md` y corregirla. `EmpresaForm` debe mostrar un error visible para cualquier status de error (hoy solo trata 409) y el modal nunca debe quedar sin salida.
- `EmpresaUsuariosPage`: `Link` a `/admin/empresas` reutilizando el patrón de "volver" de las páginas de detalle (`ArrowLeft` + `detail.backToList`).
- Contrato explícito para borrar el logo: `logoBase64: ""` significa "quitar logo"; `null`/omitido significa "no cambiar". Aplicado a la vez en backend (`ActualizarEmpresaHandler`), frontend (`LogoUploadField`/`EmpresaForm`), handler MSW, tipos/schema TS y tests. Al editar sin tocar el logo, el PATCH no reenvía `logoBase64`.
- Decisiones D1 (filtros en cliente), D2 (logos siguen como base64; mover a archivos queda fuera de alcance, requiere decisión explícita) y D3 (contrato de borrado) quedan escritas en `design.md`.

## Capabilities

### New Capabilities
- `empresa-list-filters`: filtrado y paginación en cliente de la lista de empresas, y estados vacíos diferenciados.

### Modified Capabilities
- `empresa-form`: contrato de logo (`""` = quitar, omitido = no cambiar, no reenviar logo sin cambios) y manejo visible de errores no-409 sin dejar el modal sin salida.
- `empresa-user-assignment`: enlace para volver a `/admin/empresas` desde la pantalla de usuarios de la empresa.

## Impact

- Frontend: `features/empresas/components/{EmpresaList,EmpresaForm,LogoUploadField}.tsx`, `pages/EmpresaUsuariosPage.tsx`, `schemas/empresaForm.schema.ts`, `hooks/useEmpresas.ts`, i18n `empresas` (es-PE y en-US), tests.
- MSW: `mocks/handlers/empresas.handlers.ts` (`PATCH /api/empresas/:id`).
- Backend: `ShcMvpEndPoint/Features/Empresas/ActualizarEmpresa/ActualizarEmpresaHandler.cs` (+ tests) y la causa raíz del punto 2 que resulte de la reproducción.
- Sin cambios en `GET /api/empresas` (D1 = cliente). Sin migración de datos (D2 = no mover logos).
