## Why

El detalle de documento (`/documentos/:id`) apila hoy todo en una sola columna angosta (`max-w-3xl`): encabezado, panel de acciones y cinco acordeones (descripción/archivo, historial, versiones, QE vinculados, NC vinculadas, audit trail). La página se alarga mucho y desperdicia el espacio lateral en pantallas anchas. Toño aprobó un rediseño de dos columnas (encabezado y barra lateral fijos al hacer scroll, contenido principal en pestañas) sobre un mockup de referencia (`Claude outputs/SHAC-Mockup-Detalle-Documento-Opcion1.html`).

## What Changes

- Layout de `DocumentDetailPage` pasa de una columna (`max-w-3xl`) a un contenedor ancho (`max-w-[1440px]`) con grid de dos columnas desde `xl` (≥1280px): contenido con pestañas a la izquierda, barra lateral fija a la derecha. Por debajo de `xl`, una sola columna con la barra lateral antes de las pestañas.
- Encabezado (`DocumentDetailHeader`) pasa a `sticky top-0`, incorpora las acciones de gestión (máximo 2 botones visibles por estado/rol + menú "⋯" para el resto). Los avisos/banners existentes se mueven a una franja a todo el ancho, debajo del encabezado fijo, fuera de la parte sticky.
- Los acordeones actuales de la columna única se reemplazan por pestañas: Resumen, Historial, Versiones, Vínculos (QE+NC), Copias (condicional), Log — cada una reutilizando sin cambios de lógica los componentes ya existentes (`DocumentHistorial`, `DocumentVersionesTab`, `DocumentQEVinculadosList`, `DocumentNCVinculadasList`, `DocumentAuditTrail`). Pestaña activa sincronizada con `?tab=`.
- Nueva barra lateral fija (`sticky`) con tres tarjetas: acciones de lectura (Ver documento / Descargar copia / Emitir copia controlada, condiciones de visibilidad sin cambios), ficha de metadatos (versión vigente, fecha de publicación, tipo, área, próx. revisión, confidencialidad, responsables con avatar+nombre+rol), y actividad reciente (últimas 5 entradas del audit trail, derivadas del mismo `documento`, sin fetch nuevo).
- La lógica de permisos de `DocumentActionPanel` se separa del markup en un hook (`useDocumentActionsAvailability`) para que el encabezado y la barra lateral puedan consumir las mismas banderas sin duplicar reglas de negocio. **Ninguna regla de permisos cambia** — solo dónde se pintan los botones.
- La pestaña "Copias" queda detrás de una condición (feature flag desactivado) porque el change `copias-controladas` del que depende no existe todavía en el repo (ni activo ni archivado) — ver design.md.
- **Backend**: el endpoint `GET /api/users/nombres` (`NombresUsuariosEndpoint`/`NombresUsuariosHandler`/`UserNombreDto`) se extiende para devolver también `nombre`, `apellido` y `avatarUrl` (ya existe como columna `avatar_url` en `asp_net_users`, un string — hoy una data URI base64, nunca una ruta de archivo — ver design.md), sin exponer `email` ni `rol`. **BREAKING** de forma controlada: `UserNombreDto` gana tres campos opcionales adicionales; `nombreCompleto` se mantiene para no romper consumidores existentes de `getName`.
- Frontend: `useUserNames` expone además `getUser(id) → { nombre, apellido, avatarUrl? } | undefined` sin romper `getName`. `UserAvatar` (`components/ui/UserAvatar.tsx`) deja de requerir `rol` (se usa un color de fondo neutro cuando no se provee) para poder usarse con los datos mínimos que expone el endpoint de nombres.

## Capabilities

### New Capabilities
(ninguna — es un rediseño de una página existente, no una funcionalidad nueva)

### Modified Capabilities
- `document-detail`: layout pasa de columna única con acordeones a dos columnas con pestañas + barra lateral fija; el encabezado fijo incorpora las acciones de gestión (antes en `DocumentActionPanel` como fila aparte, cuya lógica de disponibilidad se extrae a `useDocumentActionsAvailability` sin cambiar ninguna regla); los banners se reubican debajo del header fijo. (`document-permissions`, la matriz pura `getDocumentPermissions`, no cambia — la extracción vive en la capa de composición de la página, no en la matriz.)
- `user-names-lookup`: `GET /api/users/nombres` (backend real + handler MSW) amplía su contrato de respuesta con `nombre`, `apellido` y `avatarUrl` opcionales, sin exponer `email`/`rol`. **Nota de secuencia**: esta capability hoy solo existe como delta spec dentro del change `nombres-usuarios-reales` (en progreso, no archivado/sincronizado a `openspec/specs/` todavía) — este change construye su delta sobre esa misma definición en vez de sobre un main spec inexistente; ver design.md.

## Impact

- Frontend: `DocumentDetailPage.tsx` (reescritura de layout), `DocumentDetailHeader.tsx` (sticky + acciones), `DocumentActionPanel.tsx` (se divide en hook de disponibilidad + sub-renderizados para header/menú/sidebar), nuevo componente de pestañas (`components/ui/Tabs` si no existe uno reutilizable), nueva barra lateral (`DocumentDetailSidebar` o similar), `UserAvatar.tsx` (prop `rol` opcional), `useUserNames.ts` (nuevo `getUser`), `userManagement.types.ts` (`UserNombre` gana campos opcionales), `es-PE.json`/`en-US.json` (nuevas claves de pestañas, ficha, actividad reciente, fechas relativas).
- Backend: `UserNombreDto.cs`, `NombresUsuariosHandler.cs` (SQL + mapeo), tests de `NombresUsuariosEndpointTests.cs`.
- MSW: `users.handlers.ts` + fixtures de usuarios (agregar `avatarUrl` a algunas fixtures, no todas).
- Sin cambios de base de datos (la columna `avatar_url` ya existe); sin cambios de rutas ni de permisos de negocio.
