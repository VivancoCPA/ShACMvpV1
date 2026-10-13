import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { documentHandlers } from '../../../mocks/handlers/documents.handlers'
import { useAuthStore } from '../../../stores/authStore'
import { DocumentReplaceArchivoOriginalModal } from './DocumentReplaceArchivoOriginalModal'
import type { DocType } from '../../../types/documents.types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
    i18n: { language: 'es-PE' },
  }),
}))

const server = setupServer(...documentHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
// doc-004 pertenece a empresa-001 — el handler ahora filtra/asigna por
// empresa activa de sesión (me-f3-scoping-modulos).
beforeEach(() => {
  useAuthStore.setState({ empresaActivaId: 'empresa-001' })
})
afterEach(() => {
  server.resetHandlers()
  cleanup()
})
afterAll(() => server.close())

function renderModal(onClose: () => void, archivoOriginalNombre?: string | null, tipo: DocType = 'PRC') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <DocumentReplaceArchivoOriginalModal
        documentId="doc-004"
        tipo={tipo}
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

  // original-pdf-tipos-permitidos (RN-DOC-021)
  it('accepts a PDF when tipo allows it', async () => {
    const { container } = renderModal(vi.fn(), null, 'PLAN')

    const file = new File(['%PDF-1.4'], 'plan.pdf', { type: 'application/pdf' })
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)

    expect(screen.getByText('archivo.original.modal.confirmar')).not.toBeDisabled()
    expect(screen.queryByText('form.error_file_type')).not.toBeInTheDocument()
  })

  it('rejects a PDF when tipo does not allow it', async () => {
    const { container } = renderModal(vi.fn(), null, 'PRC')

    const file = new File(['%PDF-1.4'], 'procedimiento.pdf', { type: 'application/pdf' })
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    // applyAccept: false — ver el mismo comentario en FileUploadField.test.tsx.
    await userEvent.upload(input, file, { applyAccept: false })

    expect(screen.getByText('form.error_file_type')).toBeInTheDocument()
    expect(screen.getByText('archivo.original.modal.confirmar')).toBeDisabled()
  })
})
