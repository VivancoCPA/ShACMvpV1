## Context

Hoy existe una única capa de datos para `Local`/`Zona`, construida en M3 exclusivamente para el caso de uso de **solo lectura**: `src/api/endpoints/locales.api.ts` (`localesApi.getLocales`), `src/mocks/handlers/locales.handlers.ts` (`GET /api/locales`, `GET /api/zonas`, ambos sirviendo directamente los arrays constantes de fixtures) y `src/features/incidents/hooks/useLocales.ts` (siempre filtra `activo: true`, sin exponer detalle ni zonas). Esa capa la sigue usando `IncidentForm`/Mapa (M3-S04/S05) y **no se modifica**.

M6-S01 ya dejó, en `src/features/locations/`, los tipos de entrada de formulario (`LocalFormInput`, `ZonaFormInput`), los helpers de permisos (`puedeAdministrarLocales`, `puedeConsultarLocales`) y los helpers puros de reglas de negocio (`puedeCrearLocalActivo`, `puedeDesactivarLocal`, `puedeDesactivarZona`) que ya tienen sus propios tests unitarios contra arrays en memoria. Esta spec conecta esos helpers a una capa de datos real (mock) de administración: API client, handlers MSW con estado mutable, y hooks de TanStack Query v5.

Un detalle importante que condiciona el diseño: `localFormSchema` (M6-S01) valida `planoUrl` como `z.instanceof(File)`, mientras que la entidad `Local` (M3) solo tiene `planoPngUrl?: string`. El API client de esta spec es el punto donde ese `File` del formulario se traduce a lo que puede viajar por HTTP y a lo que persiste el mock.

## Goals / Non-Goals

**Goals:**
- Definir cómo el API client serializa `LocalFormInput`/`ZonaFormInput` (incluyendo el `File` de `planoUrl`) hacia los handlers MSW, y cómo el handler produce el `planoPngUrl` string que exige la entidad `Local`.
- Definir el store mutable en memoria de los handlers administrativos, reutilizando `localFixtures`/`zonaFixtures` como semilla, sin tocar los endpoints de solo lectura ya existentes en el mismo archivo.
- Definir cómo los handlers evalúan RN-LOC-002/RN-ZON-002 (conteo de incidentes bloqueantes) sin acoplarse al store mutable *privado* de `incidents.handlers.ts`.
- Definir el contrato de error 409 (mensaje + conteo) y cómo los hooks lo propagan hacia la UI consumidora (M6-S04) sin que esta spec construya esa UI.
- Definir namespaces de query key y de i18n separados de los ya usados por el hook de solo lectura de M3, para evitar colisiones de caché y de claves de traducción.

**Non-Goals:**
- No se construye UI de listado/formulario (M6-S03/S04) ni el mapeo visual de zonas.
- No se modifica `src/api/endpoints/locales.api.ts`, `src/features/incidents/hooks/useLocales.ts`, ni el `GET /api/locales`/`GET /api/zonas` de solo lectura ya existentes.
- No se redefinen `Local`/`Zona`, ni se agregan campos nuevos a esas interfaces (p. ej. `planoAncho`/`planoAlto` siguen viviendo solo en el schema del formulario, no en la entidad persistida).
- No se implementa sincronización en tiempo real entre el store mutable de `incidents.handlers.ts` y el de `locales.handlers.ts`.

## Decisions

### 1. El API client envía `FormData` cuando hay archivo; el handler produce una URL mock determinística
`crearLocal`/`actualizarLocal` inspeccionan si `data.planoUrl` es una instancia de `File`. Si lo es, construyen un `FormData` (campo por campo, incluyendo el archivo) y lo postean con `Content-Type: multipart/form-data` (Axios lo infiere solo con no fijar el header manualmente); si no hay archivo, postean JSON plano como el resto de los endpoints del proyecto.
En el handler, `POST /api/locales`/`PATCH /api/locales/:id` detectan el content-type: si es multipart, usan `request.formData()` y validan el archivo ahí mismo (tipo `image/png`, tamaño ≤2MB — RN-LOC-003) devolviendo 400 con mensaje descriptivo si falla; si pasa, generan `planoPngUrl` como `/mock/plano-${id}.png` (URL determinística, no depende de `URL.createObjectURL`, que no está garantizado en el entorno de test de Vitest/jsdom). Esto valida RN-LOC-003 en el "backend" (defensa en profundidad) además de en el schema Zod del formulario, tal como pide el requisito de la spec.
**Alternativa descartada**: enviar solo metadata del archivo (nombre/tamaño/tipo) como JSON, sin el binario. Se descartó porque el requisito explícito pide que el handler *valide* el PNG ≤2MB, lo que requiere que el archivo real (o al menos su tamaño/tipo reales) viaje en el request.

### 2. Store mutable por archivo de handlers, inicializado desde los fixtures existentes — mismo patrón que `incidents.handlers.ts`/`documents.handlers.ts`
`src/mocks/handlers/locales.handlers.ts` mantiene `let locales: Local[] = localFixtures.map(l => ({...l}))` y `let zonas: Zona[] = zonaFixtures.map(z => ({...z}))` a nivel de módulo. Los endpoints de lectura ya existentes (`GET /api/locales`, `GET /api/zonas`) se migran a leer de estos arrays mutables (en vez de los fixtures directamente) para que reflejen altas/bajas hechas por los endpoints administrativos nuevos, sin cambiar su contrato de respuesta ni sus query params (`activo`, `localId`).

