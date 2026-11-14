// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useActualizarResponsablesAc } from './useResponsablesAc'
import type { ConfiguracionResponsablesAc } from '../types/responsablesAc.types'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

const actualizado: ConfiguracionResponsablesAc = {
  empresaId: 'empresa-001',
  tipos: [],
  rolesDisponibles: [],
  actualizadoPorNombre: null,
  actualizadoEn: null,
}
const { updateMock } = vi.hoisted(() => ({ updateMock: vi.fn() }))
vi.mock('../api/responsablesAc.api', () => ({
  getResponsablesAc: vi.fn(),
  updateResponsablesAc: updateMock,
  restablecerResponsablesAc: vi.fn(),
}))

describe('useActualizarResponsablesAc', () => {
  it('envía el PUT e invalida los candidatos a responsable de AC', async () => {
    updateMock.mockResolvedValue(actualizado)
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useActualizarResponsablesAc('empresa-001'), { wrapper })

    result.current.mutate({ tipos: [{ tipo: 'MEJORA', roles: ['JEFE_CALIDAD_SYST'] }] })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(updateMock).toHaveBeenCalledWith('empresa-001', { tipos: [{ tipo: 'MEJORA', roles: ['JEFE_CALIDAD_SYST'] }] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['acciones-correctivas', 'candidatos'] })
    expect(queryClient.getQueryData(['acciones-correctivas', 'responsables-config', 'empresa-001'])).toEqual(actualizado)
  })
})
