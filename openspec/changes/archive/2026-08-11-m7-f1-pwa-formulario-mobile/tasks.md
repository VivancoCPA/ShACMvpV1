## 1. Setup PWA shell

- [x] 1.1 Instalar `vite-plugin-pwa` y configurar manifest (nombre, ícono, splash screen, `display: standalone`) en `vite.config.ts`.
- [x] 1.2 Configurar el Service Worker de la PWA en modo `autoUpdate`, `scope: '/m/'`, sin ninguna runtime-caching route que matchee `/api/**` (ver design.md D3).
- [x] 1.3 Verificar en DevTools > Application > Service Workers, con `VITE_ENABLE_MSW=true`, que el SW de MSW y el SW de la PWA quedan ambos registrados y activos sin desregistrarse mutuamente, navegando entre una ruta de escritorio y `/m/incidentes/nuevo`. **Verificado (2026-08-04) en navegador real** (build de producción, `npx serve -s dist`): `navigator.serviceWorker.getRegistrations()` confirma ambos SW registrados y activos simultáneamente (`mockServiceWorker.js` en scope `/`, `sw.js` en scope `/m/`) — no se desregistran mutuamente. Ver design.md D3 para el detalle de cuál controla cada página. **Superado (2026-08-05):** tras la resolución de la tarea 1.4, `sw.js` deja de registrarse mientras `VITE_ENABLE_MSW=true` — el escenario "ambos SW activos simultáneamente" ya no aplica en builds mock; solo `mockServiceWorker.js` se registra. `sw.js` volverá a registrarse (sin este SW de MSW presente) el día que `VITE_ENABLE_MSW=false` contra un backend real.
- [x] 1.4 Confirmar que una request a `POST /api/incidents` hecha desde `/m/incidentes/nuevo` sigue siendo interceptada por el handler MSW (Network tab: respuesta del mock, no intento de red real). Si no lo es, aplicar la mitigación alternativa descrita en design.md D3 (passthrough explícito o no registrar SW de PWA en dev) antes de continuar. **Verificado (2026-08-04) — resultado NEGATIVO:** una navegación de documento nueva a `/m/incidentes/nuevo` queda controlada por `sw.js` (PWA), no por MSW; `/api/**` no se intercepta y cae a la red real (confirmado con `fetch('/api/documents')` devolviendo el fallback SPA `index.html`, no JSON). La mitigación de "sin runtime-caching de `/api/**`" (tarea 1.2) no evita este bypass, solo evita que se enmascare con una respuesta de caché — ver design.md D3, decisión de mitigación aún pendiente de implementar antes de Fase 3. **Resuelto (2026-08-05):** implementado "no registrar el SW de la PWA mientras `VITE_ENABLE_MSW=true`" (`vite.config.ts` `injectRegister: null` + registro condicional en `main.tsx`). Re-verificado en navegador real (`npx vite build` + `npx serve -s dist`): navegación dura a `/m/incidentes/nuevo` queda controlada por `mockServiceWorker.js`; `POST /api/incidents`, `/api/auth/login` y el resto de `/api/**` se interceptan con normalidad. Ver design.md D3 para el detalle completo de la resolución.

## 2. Ruta y layout mobile

- [x] 2.1 Crear layout mobile-first de una columna (componente propio, reutilizando tokens Tailwind del design system existente, sin theme aparte).
- [x] 2.2 Agregar rama de router nueva para `/m/incidentes/nuevo` en `router/index.tsx`, hermana de la rama `AppShell` (no hija), envuelta en `RoleGuard requiredRoles={ROUTE_ROLE_GROUPS.incidentsView}`.
- [x] 2.3 Registrar `/m/incidentes/nuevo` explícitamente en `routeAccess.ts` con sus `requiredRoles` (mismo patrón auditado en M6-S01 — ninguna ruta nueva sin guard explícito).
- [x] 2.4 Crear página `IncidentQuickReportPage` (o equivalente) montada en esa ruta.

## 3. Modelo de datos y mock

