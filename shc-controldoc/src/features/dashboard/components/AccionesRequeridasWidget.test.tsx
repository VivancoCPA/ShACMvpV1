import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, afterEach, vi, beforeEach } from 'vitest'
import i18n from '../../../i18n'
import { AccionesRequeridasWidget } from './AccionesRequeridasWidget'
import type { AccionRequerida } from '../types/accionesRequeridas.types'

afterEach(() => cleanup())

const useAccionesRequeridasMock = vi.fn()
vi.mock('../hooks/useAccionesRequeridas', () => ({
  useAccionesRequeridas: () => useAccionesRequeridasMock(),
}))

function item(overrides: Partial<AccionRequerida>): AccionRequerida {
  return {
    id: 'item-1',
    dominio: 'QE',
    tipo: 'QE_VERIFICAR',
    codigo: 'QE-2026-001',
    descripcion: 'Descripción',
    prioridad: 'normal',
    ruta: '/quality-events/qe-2026-001',
    ...overrides,
  }
}

function renderWidget(props: Parameters<typeof AccionesRequeridasWidget>[0] = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<AccionesRequeridasWidget {...props} />} />
          <Route path="/quality-events/:id" element={<div data-testid="qe-detail">qe-detail</div>} />
          <Route path="/documentos/:id" element={<div data-testid="doc-detail">doc-detail</div>} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  )
}

beforeEach(() => {
  useAccionesRequeridasMock.mockReset()
})

describe('AccionesRequeridasWidget', () => {
  it('shows a loading skeleton while isLoading is true', () => {
    useAccionesRequeridasMock.mockReturnValue({ items: [], isLoading: true })
    const { container } = renderWidget()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('shows the empty state when there are no pending items', () => {
    useAccionesRequeridasMock.mockReturnValue({ items: [], isLoading: false })
    renderWidget()
    expect(screen.getByText(i18n.t('dashboard:accionesRequeridas.empty'))).toBeInTheDocument()
  })

  it('groups items by dominio in QE → AC → DOCUMENTO order', () => {
    useAccionesRequeridasMock.mockReturnValue({
      items: [
        item({ id: 'doc-1', dominio: 'DOCUMENTO', tipo: 'DOC_REVISAR', codigo: 'PRC-CD-001' }),
        item({ id: 'ac-1', dominio: 'AC', tipo: 'AC_EJECUTAR', codigo: 'AC pendiente' }),
        item({ id: 'qe-1', dominio: 'QE', tipo: 'QE_VERIFICAR', codigo: 'QE-2026-001' }),
      ],
      isLoading: false,
    })
    renderWidget()

    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(headings).toEqual([
      i18n.t('dashboard:accionesRequeridas.dominio.QE'),
      i18n.t('dashboard:accionesRequeridas.dominio.AC'),
      i18n.t('dashboard:accionesRequeridas.dominio.DOCUMENTO'),
    ])
  })

  it('shows at most 10 items and reveals the rest via "ver todos"', async () => {
    const user = userEvent.setup()
    const items = Array.from({ length: 12 }, (_, i) =>
      item({ id: `qe-${i}`, codigo: `QE-2026-${String(i).padStart(3, '0')}` }),
    )
    useAccionesRequeridasMock.mockReturnValue({ items, isLoading: false })
    renderWidget()

    expect(screen.getAllByRole('button', { name: /QE-2026-/ })).toHaveLength(10)

    await user.click(screen.getByText(i18n.t('dashboard:accionesRequeridas.verTodos', { count: 12 })))

    expect(screen.getAllByRole('button', { name: /QE-2026-/ })).toHaveLength(12)
  })

  it('navigates to the item route on click', async () => {
    const user = userEvent.setup()
    useAccionesRequeridasMock.mockReturnValue({
      items: [item({ dominio: 'DOCUMENTO', tipo: 'DOC_REVISAR', codigo: 'PRC-CD-001', ruta: '/documentos/doc-1' })],
      isLoading: false,
    })
    renderWidget()

    await user.click(screen.getByText('PRC-CD-001'))
    expect(screen.getByTestId('doc-detail')).toBeInTheDocument()
  })

  it('with a filter shows every matching item (no 10-item cap) and the chip', async () => {
    const aprobaciones = Array.from({ length: 12 }, (_, i) =>
      item({ id: `qe-${i}`, tipo: 'QE_APROBAR_CAUSA_RAIZ', codigo: `QE-2026-${i}` }),
    )
    const otros = Array.from({ length: 5 }, (_, i) => item({ id: `ac-${i}`, dominio: 'AC', tipo: 'AC_EJECUTAR', codigo: `AC ${i}` }))
    useAccionesRequeridasMock.mockReturnValue({ items: [...aprobaciones, ...otros], isLoading: false })
    const onQuitarFiltro = vi.fn()
    renderWidget({ filtroTipos: ['QE_APROBAR_CAUSA_RAIZ'], etiquetaFiltro: 'Aprobaciones', onQuitarFiltro })

    expect(screen.getAllByRole('button', { name: /QE-2026-/ })).toHaveLength(12)
    expect(screen.queryByText(/AC \d/)).not.toBeInTheDocument()
    expect(screen.queryByText(i18n.t('dashboard:accionesRequeridas.verTodos', { count: 12 }))).not.toBeInTheDocument()
    expect(screen.getByText(i18n.t('dashboard:accionesRequeridas.mostrando', { etiqueta: 'Aprobaciones', n: 12 }))).toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: i18n.t('dashboard:accionesRequeridas.quitarFiltro') }))
    expect(onQuitarFiltro).toHaveBeenCalledOnce()
  })

  it('without a filter there is no chip', () => {
    useAccionesRequeridasMock.mockReturnValue({ items: [item({})], isLoading: false })
    renderWidget()
    expect(screen.queryByRole('button', { name: i18n.t('dashboard:accionesRequeridas.quitarFiltro') })).not.toBeInTheDocument()
  })
})
