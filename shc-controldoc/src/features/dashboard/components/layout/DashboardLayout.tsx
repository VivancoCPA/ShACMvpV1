import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type Zona = 'alertas' | 'indicadores' | 'trabajo' | 'mapa'

interface DashboardLayoutProps {
  alertas?: ReactNode
  indicadores?: ReactNode
  periodoSelector?: ReactNode
  trabajoPrincipal?: ReactNode
  trabajoLateral?: ReactNode
  mapa?: ReactNode
}

function tieneContenido(nodo: ReactNode): boolean {
  return nodo !== null && nodo !== undefined && nodo !== false
}

interface ZonaSectionProps {
  zona: Zona
  primera: boolean
  accion?: ReactNode
  children: ReactNode
}

function ZonaSection({ zona, primera, accion, children }: ZonaSectionProps) {
  const { t } = useTranslation('dashboard')
  const labelId = useId()
  return (
    <section aria-labelledby={labelId} data-testid={`zona-${zona}`} className={primera ? undefined : 'mt-6'}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id={labelId} className="text-[11px] font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft">
          {t(`layout.zonas.${zona}`)}
        </h2>
        {accion}
      </div>
      {children}
    </section>
  )
}

// Layout común de 4 zonas de los dashboards de rol (dashboard-layout-4-zonas): una zona sin
// contenido no se renderiza, y si falta una de las columnas de trabajo la otra ocupa todo el ancho.
export function DashboardLayout({
  alertas,
  indicadores,
  periodoSelector,
  trabajoPrincipal,
  trabajoLateral,
  mapa,
}: DashboardLayoutProps) {
  const hayPrincipal = tieneContenido(trabajoPrincipal)
  const hayLateral = tieneContenido(trabajoLateral)

  const zonas: { zona: Zona; nodo: ReactNode; accion?: ReactNode }[] = []
  if (tieneContenido(alertas)) {
    zonas.push({
      zona: 'alertas',
      nodo: <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{alertas}</div>,
    })
  }
  if (tieneContenido(indicadores)) {
    zonas.push({
      zona: 'indicadores',
      accion: periodoSelector,
      nodo: <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{indicadores}</div>,
    })
  }
  if (hayPrincipal || hayLateral) {
    zonas.push({
      zona: 'trabajo',
      nodo: (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {hayPrincipal && (
            <div data-testid="trabajo-principal" className={`min-w-0 space-y-6 ${hayLateral ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
              {trabajoPrincipal}
            </div>
          )}
          {hayLateral && (
            <div data-testid="trabajo-lateral" className={`min-w-0 space-y-6 ${hayPrincipal ? 'lg:col-span-1' : 'lg:col-span-3'}`}>
              {trabajoLateral}
            </div>
          )}
        </div>
      ),
    })
  }
  if (tieneContenido(mapa)) {
    zonas.push({ zona: 'mapa', nodo: mapa })
  }

  return (
    <div>
      {zonas.map(({ zona, nodo, accion }, index) => (
        <ZonaSection key={zona} zona={zona} primera={index === 0} accion={accion}>
          {nodo}
        </ZonaSection>
      ))}
    </div>
  )
}
