import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App'
import { queryClient } from './lib/queryClient'
import { i18nReady } from './i18n/index'
import './stores/uiStore'
import './index.css'

// `worker.start()` resuelve cuando el Service Worker de MSW respondió el
// handshake de activación, pero eso no garantiza que YA esté controlando
// esta carga de página en concreto — en un reload normal (F5, URL tipeada)
// puede tomar un instante más en reclamar el cliente (`clients.claim()`), y
// en un hard reload (bypass de caché) el navegador directamente excluye al
// Service Worker de esa navegación por diseño, sin importar cuánto se
// espere. Mientras tanto, cualquier request sale directo a la red real y,
// sin backend, puede caer en el fallback SPA de un servidor estático
// (index.html en vez de JSON) — ver bug de bootstrap()/reload con pantalla
// en blanco. Este wait reduce la ventana del primer caso (mitigable) con un
// timeout corto; el segundo caso (no mitigable desde JS) queda cubierto por
// el interceptor de axios, que ahora trata una respuesta sin el envelope
// ApiResponse<T> como un fallo duro en vez de pasarla silenciosamente.
function waitForServiceWorkerController(timeoutMs = 2000): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return Promise.resolve()
  if (navigator.serviceWorker.controller) return Promise.resolve()

  return new Promise((resolve) => {
    const onControllerChange = () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(() => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      resolve()
    }, timeoutMs)
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
  })
}

async function enableMocking() {
  if (import.meta.env.VITE_ENABLE_MSW !== 'true') return
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledRequest: 'warn' })
  await waitForServiceWorkerController()
}

// El SW de la PWA (offline queue mobile, scope '/m/') nunca se registra mientras
// `VITE_ENABLE_MSW=true`: un documento solo puede tener un SW controlador, elegido por
// scope más específico, así que una navegación dura a '/m/*' le quitaría el control a
// MSW y ninguna request `/api/**` de esa página volvería a ser mockeada (confirmado
// empíricamente — ver m7-f1-pwa-formulario-mobile/design.md D3). Sin backend real, hoy
// eso significa que el SW de la PWA no se registra en ningún build (dev ni producción
// mock); se reactivará solo, sin tocar este archivo, el día que `VITE_ENABLE_MSW=false`
// contra un backend real.
async function registerOfflineQueueServiceWorker() {
  if (import.meta.env.VITE_ENABLE_MSW === 'true') return
  const { registerSW } = await import('virtual:pwa-register')
  registerSW({ immediate: true })
}

Promise.all([i18nReady, enableMocking(), registerOfflineQueueServiceWorker()]).then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </React.StrictMode>
  )
})
