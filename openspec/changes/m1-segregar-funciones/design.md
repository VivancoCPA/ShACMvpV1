## Context

`documentFormSchema` (`src/features/documents/schemas/documentForm.schema.ts`) ya usa `.superRefine()` para una regla cruzada existente (`rolesAutorizados` requerido cuando `confidencialidad === 'RESTRINGIDO'`). `revisorId` y `aprobadorId` se validan hoy de forma independiente (cada uno string opcional), sin ninguna relación entre ambos. El mismo formulario (`DocumentForm.tsx`) se usa tanto para creación como para edición en `BORRADOR` — es el único punto donde ambos campos son editables simultáneamente, por lo que una sola regla en el schema cubre ambos flujos del CA de la propuesta.

Este es un cambio de bajo riesgo y alcance acotado: una regla de validación adicional sobre un schema Zod ya existente, sin cambios de arquitectura, dependencias nuevas, ni modelo de datos.

## Goals / Non-Goals

**Goals:**
- Bloquear en el formulario (create y edit) el guardado cuando `revisorId === aprobadorId` y ambos tienen valor.
- Reusar el patrón de error inline ya existente (`FieldError`) sin nuevo componente de UI.

**Non-Goals:**
- No se valida contra documentos/fixtures ya persistidos (RN-DOC-019 no es retroactiva).
- No se agrega ningún mecanismo de escalación o excepción por rol — es un bloqueo puro.
- No se modifica `createDocument.schema.ts` / `updateDocument.schema.ts` (`document-schemas`) — no están conectados a ningún flujo real hoy (`useDocumentForm.ts` llama `api.post`/`api.put` directamente con el payload validado por `documentFormSchema`).

## Decisions

**Ubicación de la regla: `superRefine` sobre `documentFormSchema`, no un validador separado.**
Sigue el mismo patrón que la regla `RESTRINGIDO` → `rolesAutorizados` ya presente en el mismo archivo (líneas 30-44). Mantiene toda la lógica de validación cruzada del formulario en un solo lugar.

**Comparación solo cuando ambos campos tienen valor no vacío.**
`revisorId`/`aprobadorId` son opcionales (`z.string().optional().or(z.literal(''))`). La regla solo debe activarse cuando ambos están asignados a un usuario real — dejar cualquiera vacío nunca dispara el bloqueo, evitando falsos positivos en formularios parcialmente completos.

**El error se adjunta a `path: ['aprobadorId']`.**
`DocumentForm.tsx` ya renderiza `<FieldError name="aprobadorId" />` junto al select de Aprobador (línea 329) — no requiere ningún cambio estructural en el componente, solo la nueva clave de mensaje vía `t()`.

**Mensaje vía i18n, no hardcodeado.**
Nueva clave `documents:form.error_revisor_aprobador_same` en `es-PE.json`/`en-US.json`, consistente con la regla global #4 de CLAUDE.md (nunca texto hardcodeado en JSX). El mensaje del `ctx.addIssue` en el schema puede quedar en español como fallback interno (mismo patrón que el mensaje existente de `rolesAutorizados` en el schema), pero el criterio de aceptación de bloqueo se cumple igual porque Zod solo determina `success: false`; el texto mostrado en UI proviene de la traducción, no del `message` del schema si el formulario resuelve el mensaje vía clave i18n en `FieldError` — a confirmar contra el patrón real de `FieldError` durante implementación (ver Open Questions).

## Risks / Trade-offs

- [Riesgo: `FieldError` actualmente muestra `errors[name]?.message`, que es el string crudo del `ctx.addIssue`, no una clave i18n] → Mitigación: seguir el mismo patrón ya usado por la regla `rolesAutorizados` (mensaje literal en español dentro del `superRefine`) para consistencia interna, y registrar la clave i18n en los JSON de todas formas para cumplir el criterio de aceptación global de i18n del proyecto; confirmar en `tasks.md` cuál de los dos mecanismos usa `FieldError` realmente antes de implementar.
- [Riesgo bajo: ningún fixture MSW actual tiene `revisorId === aprobadorId`] → Mitigación: no requerida (la regla no es retroactiva), pero se verificará en tasks que ningún fixture existente rompa tests por casualidad.

## Migration Plan

No aplica — cambio de validación de formulario sin migración de datos ni despliegue especial.

## Open Questions

- Confirmar si `FieldError` en `DocumentForm.tsx` debe resolverse vía `t()` con una clave nueva, o si basta replicar el patrón actual (mensaje literal en el `ctx.addIssue`, igual que la regla de `rolesAutorizados` ya existente) — resolver durante `tasks.md`/implementación revisando el componente `FieldError` real.
