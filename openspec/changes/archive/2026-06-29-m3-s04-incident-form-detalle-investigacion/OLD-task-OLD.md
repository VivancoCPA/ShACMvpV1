## 1. Schema Zod del formulario

- [ ] 1.1 Crear `src/features/incidents/schemas/incidentForm.schema.ts` con `createIncidentSchema` (bloque reporte inicial: tipo, descripcion, area, fechaEvento, turno, huboLesionados, numLesionados, severidad) y validaciones de fecha (no futura, máx 72h pasado)
- [ ] 1.2 Agregar `updateIncidentSchema` extendiendo `createIncidentSchema` con campos opcionales del bloque investigación: `personalInvolucrado`, `testigos`, `equiposInvolucrados`, `condicionesEntorno`, `atencionMedicaRequerida`, `descripcionAtencionMedica`, `informeMedicoAdjunto`
- [ ] 1.3 Exportar tipos `CreateIncidentInput` y `UpdateIncidentInput` inferidos de los schemas

## 2. Componente EscaladoBanner

- [ ] 2.1 Crear `src/features/incidents/components/EscaladoBanner.tsx` — componente presentacional que recibe `severidad: IncidentSeveridad` y renderiza banner rojo (CRITICA) o naranja (ALTA) con ícono `AlertTriangle` de Lucide; sin renderizado para MEDIA/BAJA
- [ ] 2.2 Agregar claves i18n para el texto del banner en `incidents` namespace (`es-PE.json` y `en-US.json`)

## 3. Componente IncidentForm

- [ ] 3.1 Crear `src/features/incidents/components/IncidentForm.tsx` con prop `mode: 'create' | 'edit'` y `defaultValues?: UpdateIncidentInput`; configurar RHF con resolver Zod basado en `mode`
- [ ] 3.2 Implementar bloque "Reporte inicial": radio cards para `tipo` (4 opciones con ícono Lucide), textarea `descripcion`, select `area` desde `AREAS_SHAC`, datetime-local `fechaEvento`, select `turno` (DIA/TARDE/NOCHE, sin opción TODOS)
- [ ] 3.3 Implementar toggle `huboLesionados` con campo condicional `numLesionados` (number, mín 1) que aparece/desaparece según el toggle
- [ ] 3.4 Implementar select `severidad` deshabilitado para no-JEFE_CALIDAD_SYST; lógica `useWatch` en `tipo` y `numLesionados` para `setValue('severidad', getAutoSeveridad(tipo, numLesionados))`
- [ ] 3.5 Implementar bloque "Investigación" colapsable (solo visible si `mode = 'edit'`): chevron toggle, campos `personalInvolucrado`, `testigos`, `equiposInvolucrados`
- [ ] 3.6 Implementar checkboxes multi-select para `condicionesEntorno` usando `Controller` de RHF con opciones desde `CONDICION_ENTORNO_LABELS`
- [ ] 3.7 Implementar toggle `atencionMedicaRequerida` con textarea condicional `descripcionAtencionMedica`; file input `informeMedicoAdjunto` (PDF, máx 10 MB) con nota informativa condicional si `tipo = ACCIDENTE`
- [ ] 3.8 Implementar nota informativa de plazo de investigación usando `getPlazoInvestigacion(severidad)` en el bloque investigación
- [ ] 3.9 Agregar botones "Guardar" (submit) y "Cancelar" (navega a `/incidents`); mostrar errores de validación Zod inline bajo cada campo
- [ ] 3.10 Aplicar layout de dos columnas igual que NCForm del M2; título dinámico "Nuevo Incidente" / "Editar Incidente — INC-2026-NNN"
- [ ] 3.11 Agregar soporte dark mode en todas las clases Tailwind del componente

## 4. Páginas de creación y edición

- [ ] 4.1 Crear `src/features/incidents/pages/IncidentNewPage.tsx`: verificar `canCreate` de `getIncidentPermissions()`, redirigir a `/incidents` si false; renderizar `IncidentForm mode='create'`; en onSubmit llamar `useCreateIncident()` → toast con número → `navigate('/incidents/:id')`
- [ ] 4.2 Crear `src/features/incidents/pages/IncidentEditPage.tsx`: leer `id` de params, llamar `useIncident(id)`, verificar `canEdit` de `getIncidentPermissions()`, redirigir si false; pre-cargar `defaultValues` en `IncidentForm mode='edit'`; en onSubmit llamar `useUpdateIncident()` → toast → `navigate('/incidents/:id')`
- [ ] 4.3 Agregar claves i18n para títulos, labels, placeholders, toasts y mensajes de error del formulario en `es-PE.json` y `en-US.json`

## 5. Componente IncidentACSection

