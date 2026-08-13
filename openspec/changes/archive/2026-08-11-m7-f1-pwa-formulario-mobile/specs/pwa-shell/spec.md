## ADDED Requirements

### Requirement: Aplicación instalable como PWA
El sistema SHALL exponer un manifest PWA (nombre, ícono, splash screen, `display: standalone`) y registrar un Service Worker en modo `autoUpdate` vía `vite-plugin-pwa`, de forma que la aplicación sea instalable desde un navegador mobile (Android/iOS).

#### Scenario: Instalación en dispositivo mobile
- **WHEN** un usuario abre la aplicación en un navegador mobile compatible (Chrome Android, Safari iOS)
- **THEN** el navegador ofrece la opción de instalar la aplicación como PWA usando el manifest configurado

#### Scenario: Actualización automática del Service Worker
- **WHEN** se despliega una nueva versión de la aplicación y el usuario reabre la PWA ya instalada
- **THEN** el Service Worker se actualiza en modo `autoUpdate` sin requerir desinstalación manual

### Requirement: Convivencia de Service Workers sin colisión de scope
El Service Worker de la PWA SHALL registrarse con un scope distinto y más específico que el scope del Service Worker de MSW (`/`), y SHALL NOT interceptar ni responder requests a `/api/**` mediante runtime caching propio, de forma que el interceptado de MSW sobre las llamadas a la API siga funcionando para las páginas bajo su control durante el desarrollo con mocks activos.

#### Scenario: Verificación de coexistencia en DevTools
- **WHEN** un desarrollador abre DevTools > Application > Service Workers con `VITE_ENABLE_MSW=true` y navega tanto a una ruta de escritorio como a `/m/incidentes/nuevo`
- **THEN** ambos Service Workers (MSW y el de la PWA) aparecen registrados y activos sin que uno cause el des-registro o la falla de activación del otro

#### Scenario: Llamadas a la API siguen interceptadas por MSW dentro de la ruta mobile
- **WHEN** el usuario envía el formulario de reporte rápido desde `/m/incidentes/nuevo` con `VITE_ENABLE_MSW=true`
- **THEN** la request a `POST /api/incidents` es interceptada por el handler MSW existente y responde con datos del mock, no con un intento de red real
