# pwa-shell

## Purpose

Infraestructura PWA de la aplicación: instalabilidad (manifest + Service Worker `autoUpdate` vía `vite-plugin-pwa`), reglas de convivencia de scope para que el Service Worker de la PWA no colisione con ni intercepte las requests `/api/**` que el Service Worker de MSW necesita manejar durante el desarrollo, y registro de Background Sync para notificar al hilo principal cuando hay reportes offline pendientes de sincronizar.

## Requirements

### Requirement: Aplicación instalable como PWA
El sistema SHALL exponer un manifest PWA (nombre, ícono, splash screen, `display: standalone`) y registrar un Service Worker en modo `autoUpdate` vía `vite-plugin-pwa`, de forma que la aplicación sea instalable desde un navegador mobile (Android/iOS).

#### Scenario: Instalación en dispositivo mobile
- **WHEN** un usuario abre la aplicación en un navegador mobile compatible (Chrome Android, Safari iOS)
- **THEN** el navegador ofrece la opción de instalar la aplicación como PWA usando el manifest configurado

#### Scenario: Actualización automática del Service Worker
- **WHEN** se despliega una nueva versión de la aplicación y el usuario reabre la PWA ya instalada
- **THEN** el Service Worker se actualiza en modo `autoUpdate` sin requerir desinstalación manual

### Requirement: Convivencia de Service Workers sin colisión de scope
El Service Worker de la PWA SHALL registrarse con un scope distinto y más específico que el scope del Service Worker de MSW (`/`), y SHALL NOT interceptar ni responder requests a `/api/**` mediante runtime caching propio ni mediante su handler de sincronización en background, de forma que el interceptado de MSW sobre las llamadas a la API siga funcionando para las páginas bajo su control durante el desarrollo con mocks activos. El Service Worker SHALL usar la estrategia `injectManifest` de `vite-plugin-pwa` (con un archivo fuente propio) en vez de `generateSW`, para permitir registrar listeners de eventos personalizados (ver Requirement: Registro de sincronización en background) manteniendo el mismo comportamiento de precache y scope ya verificado en Fase 1.

#### Scenario: Verificación de coexistencia en DevTools
- **WHEN** un desarrollador abre DevTools > Application > Service Workers con `VITE_ENABLE_MSW=true` y navega tanto a una ruta de escritorio como a `/m/incidentes/nuevo`
- **THEN** ambos Service Workers (MSW y el de la PWA) aparecen registrados y activos sin que uno cause el des-registro o la falla de activación del otro

#### Scenario: Llamadas a la API siguen interceptadas por MSW dentro de la ruta mobile
- **WHEN** el usuario envía el formulario de reporte rápido desde `/m/incidentes/nuevo` con `VITE_ENABLE_MSW=true`
- **THEN** la request a `POST /api/incidents` es interceptada por el handler MSW existente y responde con datos del mock, no con un intento de red real

#### Scenario: El handler de sincronización en background no hace fetch directo a la API
- **WHEN** el Service Worker de la PWA recibe el evento `sync` con tag `sync-incidents`
- **THEN** el Service Worker no realiza ningún `fetch` hacia `/api/**` desde dentro de sí mismo, y en su lugar reenvía la señal a los clientes abiertos vía `postMessage`

### Requirement: Registro de sincronización en background
El Service Worker de la PWA SHALL registrar un listener para el evento `sync` con tag `sync-incidents` en los navegadores que implementen Background Sync API (Chrome/Edge Android). Al recibir ese evento, el Service Worker SHALL notificar a todos los clientes (pestañas) abiertos vía `postMessage`, sin intentar sincronizar directamente contra `/api/**` desde dentro del propio Service Worker.

#### Scenario: Background Sync disponible y con clientes abiertos
- **WHEN** el navegador soporta Background Sync API, se dispara el evento `sync` con tag `sync-incidents`, y hay al menos una pestaña de la aplicación abierta
- **THEN** el Service Worker envía un mensaje a esa pestaña indicando que debe iniciar la sincronización de la cola offline

#### Scenario: Background Sync disponible sin clientes abiertos
- **WHEN** el navegador soporta Background Sync API, se dispara el evento `sync` con tag `sync-incidents`, y no hay ninguna pestaña de la aplicación abierta
- **THEN** el Service Worker no realiza ninguna acción de sincronización — la cola queda pendiente hasta que el usuario reabra la aplicación y se dispare el listener `online` o un nuevo evento `sync` con un cliente ya abierto

#### Scenario: Navegador sin soporte de Background Sync API
- **WHEN** el navegador no implementa Background Sync API
- **THEN** el Service Worker no registra el listener `sync`, y la sincronización de la cola offline depende exclusivamente del listener `online` del hilo principal
