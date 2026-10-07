import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { useAuthStore } from '../../../stores/authStore'
import { DocumentSignatureModal } from './DocumentSignatureModal'

// DocumentSignatureModal used to only ever talk about "contraseña" and only ever
// reacted to a 401 — a user without a configured PIN got no feedback at all, and
// any other backend error (e.g. errorCode: 'PIN_NO_CONFIGURADO' after a mid-session
// reset) was silently dropped. These tests cover the three outcomes the component
// now distinguishes: no PIN configured up front, PIN reset mid-session, and any
// other error — see pin-firma-ui/specs/document-approval-flow.

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es-PE' },
  }),
}))

const signDocumentMock = vi.fn()
vi.mock('../../../api/endpoints/documents.api', () => ({
  signDocument: (...args: unknown[]) => signDocumentMock(...args),
}))

function setUser(tienePinFirma: boolean | undefined) {
  useAuthStore.setState({
    user: {
      id: 'user-001',
      nombre: 'Ana',
      apellido: 'Torres',
      email: 'ana@shac.pe',
      rol: 'JEFE_CALIDAD_SYST',
      createdAt: '2026-01-01T00:00:00.000Z',
      activo: true,
      tienePinFirma,
    },
  })
}

function renderModal(onClose = vi.fn()) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DocumentSignatureModal documentId="doc-001" onClose={onClose} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function makeAxiosError(status: number, data: Record<string, unknown>) {
  return new AxiosError('Request failed', undefined, undefined, undefined, {
    status,
    data,
    statusText: '',
    headers: {},
    config: {} as never,
  })
}

describe('DocumentSignatureModal', () => {
  afterEach(() => {
    cleanup()
    signDocumentMock.mockReset()
    useAuthStore.setState({ user: null })
  })

  it('shows a setup notice instead of the PIN field when the user has no PIN configured', () => {
    setUser(false)
    renderModal()

    expect(screen.getByText('signature.noPinConfigured')).toBeInTheDocument()
    expect(screen.queryByLabelText('signature.pinLabel')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'signature.submit' })).toBeDisabled()
  })

  it('shows the same setup notice when the backend reports PIN_NO_CONFIGURADO mid-session', async () => {
    setUser(true)
    signDocumentMock.mockRejectedValueOnce(
      makeAxiosError(422, { success: false, message: 'PIN_NO_CONFIGURADO: ...', errorCode: 'PIN_NO_CONFIGURADO' }),
    )
    renderModal()

    fireEvent.change(screen.getByLabelText('signature.pinLabel'), { target: { value: '1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'signature.submit' }))

    await waitFor(() => expect(screen.getByText('signature.noPinConfigured')).toBeInTheDocument())
  })

  it('shows an inline PIN-incorrect error on 401, without closing', async () => {
    setUser(true)
    const onClose = vi.fn()
    signDocumentMock.mockRejectedValueOnce(makeAxiosError(401, { success: false, message: 'PIN incorrecto' }))
    renderModal(onClose)

    fireEvent.change(screen.getByLabelText('signature.pinLabel'), { target: { value: '9999' } })
    fireEvent.click(screen.getByRole('button', { name: 'signature.submit' }))

    await waitFor(() => expect(screen.getByText('signature.errorInvalid')).toBeInTheDocument())
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows any other backend error inline instead of dropping it', async () => {
    setUser(true)
    signDocumentMock.mockRejectedValueOnce(
      makeAxiosError(409, { success: false, message: 'No se puede publicar: QE vinculado activo' }),
    )
    renderModal()

    fireEvent.change(screen.getByLabelText('signature.pinLabel'), { target: { value: '1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'signature.submit' }))

    await waitFor(() =>
      expect(screen.getByText('No se puede publicar: QE vinculado activo')).toBeInTheDocument(),
    )
  })

  it('shows an inline error when the document has no original file (pdf-distribucion-real)', async () => {
    setUser(true)
    const onClose = vi.fn()
    signDocumentMock.mockRejectedValueOnce(
      makeAxiosError(422, {
        success: false,
        message: 'El documento no tiene archivo original; súbelo antes de enviarlo a aprobación',
        errorCode: 'SIN_ARCHIVO_ORIGINAL',
      }),
    )
    renderModal(onClose)

    fireEvent.change(screen.getByLabelText('signature.pinLabel'), { target: { value: '1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'signature.submit' }))

    await waitFor(() =>
      expect(
        screen.getByText('El documento no tiene archivo original; súbelo antes de enviarlo a aprobación'),
      ).toBeInTheDocument(),
    )
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows an inline error when PDF conversion fails (pdf-distribucion-real)', async () => {
    setUser(true)
    const onClose = vi.fn()
    signDocumentMock.mockRejectedValueOnce(
      makeAxiosError(422, {
        success: false,
        message: 'No se pudo generar el PDF del documento. Intenta de nuevo o contacta al administrador',
        errorCode: 'PDF_CONVERSION_FAILED',
      }),
    )
    renderModal(onClose)

    fireEvent.change(screen.getByLabelText('signature.pinLabel'), { target: { value: '1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'signature.submit' }))

    await waitFor(() =>
      expect(
        screen.getByText('No se pudo generar el PDF del documento. Intenta de nuevo o contacta al administrador'),
      ).toBeInTheDocument(),
    )
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes and signs on a valid PIN', async () => {
    setUser(true)
    const onClose = vi.fn()
    signDocumentMock.mockResolvedValueOnce({ id: 'doc-001', estado: 'PUBLICADO' })
    renderModal(onClose)

    fireEvent.change(screen.getByLabelText('signature.pinLabel'), { target: { value: '1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'signature.submit' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