- [x] 3.1 Agregar tipo `IncidenteGeoUbicacion { lat, lng, capturadoEn }` y campo opcional `Incidente.geoUbicacion` en `features/incidents/types/incident.types.ts`.
- [x] 3.2 Extender `createIncidentSchema` (o crear un schema mobile que lo extienda) para aceptar `geoUbicacion` opcional, sin tocar los campos existentes.
- [x] 3.3 Actualizar `POST /api/incidents` en `incidents.handlers.ts` para persistir `geoUbicacion` si viene en el body, con el mismo patrón de spread condicional que ya usan `evidencias`/`condicionesEntorno` (líneas 219-227).
- [x] 3.4 Confirmar (sin modificar) que `generateNumero`/`getActiveEmpresaId` siguen resolviéndose server-side para requests originadas en la ruta mobile — no requiere cambio de código, solo verificación.

## 4. Formulario de reporte rápido

- [x] 4.1 Construir el formulario (React Hook Form + Zod) con el subset de campos: `tipo`, `areaId`, `descripcion`, severidad percibida (opcional), `huboLesionados`/`numPersonasAfectadas` según la misma regla condicional del schema de escritorio. (`turno` también incluido: es requerido por `POST /api/incidents` y no puede omitirse.)
- [x] 4.2 Implementar selector de `areaId` reutilizando el hook/componente ya usado en el formulario de escritorio (`useAreas()` u equivalente) — no duplicar lógica de catálogo.
- [x] 4.3 Implementar captura de foto: `<input type="file" accept="image/*" capture="environment">`, múltiple, con preview antes de enviar y opción de quitar una foto de la selección.
- [x] 4.4 Implementar captura de GPS: `navigator.geolocation.getCurrentPosition` al abrir el formulario, no bloqueante ante rechazo de permiso, error o falta de soporte — mapear a `geoUbicacion` solo si la captura fue exitosa.
- [x] 4.5 Conectar el envío a la mutation de creación de incidentes existente (reutilizar hook de `IncidentNewPage`, no crear un cliente Axios paralelo).
- [x] 4.6 Manejar el caso de envío sin conexión: mostrar error vía `toast` (Sonner), sin `alert()` y sin simular éxito ni encolar el reporte. (Cubierto por el `onError` ya existente de `useCreateIncident`, sin código adicional.)
- [x] 4.7 Agregar claves i18n de los textos del formulario mobile en `es-PE.json` y `en-US.json` (namespace `incidents.mobile`, reutilizando además las claves ya existentes de `incidents.form.fields`/`tipo`/`severidad`/`turno`).

## 5. Verificación end-to-end

- [ ] 5.1 Instalar la PWA en un dispositivo Android real y reportar un incidente con foto y GPS con conexión activa. **Pendiente — requiere dispositivo físico, no ejecutable desde este entorno.**
- [ ] 5.2 Instalar la PWA en un dispositivo iOS real y repetir la verificación (Safari/PWA en iOS tiene comportamiento de instalación distinto a Android). **Pendiente — requiere dispositivo físico.**
- [x] 5.3 Confirmar que el incidente reportado desde mobile aparece en `IncidentListPage` de escritorio con folio asignado por el servidor y el mismo tratamiento visual/funcional que un incidente creado desde `/incidents/nuevo`. **Verificado (2026-08-04)** durante el cierre de pendientes de m7-f2-offline-sync: incidentes enviados desde `/m/incidentes/nuevo` (vía cola offline) aparecen en `/incidents` con folio server-side (`INC-2026-0XX`) y misma fila/formato que el resto del listado. Nota: alcanzado navegando a `/m/incidentes/nuevo` vía SPA client-side desde una página ya controlada por MSW, no por navegación dura — ver limitación en tarea 1.4/design.md D3.
- [ ] 5.4 Confirmar que un usuario sin rol autorizado es redirigido a `/no-autorizado` al intentar acceder a `/m/incidentes/nuevo`, y que un usuario sin sesión es redirigido a `/login`. **Pendiente de verificación en navegador** (la lógica de `RoleGuard`/`routeAccess.ts` sigue el mismo patrón ya usado y probado en el resto de la app, pero no se ejecutó end-to-end).
- [ ] 5.5 Verificar Light Mode y Dark Mode del formulario y layout mobile sin defectos visuales. **Pendiente — requiere inspección visual en navegador.**
- [ ] 5.6 Reload de la PWA ya instalada tras un cambio de versión: confirmar que el SW se actualiza en modo `autoUpdate` sin requerir desinstalación manual. **Pendiente — requiere dispositivo/navegador real con la PWA instalada.**
