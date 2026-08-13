/// <reference lib="webworker" />
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { SYNC_TAG_INCIDENTS, SYNC_MESSAGE_TYPE } from './lib/offlineSyncMessage'

declare const self: ServiceWorkerGlobalScope

// Background Sync API no está en lib.webworker.d.ts de TypeScript — se declara
// aquí el shape mínimo que usamos (ver m7-f2-offline-sync design.md D3/D7).
interface SyncEvent extends ExtendableEvent {
  readonly tag: string
}

declare global {
  interface ServiceWorkerGlobalScopeEventMap {
    sync: SyncEvent
  }
}

precacheAndRoute(self.__WB_MANIFEST)

// No se registra ningún runtime-caching de '/api/**' a propósito (heredado de
// Fase 1, D4): la cola offline vive en IndexedDB gestionada por la app, no en
// el cache del SW, y este SW nunca debe responder esas requests para no
// competir con el Service Worker de MSW.

// Fallback de navegación offline para el shell mobile (equivalente al
// `navigateFallback` de Fase 1, ahora expresado a mano porque `injectManifest`
// no tiene esa opción declarativa). Vinculado al único `index.html` real
// precacheado (SPA), no a la ruta `/m/incidentes/nuevo` en sí. `NavigationRoute`
// solo intercepta navegaciones de documento (`mode: 'navigate'`), nunca
// `fetch`/XHR a `/api/**`, así que no afecta al invariante de D4.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    allowlist: [/^\/m\//],
  }),
)

// El handler de `sync` NO hace fetch a `/api/**` desde dentro del SW — un SW
// no puede interceptar el fetch de otro SW (el de MSW), así que ese fetch
// iría a la red real y fallaría contra el mock. En su lugar, reenvía la señal
// a los clientes abiertos vía postMessage; la sincronización real ocurre en
// el hilo principal (useOfflineIncidentSync), mismo camino que el listener
// `online` (ver design.md D3).
self.addEventListener('sync', (event) => {
  if (event.tag !== SYNC_TAG_INCIDENTS) return

  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        client.postMessage({ type: SYNC_MESSAGE_TYPE })
      }
    }),
  )
})
