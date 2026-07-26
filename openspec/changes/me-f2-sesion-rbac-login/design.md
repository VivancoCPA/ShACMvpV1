## Context

Verificado en código (`shc-controldoc/src/`), no solo en el proposal de Fase 1:

- `authStore.ts` (`user`, `accessToken`, `isAuthenticated`, `isBootstrapping`) no tiene ningún campo de empresa. `User.rol` (`types/auth.types.ts`) es un único valor plano por usuario.
- `RoleGuard.tsx`, `routeAccess.ts` (`isRouteAllowedForRole`) y `getDefaultRoute.ts` (`getDefaultRouteForRole`) reciben `rol: UserRole` como parámetro simple — no conocen la sesión, solo el valor que el call site les pasa (siempre `user.rol` de `authStore`, o `user.rol` de la respuesta de login/refresh).
- Los `*Permissions.ts` de cada dominio (`documents/permissions.ts`, `qualityEventPermissions.ts`, `ncPermissions.ts`, `incidentPermissions.ts`, `areasPermissions.ts`, `localesPermissions.ts`) reciben un `usuario: User` completo y leen `usuario.rol` internamente — mismo patrón, mismo punto de entrada.
- Un grep de `\.rol\b` en `src/` (69 archivos) muestra que la enorme mayoría son: (a) componentes/hooks cliente que leen `authStore.user.rol` (directa o vía las funciones anteriores), o (b) handlers MSW que hacen su propia verificación de rol "server-side" para decisiones de negocio (ej. RN-QE-004 firma dual, aprobar/rechazar documentos).
- **Hallazgo crítico para esta fase:** los handlers MSW de Documentos, Dashboard, Incidentes, No Conformidades y Notificaciones (`nonconformities.handlers.ts`, `incidents.handlers.ts`, `documents.handlers.ts`, `dashboard.handlers.ts`, `notifications.handlers.ts`) definen — cada uno por su cuenta, ~duplicada — una función `getUserFromRequest(request)` que parsea el userId del Bearer token (`mock-access-token-<userId>-<timestamp>`) y busca ese usuario **directo en `authFixtures`/`getUsersStore()`** (el fixture crudo, con su `rol` fijo de un solo valor). El handler de Quality Events, en cambio, ya lee `useAuthStore.getState().user` directamente (nota existente en CLAUDE.md). Hoy da igual cuál de los dos patrones use cada handler porque `User.rol` es un único valor — pero en cuanto el rol pase a depender de `empresaActivaId`, ambos patrones dejan de ser equivalentes: `getUserFromRequest` seguiría devolviendo el rol "de base de datos" (estático, ligado a ninguna empresa en particular) mientras que `useAuthStore.getState().user.rol` reflejaría correctamente la empresa activa de la sesión.
- `Empresa`/`UsuarioEmpresa` (Fase 1, aplicada) ya existen en `src/features/empresas/types/empresa.types.ts` y `src/mocks/fixtures/empresas.fixtures.ts`, con `user-supervisor-001` asignado a ambas empresas con rol distinto (`SUPERVISOR` en `empresa-001`, `JEFE_CALIDAD_SYST` en `empresa-002`).
- `mockSession.ts` ya establece el patrón de persistir en `localStorage` lo que un backend real guardaría en una cookie httpOnly (ver nota de CLAUDE.md) — mismo mecanismo se reutiliza aquí para `empresaActivaId`, porque MSW en modo Service Worker no puede fijar cookies reales desde una respuesta sintética.
- `queryClient.ts` no tiene lógica de invalidación por dominio; es una instancia `QueryClient` plana.

## Goals / Non-Goals

**Goals:**
- `authStore` pasa a tener una única fuente de verdad de sesión: `user` (con `rol` ya resuelto como rol efectivo), `empresaActivaId`, `empresasDisponibles`.
- El login resuelve la empresa activa (auto-selección o paso explícito) y el rol efectivo antes de considerar la sesión completa.
- Cambiar de empresa activa desde `TopNav` actualiza `user.rol`/`empresaActivaId` sin re-login y limpia el caché de TanStack Query.
- Consolidar la resolución de "usuario actuante" en los handlers MSW en un único punto que use el rol efectivo de sesión, eliminando la duplicación de `getUserFromRequest` y el riesgo de rol desincronizado.
- Ningún call site cliente (`RoleGuard`, `routeAccess.ts`, `getDefaultRoute.ts`, `Sidebar.tsx`, `*Permissions.ts` de dominio) requiere cambio de firma — todos siguen recibiendo `UserRole`/`User` como hoy.

