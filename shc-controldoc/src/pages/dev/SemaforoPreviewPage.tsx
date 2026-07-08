import { SemaforoCriticoBanner } from '../../components/shared/SemaforoCriticoBanner'
import { SemaforoRow } from '../../components/shared/SemaforoRow'

const FILA_EXAMPLES = [
  {
    id: 'verde-1',
    estado: 'VERDE' as const,
    codigo: 'QE-2026-014',
    descripcion: 'Verificación de acción correctiva — Área Recepción',
    diasHabilesRestantes: 12,
  },
  {
    id: 'amarillo-1',
    estado: 'AMARILLO' as const,
    codigo: 'QE-2026-021',
    descripcion: 'Cierre de no conformidad — Muestreo de mineral',
    diasHabilesRestantes: 3,
  },
  {
    id: 'amarillo-hoy',
    estado: 'AMARILLO' as const,
    codigo: 'QE-2026-022',
    descripcion: 'Revisión periódica — Procedimiento de descarga',
    diasHabilesRestantes: 0,
  },
  {
    id: 'rojo-1',
    estado: 'ROJO' as const,
    codigo: 'QE-2026-009',
    descripcion: 'Acción correctiva vencida — Incidente SyST turno noche',
    diasHabilesRestantes: -1,
  },
  {
    id: 'rojo-vencido-varios',
    estado: 'ROJO' as const,
    codigo: 'QE-2026-005',
    descripcion: 'Verificación de eficacia — Hallazgo de auditoría interna',
    diasHabilesRestantes: -8,
  },
]

const CRITICO_ITEMS = [
  { id: 'crit-1', codigo: 'QE-2026-002', descripcion: 'Contaminación de lote — Almacén 3' },
  { id: 'crit-2', codigo: 'QE-2026-007', descripcion: 'Casi accidente con montacargas — Zona de carga' },
]

export function SemaforoPreviewPage() {
  return (
    <div className="min-h-screen bg-canvas p-8 dark:bg-surface-dark">
      <div className="mx-auto max-w-2xl space-y-10">
        <header>
          <h1 className="text-xl font-medium text-ink dark:text-on-dark">
            Semáforo de Pendientes — Preview de componentes (M5-S02)
          </h1>
          <p className="mt-1 text-sm text-muted dark:text-on-dark-soft">
            Página de desarrollo. No forma parte del flujo de producción.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">
            SemaforoRow — estados VERDE / AMARILLO / ROJO
          </h2>
          <div className="space-y-2">
            {FILA_EXAMPLES.map((item) => (
              <SemaforoRow
                key={item.id}
                estado={item.estado}
                codigo={item.codigo}
                descripcion={item.descripcion}
                diasHabilesRestantes={item.diasHabilesRestantes}
              />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">
            SemaforoRow — interactivo (con onClick)
          </h2>
          <SemaforoRow
            estado="AMARILLO"
            codigo="QE-2026-030"
            descripcion="Fila clicable — revisa la consola al hacer click"
            diasHabilesRestantes={2}
            onClick={() => console.log('SemaforoRow clicked')}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">
            SemaforoCriticoBanner — con eventos críticos
          </h2>
          <SemaforoCriticoBanner items={CRITICO_ITEMS} onItemClick={(id) => console.log('Crítico click', id)} />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">
            SemaforoCriticoBanner — sin eventos críticos (no debe renderizar nada)
          </h2>
          <div className="rounded-lg border border-dashed border-hairline p-4 text-sm text-muted dark:border-hairline/20 dark:text-on-dark-soft">
            <SemaforoCriticoBanner items={[]} />
            (el banner de arriba está vacío intencionalmente — items=[])
          </div>
        </section>
      </div>
    </div>
  )
}
