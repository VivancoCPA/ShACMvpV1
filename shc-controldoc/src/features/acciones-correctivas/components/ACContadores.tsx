import { useTranslation } from 'react-i18next'
import { AlertaCard, type AlertaNivel } from '../../dashboard/components/layout/AlertaCard'
import { alternarTarjeta, tarjetaActiva, type ACContadorClave } from '../utils/filtrosUrl'
import type { ACListadoContadores, ACListadoFiltros } from '../types/accionesCorrectivasListado.types'

const TARJETAS: { clave: ACContadorClave; nivel: AlertaNivel }[] = [
  { clave: 'abiertas', nivel: 'info' },
  { clave: 'enEjecucion', nivel: 'info' },
  { clave: 'pendientesVerificacion', nivel: 'warning' },
  { clave: 'porVencer', nivel: 'warning' },
  { clave: 'vencidas', nivel: 'error' },
  { clave: 'cerradasPeriodo', nivel: 'success' },
]

interface ACContadoresProps {
  contadores: ACListadoContadores | undefined
  filtros: ACListadoFiltros
  onChange: (filtros: ACListadoFiltros) => void
}

// Franja de contadores: cada tarjeta fija su filtro de estado (D4) y los números salen del backend,
// calculados con el mismo criterio que ese filtro.
export function ACContadores({ contadores, filtros, onChange }: ACContadoresProps) {
  const { t } = useTranslation('accionesCorrectivas')
  return (
    <section aria-label={t('contadores.label')} className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {TARJETAS.map(({ clave, nivel }) => (
        <AlertaCard
          key={clave}
          valor={contadores?.[clave] ?? 0}
          titulo={t(`contadores.${clave}`)}
          nivel={nivel}
          activa={tarjetaActiva(filtros, clave)}
          onSelect={() => onChange(alternarTarjeta(filtros, clave))}
        />
      ))}
    </section>
  )
}
