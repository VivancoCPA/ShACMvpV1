import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { FormProvider, useForm } from 'react-hook-form'
import { MemoryRouter } from 'react-router-dom'
import type { ComponentProps, ReactNode } from 'react'
import { DocumentForm } from './DocumentForm'
import type { DocumentFormInput } from '../schemas/documentForm.schema'
import type { CandidatoAsignacion, TipoAsignacion } from '../../../types/documents.types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('../../areas/hooks/useAreas', () => ({
  useAreas: () => ({ data: [] }),
}))

interface CandidatosState {
  data?: CandidatoAsignacion[]
  isLoading: boolean
  isError: boolean
}

const candidatosPorTipo: Record<TipoAsignacion, CandidatosState> = {
  REVISOR: { isLoading: false, isError: false, data: [] },
  APROBADOR: { isLoading: false, isError: false, data: [] },
}

const useCandidatosMock = vi.fn((tipo: TipoAsignacion, _documentoId?: string) => candidatosPorTipo[tipo])
vi.mock('../hooks/useCandidatosAsignacion', () => ({
  useCandidatosAsignacion: (tipo: TipoAsignacion, documentoId?: string) => useCandidatosMock(tipo, documentoId),
}))

function Harness({ defaults, children }: { defaults?: Partial<DocumentFormInput>; children: ReactNode }) {
  const form = useForm<DocumentFormInput>({ defaultValues: defaults as DocumentFormInput })
  return (
    <MemoryRouter>
      <FormProvider {...form}>{children}</FormProvider>
    </MemoryRouter>
  )
}

function renderForm(props: Partial<ComponentProps<typeof DocumentForm>> = {}, defaults?: Partial<DocumentFormInput>) {
  return render(
    <Harness defaults={defaults}>
      <DocumentForm
        mode="create"
        isLoading={false}
        descriptionLocked={false}
        userRole="JEFE_CONTROL_DOCUMENTARIO"
        onSubmit={(e) => e.preventDefault()}
        {...props}
      />
    </Harness>,
  )
}

const revisor: CandidatoAsignacion = { id: 'u-rev', nombreCompleto: 'Rita Revisora', rol: 'AUDITOR_INTERNO' }
const aprobador: CandidatoAsignacion = { id: 'u-apr', nombreCompleto: 'Alan Aprobador', rol: 'ALTA_DIRECCION' }

afterEach(cleanup)

beforeEach(() => {
  useCandidatosMock.mockClear()
  candidatosPorTipo.REVISOR = { isLoading: false, isError: false, data: [revisor] }
  candidatosPorTipo.APROBADOR = { isLoading: false, isError: false, data: [aprobador] }
})

describe('DocumentForm — Revisor/Aprobador desde candidatos reales', () => {
  it('cada select lista únicamente los candidatos de su tipo', () => {
    renderForm()

    const rev = screen.getByLabelText('form.field_revisor')
    const apr = screen.getByLabelText('form.field_aprobador')
    expect(within(rev).getByRole('option', { name: 'Rita Revisora' })).toBeInTheDocument()
    expect(within(rev).queryByRole('option', { name: 'Alan Aprobador' })).not.toBeInTheDocument()
    expect(within(apr).getByRole('option', { name: 'Alan Aprobador' })).toBeInTheDocument()
    expect(within(apr).queryByRole('option', { name: 'Rita Revisora' })).not.toBeInTheDocument()
  })

  it('envía el documentId al hook para que el backend excluya al autor persistido', () => {
    renderForm({ mode: 'edit', documentId: 'doc-1' })

    expect(useCandidatosMock).toHaveBeenCalledWith('REVISOR', 'doc-1')
    expect(useCandidatosMock).toHaveBeenCalledWith('APROBADOR', 'doc-1')
  })

  it('muestra "(no disponible)" seleccionado cuando el revisor guardado ya no es candidato', () => {
    renderForm({ mode: 'edit', documentId: 'doc-1', savedRevisorId: 'u-desactivado' }, { revisorId: 'u-desactivado' })

    const rev = screen.getByLabelText('form.field_revisor') as HTMLSelectElement
    expect(within(rev).getByRole('option', { name: 'form.asignacion_no_disponible' })).toBeInTheDocument()
    expect(rev.value).toBe('u-desactivado')
  })

  it('no agrega la opción "(no disponible)" cuando el valor guardado sigue siendo candidato', () => {
    renderForm({ mode: 'edit', documentId: 'doc-1', savedRevisorId: 'u-rev' }, { revisorId: 'u-rev' })

    const rev = screen.getByLabelText('form.field_revisor') as HTMLSelectElement
    expect(within(rev).queryByRole('option', { name: 'form.asignacion_no_disponible' })).not.toBeInTheDocument()
    expect(rev.value).toBe('u-rev')
  })

  it('mientras carga muestra el select deshabilitado', () => {
    candidatosPorTipo.REVISOR = { isLoading: true, isError: false }
    renderForm()

    expect(screen.getByLabelText('form.field_revisor')).toBeDisabled()
  })

  it('sin candidatos muestra el mensaje informativo', () => {
    candidatosPorTipo.APROBADOR = { isLoading: false, isError: false, data: [] }
    renderForm()

    expect(screen.getByText('form.asignacion_sin_candidatos')).toBeInTheDocument()
  })
})

// original-pdf-tipos-permitidos (RN-DOC-021)
describe('DocumentForm — texto de ayuda del archivo original según tipo', () => {
  it('muestra el texto con PDF para un tipo que lo permite (PLAN)', () => {
    renderForm({ isAutorOrJefe: true }, { tipo: 'PLAN' })

    expect(screen.getByText('form.archivoOriginal.hintConPdf')).toBeInTheDocument()
    expect(screen.queryByText('form.archivoOriginal.hint')).not.toBeInTheDocument()
  })

  it('muestra el texto sin PDF para un tipo que no lo permite (PRC)', () => {
    renderForm({ isAutorOrJefe: true }, { tipo: 'PRC' })

    expect(screen.getByText('form.archivoOriginal.hint')).toBeInTheDocument()
    expect(screen.queryByText('form.archivoOriginal.hintConPdf')).not.toBeInTheDocument()
  })
})
