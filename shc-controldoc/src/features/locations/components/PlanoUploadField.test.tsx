import { useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PlanoUploadField } from './PlanoUploadField'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

afterEach(() => cleanup())

function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes)
  return new File([content], name, { type })
}

function selectFile(input: HTMLInputElement, file: File) {
  fireEvent.change(input, { target: { files: [file] } })
}

describe('PlanoUploadField', () => {
  it('rechaza un archivo que no es PNG', () => {
    const onChange = vi.fn()
    render(<PlanoUploadField value={null} onChange={onChange} />)

    const input = document.getElementById('planoUrl') as HTMLInputElement
    selectFile(input, makeFile('foto.jpg', 'image/jpeg', 1024))

    expect(screen.getByRole('alert')).toHaveTextContent('form.plano.formatoInvalido')
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('rechaza un PNG mayor a 2MB', () => {
    const onChange = vi.fn()
    render(<PlanoUploadField value={null} onChange={onChange} />)

    const input = document.getElementById('planoUrl') as HTMLInputElement
    selectFile(input, makeFile('plano.png', 'image/png', 2.5 * 1024 * 1024))

    expect(screen.getByRole('alert')).toHaveTextContent('form.plano.tamanoInvalido')
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('acepta un PNG de hasta 2MB sin error', () => {
    const onChange = vi.fn()
    render(<PlanoUploadField value={null} onChange={onChange} />)

    const input = document.getElementById('planoUrl') as HTMLInputElement
    const file = makeFile('plano.png', 'image/png', 1024 * 1024)
    selectFile(input, file)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onChange).toHaveBeenCalledWith(file)
  })

  it('muestra un thumbnail real (objectURL) tras seleccionar un PNG válido', () => {
    function Wrapper() {
      const [value, setValue] = useState<File | null>(null)
      return <PlanoUploadField value={value} onChange={setValue} />
    }
    render(<Wrapper />)

    const input = document.getElementById('planoUrl') as HTMLInputElement
    const file = makeFile('plano-almacen.png', 'image/png', 1024)
    selectFile(input, file)

    const img = screen.getByAltText('form.plano.previewAlt') as HTMLImageElement
    expect(img.src).toMatch(/^blob:/)
  })

  it('muestra automáticamente el thumbnail real del plano existente en modo edición', () => {
    render(
      <PlanoUploadField
        value={null}
        onChange={vi.fn()}
        existingUrl="/mock/plano-loc-001.png"
      />,
    )

    const img = screen.getByAltText('form.plano.previewAlt') as HTMLImageElement
    expect(img.src).toContain('/mock/plano-loc-001.png')
    expect(screen.getByText('form.plano.reemplazar')).toBeInTheDocument()
  })

  it('subir un plano nuevo en modo edición actualiza el thumbnail al archivo recién seleccionado', () => {
    function Wrapper() {
      const [value, setValue] = useState<File | null>(null)
      return (
        <PlanoUploadField
          value={value}
          onChange={setValue}
          existingUrl="/mock/plano-loc-001.png"
        />
      )
    }
    render(<Wrapper />)

    expect((screen.getByAltText('form.plano.previewAlt') as HTMLImageElement).src).toContain(
      '/mock/plano-loc-001.png',
    )

    const input = document.getElementById('planoUrl') as HTMLInputElement
    selectFile(input, makeFile('plano-nuevo.png', 'image/png', 1024))

    const img = screen.getByAltText('form.plano.previewAlt') as HTMLImageElement
    expect(img.src).toMatch(/^blob:/)
    expect(img.src).not.toContain('/mock/plano-loc-001.png')
  })
})
