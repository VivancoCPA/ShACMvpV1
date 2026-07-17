## 1. Reset por dominio en handlers MSW

- [x] 1.1 En `src/mocks/handlers/quality-events.handlers.ts`: agregar y exportar `resetStore()` que reasigna `qeStore = [...qualityEventFixtures]`.
- [x] 1.2 En `src/mocks/handlers/nonconformities.handlers.ts`: agregar y exportar `resetStore()` que reasigna `nonconformities = [...nonconformityFixtures]`.
- [x] 1.3 En `src/mocks/handlers/incidents.handlers.ts`: agregar y exportar `resetStore()` que reasigna `incidents = [...incidentFixtures]`.
- [x] 1.4 En `src/mocks/handlers/locales.handlers.ts`: agregar y exportar `resetStore()` que reasigna `locales = localFixtures.map((l) => ({ ...l }))` y `zonas = zonaFixtures.map((z) => ({ ...z }))`.
- [x] 1.5 Confirmar que `src/mocks/handlers/documents.handlers.ts` ya expone `resetStore()` (existente, sin cambios) y que su firma es reutilizable tal cual desde el módulo central.

## 2. Módulo central de reset

- [x] 2.1 Crear `src/mocks/resetAllStores.ts` con `resetAllMockStores()` que importa y llama el `resetStore()` de los cinco handlers de dominio (documents, quality-events, nonconformities, incidents, locales).
- [x] 2.2 Agregar comentario en `resetAllStores.ts` enumerando explícitamente los dominios cubiertos, para que agregar un store mutable nuevo en el futuro recuerde actualizar este archivo.

## 3. Página dev-only y ruta

- [x] 3.1 Crear `src/pages/dev/DevResetMocksPage.tsx` con un control que, al activarse, pide confirmación (`window.confirm` o modal básico) antes de ejecutar el reset.
- [x] 3.2 Al confirmar: llamar `resetAllMockStores()` y luego `window.location.reload()`. Al cancelar: no ejecutar ninguna acción.
- [x] 3.3 Registrar la ruta `/dev/reset-mocks` en `src/router/index.tsx` como hija directa de `<AppShell>`, fuera de cualquier `<RoleGuard requiredRoles={...}>` adicional (mismo bloque que `/dev/semaforo-preview`), con comentario aclarando que es dev-only.
- [x] 3.4 Confirmar que `/dev/reset-mocks` no se agrega a `Sidebar.tsx` ni a ningún menú de producción.

## 4. Verificación manual

- [x] 4.1 Con el dev server corriendo, modificar un registro de cada dominio (documento, quality event, no conformidad, incidente, local/zona) vía la UI normal.
- [x] 4.2 Navegar a `/dev/reset-mocks`, confirmar el reset, y verificar tras el reload que los cinco dominios volvieron a su estado de fixtures original.
- [x] 4.3 Verificar que la sesión sigue activa tras el reload (no redirige a `/login`).
- [x] 4.4 **Resuelto vía addendum (`/opsx:sync`, ver `specs/dev-mock-reset/spec.md`):** se verificó (Playwright, `npm run dev`, repetido 2x) que un usuario modificado vía `/usuarios/:id/toggle-active` **sí se revierte** tras `/dev/reset-mocks`. Causa raíz: `window.location.reload()` por sí solo ya reinicializa TODOS los stores mock a fixtures — incluido `authFixtures` — porque los handlers MSW y sus `let store` viven en el contexto JS de la página, no en el Service Worker, y un reload real destruye y re-ejecuta ese contexto completo. Decisión: se acepta este comportamiento como correcto (no se persigue excluir usuarios); se corrigió `specs/dev-mock-reset/spec.md`, `proposal.md` y `design.md` para reflejarlo. No se requirió cambio de código — el comportamiento observado ya era el correcto una vez corregida la expectativa.
