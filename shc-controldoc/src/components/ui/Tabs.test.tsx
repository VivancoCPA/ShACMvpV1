// @vitest-environment jsdom
import { useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Tabs } from './Tabs'
import type { TabItem } from './Tabs'

afterEach(() => {
  cleanup()
})

const TABS: TabItem[] = [
  { id: 'resumen', label: 'Resumen', panel: <p>Panel resumen</p> },
  { id: 'historial', label: 'Historial', count: 3, panel: <p>Panel historial</p> },
  { id: 'log', label: 'Log', panel: <p>Panel log</p> },
]

function Controlled({ initial = 'resumen' }: { initial?: string }) {
  const [active, setActive] = useState(initial)
  return <Tabs tabs={TABS} activeId={active} onChange={setActive} />
}

describe('Tabs', () => {
  it('renderiza solo el panel activo', () => {
    render(<Tabs tabs={TABS} activeId="resumen" onChange={() => {}} />)

    expect(screen.getByText('Panel resumen')).toBeInTheDocument()
    expect(screen.queryByText('Panel historial')).not.toBeInTheDocument()
  })

  it('muestra el contador cuando el tab lo define', () => {
    render(<Tabs tabs={TABS} activeId="resumen" onChange={() => {}} />)

    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('aria-selected marca la pestaña activa', () => {
    render(<Tabs tabs={TABS} activeId="historial" onChange={() => {}} />)

    expect(screen.getByRole('tab', { name: /historial/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /resumen/i })).toHaveAttribute('aria-selected', 'false')
  })

  it('click en una pestaña llama a onChange con su id', () => {
    const onChange = vi.fn()
    render(<Tabs tabs={TABS} activeId="resumen" onChange={onChange} />)

    fireEvent.click(screen.getByRole('tab', { name: /log/i }))

    expect(onChange).toHaveBeenCalledWith('log')
  })

  it('cambia de panel al hacer click (componente controlado)', () => {
    render(<Controlled />)

    expect(screen.getByText('Panel resumen')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /log/i }))
    expect(screen.getByText('Panel log')).toBeInTheDocument()
    expect(screen.queryByText('Panel resumen')).not.toBeInTheDocument()
  })

  it('flecha derecha mueve el foco y activa la siguiente pestaña', () => {
    render(<Controlled />)

    const resumenTab = screen.getByRole('tab', { name: /resumen/i })
    resumenTab.focus()
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' })

    const historialTab = screen.getByRole('tab', { name: /historial/i })
    expect(historialTab).toHaveFocus()
    expect(historialTab).toHaveAttribute('aria-selected', 'true')
  })

  it('flecha izquierda desde la primera pestaña envuelve a la última', () => {
    render(<Controlled />)

    screen.getByRole('tab', { name: /resumen/i }).focus()
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowLeft' })

    const logTab = screen.getByRole('tab', { name: /log/i })
    expect(logTab).toHaveFocus()
    expect(logTab).toHaveAttribute('aria-selected', 'true')
  })
})
