import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { IncidentMapCanvas } from './IncidentMapCanvas'
import type { Incidente } from '../types/incident.types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es-PE' } }),
}))

afterEach(() => cleanup())

function makeInc(id: string, x: number, y: number): Incidente {
  return {
    id,
    numero: `INC-${id}`,
    empresaId: 'empresa-001',
    tipo: 'ACCIDENTE',
    estado: 'ABIERTO',
    severidad: 'MEDIA',
    descripcion: 'test',
    areaId: 'test',
    turno: 'DIA',
    fechaEvento: '2026-01-01T00:00:00Z',
    fechaReporte: '2026-01-01T00:00:00Z',
    reportadoPorId: 'user-001',
    huboLesionados: false,
    auditTrail: [],
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
    localId: 'loc-001',
    ubicacion: { x, y },
  }
}

describe('IncidentMapCanvas — plano y marcadores (incidentes-ajustes-ui)', () => {
  it('el plano se limita a 70vh sin object-contain y los marcadores viven en el envoltorio de la imagen', () => {
    const { container } = render(
      <IncidentMapCanvas
        incidentes={[makeInc('a', 10, 10), makeInc('b', 80, 80)]}
        localId="loc-001"
        planoPngUrl="blob:plano"
        onGroupClick={() => {}}
      />,
    )

    const img = container.querySelector('img')!
    expect(img.className).toContain('max-h-[70vh]')
    expect(img.className).toContain('max-w-full')
    expect(img.className).not.toContain('object-contain')

    const wrapper = screen.getByTestId('incident-map-plano')
    expect(wrapper).toContainElement(img)
    const markers = screen.getAllByRole('button', { name: /incidente/ })
    expect(markers).toHaveLength(2)
    for (const marker of markers) expect(wrapper).toContainElement(marker)
  })

  it('sin plano no renderiza imagen ni marcadores', () => {
    render(
      <IncidentMapCanvas incidentes={[makeInc('a', 10, 10)]} localId="loc-001" onGroupClick={() => {}} />,
    )
    expect(screen.getByText('map.planUnavailable')).toBeInTheDocument()
    expect(screen.queryByTestId('incident-map-plano')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /incidente/ })).not.toBeInTheDocument()
  })
})
