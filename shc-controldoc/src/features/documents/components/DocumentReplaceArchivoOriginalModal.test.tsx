import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { documentHandlers } from '../../../mocks/handlers/documents.handlers'
import { DocumentReplaceArchivoOriginalModal } from './DocumentReplaceArchivoOriginalModal'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
    i18n: { language: 'es-PE' },
  }),
}))

const server = setupServer(...documentHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
})
afterAll(() => server.close())

function renderModal(onClose: () => void, archivoOriginalNombre?: string | null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <DocumentReplaceArchivoOriginalModal
        documentId="doc-004"
        archivoOriginalNombre={archivoOriginalNombre}
        onClose={onClose}
      />
    </QueryClientProvider>,
  )
}

describe('DocumentReplaceArchivoOriginalModal', () => {
  it('shows the current file name when present', () => {
    renderModal(vi.fn(), 'REG-CD-001-v1.0.xlsx')

    expect(
      screen.getByText((content) => content.includes('REG-CD-001-v1.0.xlsx')),
    ).toBeInTheDocument()
  })

  it('does not show a current-file line when there is none', () => {
    renderModal(vi.fn(), null)

    expect(screen.queryByText(/archivo.original.modal.archivoActual/)).not.toBeInTheDocument()
  })

  it('confirm button is disabled until a file is selected', () => {
    renderModal(vi.fn(), null)

    expect(screen.getByText('archivo.original.modal.confirmar')).toBeDisabled()
  })

  it('uploading a file and confirming calls onClose on success', async () => {
    const onClose = vi.fn()
    const { container } = renderModal(onClose, null)

    const file = new File(['contenido'], 'nuevo.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)

    const confirmBtn = screen.getByText('archivo.original.modal.confirmar')
    expect(confirmBtn).not.toBeDisabled()
    await userEvent.click(confirmBtn)

    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
