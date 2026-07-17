## Context

Cada dominio con datos mutables mockea su store como un array a nivel de módulo, reasignado (`let store = ...`) por handlers de escritura MSW. Estado actual verificado en `shc-controldoc/src/mocks/handlers/`:

| Dominio | Archivo | Variable(s) de store | `resetStore()` hoy |
| --- | --- | --- | --- |
| Documentos | `documents.handlers.ts` | `let store: Documento[]` (línea 82) | Ya existe y está exportado (`export { resetStore }`, línea 1126). Usado hoy solo desde `documents.handlers.test.ts` (`beforeEach`). |
| Quality Events | `quality-events.handlers.ts` | `let qeStore: QualityEvent[]` (línea 50) | No existe. |
| No Conformidades | `nonconformities.handlers.ts` | `let nonconformities: NoConformidad[]` (línea 16) | No existe. |
| Incidentes | `incidents.handlers.ts` | `let incidents: Incidente[]` (línea 19) | No existe. También expone `getIncidentsStore()`, consumido por `locales.handlers.ts` para resolver nombres. |
| Locales/Zonas | `locales.handlers.ts` | `let locales: Local[]`, `let zonas: Zona[]` (líneas 14-15) | No existe. |
| Usuarios | `auth.fixtures.ts` (`getUsersStore()`) + `users.handlers.ts` | `authFixtures` (mismo array, sin copia) | No existe explícitamente, y no lo necesita: se revierte igual que el resto vía `window.location.reload()` (ver Non-Goals — hallazgo verificado). |
| Dashboard | `dashboard.handlers.ts` | Ninguno propio — lee vía `getDocumentsStore()` y stores de otros dominios | N/A, cubierto transitivamente por el reset de sus dominios fuente. |
| Auth (login) | `auth.handlers.ts` | Ninguno propio — usa `getUsersStore()` | N/A, mismo store que Usuarios (fuera de alcance). |

`/dev/semaforo-preview` (`src/pages/dev/SemaforoPreviewPage.tsx`, registrada en `router/index.tsx` línea 56) ya establece el patrón de ruta dev-only: hija directa de `<AppShell>`, fuera de todo `<RoleGuard requiredRoles={...}>`, sin entrada en `Sidebar.tsx`, texto literal sin `t()`.

## Goals / Non-Goals

**Goals:**
- Reset de un solo clic (con confirmación) de todos los stores mock de dominio operativo a su estado de fixtures original, sin reiniciar el servidor de desarrollo.
- Reutilizar el `resetStore()` ya existente de `documents.handlers.ts` en vez de reescribirlo; replicar el mismo patrón (reasignación desde `*.map((x) => ({...x}))` o `[...fixtures]`, según cómo cada store se inicializó originalmente) en los cuatro dominios que aún no lo tienen.
- Mantener la sesión activa (`authStore`, `mockSession.ts`) intacta durante y después del reset.

