## Context

M2-S01 entregó la capa de tipos completa para No Conformidades: `NCStatus`, `NCTipo`, `NCSeveridad`, `NCOrigen`, `NoConformidad`, `NCPermissions`, schemas Zod y `getNCPermissions`. M2-S02 construye sobre esa base para añadir la capa de datos completa.

El backend .NET 10 aún no existe. MSW v2 es la única fuente de datos en desarrollo. El flujo de tres capas es:

```
UI Component → TanStack Query Hook → nonconformities.api.ts (Axios) → MSW interceptor → in-memory fixtures
```

Esta spec también extiende la interfaz `NoConformidad` con tres adiciones requeridas por los fixtures y handlers: el campo `dominio: NCDominio` (que determina el prefijo del número de NC), el array `accionesCorrectivas: AccionCorrectiva[]`, y campos opcionales específicos de dominio (`requiereIPER` para SST, `notificacionComercioExterior` para ADU). Todos los cambios son aditivos — sin breaking changes en M2-S01.

## Goals / Non-Goals

**Goals:**
- Definir 8 funciones Axios puras en `nonconformities.api.ts` como única interfaz HTTP del dominio M2.
- Proveer 8 fixtures realistas cubriendo los 4 dominios (NC-CAL, NC-SST, NC-ADU, NC-OPE), 3 severidades y todos los estados del ciclo de vida, con 1–3 ACs cada una.
- Implementar 8 handlers MSW v2 que enforcan RN-NC-001..007 y la detección de duplicados (RN-NC-005) en la capa mock.
- Envolver todas las llamadas API en 8 hooks TanStack Query v5 con invalidación de caché correcta y feedback Sonner en onSuccess/onError.
- Extender `NoConformidad` con `NCDominio`, `AccionCorrectiva[]` y campos específicos de dominio (cambios aditivos).

**Non-Goals:**
- Componentes React o layouts — diferidos a M2-S03.
- Valores de traducción en i18n (`es-PE.json`/`en-US.json`) — claves se declaran en specs; valores se rellenan en M2-S03.
- Integración real con M4 (Quality Events) — el campo `qeGeneradoId` sigue siendo una referencia opaca.
- Backend API integration o contract testing — diferido hasta que exista el backend.
- Persistencia de audit trail más allá del array in-memory de MSW.

## Decisions

### D1 — Funciones API puras separadas de hooks

**Decision:** `nonconformities.api.ts` exporta 8 funciones async puras; los hooks importan y llaman exclusivamente estas funciones. Sigue el mismo patrón que `documents.api.ts` de M1-S02.

**Rationale:** (a) Funciones testables sin wrapper React. (b) Importables directamente fuera de componentes (ej. desde acciones Zustand). (c) Cuando el backend llegue, solo `nonconformities.api.ts` cambia — cero modificaciones en hooks.

**Alternativa descartada:** Inline `axios.get(...)` dentro de los fetchers de `useQuery`. Rechazada: filtra detalles HTTP al hook layer, complica el testing, viola la convención de capas del proyecto.

### D2 — Estado in-memory de MSW como array mutable a nivel de módulo

**Decision:** El módulo de handlers inicializa `let nonconformities = [...nonconformityFixtures]` en la importación. Todos los handlers de mutación actualizan este array en lugar. El array se resetea a fixtures en cada recarga de página.

**Rationale:** El enfoque más simple que provee comportamiento CRUD realista. El reset en recarga es deseable en desarrollo: cada sesión empieza desde un estado determinístico conocido.

**Alternativa descartada:** Persistir estado en `localStorage` via el service worker. Rechazada: añade complejidad sin beneficio; los fixtures son determinísticos por diseño.

### D3 — Enforcement de reglas de negocio dentro de los handlers MSW

**Decision:** Los handlers de mutación importan `NC_STATE_TRANSITIONS` de las constantes y `getNCPermissions` de los utils para validar RN-NC-001..007 antes de mutar estado.

**Rationale:** Los desarrolladores deben experimentar rechazos realistas en desarrollo, no descubrir violaciones de reglas solo al conectar el backend. Usar los mismos helpers que usará el código de producción previene drift estructuralmente.

### D4 — NCDominio como campo adicional en NoConformidad (no reemplaza NCTipo)

