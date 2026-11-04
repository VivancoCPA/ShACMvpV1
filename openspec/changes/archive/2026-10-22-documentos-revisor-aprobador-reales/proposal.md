## Why

`DocumentFormPage` alimenta los `<select>` de Revisor y Aprobador con `mockUsers` importado de `mocks/fixtures/documents.fixtures`. Con MSW apagado se envían a `POST/PUT /api/documents` IDs ficticios que no existen en `asp_net_users`, y el backend los guarda sin validar (solo verifica RN-DOC-019, revisor ≠ aprobador). Resultado: el documento se crea "bien" pero nadie real puede revisarlo ni aprobarlo, y hoy se puede asignar a un usuario de otra empresa o a un GUID inventado (viola el aislamiento multi-tenant). Es un hueco que se le escapó al cutover de Documentos, invisible bajo MSW.

## What Changes

- **Nuevo endpoint** `GET /api/documents/candidatos-asignacion?tipo=REVISOR|APROBADOR[&documentoId=]` (Dapper, `RequireAuthorization` + `RequireEmpresaActivaFilter`): usuarios activos con asignación ACTIVA en la empresa activa y rol elegible (D1), excluyendo al autor (D2). Devuelve solo `id`, `nombreCompleto`, `rol`.
- **Validación server-side** de `revisorId`/`aprobadorId` en crear y editar mediante un helper compartido en `Features/Documentos/Shared/`: usuario existente, activo, de la empresa activa, rol elegible y distinto del autor. Error de validación por campo (no 404). Nueva versión no acepta esos campos (los hereda del origen), por lo que no se valida ahí.
- **Frontend**: hook `useCandidatosAsignacion(tipo)`; se elimina la prop `mockUsers` y el import de fixtures en `DocumentFormPage`/`DocumentForm`; en edición, un revisor/aprobador guardado que ya no es candidato se muestra como opción "(no disponible)".
- **MSW**: handler del endpoint nuevo aplicando la misma regla D1/D2 sobre el store de usuarios.
- **Constantes de roles elegibles** en un único lugar por lado (backend y `features/documents/constants.ts`).
- **Barrido**: inventario en `design.md` de todo import desde `src/mocks/` en código de producción; solo se corrigen los de Documentos.

Decisiones ya tomadas por Toño (2026-09-24): **D1** roles flexibles — Revisor ∈ {JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, AUDITOR_INTERNO, ALTA_DIRECCION}, Aprobador ∈ {JEFE_CONTROL_DOCUMENTARIO, ALTA_DIRECCION}; **D2** se excluye al autor.

## Capabilities

### New Capabilities
- `documentos-candidatos-asignacion`: endpoint de candidatos, regla de elegibilidad (D1/D2), validación server-side compartida, hook, handler MSW y contrato de tipos.

### Modified Capabilities
- `document-form`: los selects de revisor/aprobador se alimentan del hook de candidatos (ya no de fixtures) y manejan el valor guardado no disponible en edición.
- `be-documentos-api`: creación y edición rechazan revisor/aprobador inválidos (inexistente, inactivo, otra empresa, rol no elegible, igual al autor).

## Impact

- Backend: `Features/Documentos/CrearDocumento`, `EditarDocumento`, nuevo `Features/Documentos/CandidatosAsignacion`, nuevo helper en `Shared/`; tests de integración en `ShcMvpEndPoint.Tests/Features/Documentos/`.
- Frontend: `features/documents/{pages/DocumentFormPage.tsx, components/DocumentForm.tsx, constants.ts, hooks, api}`, `types/documents.types.ts`, i18n `documents` (es-PE/en-US), `mocks/handlers/documents.handlers.ts`.
- Sin cambios de esquema de base de datos. Cambio de comportamiento: peticiones con revisor/aprobador no elegibles pasan a rechazarse (documentos ya existentes con asignaciones inválidas no se tocan).
