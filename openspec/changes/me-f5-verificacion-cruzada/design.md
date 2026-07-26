## Context

Fases 1-4 de Multiempresa ya aplicadas. Fase 3 filtró los 6 módulos de negocio (Documentos, Incidentes, NC, QE, Locales/Zonas) por empresa activa en sus operaciones CRUD estándar, dejando explícitamente fuera de alcance "dashboard, notificaciones y exports" por no seguir el patrón CRUD. Fase 4 dejó explícitamente fuera de alcance "verificación de exports/reportes cross-empresa del módulo QE".

Un inventario de código (no de PRD/specs) hecho antes de esta propuesta encontró:

1. `GET /api/quality-events` (listado, `quality-events.handlers.ts:130-163`) es el único endpoint del módulo QE sin `qe.empresaId !== getActiveEmpresaId()` — el resto del mismo archivo (detalle, PATCH, DELETE, export-pdf) sí lo valida. Bug real, no solo alcance pendiente.
2. `dashboard.handlers.ts` agrega sobre `getQeStore()`/`getDocumentsStore()`/`getNonconformitiesStore()`/`getIncidentsStore()` sin filtro de empresa en 6 puntos de lectura distintos, repartidos entre las funciones internas que alimentan `/api/dashboard/kpis` y `/api/dashboard/summary`.
3. `Notificacion` (`src/types/notification.types.ts`) no tiene `empresaId`. Sus dos rutas de creación (`generateVencimientoNotifications` en `notificationGeneration.ts`, y `createCambioEstadoNotification` invocada desde 11 call sites en los 4 handlers de dominio) tampoco lo asignan.
4. La resolución de destinatarios por rol en 6 puntos (3 en `quality-events.handlers.ts`, 2 en `notificationGeneration.ts`, ver Decisión 3) usa `MockUser.rol` — un campo base del fixture crudo — en vez de `getRolEfectivo(usuarioId, empresaId)`, el helper que Fase 2 ya introdujo para resolver el rol efectivo por empresa (`empresas.fixtures.ts:79`).
5. Numeración/folios (5 generadores), export PDF de QE (individual y batch), `staleTime` de vistas agregadas, y selectores de Local/Zona: confirmados ya correctos en código, sin cambio necesario.

## Goals / Non-Goals

**Goals:**
- Cerrar el hueco de `GET /api/quality-events` sin filtro de empresa.
- Extender el filtrado por empresa activa a las dos superficies transversales que Fase 3 dejó fuera: dashboard y notificaciones.
- Corregir la resolución de destinatarios por rol para que use el rol efectivo por empresa (`getRolEfectivo`), no un campo estático del fixture, en los 6 puntos identificados.
- Formalizar en spec (requirement + scenario) las garantías que ya son correctas en código (numeración, export PDF, Local/Zona) para protegerlas de regresión futura, sin tocar su implementación.
- Dejar registro explícito de que el pendiente de `staleTime` de `useIncidents` ya no aplica al código actual.

**Non-Goals:**
- No se agrega ninguna funcionalidad nueva ni pantalla nueva.
- No se re-arquitectura el sistema de notificaciones (sigue siendo recomputado en cada `GET`, sin cron — Decisión 4 de `me-f2`/patrón ya establecido).
- No se introduce un helper de sesión compartido nuevo para `getActiveEmpresaId()` — cada handler MSW ya define su propia copia idéntica (patrón establecido en Fase 3, ver `me-f3-scoping-modulos` design.md D1); esta fase sigue el mismo patrón en `dashboard.handlers.ts`.
- No se toca el catálogo de Áreas (`features/areas/`) — confirmado en Fase 1 y re-confirmado aquí que sigue fuera de alcance; el emparejamiento de `SUPERVISOR` por `areaIds` en notificaciones sigue funcionando igual que hoy (an isolated per-empresa fix no depende de que Área tenga `empresaId`).

## Decisions

