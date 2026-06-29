## Context

El Módulo M3 (Gestión de Incidentes SyST) sigue el mismo patrón arquitectónico que M2 (No Conformidades). Al momento de este spec, M2 ya está implementado con tipos, schemas, permisos y constantes. M3-S01 replica esa estructura adaptada al dominio SyST: ciclo de vida más corto (sin REABIERTO), severidad auto-calculada por tipo de incidente, y reglas de permisos distintas. El backend aún no existe; MSW intercepta todo.

## Goals / Non-Goals

**Goals:**
- Establecer el contrato de tipos TypeScript del dominio incidentes (enums, interfaces, AC)
- Definir la función de permisos RBAC `getIncidentPermissions()` como única fuente de verdad
- Proveer helpers de negocio (`getAutoSeveridad`, `getPlazoInvestigacion`) consumibles desde M3-S04
- Definir schemas Zod para las dos fases de formulario: reporte inicial e investigación
- Agregar constantes de etiquetas a `shared.constants.ts` sin romper imports existentes

**Non-Goals:**
- No incluye UI (formularios, listas, badges) — eso es M3-S02 a M3-S06
- No incluye hooks TanStack Query ni cliente Axios — eso es M3-S02
- No incluye handlers MSW ni fixtures — eso es M3-S03
- No implementa la vinculación real con M4 Quality Events — `qeId` es un stub provisional

## Decisions

**1. Tipos separados de M2, sin herencia**
`IncidentSeveridad` y `IncidentTurno` tienen los mismos valores que `NCSeveridad` y `NCTurno`, pero se definen como tipos separados en `incident.types.ts`. Alternativa rechazada: exportar desde shared y que ambos módulos importen de ahí, porque crea un acoplamiento prematuro entre M2 y M3 que complica el eventual reemplazo por M4. Cuando M4 absorba ambos, unificará en ese momento.

**2. `IncidentStatus` no incluye `REABIERTO`**
A diferencia del QE (M4), los incidentes SyST no tienen ciclo de reapertura formal — la ISO 45001 §10.2 exige investigar y cerrar, pero la reapertura se gestiona como un nuevo incidente con referencia al original. `ANULADO` cubre los casos de cancelación.

**3. `getAutoSeveridad` como helper puro, no lógica de schema**
La auto-severidad no se mete dentro del refine del schema Zod porque el formulario M3-S04 permitirá al usuario ajustarla. El helper es solo para el valor inicial sugerido, no una validación hard. Alternativa rechazada: `.transform()` en el schema — haría el campo no ajustable por el usuario.

**4. `informeMedicoAdjunto?: string` en la interfaz, validación en M3-S04**
RN-INC-002 exige que un ACCIDENTE no se cierre sin informe médico. El campo se define ahora en el tipo para que M3-S04 pueda leerlo. La lógica de bloqueo del botón "Cerrar" se implementa en el componente de detalle (M3-S05), no en el schema de creación.

**5. Barrel export en `incidents/index.ts`**
Mismo patrón que M2: un único punto de entrada para que otros módulos puedan importar desde `@/features/incidents` en lugar de rutas absolutas profundas. Facilita la futura migración a M4.

## Risks / Trade-offs

- **Duplicación de tipos con M2** → Aceptado. Es temporal hasta que M4 unifique. Duplicar ahora es más seguro que crear dependencias cruzadas prematuras entre features.
- **`qeId` es stub sin validación** → Riesgo bajo: el campo es opcional, M4 lo adoptará. No hay lógica de negocio sobre él en este spec.
- **`IncidentTurno` incluye `TODOS`** → Necesario para el helper de filtros de lista (M3-S02). A diferencia de `NCTurno`, un incidente real siempre tiene turno específico; `TODOS` solo es válido en el contexto de filtros.