- [ ] 5.1 Crear `src/features/incidents/components/IncidentACSection.tsx`: recibe `accionesCorrectivas: AccionCorrectiva[]` y `canAddAC: boolean`; renderiza lista de ACs con descripción, responsable, `DeadlineBadge` para `fechaVencimiento`, y badge de estado
- [ ] 5.2 Implementar botón "+ Agregar AC" visible solo si `canAddAC = true`; el modal/form de agregar AC puede ser un placeholder funcional con campos mínimos (descripcion, responsable, fechaVencimiento) que llama a `useUpdateIncident()` para añadir la AC al array
- [ ] 5.3 Agregar claves i18n para la sección de ACs

## 6. Componente IncidentDetail

- [ ] 6.1 Crear `src/features/incidents/components/IncidentDetail.tsx`: recibe `incidente: Incidente`; estructura con tres secciones verticales: cabecera, detalle/investigación, ACs
- [ ] 6.2 Implementar cabecera: número en tipografía grande, `IncidentTypeBadge` + `IncidentStatusBadge` + `SeverityBadge` en línea, metadatos (fecha evento, área, turno, reportado por, fecha reporte), `EscaladoBanner` condicional
- [ ] 6.3 Implementar botones de acción en cabecera según `getIncidentPermissions()`: "Editar" (Pencil, navega a editar) si `canEdit`, "Eliminar" (Trash2, modal confirmación) si `canDelete`; ocultar todos si `estado = ANULADO`
- [ ] 6.4 Implementar sub-bloque "Descripción del evento" (expandido por defecto): `descripcion`, lesionados y número si aplica, `condicionesEntorno` como badges usando `CONDICION_ENTORNO_LABELS`, `equiposInvolucrados`/`personalInvolucrado`/`testigos` con valor, `atencionMedica` + descripción, enlace de descarga `informeMedicoAdjunto` con ícono FileText
- [ ] 6.5 Implementar sub-bloque "Información de investigación" colapsable: plazo con `getPlazoInvestigacion(severidad)`, estado actual con orientación de qué falta, alerta amarilla si `tipo = ACCIDENTE` y sin `informeMedicoAdjunto`
- [ ] 6.6 Integrar `IncidentACSection` como Sección 3; reducir opacidad de la card completa si `estado = ANULADO`
- [ ] 6.7 Implementar breadcrumb "Incidentes / INC-2026-NNN" y botón "Volver a Incidentes"
- [ ] 6.8 Aplicar dark mode en todas las clases Tailwind del componente

## 7. Página de detalle

- [ ] 7.1 Crear `src/features/incidents/pages/IncidentDetailPage.tsx`: leer `id` de params, llamar `useIncident(id)`; si `deletedAt` presente → `navigate('/incidents', { replace: true })`; si 404 → estado vacío con botón volver; si carga → renderizar `IncidentDetail`
- [ ] 7.2 Agregar claves i18n para estados vacíos, errores de carga y textos de la página de detalle

## 8. Rutas

- [ ] 8.1 En `src/router/index.tsx` agregar ruta `/incidents/nuevo` → `IncidentNewPage` ANTES de la ruta `/incidents/:id` para evitar colisión en React Router v6
- [ ] 8.2 Agregar ruta `/incidents/:id` → `IncidentDetailPage`
- [ ] 8.3 Agregar ruta `/incidents/:id/editar` → `IncidentEditPage`
- [ ] 8.4 Verificar que el sidebar y la navegación existente no requieren cambios adicionales

## 9. Exportaciones e integración

- [ ] 9.1 Actualizar `src/features/incidents/index.ts` para exportar los nuevos componentes y páginas: `IncidentForm`, `IncidentDetail`, `IncidentACSection`, `EscaladoBanner`, `IncidentNewPage`, `IncidentEditPage`, `IncidentDetailPage`
- [ ] 9.2 Verificar que el schema `incidentForm.schema.ts` está exportado desde `index.ts` o desde el barrel de schemas

## 10. Verificación de criterios de aceptación

- [ ] 10.1 Crear incidente ACCIDENTE con 2 lesionados → severidad pre-rellena CRITICA, banner rojo visible en detalle
- [ ] 10.2 Crear incidente CONDICION_INSEGURA → severidad pre-rellena BAJA, sin banner en detalle
- [ ] 10.3 Intentar submit con descripción < 20 chars → error inline visible bajo el campo
- [ ] 10.4 Seleccionar `fechaEvento` futura → error de validación visible
- [ ] 10.5 Editar incidente EN_INVESTIGACION como SUPERVISOR → formulario disponible con bloque investigación visible
- [ ] 10.6 Navegar a editar como OPERARIO → redirige a `/incidents`
- [ ] 10.7 Ver detalle de ACCIDENTE sin informe médico → alerta amarilla visible
- [ ] 10.8 Agregar AC desde detalle como SUPERVISOR → aparece en lista de ACs
- [ ] 10.9 Ver incidente ANULADO → sin botones de edición, card con opacidad reducida
- [ ] 10.10 Breadcrumb "Incidentes / INC-2026-NNN" funcional y botón "Volver" navega a `/incidents`
