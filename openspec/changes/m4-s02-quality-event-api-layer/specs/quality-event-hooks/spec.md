## ADDED Requirements

### Requirement: Query keys centralizadas para Quality Event
El sistema SHALL exportar `QE_QUERY_KEYS` desde el módulo de hooks, con la estructura:
```typescript
export const QE_QUERY_KEYS = {
  all:    ['quality-events'] as const,
  list:   (filters: QEListParams) => ['quality-events', 'list', filters] as const,
  detail: (id: string) => ['quality-events', 'detail', id] as const,
} as const
```

#### Scenario: Uso en invalidación de caché
- **WHEN** una mutación llama `queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.all })`
- **THEN** se invalidan tanto las queries de lista como las de detalle

### Requirement: Hook useQualityEvents para lista paginada
El sistema SHALL implementar `useQualityEvents(filters: QEListParams)` en `src/features/quality-events/hooks/useQualityEvents.ts` usando `useQuery` de TanStack Query v5 con `queryKey: QE_QUERY_KEYS.list(filters)` y `queryFn: () => getQualityEvents(filters)`.

#### Scenario: Consulta de lista
- **WHEN** un componente llama `useQualityEvents({ page: 1, pageSize: 10 })`
- **THEN** el hook retorna `{ data, isLoading, isError }` poblados desde MSW

#### Scenario: Reactivity ante cambio de filtros
- **WHEN** los `filters` cambian (nuevo `estado`)
- **THEN** TanStack Query dispara una nueva petición automáticamente por el cambio de `queryKey`

### Requirement: Hook useQualityEvent para detalle
El sistema SHALL implementar `useQualityEvent(id: string)` usando `useQuery` con `queryKey: QE_QUERY_KEYS.detail(id)` y `enabled: Boolean(id)`.

#### Scenario: Consulta de detalle con ID válido
- **WHEN** se llama `useQualityEvent('qe-2026-001')`
- **THEN** el hook retorna el fixture correspondiente en `data`

#### Scenario: Query deshabilitada sin ID
- **WHEN** se llama `useQualityEvent('')`
- **THEN** la query no se ejecuta (`enabled: false`)

### Requirement: Hook useCreateQualityEvent con toast de confirmación
El sistema SHALL implementar `useCreateQualityEvent()` usando `useMutation` con `mutationFn: createQualityEvent`. En `onSuccess`, DEBE:
- Invalidar `QE_QUERY_KEYS.all`.
- Mostrar `toast.success('QE ${data.numero} creado correctamente')` usando Sonner.

#### Scenario: Creación exitosa muestra toast con número
- **WHEN** se llama `mutate(data)` y MSW retorna status 201
- **THEN** `toast.success` se invoca con un mensaje que incluye el número del QE (e.g., `QE-2026-009`)

#### Scenario: Caché invalidado tras creación
- **WHEN** la mutación tiene éxito
- **THEN** la lista de QEs se refresca automáticamente al invalidarse `QE_QUERY_KEYS.all`

### Requirement: Hook useUpdateQualityEvent para actualización de campos
El sistema SHALL implementar `useUpdateQualityEvent()` usando `useMutation`. En `onSuccess`, DEBE invalidar `QE_QUERY_KEYS.list` y `QE_QUERY_KEYS.detail(id)`.

#### Scenario: Actualización exitosa invalida lista y detalle
- **WHEN** la mutación `mutate({ id: 'qe-2026-001', data: { ... } })` tiene éxito
- **THEN** tanto la query de lista como la de detalle del QE afectado se invalidan

### Requirement: Hook useTransitionQEStatus con manejo de errores de negocio
El sistema SHALL implementar `useTransitionQEStatus()` usando `useMutation`. En `onSuccess`, DEBE invalidar `QE_QUERY_KEYS.list` y `QE_QUERY_KEYS.detail(id)`. En `onError`, DEBE mostrar `toast.error(errorMessage)` donde `errorMessage` es el campo `message` de la respuesta del backend (e.g., `'RN-QE-002: causa raíz no firmada'`).

#### Scenario: Error RN-QE-002 muestra toast con mensaje del backend
- **WHEN** se llama `mutate({ id: 'qe-2026-001', data: { nuevoEstado: 'EN_EJECUCION' } })` y MSW retorna 422 con `message: 'RN-QE-002: causa raíz no firmada'`
- **THEN** `toast.error('RN-QE-002: causa raíz no firmada')` es invocado

#### Scenario: Error RN-QE-004 muestra toast con mensaje del backend
- **WHEN** se llama `mutate({ id: 'qe-2026-003', data: { nuevoEstado: 'CERRADO' } })` y MSW retorna 422 con `message: 'RN-QE-004: se requiere firma dual'`
- **THEN** `toast.error('RN-QE-004: se requiere firma dual')` es invocado

#### Scenario: Test unitario de useTransitionQEStatus con error 422
- **WHEN** el test renderiza el hook con `renderHook`, llama `mutate({ id: 'qe-2026-001', data: { nuevoEstado: 'EN_EJECUCION' } })` y MSW intercepta con status 422
- **THEN** `toast.error` es llamado con un string que contiene `'RN-QE-002'`
