## Context

`Local` y `Zona` fueron definidos en M3-S01 (`src/features/incidents/types/incident.types.ts`) exclusivamente como catálogo de apoyo para `IncidentForm` (M3-S04) y la vista de Mapa (M3-S05). No existe hoy ninguna capa de permisos, reglas de negocio ni rutas para administrar ese catálogo — es deuda técnica de ADD-03 que M6 debe saldar antes de construir la UI de administración (M6-S03/S04) y su capa de datos (M6-S02).

El `UserRole` actual (`src/types/auth.types.ts`) no incluye un rol de administración de sistema. El usuario confirmó agregar `'ADMINISTRADOR_SISTEMA'` como nuevo valor del union type en lugar de reutilizar `JEFE_CONTROL_DOCUMENTARIO` o `ALTA_DIRECCION`, para mantener la separación de responsabilidades entre control documentario, dirección y administración técnica del catálogo de Locales/Zonas.

## Goals / Non-Goals

**Goals:**
- Definir los helpers de permisos (`puedeAdministrarLocales`, `puedeConsultarLocales`) y de reglas de negocio (`puedeCrearLocalActivo`, `puedeDesactivarLocal`, `puedeDesactivarZona`) como funciones puras, testeables de forma aislada.
- Extender `UserRole` con `'ADMINISTRADOR_SISTEMA'` de forma retrocompatible con el código existente.
- Registrar `/admin/locales` y `/admin/locales/:id` en el router siguiendo el patrón ya usado por otras rutas protegidas (`RoleGuard` a nivel de ruta + verificación adicional a nivel de componente para acciones).
- Definir los schemas Zod `localFormSchema` y `zonaFormSchema` que consumirá el formulario en M6-S04.

**Non-Goals:**
- No se construye UI de listado/formulario (M6-S03/S04).
- No se crea API client, fixtures ni handlers MSW para locales/zonas administrativos (M6-S02) — el hook `useLocales` y sus fixtures ya existen para el caso de uso de solo-lectura de M3 y no se tocan aquí.
- No se redefinen `Local` ni `Zona`; tampoco se les agregan campos (p. ej. `planoAncho`/`planoAlto` viven solo en el schema del formulario en esta etapa, no en la entidad).
- No se implementa lógica de mapa o selección visual de zonas (ya cubierta en M3-S04/S05).

## Decisions

### 1. Extender `UserRole` con `ADMINISTRADOR_SISTEMA` en lugar de reutilizar un rol existente
Confirmado con el usuario. Alternativas consideradas: reutilizar `JEFE_CONTROL_DOCUMENTARIO` o `ALTA_DIRECCION`. Se descartaron porque mezclarían responsabilidades no relacionadas (control documentario o dirección general) con administración técnica de un catálogo de infraestructura física.
**Impacto colateral**: cualquier `switch` exhaustivo sobre `UserRole` sin `default` (p. ej. `getIncidentPermissions` en `src/features/incidents/utils/incidentPermissions.ts`) deja de compilar hasta agregar el caso `'ADMINISTRADOR_SISTEMA'`. Como parte de las tareas de esta spec se debe localizar y actualizar esos switches para que sigan siendo exhaustivos (retornando `DENY_ALL`/equivalente, ya que `ADMINISTRADOR_SISTEMA` no participa en los dominios de Incidentes/NC/QE).

### 2. Dos helpers de permisos en vez de un enum de niveles de acceso
`puedeAdministrarLocales` y `puedeConsultarLocales` son funciones booleanas independientes (no un helper único que retorne un nivel `'none' | 'read' | 'admin'`) para seguir el patrón ya establecido en el proyecto (`getIncidentPermissions`, `getNcPermissions`, etc.): funciones puras por capacidad, no un objeto de "nivel". Esto también simplifica su uso directo en `RoleGuard` y en checks de UI (`{puedeAdministrarLocales(user) && <Button .../>}`).

### 3. `RoleGuard` a nivel de ruta usa una lista estática de roles, no las funciones de permiso directamente
`RoleGuard` (`src/router/RoleGuard.tsx`) solo acepta `requiredRoles: UserRole[]`, no predicados. Para `/admin/locales` y `/admin/locales/:id` se usa `requiredRoles={['ADMINISTRADOR_SISTEMA', 'JEFE_CALIDAD_SYST']}` — el mismo conjunto de roles que `puedeConsultarLocales` acepta — de modo que el guard de ruta y el helper de permisos queden sincronizados por construcción. La visibilidad de acciones de administración (crear/editar/desactivar) dentro de la página se controla con `puedeAdministrarLocales(user)`, replicando el patrón ya usado en la ruta `/quality-events` (guard amplio a nivel de ruta, control fino de acciones a nivel de componente). No se modifica `RoleGuard` para aceptar predicados: sería un cambio más amplio, no justificado por el alcance de esta spec.

### 4. Los helpers de reglas de negocio reciben arrays ya cargados, no hacen fetch
`puedeCrearLocalActivo(locales: Local[])`, `puedeDesactivarLocal(local, incidentes)` y `puedeDesactivarZona(zona, incidentes)` son funciones puras que reciben los datos ya resueltos (vía hooks de TanStack Query en capas superiores, fuera de alcance aquí). Mantiene los helpers testeables sin mocks de red y reutilizables tanto en UI como en validaciones de schema si fuera necesario más adelante.

### 5. Ubicación de los helpers de reglas de negocio
Se colocan junto a los de permisos bajo `src/features/locations/` (no bajo `src/features/incidents/`) porque, aunque operan sobre `Incidente[]` para contar bloqueos, la regla de negocio pertenece al dominio de administración de Locales/Zonas (M6), no al de Incidentes (M3). `Local`/`Zona`/`Incidente` se importan como tipos desde su ubicación actual en `incidents/types`.

## Risks / Trade-offs

- **[Riesgo] Switches exhaustivos rotos en otros dominios** al agregar `ADMINISTRADOR_SISTEMA` a `UserRole` → **Mitigación**: tarea explícita de grep + actualización de cada `switch (userRole)` sin `default` antes de cerrar esta spec; se verifica con `tsc --noEmit`.
- **[Riesgo] Desalineación entre `RoleGuard` (lista estática) y `puedeConsultarLocales` (función)** si en el futuro cambia la regla de negocio de quién puede consultar → **Mitigación**: se documenta explícitamente en el requirement de routing que ambos deben mantenerse sincronizados; cualquier cambio a `puedeConsultarLocales` requiere revisar el `requiredRoles` de las rutas `/admin/locales*`.
- **[Trade-off] `localFormSchema` valida campos (`planoAncho`, `planoAlto`) que aún no existen en la interfaz `Local`** → aceptado conscientemente: el mapeo de estos campos calculados a la entidad ocurre en M6-S02/S04 (fuera de alcance); el schema define el contrato del formulario, no el de la entidad persistida.

## Open Questions

Ninguna pendiente — el punto de mayor ambigüedad (rol de administración inexistente) fue resuelto con el usuario antes de este documento.
