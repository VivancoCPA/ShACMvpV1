import type {
  ACSolicitudAjustePlazoResumen,
  AccionCorrectivaResumen,
  IncidenteResumen,
  QEReaperturaResumen,
} from '../types/dashboardSummary.types'
import type { QEStatus } from '../../quality-events/types/qualityEvent.types'
import type { RangoPeriodo } from '../hooks/usePeriodoKpi'

// Conteos de las tarjetas de "Requiere atención" (dashboard-layout-4-zonas design.md D9). Puros:
// reciben `ahora` para poder testearlos sin mockear el reloj.

const MS_POR_DIA = 24 * 60 * 60 * 1000
const ESTADOS_TERMINALES_AC = ['CERRADA', 'COMPLETADA']
const ESTADOS_TERMINALES_QE: QEStatus[] = ['CERRADO', 'VERIFICADO']

// Operario: AC no terminales vencidas, y las que vencen entre ahora y ahora + `diasPorVencer`.
// Devuelve los arreglos (no los conteos): la tarjeta usa `.length` y MisACsWidget renderiza el
// mismo arreglo (dashboard-alertas-coherentes D2).
export function clasificarAcsVencidasYPorVencer(
  acs: AccionCorrectivaResumen[],
  diasPorVencer = 5,
  ahora: number = Date.now(),
): { vencidas: AccionCorrectivaResumen[]; porVencer: AccionCorrectivaResumen[] } {
  const limite = ahora + diasPorVencer * MS_POR_DIA
  const activas = acs.filter((ac) => !ESTADOS_TERMINALES_AC.includes(ac.estado))
  return {
    vencidas: activas.filter((ac) => new Date(ac.plazoFecha).getTime() < ahora),
    porVencer: activas.filter((ac) => {
      const plazo = new Date(ac.plazoFecha).getTime()
      return plazo >= ahora && plazo <= limite
    }),
  }
}

// JCA, pestaña "Por vencer": el backend incluye en accionesCorrectivasPorVencer las ya vencidas
// (las consumen los exportes); se quitan para no solaparse con la pestaña "Vencidas".
export function filtrarAcsNoVencidas(acs: AccionCorrectivaResumen[], ahora: number = Date.now()): AccionCorrectivaResumen[] {
  return acs.filter((ac) => new Date(ac.plazoFecha).getTime() >= ahora)
}

// Alta Dirección: AC con una solicitud de ajuste de plazo PENDIENTE que requiere a Gerencia — el
// número de la tarjeta y las filas de ACsExtensionPlazoWidget.
export function filtrarSolicitudesGerenciaPendientes(acs: ACSolicitudAjustePlazoResumen[]): ACSolicitudAjustePlazoResumen[] {
  return acs.filter((ac) => ac.solicitudesAjustePlazo.some((s) => s.estado === 'PENDIENTE' && s.requiereAprobacionGerencia))
}

// Supervisor: incidentes con fechaEvento en los últimos `dias` días, y la fecha `yyyy-MM-dd` desde
// la que filtrar la lista de incidentes.
export function contarIncidentesRecientes(
  incidentes: IncidenteResumen[],
  dias = 7,
  ahora: number = Date.now(),
): { total: number; fechaDesde: string } {
  const desde = ahora - dias * MS_POR_DIA
  return {
    total: incidentes.filter((i) => new Date(i.fechaEvento).getTime() >= desde).length,
    fechaDesde: new Date(desde).toISOString().slice(0, 10),
  }
}

// Alta Dirección: reaperturas cuya fecha cae dentro del período elegido.
export function contarReaperturasEnRango(reaperturas: QEReaperturaResumen[], rango: RangoPeriodo): number {
  const desde = rango.desde.getTime()
  const hasta = rango.hasta.getTime()
  return reaperturas.filter((r) => {
    const fecha = new Date(r.fechaReapertura).getTime()
    return fecha >= desde && fecha < hasta
  }).length
}

// Auditor: hallazgos en cualquier estado salvo CERRADO y VERIFICADO.
export function contarHallazgosAbiertos(hallazgosPorEstado: Partial<Record<QEStatus, number>>): number {
  return (Object.entries(hallazgosPorEstado) as [QEStatus, number][])
    .filter(([estado]) => !ESTADOS_TERMINALES_QE.includes(estado))
    .reduce((acc, [, total]) => acc + total, 0)
}