**Non-Goals:**
- Excluir `authFixtures` (store de usuarios) del reset **no es una meta alcanzable con este diseño**, y se abandonó como Non-Goal explícito tras verificación en navegador real (ver Decisions #7 y Risks). El código de `resetAllMockStores()` deliberadamente no toca `authFixtures` — pero `window.location.reload()`, que el flujo requiere de todas formas, reinicializa todo el contexto JS de la página (donde vive `authFixtures` junto con el resto de stores MSW), así que cualquier mutación de usuario (alta, edición, activar/desactivar, reset de contraseña desde `/usuarios`) también desaparece al confirmar el reset. Este es el comportamiento esperado y documentado, no un bug.
- No es un seed configurable ni permite reset selectivo por dominio.
- No reemplaza el reinicio del servidor de desarrollo para cambios de código fuente.
- No toca `TanStack Query` cache ni `Zustand` stores de UI explícitamente — se asume que `window.location.reload()` los limpia de forma natural al recargar el documento completo.

## Decisions

1. **Función central `resetAllMockStores()` en `src/mocks/resetAllStores.ts`**, que importa y llama el `resetStore()` (o equivalente recién agregado) de cada handler de dominio, en vez de que la página dev llame a cinco imports distintos directamente. Alternativa descartada: importar cada `resetStore` directo en la página — se prefiere centralizar para que agregar un dominio nuevo en el futuro sea un solo punto de edición (este archivo), no la página UI.
2. **Nombrar y exportar `resetStore()` en cada handler siguiendo el nombre ya usado en `documents.handlers.ts`**, no `resetXStore()` por dominio — consistencia de nombre de función a través de módulos (el nombre del módulo ya lo distingue en el import). Se exporta con `export function resetStore()` (mismo patrón directo que ya usa `documents.handlers.ts` al final del archivo vía `export { resetStore }`, o inline — cualquiera de las dos formas ya presentes en el código es válida, se sigue la convención de cada archivo).
3. **Reinicialización idéntica a la inicialización original de cada store**, no una función de deep-clone genérica: `documents` y `locales`/`zonas` usan `fixtures.map((x) => ({ ...x }))` (copia superficial por elemento); `quality-events`, `nonconformities`, `incidents` usan `[...fixtures]` (copia superficial del array, comparten referencias de objetos internos con el fixture). Se replica el patrón exacto que cada archivo ya usaba en su declaración `let`, no se homogeniza a un único estilo — cambiar la estrategia de copia de un store existente (p.ej. de shallow-array-copy a deep-copy) es una decisión aparte, fuera de esta propuesta, porque podría cambiar sutilmente semántica de mutación ya asumida por handlers de escritura existentes.
4. **Ruta `/dev/reset-mocks` como página, no un botón flotante global** — sigue el patrón ya establecido por `/dev/semaforo-preview`: entrada de router dedicada, sin guard de rol, sin entrada en Sidebar, solo alcanzable escribiendo la URL. Evita mezclar responsabilidades con la página de preview de semáforo existente (Toño ya descartó esa opción explícitamente en la propuesta).
5. **Confirmación con `window.confirm()` nativo**, no un modal custom — el criterio de aceptación solo pide "confirmación antes de ejecutar", y Toño indicó explícitamente que un `window.confirm` básico es suficiente. Nota: esta es la única excepción justificada a la regla global del proyecto de "nunca `alert()`/`confirm()`" (CLAUDE.md), porque esta página es dev-only, no producción, y el criterio de aceptación de i18n/Sonner tampoco aplica a `/dev/*` (mismo trato que el resto de páginas dev-only).
6. **`resetAllMockStores()` se llama sincrónicamente y de inmediato dispara `window.location.reload()`** — no hay `await` de red ni invalidación manual de TanStack Query; el reload de página completo se encarga de limpiar cualquier caché en memoria del cliente.
7. **Se mantiene `resetAllMockStores()` explícito en vez de depender únicamente de `window.location.reload()`**, aunque la verificación en navegador (task 4.4, Playwright contra `npm run dev`) confirmó que el reload por sí solo ya reinicializa todos los stores MSW (documents, quality-events, nonconformities, incidents, locales, **y también** `authFixtures`) porque ese código vive en el contexto JS de la página, no en el Service Worker — lo que vuelve `resetAllMockStores()` funcionalmente redundante para el caso feliz. Se conserva de todas formas porque: (a) documenta explícitamente e intencionalmente qué dominios se consideran "cubiertos" por esta herramienta, sirviendo de single-source-of-truth ante futuros dominios nuevos (ver Riesgo de dominio olvidado); (b) es la base testeable — `documents.handlers.test.ts` y equivalentes futuros llaman `resetStore()` directo en `beforeEach`, sin pasar por un reload de navegador real; (c) elimina cualquier dependencia frágil de que el reload complete la reinicialización antes de que el usuario navegue de vuelta (aunque en la práctica ya ocurre de forma síncrona). No se intentó (ni se justifica) hacer que `authFixtures` sobreviva al reload — ver Non-Goals.

## Risks / Trade-offs

- **[Riesgo] Nuevo dominio con store mutable se agrega en el futuro y su autor olvida registrarlo en `resetAllMockStores()`.** → Mitigación: comentario explícito en `resetAllStores.ts` enumerando la lista completa de dominios activos y recordando actualizarlo al agregar un store mutable nuevo (mismo tipo de nota que ya usa el proyecto para otras convenciones transversales, p.ej. `getDocumentsStore()`).
- **[Riesgo, cerrado tras verificación] Se creyó que `authFixtures`/usuarios podía quedar excluido del reset por decisión de código.** → Verificado como inaplicable: `window.location.reload()` reinicializa `authFixtures` junto con todo lo demás, sin importar qué toque `resetAllMockStores()`. No requiere mitigación — es el comportamiento correcto y ya documentado en Non-Goals y en `specs/dev-mock-reset/spec.md`.
- **[Riesgo] La página `/dev/reset-mocks` queda accesible en un build de producción si alguien olvida que `VITE_ENABLE_MSW=false` no elimina la ruta del router, solo hace que MSW no intercepte.** → Mitigación: la ruta llama funciones de `src/mocks/*`, que en producción real (`VITE_ENABLE_MSW=false`, sin backend MSW activo) ejecutarían un reset de arrays en memoria que ningún handler real usa — no hay riesgo de seguridad ni de datos reales, es un no-op funcionalmente inerte, igual que otras herramientas dev-only ya documentadas en CLAUDE.md. No se requiere gate adicional de entorno.

## Migration Plan

No aplica migración de datos. Es una herramienta nueva, aditiva; no cambia comportamiento de ningún endpoint ni tipo existente. Rollback trivial: eliminar la ruta y el archivo `resetAllStores.ts` sin efectos secundarios, ya que ningún otro código depende de ellos.

## Open Questions

Ninguna pendiente. La única duda que surgió durante la implementación (¿es alcanzable excluir `authFixtures` del reset?) se resolvió por verificación directa en navegador (task 4.4): no es alcanzable con `window.location.reload()`, y se decidió no perseguirlo (ver Non-Goals) — no se requirió cambio de código, solo corrección de la spec y este documento.
