## Context

`DocumentFormPage` pasa `mockUsers` (de `mocks/fixtures/documents.fixtures`) a `DocumentForm`, que puebla los `<select>` `revisorId`/`aprobadorId`. Contra el backend real esos IDs no existen. `CrearDocumentoHandler` y `EditarDocumentoHandler` persisten `RevisorId`/`AprobadorId` sin validar; solo RN-DOC-019 (revisor ≠ aprobador) se comprueba en el validator. `GET /api/users` no sirve como fuente: está restringido a `ADMINISTRADOR_EMPRESA`/`SUPERADMIN`, y quienes crean documentos (JCA, JCD, DIR) no tienen esos roles. `NuevaVersionDocumentoHandler` copia `RevisorId`/`AprobadorId` del origen y su command no los acepta.

Documentación consultada: PRD §4.2 no restringe roles globales asignables; la matriz RACI de M1 marca Revisor = JCD "típicamente" y Aprobador = DIR "típicamente".

## Goals / Non-Goals

**Goals:**
- Que revisor y aprobador salgan siempre de usuarios reales, activos, de la empresa activa y con rol apto.
- Que el backend rechace lo contrario aunque el cliente se salte el formulario (multi-tenancy).
- Que el modo mock siga funcionando con la misma regla.

**Non-Goals:**
- Cambiar el esquema de BD.
- Revalidar documentos ya existentes con asignaciones inválidas, ni validar en `NuevaVersion` (hereda del origen).
- Corregir imports de fixtures de otros módulos (solo se listan).
- Exigir PIN configurado al aprobador (RN-DOC-004 se sigue verificando al firmar).

## Decisions

**D1 — Roles elegibles (decidido por Toño, 2026-09-24): opción (b) flexible.**
Opciones evaluadas: (a) estricto según matriz: Revisor ∈ {JCD, DIR}, Aprobador ∈ {DIR}; (b) flexible: Revisor ∈ {JEFE_CALIDAD_SYST, JEFE_CONTROL_DOCUMENTARIO, AUDITOR_INTERNO, ALTA_DIRECCION}, Aprobador ∈ {JEFE_CONTROL_DOCUMENTARIO, ALTA_DIRECCION}; (c) cualquier usuario activo salvo OPERARIO. **Elegida (b)**: respeta el "típicamente" de la matriz sin dejar sin candidatos a una empresa pequeña y coincide con los roles que ven documentos CONFIDENCIAL. La lista vive en una constante por lado (backend: p. ej. `DocumentoAsignacionRoles` en `Features/Documentos/Shared/`; frontend: `features/documents/constants.ts`, junto a `DOCUMENT_AUTHORIZED_ROLES`), sin duplicarla en otros archivos. El handler MSW importa la constante del frontend.

**D2 — Excluir al autor (decidido por Toño, 2026-09-24): sí.** Segregación de funciones (ISO 9001 §7.5). El autor no aparece en las listas ni se acepta como revisor/aprobador (creación: actor; edición: `AutorId` persistido).

**D3 — Endpoint dedicado con Dapper** `GET /api/documents/candidatos-asignacion`, en `Features/Documentos/CandidatosAsignacion/`. Consulta: `asp_net_users` (activo) ⨝ `usuarios_empresa` (asignación ACTIVA, `empresa_id` = empresa activa de la sesión, `rol` = ANY(elegibles)), orden por nombre; proyección mínima `id, nombreCompleto, rol`. Nombres exactos de tablas/columnas se confirman leyendo el código al implementar; si divergen de este doc, prevalece el código y se anota aquí.

**D4 — Validación en helper compartido** (`Features/Documentos/Shared/DocumentoAsignacionValidator` o similar) con una única consulta que devuelve los IDs elegibles; lo invocan Crear y Editar dentro del handler (necesita `empresaId` y `AutorId`, que el `AbstractValidator` no tiene). Falla con el mismo tipo de error de validación que produce `ValidationFilter` (errores por campo `revisorId`/`aprobadorId`), no 404. Se valida solo si el campo viene informado; en edición, además, si el valor no cambió respecto al persistido se **acepta aunque ya no sea elegible** (evita bloquear guardar un BORRADOR por otros campos cuando un revisor se desactivó). Este último punto amplía el pedido original y es coherente con la opción "(no disponible)" del formulario; si Toño prefiere bloqueo estricto, se cambia en un solo lugar.

**D5 — Frontend.** `useCandidatosAsignacion(tipo, documentoId?)` con query key `['documents','candidatos-asignacion',tipo,documentoId]`. `DocumentForm` recibe las dos listas por hook (no por prop `mockUsers`); se elimina el import de `MockUser`. En edición, si el valor guardado no está en la lista se antepone una opción `"{{id}} (no disponible)"` (i18n `documents:form.option_no_disponible`, es-PE/en-US); el nombre se resuelve con lo disponible y, si no, se muestra el ID. Tipo `CandidatoAsignacion` en `types/documents.types.ts`.

**D6 — MSW.** Handler en `documents.handlers.ts` filtrando `getUsersStore()` (store mutable, no el fixture estático) por rol de D1, activo y excluyendo al autor (sesión o autor del documento).

## Barrido de imports desde `src/mocks/` en código de producción

