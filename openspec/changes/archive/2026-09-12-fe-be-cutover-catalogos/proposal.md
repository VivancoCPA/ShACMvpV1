## Why

`cutover-auth` verificó login/refresh/logout de punta a punta contra el backend .NET real y quedó cerrado sin bugs. Los catálogos (Areas, Empresas, Locales, Zonas) son el siguiente módulo del roadmap acordado con Toño porque el resto de los módulos de dominio (Incidentes, NC, QualityEvents, Documentos) dependen de ellos para poblar selects y validar scoping por empresa — no tiene sentido cutover-ear un módulo de dominio contra un catálogo que todavía habla con MSW. A diferencia de Auth, acá hay un hallazgo bloqueante real: dos rutas que la UI de producción ya llama (`GET /api/locales/:id`, `GET /api/zonas`) no existen en el backend hoy, así que este change no es solo "apuntar y verificar" — primero hay que construir esos dos endpoints.

## What Changes

- Construir dos endpoints backend que hoy no existen pero tienen consumidor real en el frontend: `GET /api/locales/{id}` (detalle de Local con sus Zonas embebidas, `LocalConZonas`) y `GET /api/zonas` (todas las Zonas de la empresa activa, sin filtro de Local) — mismo patrón Dapper/CQRS que `ListarLocales`/`ListarZonasPorLocal`, scoped por `empresaId` de la sesión, 404-nunca-403 cuando el recurso pertenece a otra empresa.
- Apuntar `shc-controldoc` en desarrollo (`.env.development`, `VITE_ENABLE_MSW=false`) al backend .NET real y verificar en navegador, contra Postgres real, los 4 catálogos: alta/edición/desactivación/reactivación de Area, Local y Zona; listado de zonas sin filtro (`LocalList`); detalle de local con zonas embebidas (`LocalEditPage`); alta de empresa y gestión de usuarios de empresa como `SUPERADMIN`; confirmación de que un rol no-`SUPERADMIN` recibe 403/404 al intentar los 7 endpoints de Empresas.
- Confirmar en navegador el manejo real de `multipart/form-data` en `CrearLocal`/`ActualizarLocal` (el cliente fija `Content-Type: undefined` para que axios calcule el boundary) contra el parseo real del backend (`request.HasFormContentType` + `ReadFormAsync`), no solo por coincidencia de contrato en el código.
- Documentar en `design.md`, como hallazgo informativo (no bloqueante, no se corrige en este change): `PATCH /api/empresas/:id/usuarios/:usuarioId/reset-pin` (`ResetPinEndpoint`, backend) sin consumidor frontend hoy; y el desfase ya conocido (detectado en `2026-08-24-be-crud-locales-zonas`, todavía sin resolver) entre los roles que el backend permite administrar Areas/Locales/Zonas (`ADMINISTRADOR_SISTEMA` + `JEFE_CALIDAD_SYST`) y los que las guards/permisos del frontend realmente exponen (`puedeAdministrarAreas`/`puedeAdministrarLocales` solo reconocen `ADMINISTRADOR_SISTEMA`; la ruta `/admin/areas` ni siquiera deja entrar a `JEFE_CALIDAD_SYST`).
- Como en `cutover-auth`: inspeccionar los tests de frontend de estos 4 catálogos antes de asumir que dependen de MSW; migrar a backend real solo los que realmente hagan red vía `msw/node`, documentando en `design.md` si la premisa "hay que migrar todo" no aplica (igual que la D4 revisada del change anterior).
- Al cerrar: revertir `.env.development` a `VITE_ENABLE_MSW=true` (los módulos de dominio restantes siguen dependiendo de MSW hasta su propio cutover). No se toca `.env.production` ni `Cors:AllowedOrigins` de producción — sigue pendiente el Open Question de hosting heredado de `cutover-auth`.

## Capabilities

### New Capabilities

- `frontend-catalogos-cutover-verification`: escenarios de verificación manual en navegador para Areas, Empresas, Locales y Zonas contra el backend .NET real + Postgres real, sin MSW — CRUD completo de cada catálogo, multipart de Local, scoping multi-tenant, y el gating por rol `SUPERADMIN` de Empresas. Equivalente de catálogos a `frontend-auth-cutover-verification`.

### Modified Capabilities

- `be-locales-zonas-lectura`: agrega dos requirements nuevos — `GET /api/locales/:id` (detalle de Local con Zonas embebidas, scoped por empresa activa, 404 si el Local no existe o es de otra empresa) y `GET /api/zonas` (listado de Zonas activas de la empresa activa, sin filtro de Local). Ambos sin restricción de rol más allá de autenticación, igual que los otros endpoints de lectura del catálogo.

## Impact

- **Afectado (backend)**: `ShcMvpEndPoint/Features/Locales/` (dos features nuevas, `ObtenerLocal` y — a definir en `design.md` si vive bajo `Features/Locales` o `Features/Zonas` — `ListarZonas`), `openspec/specs/be-locales-zonas-lectura/spec.md`.
- **Afectado (frontend)**: `shc-controldoc/.env.development` (ventana de verificación), tests de Areas/Empresas/Locales/Zonas que resulten depender de MSW real tras inspección.
- **No afectado**: `openspec/specs/be-areas-catalogo`, specs de Empresas (`empresa-admin-*`), handlers MSW de los 4 catálogos (se mantienen intactos para los módulos aún no cutover-eados), `shc-controldoc/src/features/{areas,empresas,locations}/**` fuera de tests (ningún cambio de UI/lógica de cliente — el contrato ya coincide).
- **Pendiente explícito, no se resuelve en este change**: el desfase de roles Areas/Locales frontend vs. backend (`JEFE_CALIDAD_SYST`) — se documenta como hallazgo, la corrección de UI queda para un change de frontend futuro si Toño lo pide; el Open Question de hosting/dominio de producción heredado de `cutover-auth`.
- **Fuera de alcance**: los 7 módulos de dominio restantes del roadmap (Incidentes, NoConformidades, QualityEvents, Documentos, Notifications, Dashboard, Users) — cada uno su propio change `cutover-<modulo>`.