**Non-Goals (explícitamente diferido a fases futuras):**
- Filtrar los datos devueltos por handlers MSW de Documentos/Incidentes/NC/QE/Locales según `empresaId` (Fase 3) — esta fase solo corrige la resolución del **rol**, no el alcance de los **datos** listados.
- CRUD de `Empresa`/`UsuarioEmpresa`, gestión de asignaciones usuario↔empresa (Fase 4). El módulo `features/users/` sigue leyendo/escribiendo `User.rol` como campo plano de fixture — queda una inconsistencia conocida (ver Risks) hasta Fase 4.
- Theming por empresa (logo en sidebar/header más allá del selector, colores por tenant).

## Decisions

### D1 — `empresaActivaId` y `empresasDisponibles` viven en `authStore`, no en `User`
`User` (`types/auth.types.ts`) sigue siendo la forma que refleja "el usuario" — `empresaActivaId` es un concepto de sesión (qué contexto está activo ahora mismo), no un atributo del usuario, igual que `accessToken`. Se agrega a `AuthState`:
```typescript
interface AuthState {
  user: User | null                 // user.rol = rol efectivo en empresaActivaId
  empresaActivaId: string | null
  empresasDisponibles: Empresa[]    // empresas ACTIVAS asignadas al usuario logueado
  accessToken: string | null
  isAuthenticated: boolean
  isBootstrapping: boolean
}
```
Alternativa descartada: anidar `empresaActiva: Empresa` completo dentro de `User` — se descarta porque mezclaría un concepto de sesión dentro del DTO de usuario, y complicaría el tipo `User` que otras partes de la app (ej. `UserManagement` de M6) siguen usando como entidad plana de negocio.

### D2 — `User.rol` se reescribe como "rol efectivo", no se agrega un campo paralelo
Se descarta agregar `rolEfectivo` como campo nuevo junto a `rol` (que dejaría `rol` obsoleto pero presente, con alto riesgo de que algún call site siga leyendo el campo viejo por error). En su lugar, el `user` que entrega `authStore` **siempre** trae `rol` ya resuelto para `empresaActivaId` — el mismo campo, mismo tipo (`UserRole`), mismo nombre. Esto es lo que permite que los 69 archivos que hoy leen `.rol` sigan funcionando sin tocarse: siguen leyendo el mismo campo, que ahora se puebla correctamente. La fuente "cruda" (`UsuarioEmpresa.rol` por empresa) nunca se expone directamente a componentes — solo la usan los puntos de resolución (login, refresh, switch, handlers MSW).

### D3 — Consolidar `getUserFromRequest` en un helper de sesión compartido
Se crea `src/mocks/handlers/shared/session.ts` con `getSessionUser()` — lee `useAuthStore.getState().user` (ya con rol efectivo) en vez de re-derivar desde `authFixtures`/`getUsersStore()` por token. Los 5 handlers que hoy duplican `getUserFromRequest` (`documents.handlers.ts`, `dashboard.handlers.ts`, `incidents.handlers.ts`, `nonconformities.handlers.ts`, `notifications.handlers.ts`) migran a este helper; `quality-events.handlers.ts` ya sigue este patrón y solo cambia el import. El Bearer token se sigue validando (401 si falta/no matchea el userId de la sesión) pero deja de ser la fuente del `rol` — la sesión activa lo es. Alternativa descartada: extender el formato del token para incluir `empresaId` (`mock-access-token-<userId>-<empresaId>-<timestamp>`) y re-derivar el rol vía `usuarioEmpresaFixtures` en cada handler — se descarta por tocar la emisión de tokens en 2 handlers de auth + el parseo en 5 handlers de dominio para replicar información que la sesión del navegador ya tiene disponible en memoria (MSW Service Worker corre en el mismo contexto JS que la app — no es un backend real separado); es más superficie de cambio por el mismo resultado, y ya existe precedente de este atajo (`quality-events.handlers.ts`).

