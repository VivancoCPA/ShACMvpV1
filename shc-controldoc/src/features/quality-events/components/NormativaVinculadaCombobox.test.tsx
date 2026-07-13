import { useState } from 'react'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi, afterEach } from 'vitest'
import i18n from '../../../i18n'
import { NormativaVinculadaCombobox } from './NormativaVinculadaCombobox'
import type { NormativaVinculada } from '../types/qualityEvent.types'

afterEach(() => cleanup())

function Harness({ onChange, initial }: { onChange: (v: NormativaVinculada | undefined) => void; initial?: NormativaVinculada }) {
  const [value, setValue] = useState<NormativaVinculada | undefined>(initial)
  return (
    <NormativaVinculadaCombobox
      ariaLabel="Cláusula incumplida"
      value={value}
      onChange={(v) => {
        setValue(v)
        onChange(v)
      }}
    />
  )
}

function renderCombobox(onChange: (v: NormativaVinculada | undefined) => void, initial?: NormativaVinculada) {
  return render(
    <I18nextProvider i18n={i18n}>
      <Harness onChange={onChange} initial={initial} />
    </I18nextProvider>,
  )
}

describe('NormativaVinculadaCombobox', () => {
  it('shows a filterable clause dropdown when an ISO norma is selected, and filters as the user types', async () => {
    const onChange = vi.fn()
    renderCombobox(onChange)

    await userEvent.selectOptions(screen.getByLabelText(i18n.t('qualityEvents:form.fields.normaVinculada')), 'ISO_45001_2018')

    const clauseInput = screen.getByRole('combobox', { name: 'Cláusula incumplida' })
    await userEvent.click(clauseInput)
    const listbox = screen.getByRole('listbox')
    expect(within(listbox).getAllByRole('option').length).toBeGreaterThan(1)

    await userEvent.type(clauseInput, '8.2')
    const options = within(listbox).getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent('8.2')
  })

  it('falls back to free-text clause entry when no catalog entry matches the typed text', async () => {
    const onChange = vi.fn()
    renderCombobox(onChange)

    await userEvent.selectOptions(screen.getByLabelText(i18n.t('qualityEvents:form.fields.normaVinculada')), 'ISO_9001_2015')
    const clauseInput = screen.getByRole('combobox', { name: 'Cláusula incumplida' })
    await userEvent.click(clauseInput)
    await userEvent.type(clauseInput, 'texto-que-no-existe-en-catalogo')

    const freeTextOption = screen.getByText(/usar/i)
    await userEvent.click(freeTextOption)

    expect(onChange).toHaveBeenLastCalledWith({
      norma: 'ISO_9001_2015',
      clausula: 'texto-que-no-existe-en-catalogo',
    })
  })

  it('shows free-text clausula and a required normaOtraDetalle field when norma is OTRA, no catalog dropdown', async () => {
    const onChange = vi.fn()
    renderCombobox(onChange)

    await userEvent.selectOptions(screen.getByLabelText(i18n.t('qualityEvents:form.fields.normaVinculada')), 'OTRA')

    expect(screen.queryByRole('combobox', { name: 'Cláusula incumplida' })).not.toBeInTheDocument()
    expect(screen.getByLabelText(i18n.t('qualityEvents:form.fields.normaOtraDetalle'), { exact: false })).toBeInTheDocument()
  })

  it('onChange emits the full NormativaVinculada object when a catalog clause is selected', async () => {
    const onChange = vi.fn()
    renderCombobox(onChange)

    await userEvent.selectOptions(screen.getByLabelText(i18n.t('qualityEvents:form.fields.normaVinculada')), 'ISO_9001_2015')
    const clauseInput = screen.getByRole('combobox', { name: 'Cláusula incumplida' })
    await userEvent.click(clauseInput)
    await userEvent.type(clauseInput, '7.1.5')

    const option = screen.getByText('§7.1.5')
    await userEvent.click(option)

    expect(onChange).toHaveBeenLastCalledWith({ norma: 'ISO_9001_2015', clausula: '7.1.5' })
  })
})
