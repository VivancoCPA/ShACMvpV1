## Why

Dos defectos menores detectados en M1 (Control Documentario) durante revisión de RN-DOC-013/016: (1) el guard de ruta de `/documents/:id/edit` bloquea a autores legítimos cuyo rol global no está en su lista fija de roles, y otorga acceso de edición a SUPERVISOR sin que exista ninguna base real para ello en `permissions.ts`; (2) `DocumentList` pagina con un tamaño por defecto distinto (5) al resto de listados del sistema, ya inconsistente incluso antes de este fix (NCList también usa 5; solo QEList e IncidentList usan 10). Se agrupan en un solo spec por tamaño reducido, pero se implementan y verifican como cambios independientes.

## What Changes

- El guard de `/documents/:id/edit` deja de basarse solo en una lista fija de roles globales. Ahora permite acceso si el rol global del usuario es `JEFE_CONTROL_DOCUMENTARIO` o `JEFE_CALIDAD_SYST`, **o** si el usuario autenticado es el `autorId` del documento específico solicitado, cargado vía el hook `useDocument(id)` ya existente.
- **BREAKING (comportamiento, no API):** se remueve `SUPERVISOR` de la lista de roles globales permitidos en ese guard. Hoy SUPERVISOR puede editar cualquier documento en `BORRADOR` a través de esta ruta pese a que `permissions.ts` nunca le otorga `canEdit` (se mapea a `DocRole: 'OPERARIO'` → `DENY_ALL`) y el formulario no valida permisos por sí mismo. Esa capacidad desaparece; solo queda cubierta la vía de autoría real.
- `DocumentList` pasa de `pageSize: 5` a `pageSize: 10` en `useDocumentList`, alineándose con `QEList`/`IncidentList`. `NCList` (que también usa 5) queda fuera de este alcance.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `document-management`: la regla de acceso a edición de documento (quién puede llegar al formulario `/documents/:id/edit`) cambia de "rol global en lista fija" a "rol global (Jefe Control Documentario / Jefe Calidad SyST) O autor real del documento". SUPERVISOR pierde acceso de edición vía ruta.

## Impact

- `src/router/index.tsx` — reemplaza el bloque `RoleGuard` de `/documents/:id/edit` por un guard que también verifica autoría.
- Nuevo componente de guard (p. ej. `DocumentEditGuard` en `src/router/`) que usa `useParams` + `useDocument(id)` (TanStack Query, ya existente en `features/documents/hooks/useDocuments.ts`) para resolver `autorId`.
- `src/features/documents/hooks/useDocumentList.ts` — cambia `pageSize: 5` → `pageSize: 10`.
- Sin cambios en `permissions.ts`, en el backend simulado (MSW), ni en el comportamiento de paginación de NCList/IncidentList/QEList/LocalList.
