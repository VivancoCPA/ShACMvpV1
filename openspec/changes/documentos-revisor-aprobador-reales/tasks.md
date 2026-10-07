## 1. Backend — elegibilidad y endpoint

- [x] 1.1 Leer `usuarios_empresa`/`asp_net_users` (entidades y SQL de otros endpoints Dapper) y confirmar nombres reales de tabla/columna; anotar divergencias en design.md
- [x] 1.2 Crear la constante de roles elegibles (Revisor / Aprobador, D1) en `Features/Documentos/Shared/`
- [x] 1.3 Crear `Features/Documentos/CandidatosAsignacion/` (Endpoint, Handler Dapper, Response `id`/`nombreCompleto`/`rol`) con `RequireAuthorization` + `RequireEmpresaActivaFilter`; validar `tipo` (400) y `documentoId` (404 si no existe o es de otra empresa); excluir al autor (D2)
- [x] 1.4 Registrar el endpoint en el mapeo de rutas y DI

## 2. Backend — validación en crear y editar

- [x] 2.1 Crear el helper compartido de validación de asignación en `Features/Documentos/Shared/` (existe, activo, asignación ACTIVA en empresa activa, rol elegible, distinto del autor) con errores por campo `revisorId`/`aprobadorId`
- [x] 2.2 Invocarlo desde `CrearDocumentoHandler` (autor = actor) antes de persistir
- [x] 2.3 Invocarlo desde `EditarDocumentoHandler` (autor = `AutorId`), aceptando valores sin cambios respecto al persistido (D4)
- [x] 2.4 Confirmar que `NuevaVersionDocumento` no acepta revisor/aprobador y anotarlo

## 3. Backend — tests de integración

- [x] 3.1 Candidatos: nunca devuelve usuarios de otra empresa, inactivos ni con asignación inactiva; excluye al autor (sesión y `documentoId`); `documentoId` ajeno → 404; `tipo` inválido → 400; sin email/avatar en la respuesta
- [x] 3.2 Crear: rechaza otra empresa, GUID inexistente, inactivo, rol no elegible y autor; acepta candidato válido
- [x] 3.3 Editar: rechaza aprobador no elegible; acepta valor sin cambios aunque ya no sea elegible
- [x] 3.4 Ajustar tests existentes de Documentos que usaban IDs de revisor/aprobador arbitrarios

## 4. Frontend — contrato, hook y formulario

- [x] 4.1 Agregar constantes de roles elegibles en `features/documents/constants.ts` y el tipo `CandidatoAsignacion` en `types/documents.types.ts`
- [x] 4.2 Agregar función en `documents.api.ts`, query key y hook `useCandidatosAsignacion(tipo, documentoId?)`
- [x] 4.3 Eliminar `mockUsers` de `DocumentFormPage` y la prop/`import type MockUser` de `DocumentForm`; cada select usa su lista; estado de carga y mensaje sin candidatos
- [x] 4.4 Opción "(no disponible)" en edición para revisor/aprobador guardado fuera de la lista
- [x] 4.5 Claves i18n en es-PE y en-US (`option_no_disponible`, sin candidatos, cargando)
- [x] 4.6 Mantener el superRefine de RN-DOC-019

## 5. Frontend — MSW y tests

- [x] 5.1 Handler `GET /api/documents/candidatos-asignacion` en `documents.handlers.ts` con la regla D1/D2 sobre `getUsersStore()`; registrado en `handlers/index.ts`
- [x] 5.2 Tests: hook, `DocumentForm` (selects independientes, "(no disponible)", sin candidatos), handler MSW filtra por rol/autor
- [x] 5.3 Actualizar tests existentes de `DocumentForm`/`DocumentFormPage` que pasaban `mockUsers`

## 6. Barrido y verificación

- [x] 6.1 Reconfirmar el inventario de imports desde `src/mocks/` (tabla de design.md) tras los cambios; `DocumentFormPage` y `DocumentForm` sin imports de `mocks/`
- [x] 6.2 Suite completa de tests del frontend, tests del backend y `tsc` (backend 472/472; frontend 1337/1338 — falla `JefeCalidadDashboard.test.tsx` y `tsc` falla en `IncidentForm.tsx:377`, ambos preexistentes y verificados en el baseline sin estos cambios)
- [ ] 6.3 Prueba manual con MSW apagado contra el backend real: crear documento con revisor y aprobador reales y recorrer BORRADOR → EN_REVISION → EN_APROBACION → firma con PIN → PUBLICADO
- [ ] 6.4 Avisar a Toño ("listo") para la verificación de Cowork; reportar el hallazgo de `resolveUserDisplayName` (nombres en detalle) para decidir un change aparte
