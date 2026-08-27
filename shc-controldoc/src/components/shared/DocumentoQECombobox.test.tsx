import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { documentHandlers, resetStore as resetDocumentsStore, getDocumentsStore } from '../../mocks/handlers/documents.handlers'
import { qualityEventHandlers, resetStore as resetQeStore, getQeStore } from '../../mocks/handlers/quality-events.handlers'
import { useAuthStore } from '../../stores/authStore'
import { DocumentoQECombobox } from './DocumentoQECombobox'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es-PE' },
  }),
}))

const server = setupServer(...documentHandlers, ...qualityEventHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  cleanup()
  server.resetHandlers()
  resetDocumentsStore()
  resetQeStore()
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false, empresaActivaId: null })
})

function loginAsJefeCalidad() {
  useAuthStore.setState({
    isAuthenticated: true,
    user: { id: 'user-jefecalidad-001', rol: 'JEFE_CALIDAD_SYST' } as never,
    empresaActivaId: 'empresa-001',
  })
}

function renderCombobox(props: Partial<React.ComponentProps<typeof DocumentoQECombobox>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onSelect = vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <DocumentoQECombobox
        mode="document-search-qe"
        linkedIds={[]}
        onSelect={onSelect}
        ariaLabel="Buscar QE"
        {...props}
      />
    </QueryClientProvider>,
  )
  return { onSelect }
}

describe('DocumentoQECombobox', () => {
  it('busca con debounce y muestra resultados que coinciden', async () => {
    loginAsJefeCalidad()
    const qe = getQeStore().find((q) => q.numero === 'QE-2026-003')!

    renderCombobox()
    const input = screen.getByRole('combobox', { name: 'Buscar QE' })
    await userEvent.type(input, qe.numero)

    await waitFor(() => expect(screen.getByText(qe.numero)).toBeInTheDocument(), { timeout: 2000 })
  })

  it('seleccionar un resultado dispara onSelect y limpia el input', async () => {
    loginAsJefeCalidad()
    const qe = getQeStore().find((q) => q.numero === 'QE-2026-003')!

    const { onSelect } = renderCombobox()
    const input = screen.getByRole('combobox', { name: 'Buscar QE' }) as HTMLInputElement
    await userEvent.type(input, qe.numero)
    await waitFor(() => expect(screen.getByText(qe.numero)).toBeInTheDocument(), { timeout: 2000 })

    await userEvent.click(screen.getByText(qe.numero))

    expect(onSelect).toHaveBeenCalledWith(qe.id)
    expect(input.value).toBe('')
  })

  it('excluye de los resultados los ids ya vinculados', async () => {
    loginAsJefeCalidad()
    const qe = getQeStore().find((q) => q.numero === 'QE-2026-003')!

    renderCombobox({ linkedIds: [qe.id] })
    const input = screen.getByRole('combobox', { name: 'Buscar QE' })
    await userEvent.type(input, qe.numero)

    await waitFor(() => expect(screen.getByText('common:searchableSelect.noResults')).toBeInTheDocument(), { timeout: 2000 })
    expect(screen.queryByText(qe.numero)).not.toBeInTheDocument()
  })

  it('modo qe-search-document busca documentos', async () => {
    loginAsJefeCalidad()
    const doc = getDocumentsStore().find((d) => d.codigo === 'POL-CD-001')!

    renderCombobox({ mode: 'qe-search-document', ariaLabel: 'Buscar documento' })
    const input = screen.getByRole('combobox', { name: 'Buscar documento' })
    await userEvent.type(input, doc.codigo)

    await waitFor(() => expect(screen.getByText(doc.codigo)).toBeInTheDocument(), { timeout: 2000 })
  })
})
