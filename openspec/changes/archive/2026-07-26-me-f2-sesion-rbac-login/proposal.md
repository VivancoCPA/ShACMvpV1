## Why

La Fase 1 (`me-f1-modelo-datos`, aplicada) agregó las entidades `Empresa` y `UsuarioEmpresa` y etiquetó la mock data transaccional con `empresaId`, pero explícitamente dejó `User.rol` como única fuente de verdad para RBAC y no tocó el login (ver design.md de Fase 1, Non-Goals). Hoy `authStore`, `RoleGuard`, `routeAccess.ts`, `getDefaultRouteForRole` y todos los `*Permissions.ts` de dominio siguen leyendo un rol fijo por usuario — no existe ningún concepto de "empresa activa" en la sesión, y un usuario asignado a dos empresas con roles distintos (ya modelado en `usuarioEmpresaFixtures`, ver `user-supervisor-001`) no tiene forma de operar con el rol correcto en cada una. Esta fase conecta la sesión real al modelo multiempresa ya existente.

## What Changes

- **ADDED**: Resolución de **empresa activa** en el login vía `UsuarioEmpresa` — autoselección si el usuario tiene una sola empresa asignada; paso de selección explícito si tiene más de una (con la última empresa usada como default sugerido).
- **ADDED**: `LoginPage` pasa a layout de dos paneles (arte institucional genérico SHAC a la izquierda, formulario a la derecha) — el arte no puede ser específico de una empresa porque esta aún no se conoce antes de autenticar.
- **ADDED**: Selector de **empresa activa** en `TopNav`, visible solo para usuarios con más de una empresa asignada, para cambiar de contexto sin cerrar sesión.
- **ADDED**: Invalidación completa de `queryClient` (TanStack Query) al cambiar de empresa activa, para no mezclar datos cacheados entre contextos.
- **MODIFIED**: El objeto `user` de la sesión (`authStore`) deja de portar un `rol` fijo de base de datos y pasa a portar el **rol efectivo** — resuelto contra `UsuarioEmpresa` + `empresaActivaId` en cada login, refresh y cambio de empresa. Todo call site que hoy lee `user.rol` (RoleGuard, `routeAccess.ts`, `getDefaultRouteForRole`, Sidebar, TopNav, los `*Permissions.ts` de cada dominio) sigue leyendo el mismo campo — el cambio es de *dónde sale ese valor*, no de la forma en que se consume. Ver design.md para el inventario completo de puntos de lectura auditados.
- **MODIFIED**: Estado de sesión (`authStore` + handlers MSW de `/auth/login` y `/auth/refresh`) agrega `empresaActivaId`, persistido de forma que sobreviva a un refresh de página (mismo mecanismo mock-only que el refresh token en `localStorage`, ver `lib/mockSession.ts`).

Explícitamente **fuera de alcance de este cambio**:
- Filtrado por empresa de los handlers MSW de Documentos, Incidentes, NC, QE, Locales/Zonas (Fase 3) — las listas seguirán mostrando registros de ambas empresas mezclados.
- CRUD de administración de empresas y de asignación `Usuario` ↔ `UsuarioEmpresa` (Fase 4). El módulo de Gestión de Usuarios (`features/users/`) sigue creando/editando `User.rol` como campo plano tal como hoy — es una inconsistencia conocida con el nuevo modelo que Fase 4 resuelve, no esta fase.
- Verificación de exports/reportes cross-empresa (Fase 5).

## Capabilities

### New Capabilities
- `empresa-session`: resolución y persistencia de `empresaActivaId` en la sesión (login, refresh, cambio de empresa), cálculo del rol efectivo a partir de `UsuarioEmpresa`, e invalidación del `queryClient` al cambiar de empresa.

### Modified Capabilities
- `auth-flow`: `LoginPage` pasa a layout de dos paneles; el flujo de login incorpora el paso de resolución/selección de empresa activa antes de redirigir al destino por rol; los handlers MSW de `/auth/login` y `/auth/refresh` devuelven `empresaActivaId` y el rol efectivo resuelto.
- `app-navigation`: `TopNav` agrega el selector de empresa activa (solo usuarios multi-empresa); el filtrado de `Sidebar` por rol sigue leyendo `authStore.user.rol`, ahora poblado como rol efectivo por `empresa-session`.

## Impact

- **Specs afectadas**: `auth-flow`, `app-navigation`, más la nueva `empresa-session`. Los specs de permisos por dominio (`document-permissions`, `incident-permissions`, `quality-event-permissions`, `nonconformity-permissions`, `area-permissions`, `location-permissions`) no requieren delta — sus requirements ya están expresados en términos de `rol`, y ese contrato no cambia; solo se auditan sus puntos de lectura (ver Notas de implementación).
- **Código afectado**: `src/stores/authStore.ts`, `src/mocks/handlers/auth.handlers.ts`, `src/features/auth/pages/LoginPage.tsx`, `src/features/auth/hooks/useLogin.ts`, `src/features/auth/api/auth.api.ts`, `src/types/auth.types.ts` (o tipo nuevo de sesión), `src/components/layout/TopNav.tsx`, `src/lib/queryClient.ts`, `src/lib/mockSession.ts` (o equivalente para persistir `empresaActivaId`), y — solo como puntos de auditoría, no de reescritura — `RoleGuard.tsx`, `routeAccess.ts`, `getDefaultRoute.ts`, `Sidebar.tsx`, y los `*Permissions.ts` de cada dominio.
- **Riesgo**: medio-alto — toca la capa de sesión y RBAC que protege rutas y acciones en toda la app (69 archivos referencian `.rol` hoy). El riesgo se mitiga manteniendo la forma actual de `user.rol` como punto de lectura único, en vez de migrar cada call site a una API nueva.
- **Dependencias**: requiere Fase 1 aplicada (ya cumplido — `Empresa`, `UsuarioEmpresa`, `empresaId` en entidades transaccionales, mock data de 2 empresas con `user-supervisor-001` asignado a ambas).

## Notas de implementación

Antes de escribir código: diagnosticar y listar en design.md todos los puntos donde hoy se lee `user.rol` o se decide un permiso/ruta por rol (grep de `.rol` ya identificó 69 archivos candidatos), clasificándolos en (a) leen `authStore.user.rol` directamente — no requieren cambio de código, solo quedan cubiertos automáticamente por la resolución en `empresa-session`, y (b) leen el rol desde otra fuente (fixture crudo, prop pasada manualmente, etc.) — estos sí requieren migración explícita a la sesión activa. No migrar a medias: cualquier punto de la categoría (b) que quede sin resolver antes de cerrar la fase debe quedar documentado como riesgo abierto, no silenciado.

Verificación clave a pedirle a Toño: iniciar sesión con `user-supervisor-001` (asignado a `empresa-001` como `SUPERVISOR` y a `empresa-002` como `JEFE_CALIDAD_SYST`), confirmar que el login pide elegir empresa, y que el rol/permisos visibles (sidebar, acciones disponibles) cambian correctamente al alternar entre empresas con el selector del header, sin necesidad de re-login.