### Decisión 1 — Fix de `GET /api/quality-events`: mismo patrón inline que el resto del handler
Se agrega `filtered = filtered.filter(qe => qe.empresaId === getActiveEmpresaId())` al inicio de la cadena de filtros en el handler de listado (`quality-events.handlers.ts:144`), reusando la función `getActiveEmpresaId()` ya definida en el mismo archivo (línea 35). Es el mismo patrón que ya usan `detail`/`PATCH`/`DELETE` en el mismo archivo — no se introduce abstracción nueva.

**Alternativa descartada:** envolver `qeStore` en un getter "scoped" reutilizable (`getScopedQeStore()`). Se descarta porque el resto del archivo seguiría usando `qeStore`/`getQeStore()` directo (usado también por `dashboard.handlers.ts` y `notificationGeneration.ts`, que necesitan el store completo sin filtrar para agregarlo ellos mismos por su propia empresa activa) — cambiar la forma del getter exportado rompería esos consumidores.

### Decisión 2 — `dashboard.handlers.ts`: helpers `scoped*()` locales en vez de filtrar en cada uno de los 6 call sites
El archivo tiene 6 bloques que llaman `getQeStore()`/`getDocumentsStore()`/`getNonconformitiesStore()`/`getIncidentsStore()` sin filtro (líneas ~308-311, 449-452, 472-474, 572-574, 692-695, 797). En vez de repetir `.filter(x => x.empresaId === activeEmpresaId)` 15+ veces, se agrega al archivo su propia copia de `getActiveEmpresaId()` (mismo patrón que los otros 5 handlers) más 4 funciones locales `scopedQes()`, `scopedDocs()`, `scopedNcs()`, `scopedIncidentes()` que envuelven el store crudo con el filtro, y se reemplazan los 6 call sites para usarlas. Limitado a este archivo — no se exporta el helper ni se comparte con otros handlers.

**Alternativa descartada:** filtrar inline en cada uno de los ~15 call sites individuales. Se descarta por repetición — 4 líneas de helper evitan duplicar la misma expresión de filtro más de una docena de veces en un archivo de más de 800 líneas, reduciendo el riesgo de que una futura adición al dashboard olvide el filtro.

### Decisión 3 — `Notificacion` gana `empresaId: string`, poblado en el origen, no derivado en el `GET`
Se agrega `empresaId: string` a la interfaz `Notificacion` (`notification.types.ts`). Se puebla en el momento de creación, no derivado en `GET /api/notifications` buscando la entidad origen por `entidadTipo`/`entidadId` en cada lectura:
- `generateVencimientoNotifications`: cada notificación toma el `empresaId` de la entidad que la origina (QE/NC/Incidente/Documento), que el store ya expone en el objeto que se está iterando.
- `createCambioEstadoNotification`: su `CreateCambioEstadoParams` gana un campo `empresaId`, que los 11 call sites (7 en `quality-events.handlers.ts`, 2 en `documents.handlers.ts`, 1 en `incidents.handlers.ts`, 1 en `nonconformities.handlers.ts`) pasan desde la entidad que ya tienen cargada en memoria en ese punto del handler.
- `GET /api/notifications` agrega `.filter(n => n.empresaId === activeEmpresaId)` junto al filtro existente por `usuarioId`.

**Alternativa descartada:** no tocar `Notificacion` y resolver `empresaId` en el `GET` buscando la entidad origen (`entidadTipo` + `entidadId`) contra los 4 stores de dominio. Se descarta porque es más caro (una búsqueda cross-store por cada notificación en cada `GET`, ejecutado además dentro de `generateVencimientoNotifications` que ya corre en cada `GET`), más frágil (una notificación de una entidad ya eliminada del store pierde la forma de resolver su empresa), y rompe el patrón ya establecido en el propio archivo de denormalizar datos conocidos al momento de creación (`entidadCodigo` ya se guarda así, no se re-deriva).

