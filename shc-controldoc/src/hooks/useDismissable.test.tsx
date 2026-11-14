import { describe, it, expect, vi, afterEach } from 'vitest'
import { useRef } from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { useDismissable, useRouteScopedOpen } from './useDismissable'

afterEach(() => cleanup())

function Harness({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  useDismissable(open, onClose, [panelRef, triggerRef])
  return (
    <>
      <button ref={triggerRef}>trigger</button>
      <div ref={panelRef}>
        <span>dentro</span>
      </div>
      <span>afuera</span>
    </>
  )
}

describe('useDismissable', () => {
  it('llama a onClose con un mousedown o touchstart afuera', () => {
    const onClose = vi.fn()
    render(<Harness open onClose={onClose} />)
    fireEvent.mouseDown(screen.getByText('afuera'))
    fireEvent.touchStart(document.body)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('no llama a onClose con un clic dentro del panel ni en el botón', () => {
    const onClose = vi.fn()
    render(<Harness open onClose={onClose} />)
    fireEvent.mouseDown(screen.getByText('dentro'))
    fireEvent.mouseDown(screen.getByText('trigger'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Escape llama a onClose y devuelve el foco al botón', () => {
    const onClose = vi.fn()
    render(<Harness open onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.getByText('trigger')).toHaveFocus()
  })

  it('ignora otras teclas', () => {
    const onClose = vi.fn()
    render(<Harness open onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('sin open no registra listeners', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const onClose = vi.fn()
    render(<Harness open={false} onClose={onClose} />)
    fireEvent.mouseDown(document.body)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(addSpy.mock.calls.some(([type]) => type === 'mousedown' || type === 'keydown')).toBe(false)
    addSpy.mockRestore()
  })

  it('remueve los listeners al cerrar', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const onClose = vi.fn()
    const { rerender } = render(<Harness open onClose={onClose} />)
    rerender(<Harness open={false} onClose={onClose} />)
    expect(removeSpy.mock.calls.map(([type]) => type)).toEqual(
      expect.arrayContaining(['mousedown', 'touchstart', 'keydown']),
    )
    fireEvent.mouseDown(document.body)
    expect(onClose).not.toHaveBeenCalled()
    removeSpy.mockRestore()
  })
})

function RouteScopedHarness() {
  const { open, toggle, close } = useRouteScopedOpen()
  const navigate = useNavigate()
  return (
    <>
      <button onClick={toggle}>toggle</button>
      <button onClick={close}>close</button>
      <button onClick={() => void navigate('/b')}>navegar</button>
      {open && <span>panel</span>}
    </>
  )
}

describe('useRouteScopedOpen', () => {
  function renderHarness() {
    return render(
      <MemoryRouter initialEntries={['/a']}>
        <RouteScopedHarness />
      </MemoryRouter>,
    )
  }

  it('alterna y cierra', () => {
    renderHarness()
    fireEvent.click(screen.getByText('toggle'))
    expect(screen.getByText('panel')).toBeInTheDocument()
    fireEvent.click(screen.getByText('toggle'))
    expect(screen.queryByText('panel')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('toggle'))
    fireEvent.click(screen.getByText('close'))
    expect(screen.queryByText('panel')).not.toBeInTheDocument()
  })

  it('queda cerrado al cambiar de ruta', () => {
    renderHarness()
    fireEvent.click(screen.getByText('toggle'))
    expect(screen.getByText('panel')).toBeInTheDocument()
    fireEvent.click(screen.getByText('navegar'))
    expect(screen.queryByText('panel')).not.toBeInTheDocument()
  })
})
