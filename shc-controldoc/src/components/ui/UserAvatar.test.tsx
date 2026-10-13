// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { UserAvatar } from './UserAvatar'

afterEach(() => {
  cleanup()
})

describe('UserAvatar', () => {
  it('con avatarUrl (y sin rol) renderiza la imagen, no las iniciales', () => {
    const { container } = render(
      <UserAvatar
        user={{ nombre: 'Sofía', apellido: 'Vargas', avatarUrl: 'data:image/png;base64,abc123' }}
      />,
    )

    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', 'data:image/png;base64,abc123')
    expect(img).toHaveAttribute('alt', 'Sofía Vargas')
    expect(container.querySelector('span')).not.toBeInTheDocument()
  })

  it('sin avatarUrl y sin rol muestra iniciales con fondo neutro', () => {
    const { container } = render(<UserAvatar user={{ nombre: 'Luis', apellido: 'Quispe' }} />)

    const initials = container.querySelector('span')
    expect(initials?.textContent).toBe('LQ')
    expect(initials?.className).toContain('bg-surface-cream')
  })

  it('sin avatarUrl pero con rol mantiene el color por rol (consumidores existentes no cambian)', () => {
    const { container } = render(
      <UserAvatar user={{ nombre: 'Luis', apellido: 'Quispe', rol: 'SUPERVISOR' }} />,
    )

    const initials = container.querySelector('span')
    expect(initials?.className).toContain('bg-teal/30')
    expect(initials?.className).not.toContain('bg-surface-cream')
  })

  it.each(['sm', 'md', 'lg'] as const)('acepta el tamaño %s sin error', (size) => {
    expect(() =>
      render(<UserAvatar user={{ nombre: 'Ana', apellido: 'Torres' }} size={size} />),
    ).not.toThrow()
  })
})
