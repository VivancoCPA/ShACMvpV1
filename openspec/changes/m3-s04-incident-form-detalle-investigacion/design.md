## Context

M3 tiene S01–S03 archivados: tipos/schemas/permisos/helpers, API client + MSW handlers + hooks TanStack Query, e IncidentList con filtros y paginación. Los usuarios pueden ver la lista pero no pueden crear, editar ni ver el detalle de un incidente. El backend no existe todavía; MSW es la única fuente de datos.

El referente canónico de UX es M2 (NCForm / NCDetail). La adaptación al dominio de incidentes implica campos distintos (tipo de incidente, lesionados, condiciones de entorno, informe médico) y lógica de escalado visual por severidad.

## Goals / Non-Goals

**Goals:**
- Formulario de creación (`/incidents/nuevo`) y edición (`/incidents/:id/editar`) con RHF + Zod
- Vista de detalle (`/incidents/:id`) con cabecera, investigación y ACs provisionales
- Cálculo automático de severidad via `getAutoSeveridad()` al cambiar tipo o lesionados
- Escalado visual: banner rojo/naranja para CRITICA/ALTA, alerta amarilla para ACCIDENTE sin informe médico
- Guards de ruta por rol usando `getIncidentPermissions()` (ya existe en S01)
- Sección de ACs provisional con `incidenteId`, sin `qeId`

**Non-Goals:**
- Firma electrónica (M4)
- Transiciones de estado (M4)
- Migración de ACs de `incidenteId` a `qeId` (M4)
- Nuevos handlers MSW — los existentes de S02 son suficientes
- Audit trail UI (se registra en backend, no se muestra en este spec)

## Decisions

### D1 — Schema Zod separado para formulario vs. tipo de dominio

Se crea `incidentForm.schema.ts` en `features/incidents/schemas/` con `createIncidentSchema` (campos del bloque inicial) y `updateIncidentSchema` (extiende con bloque investigación, campos opcionales). No se modifica el tipo `Incidente` de S01 — el schema Zod es solo para validación de formularios.

**Alternativa descartada**: Reusar el tipo `Incidente` directamente como schema. Rechazado porque incluye campos readonly (id, numero, auditTrail) que no deben aparecer en formularios.

### D2 — Bloque "Investigación" solo en modo edición, colapsable

El bloque de investigación solo se renderiza en `IncidentEditPage`, no en `IncidentNewPage`. Esto reduce complejidad cognitiva para el operario al reportar. En `IncidentForm` se usa prop `mode: 'create' | 'edit'` para condicionar el renderizado.

**Alternativa descartada**: Un solo formulario con bloque siempre visible. Rechazado porque el spec indica "solo en edición".

### D3 — Severidad auto-calculada con watch + useEffect en RHF

`useWatch` en `tipo` y `numLesionados` → `setValue('severidad', getAutoSeveridad(tipo, numLesionados))`. El campo severidad permanece editable para `JEFE_CALIDAD_SYST`. Para otros roles se renderiza como select deshabilitado mostrando el valor calculado.

**Alternativa descartada**: Calcular solo en submit. Rechazado porque el spec requiere pre-relleno inmediato al seleccionar tipo.

### D4 — ACs provisionales con patrón AccionCorrectiva de M2

Se reutiliza el tipo `AccionCorrectiva` con `incidenteId` en lugar de `ncId`. El campo `qeId` queda `undefined`. `IncidentACSection` es un componente nuevo (no reutiliza NCACSection de M2) para evitar acoplamiento prematuro entre módulos.

### D5 — EscaladoBanner como componente presentacional puro

`EscaladoBanner` recibe `severidad: IncidentSeveridad` y renderiza el banner correspondiente. Sin lógica interna — toda la condición se evalúa en el padre. Facilita testing y reutilización futura en M4/M5.

### D6 — Redirect en detalle si `deletedAt` presente

`IncidentDetailPage` verifica `incidente.deletedAt` tras carga. Si existe → `navigate('/incidents', { replace: true })`. Si `useIncident` retorna 404 → estado vacío con mensaje y botón volver.

## Risks / Trade-offs

- **[Riesgo] `condicionesEntorno` como checkboxes multi-select con RHF** → Se usa `Controller` de RHF para controlar el array. Mitigación: patrón ya establecido en otros checkboxes del proyecto.
- **[Riesgo] `informeMedicoAdjunto` como File input con Zod** → Zod valida solo en submit (tipo y tamaño). En el form se muestra nota informativa, no bloqueo. El bloqueo real es en el handler de cierre (M4). Mitigación: validación en schema + mensaje claro al usuario.
- **[Trade-off] No reutilizar NCACSection de M2** → Mayor consistencia a futuro cuando ACs se unifiquen en M4, a costa de algo de duplicación inicial.
- **[Riesgo] Rutas `/incidents/:id` y `/incidents/nuevo` colisionan en React Router** → Se garantiza que la ruta `/incidents/nuevo` se declare ANTES de `/incidents/:id` en el array de rutas. React Router v6 usa orden declarativo.
