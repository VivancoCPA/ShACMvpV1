## Context

Hoy el destino post-autenticación es un literal `/documentos` repetido en tres lugares independientes:

1. `src/features/auth/hooks/useLogin.ts:18` — `navigate('/documentos')` en el `onSuccess` del mutation de login (login fresco, formulario manual).
2. `src/features/auth/pages/LoginPage.tsx:30-32` — `if (isAuthenticated) return <Navigate to="/documentos" replace />` — cubre el caso de una sesión ya activa (en memoria o restaurada por bootstrap) que navega a `/login` directamente.
3. `src/router/index.tsx:43` — `{ index: true, element: <Navigate to="/documentos" replace /> }`, la ruta índice `/` bajo el árbol protegido por `<RoleGuard />` (sin `requiredRoles`, por lo que solo exige autenticación). Este es el punto que se alcanza tras un hard-refresh o navegación directa a `/` una vez que `authStore.bootstrap()` resuelve `isAuthenticated = true`.

`ADMINISTRADOR_SISTEMA` no tiene acceso a `/documentos` (su `RoleGuard` con `requiredRoles` no lo incluye), así que en los tres casos termina en `/no-autorizado`.

## Goals / Non-Goals

**Goals:**
- Un único punto de verdad para "¿cuál es el destino por defecto de este rol?" que decida `/admin/locales` para `ADMINISTRADOR_SISTEMA` y `/documentos` para todos los demás roles.
- Aplicar ese punto de verdad en los tres sitios identificados sin duplicar la condición `rol === 'ADMINISTRADOR_SISTEMA'`.
- Cubrir explícitamente el caso de bootstrap/hard-refresh, no solo el login manual.

**Non-Goals:**
- No se rediseña `RoleGuard` ni su lógica de autorización por `requiredRoles`.
- No se introduce un concepto general de "última ruta visitada" ni deep-linking post-login (redirect a la URL que el usuario intentaba visitar antes de ser enviado a `/login`); eso queda fuera de alcance de este cambio.
- No se modifica el destino de ningún otro rol.

## Decisions

### Decisión 1: Helper puro `getDefaultRouteForRole`

Se crea `src/router/getDefaultRoute.ts` exportando una función pura:

```typescript
export function getDefaultRouteForRole(rol: UserRole): string {
  if (rol === 'ADMINISTRADOR_SISTEMA') return '/admin/locales'
  return '/documentos'
}
```

**Alternativas consideradas:**
- *Duplicar el `if` en los tres sitios*: descartado — viola el principio de una sola fuente de verdad y ya hubo un incidente de switches exhaustivos incompletos al agregar `ADMINISTRADOR_SISTEMA` (ver notas de M6-S01 en CLAUDE.md); un cuarto sitio futuro repetiría el riesgo.
- *Meterlo dentro de `authStore` como un selector*: descartado — el store no debería conocer rutas de la aplicación (acopla estado global con el árbol de rutas); un helper de módulo en `src/router/` mantiene la responsabilidad de "destinos de ruta" donde corresponde.

### Decisión 2: Cada sitio consume el helper con el `user`/`rol` que ya tiene disponible

- `useLogin.ts`: usa `user.rol` de la respuesta `onSuccess` (ya disponible, no requiere leer el store por separado).
- `LoginPage.tsx`: usa `user` del `authStore` (ya se lee `isAuthenticated`; se añade lectura de `user`).
- `router/index.tsx`: la ruta índice no puede leer el store directamente en un objeto de configuración de `createBrowserRouter`; se envuelve en un pequeño componente (`DefaultRouteRedirect`) que lee `useAuthStore` y renderiza `<Navigate to={getDefaultRouteForRole(user.rol)} replace />`. Este componente vive junto al helper o en `router/index.tsx` mismo, según simplicidad.

**Alternativa considerada:** calcular el destino en `RoleGuard` mismo y exponerlo vía contexto — descartado por ser un cambio más invasivo que introduce acoplamiento nuevo entre `RoleGuard` y el concepto de "destino por defecto", que solo aplica a la ruta índice, no a todas las rutas protegidas.

### Decisión 3: No tocar `RoleGuard`

El `RoleGuard` sigue siendo agnóstico a "destinos por defecto" — solo autentica y autoriza. La resolución de destino vive exclusivamente en los tres puntos de salida (login fresco, login-ya-autenticado, ruta índice).

## Risks / Trade-offs

- [Riesgo] Un cuarto lugar futuro que redirija a `/documentos` hardcodeado repetiría el bug para nuevos roles de sistema puro → Mitigación: el helper es la única función que debe usarse para "destino por defecto post-auth"; se documenta con un comentario corto en el archivo señalando que es la fuente única.
- [Riesgo] `LoginPage.tsx` podría montarse con `user === null` pero `isAuthenticated === true` en un estado transitorio inconsistente del store → Mitigación: no es un caso nuevo introducido por este cambio (ya existía la lectura de `isAuthenticated` sin `user`); se mantiene el fallback a `/documentos` si `user` es `null` en ese instante, igual que el comportamiento actual.

## Migration Plan

Cambio de código puro en frontend, sin migración de datos ni backend. Se despliega junto con el resto de la SPA; no requiere pasos de rollback especiales más allá de revertir el commit.

## Open Questions

Ninguna — el alcance y los tres puntos de intervención quedaron confirmados por inspección directa del código antes de escribir este documento.
