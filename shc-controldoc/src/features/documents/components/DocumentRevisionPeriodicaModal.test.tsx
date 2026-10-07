import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { DocumentRevisionPeriodicaModal } from './DocumentRevisionPeriodicaModal'
import { todayCalendarDateIso, addCalendarDays, addCalendarMonths } from '../../../utils/date.utils'
import type { Documento, DocType } from '../../../types/documents.types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es-PE' },
  }),
}))

const mutateAsyncMock = vi.fn().mockResolvedValue({ id: 'doc-001' })
vi.mock('../hooks/useDocumentActions', () => ({
  useConfirmarRevisionPeriodica: () => ({ mutateAsync: mutateAsyncMock, isPending: false }),
}))

function makeDocumento(tipo: DocType): Documento {
  return {
    id: 'doc-001',
    codigo: 'PRC-CD-001',
    titulo: 'Documento de prueba',
    tipo,
    version: 'v1.0',
    estado: 'PUBLICADO',
    areaId: 'area-001',
    empresaId: 'empresa-001',
    confidencialidad: 'INTERNO',
    autorId: 'user-autor-001',
    archivoOriginalUrl: null,
    archivoOriginalNombre: null,
    archivoOriginalBloqueado: false,
    archivoDistribucionUrl: null,
    qeVinculados: [],
    ncVinculados: [],
    auditTrail: [],
    creadoEn: '2026-01-01T08:00:00.000Z',
    actualizadoEn: '2026-01-01T08:00:00.000Z',
  }
}

function renderModal(tipo: DocType) {
  return render(
    <DocumentRevisionPeriodicaModal
      documento={makeDocumento(tipo)}
      onClose={vi.fn()}
      onCrearNuevaVersion={vi.fn()}
    />,
  )
}

afterEach(() => {
  cleanup()
  mutateAsyncMock.mockClear()
})

describe('DocumentRevisionPeriodicaModal — fecha sugerida según tipo', () => {
  it('PRC precarga hoy + 12 meses', () => {
    renderModal('PRC')
    fireEvent.click(screen.getByText('revisionPeriodica.modal.opcionA'))

    const input = screen.getByLabelText('revisionPeriodica.modal.fechaLabel') as HTMLInputElement
    expect(input.value).toBe(addCalendarMonths(todayCalendarDateIso(), 12))
  })

  it('INS precarga hoy + 24 meses', () => {
    renderModal('INS')
    fireEvent.click(screen.getByText('revisionPeriodica.modal.opcionA'))

    const input = screen.getByLabelText('revisionPeriodica.modal.fechaLabel') as HTMLInputElement
    expect(input.value).toBe(addCalendarMonths(todayCalendarDateIso(), 24))
  })

  it('MAT precarga hoy + 6 meses', () => {
    renderModal('MAT')
    fireEvent.click(screen.getByText('revisionPeriodica.modal.opcionA'))

    const input = screen.getByLabelText('revisionPeriodica.modal.fechaLabel') as HTMLInputElement
    expect(input.value).toBe(addCalendarMonths(todayCalendarDateIso(), 6))
  })

  it('REG no precarga ninguna fecha', () => {
    renderModal('REG')
    fireEvent.click(screen.getByText('revisionPeriodica.modal.opcionA'))

    const input = screen.getByLabelText('revisionPeriodica.modal.fechaLabel') as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('el atributo min es hoy + 30 días para cualquier tipo', () => {
    renderModal('PRC')
    fireEvent.click(screen.getByText('revisionPeriodica.modal.opcionA'))

    const input = screen.getByLabelText('revisionPeriodica.modal.fechaLabel') as HTMLInputElement
    expect(input.min).toBe(addCalendarDays(todayCalendarDateIso(), 30))
  })
})

describe('DocumentRevisionPeriodicaModal — validación del margen mínimo', () => {
  it('no confirma con una fecha por debajo del mínimo', async () => {
    renderModal('PRC')
    fireEvent.click(screen.getByText('revisionPeriodica.modal.opcionA'))

    const input = screen.getByLabelText('revisionPeriodica.modal.fechaLabel') as HTMLInputElement
    fireEvent.change(input, { target: { value: addCalendarDays(todayCalendarDateIso(), 5) } })
    fireEvent.click(screen.getByText('revisionPeriodica.modal.opcionAConfirm'))

    await screen.findByText(/al menos 30 días/i)
    expect(mutateAsyncMock).not.toHaveBeenCalled()
  })

  it('confirma con la fecha sugerida sin tocarla', async () => {
    renderModal('PRC')
    fireEvent.click(screen.getByText('revisionPeriodica.modal.opcionA'))
    fireEvent.click(screen.getByText('revisionPeriodica.modal.opcionAConfirm'))

    await vi.waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledWith({
      fechaRevisionProxima: addCalendarMonths(todayCalendarDateIso(), 12),
    }))
  })
})
