## Why

Cada dominio MSW (`documents`, `quality-events`, `nonconformities`, `incidents`, `locales`) mantiene su propio store mutable in-memory que persiste entre logins dentro de la misma pestaña. El 2026-07-15/16 esto causó una falsa alarma de "regresión grave": una mutación de una prueba manual anterior (`PATCH /status` sobre un documento) quedó en el store y fue mal interpretada como bug de permisos en una sesión posterior, sin que `logout()` ni ninguna navegación la revirtiera. Hoy la única forma de limpiar el estado mock es reiniciar el servidor de desarrollo. Se necesita una herramienta dev-only para reiniciar todos los stores mock a su estado de fixtures original sin ese reinicio.

## What Changes

- Agregar `resetStore()` (o equivalente) exportado en cada handler de dominio con store mutable que hoy carece de él: `quality-events.handlers.ts` (`qeStore`), `nonconformities.handlers.ts` (`nonconformities`), `incidents.handlers.ts` (`incidents`), `locales.handlers.ts` (`locales` + `zonas`). `documents.handlers.ts` ya expone `resetStore()` — se reutiliza tal cual.
- Agregar una función central `resetAllMockStores()` (nuevo módulo, p.ej. `src/mocks/resetAllStores.ts`) que invoca el reset de todos los dominios enumerados arriba.
- Nueva página dev-only `DevResetMocksPage` en `src/pages/dev/`, registrada en `router/index.tsx` como ruta `/dev/reset-mocks` bajo `<AppShell>`, fuera de cualquier `<RoleGuard requiredRoles={...}>` (mismo patrón que `/dev/semaforo-preview`) — solo requiere sesión autenticada.
- La página muestra una confirmación (modal o `window.confirm`) antes de ejecutar; al confirmar llama `resetAllMockStores()` y dispara `window.location.reload()`.
- **Hallazgo verificado durante implementación (reemplaza la nota de "fuera de alcance" original):** `window.location.reload()` reinicia por sí solo *todo* el contexto JS de la página — incluido `authFixtures` (store de usuarios) — porque los handlers MSW y sus stores mutables viven en el contexto de la página, no en el Service Worker. Esto significa que `resetAllMockStores()` es redundante para los cinco dominios operativos (el reload ya los limpia) y que excluir `authFixtures` del reset **no es alcanzable** con este mecanismo: cualquier mutación de usuario (alta, edición, activación/desactivación, reset de contraseña desde `/usuarios`) también se revierte al confirmar el reset, como efecto del reload, no del código de reset explícito. Ver design.md.

## Capabilities

### New Capabilities
- `dev-mock-reset`: herramienta dev-only que reinicia todos los stores mock de dominio (documents, quality-events, nonconformities, incidents, locales) a su estado de fixtures original, con confirmación previa y reload completo tras ejecutar, sin afectar la sesión activa.

### Modified Capabilities
(ninguna — no cambia el comportamiento de requisitos existentes de otras capacidades; solo se les agrega una función interna de reset sin efecto visible salvo cuando se invoca desde la nueva herramienta)

## Impact

- **Código nuevo:** `src/pages/dev/DevResetMocksPage.tsx`, `src/mocks/resetAllStores.ts`.
- **Código modificado:** `src/mocks/handlers/quality-events.handlers.ts`, `src/mocks/handlers/nonconformities.handlers.ts`, `src/mocks/handlers/incidents.handlers.ts`, `src/mocks/handlers/locales.handlers.ts` (agregar y exportar `resetStore()` en cada uno), `src/router/index.tsx` (nueva ruta dev).
- **Sin impacto en producción:** ruta y función son dev-only; no se referencian desde ningún flujo real ni desde `Sidebar.tsx`. `VITE_ENABLE_MSW=false` en producción hace que los stores mock ni siquiera existan en ese build.
- **Sin impacto en backend real:** el reset opera exclusivamente sobre stores in-memory de MSW; no aplica y queda inerte automáticamente cuando exista backend .NET real (mismo patrón que otras notas técnicas dev-only del proyecto).
