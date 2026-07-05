## Context

`QualityEventForm` (M4-S04) hoy no lee ningún query param al montar — siempre inicia vacío, sin importar desde dónde llegó el usuario. `NonconformityDetailPage` (M2) e `IncidentDetailPage`/equivalente (M3) tampoco ofrecen ningún botón para *crear* un QE; el único vínculo existente en esas páginas es hacia un QE que **ya** fue creado (`qeGeneradoId` / `qeId` poblado). Para que RN-QE-013 tenga sentido (comparar el área final contra el área de la entidad origen) primero debe existir un canal que lleve esa información — número y área de la NC/Incidente — hasta el formulario de creación del QE.

`areaId` en `Incidente` y `areaAfectada` en `NoConformidad` son ambos strings tomados de `AREAS_SHAC` (no IDs opacos que requieran resolución adicional), lo cual simplifica el diseño: el valor puede viajar directo en la URL y compararse por igualdad de string.

## Goals / Non-Goals

**Goals:**
- Definir el contrato de query params que transporta origen + identidad + área de la entidad origen hacia `/quality-events/nuevo`.
- Prellenar `areaAfectada` en `QualityEventForm` a partir de ese contrato y comparar en tiempo real contra el área de origen.
- Mostrar la advertencia no bloqueante con el formato exacto exigido, para NC e Incidente.
- Agregar el botón "Crear QE" en NC e Incidente, gateado por una nueva bandera de permiso simple (`canCrearQE`).

**Non-Goals:**
- No se implementa el vínculo inverso (setear `qeGeneradoId`/`qeId` en la NC/Incidente tras crear el QE) — sigue siendo un stub provisional fuera de esta propuesta.
- No aplica a orígenes O3 (`hallazgoAuditoriaRef`) ni O4 (`reporteExternoRef`) — no tienen entidad de origen con campo de área.
- No se prellenan otros campos del QE (severidad, descripción, turno, mineral) desde la NC/Incidente — solo `areaAfectada`, y solo porque RN-QE-010 depende de ella.
- No se modifica el criterio de qué área prevalece para permisos de edición del QE (RN-QE-010/011/012): sigue siendo `qe.areaAfectada`, el valor final guardado, sin importar si difiere del origen.

## Decisions

### Contrato de query params en `/quality-events/nuevo`
- `origen`: `'O2_NC_DETECTADA' | 'O1_INCIDENTE_CAMPO'` (únicos dos valores relevantes para RN-QE-013; el select de origen soporta los cuatro valores igual que hoy).
- `ncId` / `incidenteId`: reutiliza el nombre de campo que ya existe en el schema de creación del QE (`QualityEventCreateInput`), para poder hacer `setValue` directo sin mapeo.
- `ncNumero` / `incidenteNumero`: string legible (`NC-2026-014`, `INC-2026-003`) — solo para construir el mensaje de advertencia, no se envía en el payload del QE.
- `ncArea` / `incidenteArea`: el área de la entidad origen tal cual está en `AREAS_SHAC`. Ausente o vacío ⇒ sin prellenado ni advertencia (dato legado incompleto, criterio de aceptación 8).

Solo viajan estos cuatro valores por entidad — no el objeto completo (evita URLs largas y no expone descripción/adjuntos en la barra de direcciones).

**Alternativa descartada**: pasar solo el `id` y volver a hacer fetch de la NC/Incidente completo dentro de `QualityEventForm` para leer su área. Se descarta porque obliga a `QualityEventForm` a conocer los endpoints de M2/M3 (acoplamiento cruzado innecesario) solo para leer dos campos que la página de origen ya tiene en memoria.

### Estado de comparación vive fuera de React Hook Form
`QualityEventForm` mantiene `origenEntidad: { tipoEtiqueta: 'la NC' | 'el Incidente'; numero: string; area: string } | null` en estado de componente (derivado una vez de los query params al montar, memoizado), no como campo del formulario. La comparación se hace con `watch('areaAfectada')` en cada render: `origenEntidad && watchedArea && watchedArea !== origenEntidad.area`. Esto mantiene el payload enviado a `useCreateQualityEvent` sin campos extra y hace que la advertencia aparezca/desaparezca reactivamente sin lógica de sincronización manual.

### Mensaje de advertencia con artículo pre-compuesto
En lugar de una clave i18n que intente flexionar "la NC" / "el Incidente" con reglas gramaticales, `origenEntidad.tipoEtiqueta` ya contiene el artículo + tipo completo (`'la NC'` o `'el Incidente'`), fijado en el momento en que se construye el objeto desde el query param `origen`. La clave i18n es una sola plantilla: `t('qualityEvents:form.areaDivergeWarning', { tipoEtiqueta, numero, areaOrigen })` → `"Esta área difiere de la registrada en {{tipoEtiqueta}} {{numero}}: {{areaOrigen}}."`.

### `canCrearQE` sigue el patrón de `canAddAC`
Igual que `canAddAC` en `incident-permissions`, `canCrearQE` es `true` para `SUPERVISOR` y `JEFE_CALIDAD_SYST` cuando la entidad no está en estado terminal/anulado, no tiene `deletedAt`, y no tiene ya un QE vinculado (`qeGeneradoId` / `qeId` ausente). `OPERARIO` no ve el botón — puede seguir reportando un QE nuevo sin vínculo desde `/quality-events/nuevo` directamente, pero la decisión de escalar formalmente una NC/Incidente a QE queda en manos de los roles de investigación, igual que `canAddAC`.

## Risks / Trade-offs

- **[Riesgo] Datos legados con área en formato distinto al de `AREAS_SHAC`** (p. ej. `"Almacén Norte"` en fixtures vs. `"Almacén"` en la constante canónica) podría disparar advertencias falsas-positivas de forma sistemática. → **Mitigación**: fuera de alcance de esta propuesta corregir fixtures; la comparación es por igualdad de string tal cual está guardado, consistente con cómo ya se muestra/edita `areaAfectada` hoy. Si el dato de origen no coincide con ninguna opción del select de `areaAfectada`, el campo simplemente queda con un valor prellenado que el usuario puede corregir manualmente — no bloquea nada.
- **[Riesgo] Usuario navega directo a la URL con query params manipulados** (ej. `ncArea` inventada). → **Mitigación**: la advertencia es puramente informativa y no confiere ningún permiso ni afecta el guardado; en el peor caso, el mensaje muestra un área de origen incorrecta, sin impacto en integridad de datos.
- **[Trade-off] No hay vínculo inverso todavía**: tras crear el QE desde el botón, la NC/Incidente no queda automáticamente marcada como "ya tiene QE" (`qeGeneradoId`/`qeId` no se setean). Un usuario podría crear más de un QE desde la misma NC. → Aceptado explícitamente como no-goal; ya es una limitación preexistente del stub actual, no la introduce este cambio.

## Migration Plan

Cambio puramente aditivo en UI y query params — sin migración de datos ni de esquema de backend/mock. No requiere pasos de rollout especiales; revertir es simplemente revertir el código.

## Open Questions

Ninguna pendiente — alcance confirmado con el usuario (botón "Crear QE" incluido en esta propuesta).