No incluye `*.test.*`, `test-setup` ni archivos dentro de `src/mocks/`.

| Archivo | Importa | Acción |
|---|---|---|
| `main.tsx:44` | `import('./mocks/browser')` (dinámico, condicional a `VITE_ENABLE_MSW`) | Legítimo |
| `pages/dev/DevResetMocksPage.tsx` | `resetAllMockStores` | Legítimo (página dev-only) |
| `features/documents/pages/DocumentFormPage.tsx` | `mockUsers` de `documents.fixtures` | **Se corrige aquí** |
| `features/documents/components/DocumentForm.tsx` | `import type { MockUser }` de `documents.fixtures` | **Se corrige aquí** |
| `features/documents/components/DocumentDetailHeader.tsx` | `resolveUserDisplayName` de `userIdentity.fixtures` (autor/revisor/aprobador) | Hallazgo, ver abajo |
| `features/documents/components/DocumentActionPanel.tsx` | `resolveUserDisplayName` (aprobador) | Hallazgo, ver abajo |
| `features/auth/pages/LoginPage.tsx` | `authFixtures` | Hallazgo (otro módulo) |
| `features/nonconformities/pages/NonconformityDetailPage.tsx` | `getUsersStore`, `resolveUserDisplayName` | Hallazgo (otro módulo) |
| `features/nonconformities/components/ACSection.tsx` | `qualityEventFixtures` | Hallazgo (otro módulo) |
| `features/quality-events/pages/QualityEventForm.tsx` | `resolveUserDisplayName` | Hallazgo (otro módulo) |
| `features/quality-events/components/QEHeaderSection.tsx` | `resolveUserDisplayName` | Hallazgo (otro módulo) |
| `features/quality-events/components/QEInvestigationSection.tsx` | `resolveUserDisplayName` | Hallazgo (otro módulo) |
| `features/quality-events/export/buildQualityEventPdf.ts` | `resolveUserDisplayName` | Hallazgo (otro módulo) |

**Hallazgo relevante para Documentos (pendiente de decisión de Toño):** `resolveUserDisplayName` busca en el store mock y, si no encuentra el ID, devuelve el ID crudo. Con backend real, `DocumentDetailHeader` y `DocumentActionPanel` mostrarán GUIDs en vez de nombres de autor/revisor/aprobador. Corregirlo exige que la respuesta de `GET /api/documents/:id` incluya los nombres (contrato nuevo). **Por defecto este change solo lo lista y no lo corrige**; se recomienda abrir un change aparte (`documentos-nombres-usuarios-reales`) que además cubra los mismos usos en QE y NC. Una vez resuelto, los `resolveUserDisplayName` deberían migrar a una utilidad fuera de `mocks/`.

## Divergencias durante la implementación

- **Excepción nueva `FieldValidationException`** (Domain/Exceptions) mapeada en `ApiExceptionHandler` a 400 con el mismo formato que `ValidationFilter` (`"Error de validación."` + `errors: ["revisorId: ..."]`). Se usó en vez de `BadRequestBusinessException` porque esa solo transporta un mensaje sin campo. Los errores de RN-DOC-019 y demás siguen siendo 400 (no 422 como dice el texto histórico de la spec; el código real ya respondía 400).
- **El servicio de asignación es `DocumentoAsignacionService`** (un solo lugar para el endpoint de candidatos y la validación), en vez de un helper estático.
- **Opción "(no disponible)"** muestra un texto genérico ("Usuario asignado (no disponible)") en lugar de `{{id}} (no disponible)`: mostrar un GUID crudo al usuario no aporta, y no hay forma de resolver el nombre sin el contrato pendiente de nombres (ver hallazgo `resolveUserDisplayName`).
- **Select en carga sin registrar**: mientras cargan los candidatos se renderiza un select deshabilitado sin `register`; el registrado se monta ya con las opciones para que RHF aplique el valor guardado.
- **Mock**: `mockUsers`/`MockUser` se eliminaron de `documents.fixtures.ts` y de la barrel `mocks/fixtures/index.ts`; el handler filtra por empresa activa con `getEmpresasActivasForUsuario`.
- **Test existente ajustado**: `CrearDocumento_AutoasignacionComoRevisor` pasó a verificar rechazo 400 (D2) y `CrearDocumento_ConRevisorAsignado` usa un revisor `AUDITOR_INTERNO`. La comprobación `!= actorId` antes de notificar en `CrearDocumentoHandler` queda como defensa redundante (inalcanzable tras D2).
- **Error de `tsc` previo, no relacionado**: `IncidentForm.tsx(377,9)` (tipo `evidencias`) ya fallaba antes de este change.

## Risks / Trade-offs

- Empresas sin usuarios con rol elegible verán selects vacíos: mitigado por D1 flexible y mensaje de "sin candidatos" en el formulario.
- Rechazo a peticiones que hoy pasan (cambio de comportamiento de API): aceptado, es el objetivo.
- Aceptar el valor sin cambios en edición (D4) permite conservar una asignación ya inválida hasta que se cambie; se prefirió no bloquear la edición.
- Prueba end-to-end depende de que existan en la BD real usuarios con roles elegibles y un aprobador con PIN configurado.
