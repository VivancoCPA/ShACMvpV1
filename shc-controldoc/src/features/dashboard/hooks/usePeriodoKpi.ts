import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { KpiPeriodoTipo } from '../types/kpi.types'

const TIPOS: readonly KpiPeriodoTipo[] = ['mes', 'trimestre', 'anio']

export interface RangoPeriodo {
  desde: Date
  hasta: Date
}

// Año y mes (1-12) de `ahora` en hora de Lima — el backend usa la misma zona para el default.
function anioMesLima(ahora: Date): { anio: number; mes: number } {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit' }).formatToParts(ahora)
  const anio = Number(partes.find((p) => p.type === 'year')?.value)
  const mes = Number(partes.find((p) => p.type === 'month')?.value)
  return { anio, mes }
}

export function parsePeriodoTipo(valor: string | null): KpiPeriodoTipo {
  return TIPOS.includes(valor as KpiPeriodoTipo) ? (valor as KpiPeriodoTipo) : 'mes'
}

// String de la API (`yyyy-MM`, `yyyy-Qn`, `yyyy`) y rango [desde, hasta) en UTC del período
// actual — dashboard-layout-4-zonas design.md D8.
export function periodoActual(tipo: KpiPeriodoTipo, ahora: Date = new Date()): { periodo: string; rango: RangoPeriodo } {
  const { anio, mes } = anioMesLima(ahora)
  if (tipo === 'anio') {
    return { periodo: String(anio), rango: { desde: new Date(Date.UTC(anio, 0, 1)), hasta: new Date(Date.UTC(anio + 1, 0, 1)) } }
  }
  if (tipo === 'trimestre') {
    const q = Math.floor((mes - 1) / 3)
    return {
      periodo: `${anio}-Q${q + 1}`,
      rango: { desde: new Date(Date.UTC(anio, q * 3, 1)), hasta: new Date(Date.UTC(anio, q * 3 + 3, 1)) },
    }
  }
  return {
    periodo: `${anio}-${String(mes).padStart(2, '0')}`,
    rango: { desde: new Date(Date.UTC(anio, mes - 1, 1)), hasta: new Date(Date.UTC(anio, mes, 1)) },
  }
}

export function usePeriodoKpi() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tipo = parsePeriodoTipo(searchParams.get('periodo'))
  const { periodo, rango } = useMemo(() => periodoActual(tipo), [tipo])

  const setTipo = useCallback(
    (nuevo: KpiPeriodoTipo) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('periodo', nuevo)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  return { tipo, setTipo, periodo, rango }
}