### D4 — Flujo de login en dos pasos cuando hay más de una empresa
`POST /api/auth/login` acepta `{ email, password, empresaId? }`:
- Si el usuario tiene exactamente 1 `UsuarioEmpresa` con `estado === 'ACTIVO'` → resuelve inmediatamente, ignora `empresaId` si vino, retorna sesión completa.
- Si tiene más de una y `empresaId` está ausente → responde 200 con `{ requiresEmpresaSelection: true, empresasDisponibles }`, **sin** `accessToken` ni `user` — el frontend no considera esto un login exitoso (no llama a `authStore.login()`).
- Si tiene más de una y `empresaId` viene informado → valida que esa empresa esté en las asignadas y `ACTIVO`, resuelve el rol vía `usuarioEmpresaFixtures`, retorna sesión completa.

`LoginPage` maneja la respuesta `requiresEmpresaSelection` mostrando un paso de selección (reutilizando el mismo formulario ya validado — no se piden credenciales de nuevo) antes de reintentar el submit con `empresaId`. Alternativa descartada: endpoint separado `POST /auth/select-empresa` — se descarta porque duplicaría la lógica de validación de credenciales/empresa entre dos handlers sin necesidad; un único endpoint parametrizado es más simple de mantener en mock.

### D5 — Selección de empresa nunca se salta silenciosamente para usuarios multi-empresa
Un usuario con más de una empresa asignada **siempre** ve el paso de selección — la "última empresa usada" (persistida, ver D7) solo se usa para **pre-seleccionar/resaltar** una opción por conveniencia, nunca para saltarse el paso. Evita que alguien inicie sesión en el contexto de empresa equivocado sin darse cuenta. Usuarios con una sola empresa asignada nunca ven este paso (autoselección real, sin fricción).

### D6 — Cambio de empresa activa reutiliza el flujo de emisión de token
`POST /api/auth/switch-empresa` con `{ empresaId }` (autenticado, mismo Bearer token) valida que la empresa esté entre las asignadas y `ACTIVO` al usuario de la sesión, resuelve el nuevo rol efectivo, y responde con la misma forma que un login completo (`accessToken` nuevo, `user` con `rol` actualizado, `empresaActivaId`, `empresasDisponibles`). Reemitir el `accessToken` (aunque el mock no codifica claims reales dentro del string) mantiene la simulación honesta de cómo se comportaría un backend real con JWT: cambiar de contexto de autorización implica un token nuevo, no editar uno existente en el cliente.

### D7 — Persistencia de `empresaActivaId` para sobrevivir a un refresh de página
Se extiende `lib/mockSession.ts` con `persistActiveEmpresaId(id: string | null)` / `readActiveEmpresaId(): string | null`, misma clave de `localStorage` que el patrón ya usado para `mockRefreshToken`. Se actualiza en cada login/switch exitoso y se limpia en logout. `POST /api/auth/refresh` recibe este valor como header (`X-Mock-Empresa-Activa`, mismo patrón que `X-Mock-Refresh-Token`) para poder resolver el rol efectivo correcto al restaurar sesión — sin este dato, un refresh de página perdería el contexto de empresa activa y volvería a autoseleccionar por defecto. Este mismo valor persistido es el que D5 usa como sugerencia por defecto en el selector de login. Se documenta como mock-only (igual que `mockRefreshToken`) — un backend real codificaría `empresaActivaId` dentro del propio JWT/sesión de servidor, no en `localStorage`.

### D8 — Invalidación de caché: `queryClient.clear()` completo, no invalidación selectiva
Al cambiar de empresa (`switch-empresa` exitoso), se llama `queryClient.clear()` — vacía todo el caché de TanStack Query, no solo claves "scoped por empresa". Se prefiere sobre `invalidateQueries` selectivo porque hoy ningún `QUERY_KEYS` está diseñado con `empresaId` como parte de la clave (eso es trabajo de Fase 3); intentar invalidar selectivamente ahora requeriría adivinar qué claves son sensibles a empresa sin ese diseño, con riesgo real de dejar algo cacheado por error. El costo (refetch de todo tras un switch, evento poco frecuente) es aceptable.

### D9 — Redirección post-switch si la ruta actual ya no es válida para el nuevo rol
El hook `useSwitchEmpresa()` (mutation), tras actualizar `authStore` y limpiar el caché, reutiliza `isRouteAllowedForRole(location.pathname, nuevoRol)` (ya existe, usado por `useLogin`/`LoginPage`) — si la ruta actual no está permitida para el rol resuelto en la nueva empresa, navega a `getDefaultRouteForRole(nuevoRol)`; si sigue permitida, se queda donde está (el contenido se refresca solo por el `queryClient.clear()`).