**Decision:** Se añade `dominio: NCDominio` (`'CALIDAD' | 'SST' | 'ADUANERO' | 'OPERACIONAL'`) como campo separado, ortogonal a `tipo: NCTipo` (`'PROCESO' | 'PRODUCTO' | 'SERVICIO' | 'SISTEMA' | 'SST'`).

**Rationale:** `NCTipo` describe el *tipo de defecto* (categoría de calidad). `NCDominio` describe el *área de negocio* afectada. Son clasificaciones ortogonales: una NC-SST puede tener `tipo='PROCESO'` (defecto en un proceso de seguridad). El `numero` toma el prefijo del dominio (NC-CAL-2025-001, NC-SST-2025-002, NC-ADU-2025-003, NC-OPE-2025-004).

**Alternativa descartada:** Extender NCTipo con CALIDAD/ADUANERO/OPERACIONAL. Rechazada: mezclaría dos dimensiones semánticas distintas (tipo de defecto vs. área organizacional), rompería la terminología ISO 9001, y complicaría la lógica de permisos y semáforos.

### D5 — AccionCorrectiva embebida en el detalle de NC

**Decision:** `AccionCorrectiva` vive dentro de `NoConformidad.accionesCorrectivas[]`. El endpoint `GET /api/nonconformities/:id` retorna la NC con todas sus ACs embebidas. No existe endpoint `/api/acciones-correctivas` independiente.

**Rationale:** Las ACs no tienen identidad útil fuera de su NC en M2. El embebido simplifica el data model y es el patrón natural para este dominio. Si en M4 (QE) se necesitan ACs cross-NC, se creará una entidad independiente en ese módulo.

**Alternativa descartada:** Endpoint independiente `/api/acciones-correctivas`. Rechazada: añade complejidad sin caso de uso presente; viola YAGNI.

### D6 — Duplicate detection como advertencia no bloqueante en el handler POST

**Decision:** El handler `POST /api/nonconformities` busca NCs del mismo `dominio` + `areaAfectada` en los últimos 30 días. Si hay coincidencias, retorna HTTP 201 con el body normal más `{ warning: 'POSIBLE_DUPLICADO', ncsSimilares: [...] }`.

**Rationale:** La detección de duplicados es una advertencia UX, no una validación de integridad. Bloquear la creación violaría el principio de que el operador puede reportar una NC aunque parezca duplicada (podría ser una recurrencia legítima). El hook `useCreateNonconformity` expone `data.warning` para que el componente muestre el aviso.

### D7 — Invalidación de caché: lista + detalle en mutaciones NC; detalle únicamente en mutaciones AC

**Decision:** Mutaciones NC (`create`, `update`, `anular`) invalidan `QUERY_KEYS.nonconformities.all`. Mutaciones AC (`createAC`, `updateAC`, `cerrarAC`) invalidan solo `QUERY_KEYS.nonconformities.detail(ncId)`.

**Rationale:** Las mutaciones NC pueden afectar la lista (nuevas NCs, cambio de estado visible). Las mutaciones AC solo afectan la vista de detalle (las listas no muestran ACs individuales). Invalidar `all` en mutations AC sería costoso e innecesario.

## Risks / Trade-offs

- **[Risk] MSW state resets on page reload** → Mitigation: intencional. Estado determinístico por sesión es una feature de desarrollo.
- **[Risk] Duplicate detection es timestamp-based** → Los fixtures usan fechas fijas. Los handlers usan `new Date()` para la ventana de 30 días, lo que hace la detección predecible en tests: fixtures con fechas antiguas nunca disparán el warning.
- **[Risk] NCDominio añade campo requerido a NoConformidad** → Cambio aditivo en el tipo TypeScript. Como M2-S01 no entregó fixtures, no hay arrays existentes que romper.
- **[Risk] Coherencia AC–NCStatus no validada completamente en MSW** → El handler de anular/cerrar NC bloquea si hay ACs en estado `PENDIENTE` o `EN_EJECUCION` (RN-NC-003), pero la validación completa de cierre se refinará en M2-S03.

## Open Questions

- ¿El campo `notificacionComercioExterior` necesita un `estado` propio (`NOTIFICADO | PENDIENTE`) o es solo metadata del evento? → Por ahora solo metadata `{ fecha, referencia, descripcion }`. Se revisará en M2-S03.
- ¿Las NCs de dominio `ADUANERO` requieren un estado adicional `NOTIFICADO_SUNAT` en la máquina de estados? → Diferido a consulta con el área aduanera. Por ahora siguen el flujo de 6 estados estándar.
