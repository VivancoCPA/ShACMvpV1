## 1. QualityEventForm page — scaffold and hook wiring

- [x] 1.1 Create `src/features/quality-events/pages/QualityEventForm.tsx` with `useForm<QualityEventCreateInput>({ resolver: zodResolver(qualityEventCreateSchema) })` and `useCreateQualityEvent()`
- [x] 1.2 Add `onSubmit` handler: call `mutate(data)`, on success navigate to `/quality-events/<data.id>`, on error show `toast.error` with server message or fallback
- [x] 1.3 Add "Cancelar" button that calls `navigate('/quality-events')` without submitting
- [x] 1.4 Disable "Guardar QE" button while `isPending` is true

## 2. Origen select and conditional section logic

- [x] 2.1 Render `<select>` for `origen` as the first field populated from `QE_ORIGIN_LABELS`
- [x] 2.2 Use `watch('origen')` to conditionally render exactly one origin section at a time
- [x] 2.3 On origin change, clear previous origin fields using `setValue` / `resetField` before the new section mounts

## 3. Origin-specific conditional sections

- [x] 3.1 O1 section: `incidenteId` select loaded via `useQuery GET /api/incidents` (enabled only when `origen === 'O1_INCIDENTE_CAMPO'`); each option shows `numero — descripcion.slice(0,60)... (area)`
- [x] 3.2 O1 section: show `t('qualityEvents:form.noIncidents')` inline message when incidents array is empty
- [x] 3.3 O2 section: `ncId` select loaded via `useQuery GET /api/nonconformities` (enabled only when `origen === 'O2_NC_DETECTADA'`); each option shows `numero — titulo.slice(0,60)... (areaAfectada)`
- [x] 3.4 O2 section: show `t('qualityEvents:form.noNonconformities')` inline message when NCs array is empty
- [x] 3.5 O3 section: `hallazgoAuditoriaRef` text input (maxLength 200, placeholder from `t('qualityEvents:form.hallazgoPlaceholder')`)
- [x] 3.6 O4 section: `reporteExternoRef.nombreCliente` text input (maxLength 200) and `reporteExternoRef.fechaRecepcion` date input registered via RHF dot-notation

## 4. Common header fields

- [x] 4.1 `tipo` select populated from `QE_TYPE_LABELS` (required)
- [x] 4.2 `severidad` select populated from `QE_SEVERITY_LABELS` (required)
- [x] 4.3 `descripcion` textarea (min 10 / max 2000 per schema) with live character counter `"<current>/2000"` via `watch('descripcion')`; counter turns `text-error` at ≥ 1900 chars
- [x] 4.4 `areaAfectada` select populated from `AREAS_SHAC` (required)
- [x] 4.5 `mineralInvolucrado` select with mineral options and a free-text "Otro" option (optional, no submit block)
- [x] 4.6 `turno` select with `DIA`, `TARDE`, `NOCHE` options (required)
- [x] 4.7 `fechaHoraEvento` datetime-local input (required); validate not future; convert to ISO string in `onSubmit`

## 5. CRITICA severity banner

- [x] 5.1 Render warning banner below `severidad` select when `watch('severidad') === 'CRITICA'` using `t('qualityEvents:form.criticaBanner')`; apply `bg-warning/10 text-warning border border-warning/30 rounded-md` styling

## 6. Responsive layout

- [x] 6.1 Wrap form fields in `grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4`
- [x] 6.2 Apply `md:col-span-1` to `tipo`, `severidad`, `turno`, `fechaHoraEvento` (paired columns on desktop)
- [x] 6.3 Apply `md:col-span-2` to `descripcion`, `areaAfectada`, `mineralInvolucrado`, origin-specific sections, and the footer buttons

## 7. Inline Zod validation error display

- [x] 7.1 Render `formState.errors.<field>.message` below each field using a `<p className="text-error text-sm mt-1">` pattern consistent with NCForm (M2-S04) and IncidentForm (M3-S04)
- [x] 7.2 Wire `fechaHoraEvento` future-date error to display `t('qualityEvents:form.errors.fechaFutura')` inline

## 8. i18n keys

- [x] 8.1 Add all form keys to `src/i18n/es-PE.json` under `qualityEvents.form`: `createTitle`, `noIncidents`, `noNonconformities`, `hallazgoPlaceholder`, `criticaBanner`, `errors.generic`, `errors.fechaFutura`, and field labels/placeholders
- [x] 8.2 Add matching keys to `src/i18n/en-US.json`

## 9. Router — new route

- [x] 9.1 Add child route `{ path: 'nuevo', element: <RoleGuard requiredRoles={['OPERARIO','SUPERVISOR','JEFE_CALIDAD_SYST']}><QualityEventForm /></RoleGuard> }` inside the `quality-events` segment in `src/router/index.tsx`, before any `/:id` pattern

## 10. QualityEventListPage — wire Nuevo QE button

- [x] 10.1 In `src/features/quality-events/pages/QualityEventListPage.tsx`, confirm or add `onClick={() => navigate('/quality-events/nuevo')}` on the "Nuevo Quality Event" button (skip if already present)
