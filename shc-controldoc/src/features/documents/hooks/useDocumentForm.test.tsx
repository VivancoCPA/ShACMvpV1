import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useDocumentForm } from './useDocumentForm'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const apiPostMock = vi.fn().mockResolvedValue({ data: { id: 'doc-nuevo' } })
vi.mock('../../../lib/axios', () => ({
  default: {
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useDocumentForm — RN-DOC-020 sugerencia automática de fechaRevisionProxima', () => {
  it('autocompleta fechaRevisionProxima a +12 meses para tipo PRC', () => {
    const { result } = renderHook(() => useDocumentForm({ mode: 'create' }), { wrapper })

    act(() => {
      result.current.form.setValue('tipo', 'PRC')
      result.current.form.setValue('fechaVigencia', '2026-01-01')
    })

    expect(result.current.form.getValues('fechaRevisionProxima')).toBe('2027-01-01')
  })

  it('autocompleta fechaRevisionProxima a +6 meses para tipo MAT', () => {
    const { result } = renderHook(() => useDocumentForm({ mode: 'create' }), { wrapper })

    act(() => {
      result.current.form.setValue('tipo', 'MAT')
      result.current.form.setValue('fechaVigencia', '2026-01-01')
    })

    expect(result.current.form.getValues('fechaRevisionProxima')).toBe('2026-07-01')
  })

  it('autocompleta fechaRevisionProxima a +24 meses para tipo INS', () => {
    const { result } = renderHook(() => useDocumentForm({ mode: 'create' }), { wrapper })

    act(() => {
      result.current.form.setValue('tipo', 'INS')
      result.current.form.setValue('fechaVigencia', '2026-01-01')
    })

    expect(result.current.form.getValues('fechaRevisionProxima')).toBe('2028-01-01')
  })

  it('no sugiere ninguna fecha para tipo REG (periodicidad ligada al proceso, no a una fecha fija)', () => {
    const { result } = renderHook(() => useDocumentForm({ mode: 'create' }), { wrapper })

    act(() => {
      result.current.form.setValue('tipo', 'REG')
      result.current.form.setValue('fechaVigencia', '2026-01-01')
    })

    expect(result.current.form.getValues('fechaRevisionProxima')).toBe('')
  })

  it('no sugiere ninguna fecha para tipo INF (campo opcional, sin revisión periódica)', () => {
    const { result } = renderHook(() => useDocumentForm({ mode: 'create' }), { wrapper })

    act(() => {
      result.current.form.setValue('tipo', 'INF')
      result.current.form.setValue('fechaVigencia', '2026-01-01')
    })

    expect(result.current.form.getValues('fechaRevisionProxima')).toBe('')
  })

  it('no sobreescribe fechaRevisionProxima una vez que el usuario la editó manualmente (touched)', () => {
    const { result } = renderHook(() => useDocumentForm({ mode: 'create' }), { wrapper })

    act(() => {
      result.current.form.setValue('tipo', 'PRC')
      result.current.form.setValue('fechaVigencia', '2026-01-01')
    })
    expect(result.current.form.getValues('fechaRevisionProxima')).toBe('2027-01-01')

    act(() => {
      result.current.form.setValue('fechaRevisionProxima', '2026-06-01', { shouldTouch: true })
    })

    act(() => {
      result.current.form.setValue('fechaVigencia', '2026-03-01')
    })

    expect(result.current.form.getValues('fechaRevisionProxima')).toBe('2026-06-01')
  })

  it('limpia la sugerencia cuando fechaVigencia se vacía y el campo no fue tocado', () => {
    const { result } = renderHook(() => useDocumentForm({ mode: 'create' }), { wrapper })

    act(() => {
      result.current.form.setValue('tipo', 'PRC')
      result.current.form.setValue('fechaVigencia', '2026-01-01')
    })
    expect(result.current.form.getValues('fechaRevisionProxima')).toBe('2027-01-01')

    act(() => {
      result.current.form.setValue('fechaVigencia', '')
    })

    expect(result.current.form.getValues('fechaRevisionProxima')).toBe('')
  })
})

describe('useDocumentForm — fix-fechas-utc: fechas vacías no viajan como \'\'', () => {
  it('omite fechaVigencia y fechaRevisionProxima del payload cuando quedan vacías', async () => {
    apiPostMock.mockClear()
    const { result } = renderHook(() => useDocumentForm({ mode: 'create' }), { wrapper })

    act(() => {
      result.current.form.setValue('titulo', 'Procedimiento de prueba con título válido')
      result.current.form.setValue('tipo', 'PRC')
      result.current.form.setValue('areaId', 'area-007')
      result.current.form.setValue('version', 'v1.0')
      result.current.form.setValue('confidencialidad', 'INTERNO')
      // fechaVigencia/fechaRevisionProxima quedan en su default: ''
    })

    await act(async () => {
      await result.current.onSubmit()
    })

    expect(apiPostMock).toHaveBeenCalledTimes(1)
    const payload = apiPostMock.mock.calls[0][1] as Record<string, unknown>
    expect(payload.fechaVigencia).toBeUndefined()
    expect(payload.fechaRevisionProxima).toBeUndefined()
    expect('fechaVigencia' in payload && payload.fechaVigencia === '').toBe(false)
  })

  it('sí envía fechaVigencia/fechaRevisionProxima cuando el usuario las completó', async () => {
    apiPostMock.mockClear()
    const { result } = renderHook(() => useDocumentForm({ mode: 'create' }), { wrapper })

    act(() => {
      result.current.form.setValue('titulo', 'Procedimiento de prueba con título válido')
      result.current.form.setValue('tipo', 'PRC')
      result.current.form.setValue('areaId', 'area-007')
      result.current.form.setValue('version', 'v1.0')
      result.current.form.setValue('confidencialidad', 'INTERNO')
      result.current.form.setValue('fechaVigencia', '2026-09-29')
      result.current.form.setValue('fechaRevisionProxima', '2027-09-29')
    })

    await act(async () => {
      await result.current.onSubmit()
    })

    const payload = apiPostMock.mock.calls[0][1] as Record<string, unknown>
    expect(payload.fechaVigencia).toBe('2026-09-29')
    expect(payload.fechaRevisionProxima).toBe('2027-09-29')
  })
})
