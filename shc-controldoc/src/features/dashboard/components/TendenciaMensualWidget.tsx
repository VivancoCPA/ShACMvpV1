import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  JefeCalidadDashboardData,
  TendenciaMensualVolumenEntry,
} from '../types/dashboardData.types'

const RANGOS = [3, 6, 12] as const
type Rango = (typeof RANGOS)[number]

const COLOR_ABIERTOS = '#cc785c'
const COLOR_CERRADOS = '#5db8a6'
const COLOR_KPI01 = '#cc785c'
const COLOR_KPI04 = '#e8a55a'
const COLOR_KPI05 = '#5db8a6'

interface TendenciaMensualWidgetProps {
  tendenciaMensualVolumen: TendenciaMensualVolumenEntry[]
  tendenciaMensualKpis: JefeCalidadDashboardData['tendenciaMensualKpis']
}

function formatPeriodo(periodo: string, locale: string): string {
  const [year, month] = periodo.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, 1))
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

interface TooltipPayloadEntry {
  name?: string
  value?: number | string
  color?: string
}

interface ChartTooltipProps {
  active?: boolean
  label?: string
  payload?: TooltipPayloadEntry[]
  labelFormatter: (label: string) => string
}

function ChartTooltip({ active, label, payload, labelFormatter }: ChartTooltipProps) {
  if (!active || !payload?.length || label === undefined) return null
  return (
    <div className="rounded-md border border-hairline bg-canvas p-2.5 text-xs shadow-md dark:border-hairline/20 dark:bg-surface-dark-elevated">
      <p className="mb-1 font-medium text-body-strong dark:text-on-dark">{labelFormatter(label)}</p>
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-1.5 text-body dark:text-on-dark-soft">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: {typeof entry.value === 'number' ? Math.round(entry.value * 10) / 10 : entry.value}
        </p>
      ))}
    </div>
  )
}

export function TendenciaMensualWidget({
  tendenciaMensualVolumen,
  tendenciaMensualKpis,
}: TendenciaMensualWidgetProps) {
  const { t, i18n } = useTranslation('dashboard')
  const [rango, setRango] = useState<Rango>(6)

  const volumenRecortado = useMemo(
    () => tendenciaMensualVolumen.slice(-rango),
    [tendenciaMensualVolumen, rango],
  )

  const kpisRecortados = useMemo(() => {
    const kpi01 = tendenciaMensualKpis['KPI-01']
    const kpi04 = tendenciaMensualKpis['KPI-04']
    const kpi05 = tendenciaMensualKpis['KPI-05']
    return kpi01.map((entry, i) => ({
      periodo: entry.periodo,
      kpi01: entry.valor,
      kpi04: kpi04[i]?.valor ?? 0,
      kpi05: kpi05[i]?.valor ?? 0,
    })).slice(-rango)
  }, [tendenciaMensualKpis, rango])

  const tickFormatter = (periodo: string) => formatPeriodo(periodo, i18n.language)

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">
          {t('jefeCalidad.tendencia.title')}
        </h2>
        <div
          role="group"
          aria-label={t('jefeCalidad.tendencia.rango.label')}
          className="flex gap-1.5"
        >
          {RANGOS.map((r) => (
            <button
              key={r}
              type="button"
              aria-label={t(`jefeCalidad.tendencia.rango.opciones.${r}`)}
              aria-pressed={rango === r}
              onClick={() => setRango(r)}
              className={clsx(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                rango === r
                  ? 'bg-coral text-white'
                  : 'border border-hairline bg-canvas text-body hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark-soft dark:hover:bg-surface-dark-elevated',
              )}
            >
              {t(`jefeCalidad.tendencia.rango.opciones.${r}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div
          data-export-chart="tendencia-volumen"
          className="rounded-lg border border-hairline p-4 dark:border-hairline/20"
        >
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft">
            {t('jefeCalidad.tendencia.volumen.title')}
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={volumenRecortado}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-hairline dark:stroke-hairline/30" />
              <XAxis dataKey="periodo" tickFormatter={tickFormatter} tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip content={<ChartTooltip labelFormatter={tickFormatter} />} />
              <Legend />
              <Line
                type="linear"
                dataKey="abiertos"
                name={t('jefeCalidad.tendencia.volumen.abiertos')}
                stroke={COLOR_ABIERTOS}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="linear"
                dataKey="cerrados"
                name={t('jefeCalidad.tendencia.volumen.cerrados')}
                stroke={COLOR_CERRADOS}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div
          data-export-chart="tendencia-kpis"
          className="rounded-lg border border-hairline p-4 dark:border-hairline/20"
        >
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft">
            {t('jefeCalidad.tendencia.kpis.title')}
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={kpisRecortados}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-hairline dark:stroke-hairline/30" />
              <XAxis dataKey="periodo" tickFormatter={tickFormatter} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={<ChartTooltip labelFormatter={tickFormatter} />} />
              <Legend />
              <Line
                type="linear"
                dataKey="kpi01"
                name={t('jefeCalidad.tendencia.kpis.kpi01')}
                stroke={COLOR_KPI01}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="linear"
                dataKey="kpi04"
                name={t('jefeCalidad.tendencia.kpis.kpi04')}
                stroke={COLOR_KPI04}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="linear"
                dataKey="kpi05"
                name={t('jefeCalidad.tendencia.kpis.kpi05')}
                stroke={COLOR_KPI05}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}
