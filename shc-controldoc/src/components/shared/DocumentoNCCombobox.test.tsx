import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { documentHandlers, resetStore as resetDocumentsStore, getDocumentsStore } from '../../mocks/handlers/documents.handlers'
import { nonconformityHandlers, resetStore as resetNcStore, getNonconformitiesStore } from '../../mocks/handlers/nonconformities.handlers'
import { useAuthStore } from '../../stores/authStore'
import { DocumentoNCCombobox } from './DocumentoNCCombobox'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es-PE' },
  }),
}))

const server = setupServer(...documentHandlers, ...nonconformityHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  cleanup()
  server.resetHandlers()
  resetDocumentsStore()
  resetNcStore()
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false, empresaActivaId: null })
})

function loginAsJefeCalidad() {
  useAuthStore.setState({
    isAuthenticated: true,
    user: { id: 'user-jefecalidad-001', rol: 'JEFE_CALIDAD_SYST' } as never,
    empresaActivaId: 'empresa-001',
  })
}

function renderCombobox(props: Partial<React.ComponentProps<typeof DocumentoNCCombobox>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onSelect = vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <DocumentoNCCombobox
        mode="document-search-nc"
        linkedIds={[]}
        onSelect={onSelect}
        ariaLabel="Buscar NC"
        {...props}
      />
    </QueryClientProvider>,
  )
  return { onSelect }
}

describe('DocumentoNCCombobox', () => {
  it('busca con debounce y muestra resultados que coinciden', async () => {
    loginAsJefeCalidad()
    const nc = getNonconformitiesStore()[0]

    renderCombobox()
    const input = screen.getByRole('combobox', { name: 'Buscar NC' })
    await userEvent.type(input, nc.numero)

    await waitFor(() => expect(screen.getByText(nc.numero)).toBeInTheDocument(), { timeout: 2000 })
  })

  it('seleccionar un resultado dispara onSelect y limpia el input', async () => {
    loginAsJefeCalidad()
    const nc = getNonconformitiesStore()[0]

    const { onSelect } = renderCombobox()
    const input = screen.getByRole('combobox', { name: 'Buscar NC' }) as HTMLInputElement
    await userEvent.type(input, nc.numero)
    await waitFor(() => expect(screen.getByText(nc.numero)).toBeInTheDocument(), { timeout: 2000 })

    await userEvent.click(screen.getByText(nc.numero))

    expect(onSelect).toHaveBeenCalledWith(nc.id)
    expect(input.value).toBe('')
  })

  it('excluye de los resultados los ids ya vinculados', async () => {
    loginAsJefeCalidad()
    const nc = getNonconformitiesStore()[0]

    renderCombobox({ linkedIds: [nc.id] })
    const input = screen.getByRole('combobox', { name: 'Buscar NC' })
    await userEvent.type(input, nc.numero)

    await waitFor(() => expect(screen.getByText('common:searchableSelect.noResults')).toBeInTheDocument(), { timeout: 2000 })
    expect(screen.queryByText(nc.numero)).not.toBeInTheDocument()
  })

  it('modo nc-search-document busca documentos', async () => {
    loginAsJefeCalidad()
    const doc = getDocumentsStore().find((d) => d.codigo === 'POL-CD-001')!

    renderCombobox({ mode: 'nc-search-document', ariaLabel: 'Buscar documento' })
    const input = screen.getByRole('combobox', { name: 'Buscar documento' })
    await userEvent.type(input, doc.codigo)

    await waitFor(() => expect(screen.getByText(doc.codigo)).toBeInTheDocument(), { timeout: 2000 })
  })
})