### Decisión 4 — Resolución de destinatarios por rol: `getRolEfectivo(usuarioId, empresaId)` en vez de `MockUser.rol`
Los 6 puntos que filtran `getUsersStore()` por `u.rol === 'X'` (4 en `quality-events.handlers.ts`: `notifyReaperturaEscalada` RN-QE-008, notificación a `JEFE_CALIDAD_SYST` al entrar a `PENDIENTE_CIERRE`, y las 2 escaladas RN-QE-005 a `ALTA_DIRECCION` por severidad ALTA/CRITICA al cerrar y al verificar EFECTIVO; 2 en `notificationGeneration.ts`: destinatarios de vencimiento de Documento, destinatarios de RN-INC-006; el `SUPERVISOR`+`areaIds` de incidentes se mantiene igual salvo por resolver el rol vía `getRolEfectivo`) pasan a construir la lista de destinatarios iterando `getUsersStore()` y resolviendo `getRolEfectivo(u.id, entidad.empresaId)` en vez de leer `u.rol` directo. Esto reutiliza el helper que Fase 2 ya introdujo en `empresas.fixtures.ts` para el mismo propósito en `auth.handlers.ts` — no se crea un helper nuevo.

**Por qué importa incluso después de filtrar las entidades por empresa:** un usuario con `UsuarioEmpresa` en más de una empresa tiene un único `MockUser.rol` "base" en el fixture crudo (el valor con el que fue creado, no necesariamente el vigente en la empresa de la entidad). Filtrar solo la entidad de origen por `empresaId` no arregla que la lista de destinatarios se siga armando con el rol equivocado para ese usuario.

**Alternativa descartada:** agregar `empresaId` como filtro adicional a la lista de destinatarios sin cambiar de dónde se lee el rol (ej. `getUsersStore().filter(u => u.rol === 'X' && tieneAsignacionActiva(u.id, empresaId))`). Se descarta porque seguiría usando el rol base incorrecto para decidir el `'X'` — el problema no es que falte un filtro de empresa sobre la lista de usuarios, es que el campo de rol consultado no es el efectivo para esa empresa.

## Risks / Trade-offs

- [Ampliar el fix de notificaciones a 11 call sites de `createCambioEstadoNotification` más 6 puntos de resolución de rol es más superficie que el "fix puntual" que insinuaba la propuesta original] → Mitigación: cada call site solo necesita pasar un `empresaId` que ya tiene disponible en memoria (la entidad recién cargada/mutada); no hay lógica nueva que inventar, solo un parámetro adicional propagado. Se verifica módulo por módulo en tasks.md, mismo principio de diagnóstico-antes-de-fix.
- [Cambiar la fuente del rol en la resolución de destinatarios (Decisión 4) puede alterar quién recibe una notificación existente en escenarios ya cubiertos por tests] → Mitigación: para un usuario con una sola empresa asignada, `getRolEfectivo(u.id, empresaId)` devuelve el mismo rol que `MockUser.rol` ya reflejaba (son consistentes en fixtures de un solo assignment); el comportamiento solo cambia para el usuario con doble asignación, que es exactamente el caso que Fase 1 diseñó para poder detectar este tipo de bug.
- [`dashboard.handlers.ts` tiene ~800 líneas con 6 puntos de lectura de stores repartidos en funciones distintas; fácil dejar uno sin migrar a los helpers `scoped*()`] → Mitigación: tasks.md pide un grep de verificación final (`getQeStore()`, `getDocumentsStore()`, `getNonconformitiesStore()`, `getIncidentsStore()` sin pasar por `scoped*()`) antes de dar la fase por cerrada.
- [Formalizar en spec comportamiento ya-correcto (export PDF, numeración, Local/Zona) sin tocar código es trabajo que no previene ningún bug hoy] → Mitigación: aceptado como costo bajo — son requirements/scenarios cortos, y es la única forma de que una regresión futura en esas áreas falle un test en vez de descubrirse en producción.

## Migration Plan

No aplica migración de datos (mocks). Orden de implementación sugerido en tasks.md: (1) QE listado → (2) Notificacion.empresaId + 11 call sites → (3) resolución de destinatarios por rol (6 puntos) → (4) dashboard → (5) formalización de spec para lo ya-correcto (export PDF, numeración, Local/Zona, staleTime) → (6) verificación manual end-to-end con las 2 empresas de prueba.

## Open Questions

Ninguna — alcance y decisiones confirmados contra código real antes de escribir esta propuesta.
