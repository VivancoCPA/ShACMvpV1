import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { authHandlers } from '../mocks/handlers/auth.handlers'
import { documentHandlers } from '../mocks/handlers/documents.handlers'
import { useAuthStore } from '../stores/authStore'
import { loginUser } from '../features/auth/api/auth.api'
import { router } from './index'

// Regression test for a reported dead-end: a SUPERVISOR assigned as revisorId on a
// document in EN_REVISION (doc-004 in fixtures) could see "Reemplazar archivo original"
// (RN-DOC-013 only grants archivo-original access to Autor/Jefe de Calidad, never
// Revisor/Aprobador) and clicking it landed on /no-autorizado — a dead end for a button
// that should never have been shown. Fixed in permissions.ts (canViewArchivoOriginal/
// canReplaceArchivoOriginal now require docRole AUTOR or JEFE_CALIDAD).
//
// The legitimate case — Autor/Jefe de Calidad replacing the archivo original while the
// document is EN_REVISION (RN-DOC-018 allows this even though general editing is
// BORRADOR-only) — no longer goes through DocumentFormPage/`/documents/:id/edit` at all.
// It opens a dedicated modal (DocumentReplaceArchivoOriginalModal) directly from
// DocumentDetailPage, scoped to just the file upload.

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es-PE', changeLanguage: () => Promise.resolve() },
  }),
}))

const server = setupServer(...authHandlers, ...documentHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
})
afterAll(() => server.close())

async function loginReal(email: string) {
  const { user, accessToken } = await loginUser({ email, password: 'Shac2025!' })
  useAuthStore.getState().login({ user, accessToken })
  return user
}

function renderRouterAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  void router.navigate(path)
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('document detail — archivo original access by role (RN-DOC-013)', () => {
  it('SUPERVISOR asignado como Revisor de un doc EN_REVISION no ve los botones de archivo original', async () => {
    await loginReal('supervisor@shac.pe') // supervisor@shac.pe === revisorId de doc-004

    renderRouterAt('/documentos/doc-004')

    await waitFor(() => expect(screen.getByText('detail.backToList')).toBeInTheDocument())
    expect(screen.queryByText('archivo.original.reemplazar')).not.toBeInTheDocument()
    expect(screen.queryByText('archivo.original.descargar')).not.toBeInTheDocument()
  })
})

describe('document detail — reemplazar archivo original en EN_REVISION opens a dedicated modal (RN-DOC-018)', () => {
  it('Autor abre el modal dedicado y no navega a /documents/:id/edit', async () => {
    await loginReal('autor@shac.pe') // autor@shac.pe === autorId de doc-004 (EN_REVISION)

    const { container } = renderRouterAt('/documentos/doc-004')

    const btn = await screen.findByText('archivo.original.reemplazar', {}, { timeout: 3000 })
    await userEvent.click(btn)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/documentos/doc-004')

    const file = new File(['contenido'], 'nuevo.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)
    await userEvent.click(screen.getByText('archivo.original.modal.confirmar'))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(router.state.location.pathname).toBe('/documentos/doc-004')
  })
})
