import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { DocumentHistorial } from './DocumentHistorial'
import type { Documento } from '../../../types/documents.types'

afterEach(() => cleanup())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es-PE' },
  }),
}))

function makeDocumento(overrides: Partial<Documento>): Documento {
  return {
    id: 'doc-001',
    codigo: 'PRC-CD-001',
    titulo: 'Procedimiento de prueba',
    tipo: 'PRC',
    version: 'v1.0',
    estado: 'BORRADOR',
    areaId: 'Calidad',
    confidencialidad: 'INTERNO',
    autorId: 'user-001',
    archivoOriginalUrl: null,
    archivoOriginalNombre: null,
    archivoOriginalBloqueado: false,
    archivoDistribucionUrl: null,
    qeVinculados: [],
    historialVersiones: [],
    auditTrail: [
      {
        id: 'audit-1',
        entidadTipo: 'Documento',
        entidadId: 'doc-001',
        accion: 'DOCUMENTO_CREADO',
        realizadoPorId: 'user-001',
        realizadoPorNombre: 'Ana Pérez',
        timestamp: '2026-01-01T08:00:00.000Z',
        generadoPorIA: false,
      },
    ],
    creadoEn: '2026-01-01T08:00:00.000Z',
    actualizadoEn: '2026-01-01T08:00:00.000Z',
    ...overrides,
  }
}

describe('DocumentHistorial — synthetic "Creado en Borrador" entry (CA-DOCUI-07)', () => {
  it('shows the synthetic entry when historialVersiones is empty', () => {
    const documento = makeDocumento({})
    render(<DocumentHistorial documento={documento} />)
    expect(screen.getByText('historial.createdInBorrador')).toBeInTheDocument()
  })

  it('sorts the synthetic entry to the bottom when real entries exist', () => {
    const documento = makeDocumento({
      version: 'v2.0',
      historialVersiones: [
        {
          version: 'v2.0',
          fechaPublicacion: '2026-06-01T08:00:00.000Z',
          autorId: 'user-001',
          descripcionCambios: 'Publicación v2.0',
        },
      ],
    })
    const { container } = render(<DocumentHistorial documento={documento} />)
    const descriptions = Array.from(container.querySelectorAll('li p')).map((el) => el.textContent)
    expect(descriptions).toEqual(['Publicación v2.0', 'historial.createdInBorrador'])
  })
})
