import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { LegacyRedirect } from './LegacyRedirect'

// notification-links (incidentes-qe-estado-alertas): rutas en español heredadas de
// notificaciones viejas redirigen al detalle real con replace (sin entrada intermedia).

afterEach(() => cleanup())

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/incidentes/:id', element: <LegacyRedirect to="/incidents" /> },
      { path: '/no-conformidades/:id', element: <LegacyRedirect to="/nonconformities" /> },
      { path: '/incidents/:id', element: <div data-testid="incident-detail" /> },
      { path: '/nonconformities/:id', element: <div data-testid="nc-detail" /> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('LegacyRedirect', () => {
  it('/incidentes/abc → /incidents/abc con replace', async () => {
    const router = renderAt('/incidentes/abc')

    expect(await screen.findByTestId('incident-detail')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/incidents/abc')
    expect(router.state.historyAction).toBe('REPLACE')
  })

  it('/no-conformidades/abc → /nonconformities/abc con replace', async () => {
    const router = renderAt('/no-conformidades/abc')

    expect(await screen.findByTestId('nc-detail')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/nonconformities/abc')
    expect(router.state.historyAction).toBe('REPLACE')
  })
})
