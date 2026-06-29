## 1. Types y Schema

- [x] 1.1 Agregar `IncidentEvidencia` a `incident.types.ts` y campo `evidencias?: IncidentEvidencia[]` en `Incidente`
- [x] 1.2 Crear `incidentForm.schema.ts` con `createIncidentFormSchema` (base + evidencias File[] + validaciones fechaEvento) y `updateIncidentFormSchema` (extiende con bloque investigación)

## 2. Fixtures y MSW

- [x] 2.1 Agregar 2–3 evidencias mock a fixtures `inc-001` e `inc-002` en `incidents.fixtures.ts`
- [x] 2.2 Verificar que handlers POST/PUT en `incidents.handlers.ts` devuelven `evidencias` en el payload de respuesta

## 3. Componentes nuevos

- [x] 3.1 Crear `EscaladoBanner.tsx` — banner rojo/naranja para CRITICA/ALTA, nulo para otras severidades
- [x] 3.2 Crear `IncidentACSection.tsx` — lista ACs con DeadlineBadge + modal "Agregar AC" visible solo si `canAddAC`
- [x] 3.3 Crear `IncidentForm.tsx` — radio cards de tipo, auto-severidad con useWatch, toggle lesionados, zona de evidencias con thumbnails/PDF preview, bloque investigación colapsable (solo modo edición)

## 4. Páginas nuevas

- [x] 4.1 Crear `IncidentNewPage.tsx` — guard `canCreate`, envuelve `IncidentForm mode="create"`, redirige a `/incidents` si sin permiso
- [x] 4.2 Crear `IncidentEditPage.tsx` — carga incidente, guard `canEdit`, envuelve `IncidentForm mode="edit"`, redirige si sin permiso o si `deletedAt` presente
- [x] 4.3 Crear `IncidentDetailPage.tsx` — cabecera con badges, `EscaladoBanner`, bloque descripción (condicionesEntorno como badges, evidencias con lightbox), bloque investigación colapsable, alerta ACCIDENTE sin informe/evidencias, `IncidentACSection`, redirect si `deletedAt`

## 5. i18n

- [x] 5.1 Agregar claves `form` y `detail` bajo `incidents` en `es-PE.json`
- [x] 5.2 Agregar claves `form` y `detail` bajo `incidents` en `en-US.json`

## 6. Router y exports

- [x] 6.1 Actualizar `router/index.tsx` — reemplazar ComingSoon de `/incidents/nuevo` e `/incidents/:id` con páginas reales; agregar ruta `/incidents/:id/editar` con guard SUPERVISOR/JEFE_CALIDAD_SYST
- [x] 6.2 Actualizar `features/incidents/index.ts` — exportar nuevos componentes y páginas
