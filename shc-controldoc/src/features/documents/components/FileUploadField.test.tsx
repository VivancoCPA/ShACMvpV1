import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FileUploadField } from './FileUploadField'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('FileUploadField — variant original (RN-DOC-021)', () => {
  it('accepts a PDF when allowPdf is true', async () => {
    const onChange = vi.fn()
    const { container } = render(
      <FileUploadField value={null} onChange={onChange} variant="original" allowPdf />,
    )

    const file = new File(['%PDF-1.4'], 'plan.pdf', { type: 'application/pdf' })
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)

    expect(onChange).toHaveBeenCalledWith(file)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('rejects a PDF when allowPdf is false', async () => {
    const onChange = vi.fn()
    const { container } = render(
      <FileUploadField value={null} onChange={onChange} variant="original" allowPdf={false} />,
    )

    const file = new File(['%PDF-1.4'], 'procedimiento.pdf', { type: 'application/pdf' })
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    // applyAccept: false — el navegador real ya filtraría este archivo por el atributo
    // `accept` del input (igual que user-event por defecto), pero drag-and-drop no pasa por
    // ese filtro (handleDrop llama handleFiles directo); esto ejercita la validación propia
    // del componente, no la del navegador.
    await userEvent.upload(input, file, { applyAccept: false })

    expect(onChange).toHaveBeenCalledWith(null)
    expect(screen.getByRole('alert')).toHaveTextContent('form.error_file_type')
  })

  it('still accepts a .docx regardless of allowPdf', async () => {
    const onChange = vi.fn()
    const { container } = render(
      <FileUploadField value={null} onChange={onChange} variant="original" allowPdf={false} />,
    )

    const file = new File(['contenido'], 'procedimiento.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)

    expect(onChange).toHaveBeenCalledWith(file)
  })

  it('accept attribute includes .pdf only when allowPdf is true', () => {
    const { container, rerender } = render(
      <FileUploadField value={null} onChange={vi.fn()} variant="original" allowPdf />,
    )
    expect(container.querySelector('input[type="file"]')).toHaveAttribute('accept', '.docx,.xlsx,.pdf')

    rerender(<FileUploadField value={null} onChange={vi.fn()} variant="original" allowPdf={false} />)
    expect(container.querySelector('input[type="file"]')).toHaveAttribute('accept', '.docx,.xlsx')
  })
})