### 3. RN-LOC-002/RN-ZON-002 se validan contra `incidentFixtures` (snapshot estático), no contra el store mutable de `incidents.handlers.ts`
`incidents.handlers.ts` mantiene su propio `let incidents` **privado al módulo** (no exportado). Acoplar `locales.handlers.ts` a ese estado interno requeriría exportar un getter desde `incidents.handlers.ts`, lo cual excede el alcance de esta spec (que declara explícitamente no tocar M3). En su lugar, `puedeDesactivarLocal`/`puedeDesactivarZona` (helpers puros de M6-S01) se invocan con `incidentFixtures` importado directamente desde `src/mocks/fixtures/incidents.fixtures.ts`.
**Trade-off aceptado**: un incidente creado dinámicamente durante una sesión de desarrollo (vía `POST /api/incidents`) no bloqueará la desactivación de su Local/Zona hasta que se reinicie el estado — es una limitación conocida del mock, no del backend real. Los tests de esta spec cubren los escenarios RN-LOC-002/RN-ZON-002 usando directamente los incidentes ya presentes en `incidentFixtures` (no necesitan crear incidentes nuevos vía API para probar el bloqueo).

### 4. Contrato de error 409: mensaje interpolado con el conteo, sin campo estructurado nuevo en `ApiResponse`
Los handlers de desactivación devuelven `err(mensaje, 409)` donde `mensaje` ya incluye el conteo (p. ej. `"No se puede desactivar: 2 incidentes activos/en investigación asociados"`), reutilizando el mismo shape `{ success: false, data: null, message }` que ya usan `incidents.handlers.ts`/`documents.handlers.ts`. No se agrega un campo nuevo a `ApiResponse` para el conteo estructurado: el mensaje ya es autocontenido y es lo único que la UI de M6-S04 necesita mostrar (según el propio requisito de esta spec). Los hooks (`useDesactivarLocal`/`useDesactivarZona`) leen `error.response?.data?.message` (Axios no transforma el body de error — el interceptor de `lib/axios.ts` solo desempaqueta `response.data` en el camino feliz) y lo pasan a `toast.error` y lo re-lanzan para que el caller (UI) pueda leerlo también desde `mutation.error`.

### 5. Namespace de query keys separado del hook de solo lectura de M3
`src/features/locations/hooks/useLocales.ts` define su propio objeto de query keys, `LOCATION_ADMIN_QUERY_KEYS` (`['locationsAdmin', 'list']`, `['locationsAdmin', 'detail', id]`), distinto de `['locales', 'list', { activo: true }]` que ya usa `src/features/incidents/hooks/useLocales.ts`. Mismo nombre de hook (`useLocales`), carpeta distinta (`features/locations/hooks/` vs `features/incidents/hooks/`) — se documenta explícitamente para que quien importe elija el correcto según el caso de uso (selector de solo lectura vs. administración). Sin este namespace separado, invalidar la query de administración no refrescaría (ni sería refrescada por) el hook de solo lectura de M3, y viceversa, lo cual sería observable como datos desactualizados en `IncidentForm` tras una edición administrativa.

### 6. Nuevo namespace i18n `locations` para los toasts de los hooks
Siguiendo el patrón ya establecido (`useIncidents.ts` llama `t('incidents:toasts.xxx')` dentro del propio hook, no en la UI consumidora), los hooks de mutación de esta spec necesitan un namespace de i18n nuevo, `locations`, con claves `toasts.localCreado`, `toasts.localCreateError`, `toasts.localActualizado`, `toasts.localDesactivado`, `toasts.localDesactivarError` (mensaje del backend), etc., en `es-PE.json`/`en-US.json`, y su registro en el arreglo `ns` de `src/i18n/index.ts`.

## Risks / Trade-offs

- **[Riesgo] Migrar `GET /api/locales`/`GET /api/zonas` de leer fixtures directos a leer el store mutable** podría introducir una regresión sutil en M3 si el mapeo de filtros (`activo`, `localId`) no es exactamente equivalente → **Mitigación**: el store se inicializa como copia exacta de los fixtures (mismo orden, mismos valores) y los tests existentes de M3 que dependen de estos endpoints (si los hay) deben seguir pasando sin cambios; se agrega un test explícito que verifica que `GET /api/locales` inmediatamente después de un `POST` incluye el nuevo registro.
- **[Riesgo] Desalineación entre `incidentFixtures` (snapshot) y el store real de incidentes en runtime** (Decisión 3) → **Mitigación**: documentado como limitación conocida del mock; no se oculta el comportamiento y las UIs de M6-S04 deben asumir que el conteo de bloqueo puede no reflejar incidentes creados en la misma sesión hasta refrescar la página (donde ambos módulos releen sus fixtures base).
- **[Trade-off] Enviar `FormData` solo cuando hay archivo, JSON en caso contrario** (Decisión 1) obliga al handler a ramificar por content-type → aceptado porque evita forzar `multipart/form-data` en actualizaciones que no tocan el plano (la mayoría), manteniendo el body simple en el caso común.
- **[Riesgo] Nuevo namespace i18n sin traducciones previas** → **Mitigación**: se agregan ambas variantes (`es-PE`, `en-US`) en la misma tarea, siguiendo el criterio de aceptación global del proyecto.

## Open Questions

Ninguna pendiente. El punto de mayor ambigüedad (cómo reconciliar `LocalFormInput.planoUrl: File` con `Local.planoPngUrl: string` a través de HTTP simulado) se resolvió en la Decisión 1.