### D10 — Layout de dos paneles en `LoginPage`
Panel izquierdo: arte institucional genérico de SHAC (estático, sin logo de empresa — no se conoce la empresa antes de autenticar). Panel derecho: formulario existente (email/password, selector de rol dev-only, y el paso nuevo de selección de empresa cuando aplica, D4/D5) — se mantiene el mismo componente `LoginPage`, solo cambia el layout contenedor y se agrega el paso condicional. El selector de empresa en `TopNav` (post-login) sí puede mostrar `razonSocial`/`logoUrl` de cada opción, porque ahí ya se conoce el usuario autenticado.

## Risks / Trade-offs

- **[Riesgo]** El módulo `features/users/` (Gestión de Usuarios, M6) sigue creando/editando `User.rol` como campo plano de fixture — un admin que edite el rol de un usuario ahí **no** toca su(s) fila(s) `UsuarioEmpresa`, y el nuevo mecanismo de resolución de rol efectivo ignora por completo `User.rol` como fuente. Esto deja esa pantalla de administración desalineada con el nuevo modelo hasta Fase 4. → **Mitigación:** se documenta explícitamente como Non-Goal (Fase 4 lo resuelve) y se deja advertencia en el resumen final de esta fase para que no se lea como una regresión no intencional.
- **[Riesgo]** Consolidar `getUserFromRequest` en `getSessionUser()` (D3) cambia el comportamiento de los handlers MSW de "resolver por token" a "resolver por sesión en memoria" — si algún test unitario de handlers construye requests con un Bearer token de un usuario que **no** coincide con el `authStore` mockeado en ese test, el resultado cambiaría. → **Mitigación:** tasks.md incluye un paso explícito de revisar y, si hace falta, actualizar los tests de cada handler tocado (`documents.handlers.test.ts`, `dashboard.handlers.test.ts`, etc.) para que seteen `authStore` en vez de (o además de) el token.
- **[Riesgo]** El flujo de login en dos pasos (D4) puede introducir un estado intermedio confuso si el usuario refresca la página en medio de la selección de empresa (antes de tener `accessToken`). → **Mitigación:** ese estado intermedio no se persiste en ningún lado (ni `authStore` ni `localStorage`) — un refresh en medio del paso de selección simplemente vuelve a `/login` desde cero, sin sesión parcial que limpiar.
- **[Riesgo]** `queryClient.clear()` (D8) es una operación "todo o nada" — en una demo con datos pesados podría sentirse como un parpadeo de carga notorio al cambiar de empresa. → **Mitigación:** trade-off aceptado explícitamente (ver D8); es un evento infrecuente (cambio de contexto, no navegación normal), y el proposal ya pide invalidación completa, no selectiva.

## Migration Plan

No hay backend real ni base de datos — "migrar" significa: (1) agregar `empresaActivaId`/`empresasDisponibles` a `authStore` y los tipos de respuesta de auth, (2) actualizar handlers de `/auth/login`, `/auth/refresh`, agregar `/auth/switch-empresa`, (3) crear `getSessionUser()` compartido y migrar los 5 handlers duplicados + `quality-events.handlers.ts`, (4) construir el paso de selección de empresa en `LoginPage` + layout de dos paneles, (5) construir el selector de `TopNav` + `useSwitchEmpresa()`, (6) correr `tsc --noEmit` y la suite completa, revisando especialmente los tests de handlers afectados por D3, (7) verificar manualmente en navegador con `user-supervisor-001` (login con selección de empresa, cambio de contexto sin re-login, permisos/sidebar cambiando). No hay rollback especial más allá de revertir el commit.

## Open Questions

- ¿El selector de empresa en `TopNav` debe mostrar el logo (`Empresa.logoUrl`) además de `razonSocial`, o solo texto? Se asume solo texto por simplicidad visual en el header (el logo real de estas empresas de prueba es un placeholder, ver Fase 1); se puede ajustar en implementación sin impacto de diseño.
- ¿`ADMINISTRADOR_SISTEMA` debería quedar exento del flujo de selección de empresa incluso si en el futuro se le asigna a más de una (dado que su alcance es exclusivamente M6 y no opera dentro de ningún módulo operativo por empresa)? Hoy en los fixtures tiene una sola empresa asignada, así que no bloquea esta fase — se deja constancia por si Fase 4 decide asignar admins a múltiples empresas.
