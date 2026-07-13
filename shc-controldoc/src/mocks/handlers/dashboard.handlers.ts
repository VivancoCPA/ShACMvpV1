import { http, HttpResponse, delay } from 'msw'
import { getQeStore } from './quality-events.handlers'
import { getDocumentsStore } from './documents.handlers'
import { getNonconformitiesStore } from './nonconformities.handlers'
import { getIncidentsStore } from './incidents.handlers'
import { calcularEstadoSemaforoDesdeFecha } from '../../features/dashboard/utils/semaforoPendientes'
import { horasTrabajadasFixtures } from '../fixtures/horasTrabajadas.fixtures'
import { kpi04AnioAnteriorFixtures } from '../fixtures/kpi04AnioAnterior.fixtures'
import { authFixtures } from '../fixtures/auth.fixtures'
import type { MockUser } from '../fixtures/auth.fixtures'
import {
  KPI_DEFINITIONS,
  PLAZO_MAXIMO_QE_DIAS_HABILES,
  plazoMaximoQEPorEstado,
} from '../../features/dashboard/constants/kpi.constants'
import { getDashboardDataTypeForRole } from '../../features/dashboard/utils/dashboardRoleMapping'
import { contarDiasHabiles } from '../../utils/businessDays'
import type { KpiId, KpiResult } from '../../features/dashboard/types/kpi.types'
import type {
  OperarioDashboardData,
  SupervisorDashboardData,
  JefeCalidadDashboardData,
  AltaDireccionDashboardData,
  AuditorDashboardData,
  JefeControlDocDashboardData,
  DashboardSummaryData,
} from '../../features/dashboard/types/dashboardData.types'
import type {
  QEResumen,
  IncidenteResumen,
  NCResumen,
  DocumentoResumen,
  AccionCorrectivaResumen,
  QEReaperturaResumen,
  ACSolicitudAjustePlazoResumen,
} from '../../features/dashboard/types/dashboardSummary.types'
import type { QualityEvent, QEStatus, QEType, NormaISO } from '../../features/quality-events/types/qualityEvent.types'
import type { Incidente } from '../../features/incidents/types/incident.types'
import type { NoConformidad } from '../../features/nonconformities/types/nonconformity.types'
import type { Documento } from '../../types/documents.types'

const LATENCY = 400

interface ACBase {
  id: string
  descripcion: string
  responsableId: string
  responsableNombre: string
  plazoFecha: string
  estado: string
  fechaCierre?: string
}

interface ACConOrigen {
  ac: ACBase
  origenTipo: AccionCorrectivaResumen['origenTipo']
  origenId: string
}

function getUserFromRequest(request: Request): MockUser | null {
  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  const match = /^mock-access-token-(.+)-\d{13}$/.exec(token)
  const userId = match?.[1] ?? null
  return userId ? (authFixtures.find((u) => u.id === userId) ?? null) : null
}

function currentPeriodo(): string {
  return new Date().toISOString().slice(0, 7)
}

function monthRange(periodo: string): { start: number; end: number } {
  const [y, m] = periodo.split('-').map(Number)
  return { start: Date.UTC(y, m - 1, 1), end: Date.UTC(y, m, 1) }
}

function quarterInfo(periodo: string): { start: number; end: number; label: string } {
  const [y, m] = periodo.split('-').map(Number)
  const q = Math.floor((m - 1) / 3)
  return { start: Date.UTC(y, q * 3, 1), end: Date.UTC(y, q * 3 + 3, 1), label: `${y}-Q${q + 1}` }
}

function quarterRangeFromLabel(label: string): { start: number; end: number } {
  const [yearStr, qStr] = label.split('-Q')
  const year = Number(yearStr)
  const q = Number(qStr) - 1
  return { start: Date.UTC(year, q * 3, 1), end: Date.UTC(year, q * 3 + 3, 1) }
}

function ultimosMeses(cantidad: number): string[] {
  const ahora = new Date()
  const meses: string[] = []
  for (let i = cantidad - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - i, 1))
    meses.push(d.toISOString().slice(0, 7))
  }
  return meses
}

function ultimosTrimestres(cantidad: number): string[] {
  const ahora = new Date()
  let year = ahora.getUTCFullYear()
  let quarter = Math.floor(ahora.getUTCMonth() / 3)
  const trimestres: string[] = []
  for (let i = 0; i < cantidad; i++) {
    trimestres.unshift(`${year}-Q${quarter + 1}`)
    quarter -= 1
    if (quarter < 0) {
      quarter = 3
      year -= 1
    }
  }
  return trimestres
}

function inRange(dateStr: string | undefined, start: number, end: number): boolean {
  if (!dateStr) return false
  const t = new Date(dateStr).getTime()
  return t >= start && t < end
}

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? (numerator / denominator) * 100 : 0
}

type KpiAbsolutoId = 'KPI-01' | 'KPI-02' | 'KPI-03' | 'KPI-05' | 'KPI-06' | 'KPI-07'

const KPI_DIRECTION: Record<KpiAbsolutoId, 'MAYOR_MEJOR' | 'MENOR_MEJOR'> = {
  'KPI-01': 'MAYOR_MEJOR',
  'KPI-02': 'MENOR_MEJOR',
  'KPI-03': 'MENOR_MEJOR',
  'KPI-05': 'MAYOR_MEJOR',
  'KPI-06': 'MAYOR_MEJOR',
  'KPI-07': 'MENOR_MEJOR',
}

function calcularSemaforoAbsoluto(kpiId: KpiAbsolutoId, valor: number, meta: number): 'VERDE' | 'AMARILLO' | 'ROJO' {
  const direccion = KPI_DIRECTION[kpiId]
  const cumple = direccion === 'MAYOR_MEJOR' ? valor >= meta : valor <= meta
  if (cumple) return 'VERDE'
  const desviacion = direccion === 'MAYOR_MEJOR' ? (meta - valor) / meta : (valor - meta) / meta
  return desviacion <= 0.2 ? 'AMARILLO' : 'ROJO'
}

// KPI-04 no compara contra un umbral absoluto sino contra el mismo periodo del año anterior
// (metaTipo: 'REDUCCION_INTERANUAL'). Ver design.md decisión 2.
function calcularSemaforoKpi04(
  valor: number,
  valorPeriodoAnterior: number | undefined,
  metaReduccionPct: number,
): 'VERDE' | 'AMARILLO' | 'ROJO' {
  if (!valorPeriodoAnterior) return 'ROJO'
  const reduccionReal = ((valorPeriodoAnterior - valor) / valorPeriodoAnterior) * 100
  if (reduccionReal >= metaReduccionPct) return 'VERDE'
  if (reduccionReal >= 0) return 'AMARILLO'
  return 'ROJO'
}

// KPI-08 usa una banda de conteo pequeño, no la desviación ±20% genérica. Ver design.md decisión 8.
function calcularSemaforoKpi08(valor: number): 'VERDE' | 'AMARILLO' | 'ROJO' {
  if (valor === 0) return 'VERDE'
  if (valor <= 3) return 'AMARILLO'
  return 'ROJO'
}

function collectAllACs(qes: QualityEvent[], ncs: NoConformidad[], incidentes: Incidente[]): ACBase[] {
  return [
    ...qes.flatMap((qe) => qe.accionesCorrectivas),
    ...ncs.flatMap((nc) => nc.accionesCorrectivas),
    ...incidentes.flatMap((inc) => inc.accionesCorrectivas ?? []),
  ]
}

function collectACsWithOrigin(
  qes: QualityEvent[],
  ncs: NoConformidad[],
  incidentes: Incidente[],
): ACConOrigen[] {
  return [
    ...qes.flatMap((qe) => qe.accionesCorrectivas.map((ac) => ({ ac, origenTipo: 'QE' as const, origenId: qe.id }))),
    ...ncs.flatMap((nc) => nc.accionesCorrectivas.map((ac) => ({ ac, origenTipo: 'NC' as const, origenId: nc.id }))),
    ...incidentes.flatMap((inc) =>
      (inc.accionesCorrectivas ?? []).map((ac) => ({ ac, origenTipo: 'INCIDENTE' as const, origenId: inc.id })),
    ),
  ]
}

// --- Cálculo de los 9 KPIs (fórmulas SHAC-PRD-003 §5.2, ver design.md) ---

function qeCerradosEnPeriodo(qes: QualityEvent[], start: number, end: number): QualityEvent[] {
  return qes.filter((qe) => (qe.estado === 'CERRADO' || qe.estado === 'VERIFICADO') && inRange(qe.fechaCierre, start, end))
}

function calcularKpi01(qes: QualityEvent[], periodo: string): number {
  const { start, end } = monthRange(periodo)
  const cerrados = qeCerradosEnPeriodo(qes, start, end)
  if (cerrados.length === 0) return 0
  const enPlazo = cerrados.filter((qe) => {
    const dias = contarDiasHabiles(new Date(qe.fechaHoraReporte), new Date(qe.fechaCierre!))
    return dias <= PLAZO_MAXIMO_QE_DIAS_HABILES[qe.severidad]
  })
  return pct(enPlazo.length, cerrados.length)
}

function calcularKpi02(qes: QualityEvent[], periodo: string): number {
  const { start, end } = monthRange(periodo)
  const cerrados = qeCerradosEnPeriodo(qes, start, end)
  if (cerrados.length === 0) return 0
  const totalDias = cerrados.reduce(
    (acc, qe) => acc + contarDiasHabiles(new Date(qe.fechaHoraReporte), new Date(qe.fechaCierre!)),
    0,
  )
  return totalDias / cerrados.length
}

function calcularKpi03(qes: QualityEvent[], periodo: string): number {
  const { start, end } = quarterInfo(periodo)
  const cerrados = qeCerradosEnPeriodo(qes, start, end)
  if (cerrados.length === 0) return 0
  const reincidentes = cerrados.filter((qe) => qe.ciclo > 1)
  return pct(reincidentes.length, cerrados.length)
}

function calcularKpi04(incidentes: Incidente[], periodo: string): number {
  const { start, end } = monthRange(periodo)
  const conLesionados = incidentes.filter((inc) => inc.huboLesionados && inRange(inc.fechaEvento, start, end))
  const horas = horasTrabajadasFixtures
    .filter((h) => h.periodo === periodo)
    .reduce((acc, h) => acc + h.horas, 0)
  return horas > 0 ? (conLesionados.length * 1_000_000) / horas : 0
}

function calcularKpi05(qes: QualityEvent[], ncs: NoConformidad[], periodo: string): number {
  const { start, end } = monthRange(periodo)
  // Origen QE + NC únicamente (Incidente no tiene resultadoVerificacion, ver design.md decisión 7):
  // se pasa un array vacío de incidentes a collectACsWithOrigin.
  const acsCerradas = collectACsWithOrigin(qes, ncs, []).filter(({ ac }) => ac.estado === 'CERRADA')

  function resultadoVerificacionPadre(origenTipo: 'QE' | 'NC', origenId: string): 'EFECTIVO' | 'NO_EFECTIVO' | undefined {
    if (origenTipo === 'QE') return qes.find((qe) => qe.id === origenId)?.resultadoVerificacion
    return ncs.find((nc) => nc.id === origenId)?.resultadoVerificacion
  }

  function fechaVerificacionPadre(origenTipo: 'QE' | 'NC', origenId: string): string | undefined {
    if (origenTipo === 'QE') return qes.find((qe) => qe.id === origenId)?.fechaVerificacionRealizada
    return ncs.find((nc) => nc.id === origenId)?.fechaVerificacion
  }

  const verificadasEnPeriodo = acsCerradas.filter(({ origenTipo, origenId }) => {
    const origen = origenTipo as 'QE' | 'NC'
    return !!resultadoVerificacionPadre(origen, origenId) && inRange(fechaVerificacionPadre(origen, origenId), start, end)
  })
  const efectivas = verificadasEnPeriodo.filter(({ origenTipo, origenId }) => resultadoVerificacionPadre(origenTipo as 'QE' | 'NC', origenId) === 'EFECTIVO')
  return pct(efectivas.length, verificadasEnPeriodo.length)
}

function calcularKpi06(docs: Documento[]): number {
  const publicados = docs.filter((d) => !d.deletedAt && d.estado === 'PUBLICADO')
  const vigentes = publicados.filter(
    (d) => !!d.fechaRevisionProxima && new Date(d.fechaRevisionProxima).getTime() >= Date.now(),
  )
  return pct(vigentes.length, publicados.length)
}

function fechaEntradaEstado(qe: QualityEvent, estado: QEStatus): string | undefined {
  const entradas = qe.auditTrail.filter((e) => e.accion === 'ESTADO_CAMBIADO' && e.estadoNuevo === estado)
  if (entradas.length === 0) return undefined
  return entradas.reduce((masReciente, e) => (e.timestamp > masReciente ? e.timestamp : masReciente), entradas[0].timestamp)
}

function fechaAnalisisCompletado(qe: QualityEvent): string | undefined {
  return fechaEntradaEstado(qe, 'ANALISIS_COMPLETADO')
}

// Fecha en que el QE entró a su estado ACTUAL (última transición ESTADO_CAMBIADO cuyo
// estadoNuevo coincide con qe.estado). Si nunca transicionó de ABIERTO, no hay tal entrada
// y fechaHoraReporte es la fecha correcta de todos modos (es el mismo momento).
function fechaEntradaEstadoActual(qe: QualityEvent): string {
  return fechaEntradaEstado(qe, qe.estado) ?? qe.fechaHoraReporte
}

function calcularKpi07(qes: QualityEvent[], periodo: string): number {
  const { start, end } = monthRange(periodo)
  const conAnalisisEnPeriodo = qes
    .map((qe) => ({ qe, fecha: fechaAnalisisCompletado(qe) }))
    .filter((x): x is { qe: QualityEvent; fecha: string } => !!x.fecha && inRange(x.fecha, start, end))
  if (conAnalisisEnPeriodo.length === 0) return 0
  const totalDias = conAnalisisEnPeriodo.reduce(
    (acc, { qe, fecha }) => acc + contarDiasHabiles(new Date(qe.fechaHoraReporte), new Date(fecha)),
    0,
  )
  return totalDias / conAnalisisEnPeriodo.length
}

function calcularKpi08(qes: QualityEvent[], ncs: NoConformidad[], incidentes: Incidente[]): number {
  const hoy = Date.now()
  return collectAllACs(qes, ncs, incidentes).filter(
    (ac) => ac.estado !== 'CERRADA' && ac.estado !== 'COMPLETADA' && new Date(ac.plazoFecha).getTime() < hoy,
  ).length
}

function calcularKpi09(qes: QualityEvent[], periodo: string): { valor: number; distribucion: { area: string; valor: number }[] } {
  const { start, end } = monthRange(periodo)
  const delPeriodo = qes.filter((qe) => inRange(qe.fechaHoraReporte, start, end))
  const conteos = new Map<string, number>()
  for (const qe of delPeriodo) {
    conteos.set(qe.areaAfectada, (conteos.get(qe.areaAfectada) ?? 0) + 1)
  }
  const distribucion = [...conteos.entries()]
    .map(([area, valor]) => ({ area, valor }))
    .sort((a, b) => b.valor - a.valor)
  return { valor: distribucion[0]?.valor ?? 0, distribucion }
}

function calcularKpis(periodo: string): KpiResult[] {
  const qes = getQeStore()
  const docs = getDocumentsStore()
  const ncs = getNonconformitiesStore()
  const incidentes = getIncidentsStore()
  const calculadoEn = new Date().toISOString()

  const kpi04Valor = calcularKpi04(incidentes, periodo)
  const kpi04AnioAnterior = kpi04AnioAnteriorFixtures.find((e) => e.periodo === periodo)?.valor
  const kpi09 = calcularKpi09(qes, periodo)

  return (Object.keys(KPI_DEFINITIONS) as KpiId[]).map((kpiId): KpiResult => {
    const definicion = KPI_DEFINITIONS[kpiId]
    switch (kpiId) {
      case 'KPI-01': {
        const valor = calcularKpi01(qes, periodo)
        return { kpiId, valor, meta: definicion.meta, metaTipo: definicion.metaTipo, semaforo: calcularSemaforoAbsoluto(kpiId, valor, definicion.meta), periodo, calculadoEn }
      }
      case 'KPI-02': {
        const valor = calcularKpi02(qes, periodo)
        return { kpiId, valor, meta: definicion.meta, metaTipo: definicion.metaTipo, semaforo: calcularSemaforoAbsoluto(kpiId, valor, definicion.meta), periodo, calculadoEn }
      }
      case 'KPI-03': {
        const valor = calcularKpi03(qes, periodo)
        return { kpiId, valor, meta: definicion.meta, metaTipo: definicion.metaTipo, semaforo: calcularSemaforoAbsoluto(kpiId, valor, definicion.meta), periodo: quarterInfo(periodo).label, calculadoEn }
      }
      case 'KPI-04':
        return {
          kpiId,
          valor: kpi04Valor,
          meta: definicion.meta,
          metaTipo: definicion.metaTipo,
          semaforo: calcularSemaforoKpi04(kpi04Valor, kpi04AnioAnterior, definicion.meta),
          periodo,
          calculadoEn,
          valorPeriodoAnterior: kpi04AnioAnterior,
        }
      case 'KPI-05': {
        const valor = calcularKpi05(qes, ncs, periodo)
        return { kpiId, valor, meta: definicion.meta, metaTipo: definicion.metaTipo, semaforo: calcularSemaforoAbsoluto(kpiId, valor, definicion.meta), periodo, calculadoEn }
      }
      case 'KPI-06': {
        const valor = calcularKpi06(docs)
        return { kpiId, valor, meta: definicion.meta, metaTipo: definicion.metaTipo, semaforo: calcularSemaforoAbsoluto(kpiId, valor, definicion.meta), periodo, calculadoEn }
      }
      case 'KPI-07': {
        const valor = calcularKpi07(qes, periodo)
        return { kpiId, valor, meta: definicion.meta, metaTipo: definicion.metaTipo, semaforo: calcularSemaforoAbsoluto(kpiId, valor, definicion.meta), periodo, calculadoEn }
      }
      case 'KPI-08': {
        const valor = calcularKpi08(qes, ncs, incidentes)
        return { kpiId, valor, meta: definicion.meta, metaTipo: definicion.metaTipo, semaforo: calcularSemaforoKpi08(valor), periodo: 'TIEMPO_REAL', calculadoEn }
      }
      case 'KPI-09':
        return {
          kpiId,
          valor: kpi09.valor,
          meta: definicion.meta,
          metaTipo: definicion.metaTipo,
          semaforo: 'INFORMATIVO',
          periodo,
          calculadoEn,
          distribucion: kpi09.distribucion,
        }
    }
  })
}

// --- Proyecciones a *Resumen ---

function toQEResumen(qe: QualityEvent): QEResumen {
  return {
    id: qe.id,
    numero: qe.numero,
    estado: qe.estado,
    severidad: qe.severidad,
    tipo: qe.tipo,
    origen: qe.origen,
    areaAfectada: qe.areaAfectada,
    fechaHoraReporte: qe.fechaHoraReporte,
    fechaVerificacionProgramada: qe.fechaVerificacionProgramada,
  }
}

function toIncidenteResumen(inc: Incidente): IncidenteResumen {
  return {
    id: inc.id,
    numero: inc.numero,
    tipo: inc.tipo,
    estado: inc.estado,
    severidad: inc.severidad,
    fechaEvento: inc.fechaEvento,
    areaId: inc.areaId,
  }
}

function toNCResumen(nc: NoConformidad): NCResumen {
  return {
    id: nc.id,
    numero: nc.numero,
    estado: nc.estado,
    severidad: nc.severidad,
    tipo: nc.tipo,
    areaAfectada: nc.areaAfectada,
    fechaDeteccion: nc.fechaDeteccion,
  }
}

function toDocumentoResumen(doc: Documento): DocumentoResumen {
  return {
    id: doc.id,
    codigo: doc.codigo,
    titulo: doc.titulo,
    tipo: doc.tipo,
    estado: doc.estado,
    area: doc.area,
    fechaRevisionProxima: doc.fechaRevisionProxima,
  }
}

function toACResumen(
  ac: ACBase,
  origenTipo: AccionCorrectivaResumen['origenTipo'],
  origenId: string,
): AccionCorrectivaResumen {
  return {
    id: ac.id,
    origenTipo,
    origenId,
    descripcion: ac.descripcion,
    responsableId: ac.responsableId,
    responsableNombre: ac.responsableNombre,
    plazoFecha: ac.plazoFecha,
    estado: ac.estado,
  }
}

// --- Datos por rol ---

const SUPERVISOR_KPI_IDS: KpiId[] = ['KPI-02', 'KPI-03', 'KPI-04', 'KPI-05', 'KPI-07']

function buildOperarioData(usuario: MockUser): OperarioDashboardData {
  const qes = getQeStore()
  const incidentes = getIncidentsStore()
  const ncs = getNonconformitiesStore()
  const docs = getDocumentsStore()

  const misIncidentesReportados = incidentes
    .filter((inc) => inc.reportadoPorId === usuario.id)
    .map(toIncidenteResumen)
  const misQEReportados = qes.filter((qe) => qe.reportadoPorId === usuario.id).map(toQEResumen)

  const accionesCorrectivasAsignadas = collectACsWithOrigin(qes, ncs, incidentes)
    .filter(({ ac }) => ac.responsableId === usuario.id)
    .map(({ ac, origenTipo, origenId }) => toACResumen(ac, origenTipo, origenId))

  const documentosPendientesLectura = docs
    .filter((d) => !d.deletedAt && d.estado === 'PUBLICADO' && d.area === usuario.area)
    .map(toDocumentoResumen)

  return { misIncidentesReportados, misQEReportados, accionesCorrectivasAsignadas, documentosPendientesLectura }
}

function buildSupervisorData(usuario: MockUser): SupervisorDashboardData {
  const areas = usuario.areasAsignadas ?? []
  const qes = getQeStore().filter((qe) => areas.includes(qe.areaAfectada))
  const ncs = getNonconformitiesStore().filter((nc) => areas.includes(nc.areaAfectada))
  // Incidente no tiene un campo `area` alineado a AREAS_SHAC (solo localNombre/zonaNombre);
  // se usa como mejor aproximación disponible para el alcance del Supervisor.
  const incidentes = getIncidentsStore().filter(
    (inc) => (!!inc.localNombre && areas.includes(inc.localNombre)) || (!!inc.zonaNombre && areas.includes(inc.zonaNombre)),
  )

  const qePorEstado = qes.reduce<Record<QEStatus, number>>((acc, qe) => {
    acc[qe.estado] = (acc[qe.estado] ?? 0) + 1
    return acc
  }, {} as Record<QEStatus, number>)

  const qeAbiertosPorTipo = qes.reduce<Record<QEType, number>>(
    (acc, qe) => {
      if (qe.estado !== 'CERRADO' && qe.estado !== 'VERIFICADO') {
        acc[qe.tipo] += 1
      }
      return acc
    },
    { CALIDAD: 0, SST: 0, ADUANERO: 0, OPERACIONAL: 0 },
  )

  const qesEnVerificacionArea = qes
    .filter((qe) => qe.estado === 'EN_VERIFICACION' && !!qe.fechaVerificacionProgramada)
    .map(toQEResumen)

  const hoy = Date.now()
  const pendientes = collectACsWithOrigin(qes, ncs, incidentes).filter(({ ac }) => ac.estado !== 'CERRADA')
  const accionesCorrectivasPendientesArea = pendientes.map(({ ac, origenTipo, origenId }) =>
    toACResumen(ac, origenTipo, origenId),
  )
  const vencidas = pendientes.filter(
    ({ ac }) => ac.estado !== 'CERRADA' && ac.estado !== 'COMPLETADA' && new Date(ac.plazoFecha).getTime() < hoy,
  )
  const accionesCorrectivasVencidas = vencidas.map(({ ac, origenTipo, origenId }) => toACResumen(ac, origenTipo, origenId))

  const incidentesRecientes = [...incidentes]
    .sort((a, b) => new Date(b.fechaEvento).getTime() - new Date(a.fechaEvento).getTime())
    .slice(0, 10)
    .map(toIncidenteResumen)

  const semaforoPlazos = pendientes.reduce(
    (acc, { ac }) => {
      const diasRestantes = (new Date(ac.plazoFecha).getTime() - hoy) / 86_400_000
      if (diasRestantes > 5) acc.verde += 1
      else if (diasRestantes >= 1) acc.amarillo += 1
      else acc.rojo += 1
      return acc
    },
    { verde: 0, amarillo: 0, rojo: 0 },
  )

  const kpisArea = calcularKpis(currentPeriodo()).filter((k) => SUPERVISOR_KPI_IDS.includes(k.kpiId))

  return {
    kpisArea,
    qePorEstado,
    qeAbiertosPorTipo,
    qesEnVerificacionArea,
    accionesCorrectivasPendientesArea,
    accionesCorrectivasVencidas,
    incidentesRecientes,
    semaforoPlazos,
  }
}

function buildTendenciaMensualVolumen(qes: QualityEvent[]): JefeCalidadDashboardData['tendenciaMensualVolumen'] {
  return ultimosMeses(12).map((periodo) => {
    const { start, end } = monthRange(periodo)
    return {
      periodo,
      abiertos: qes.filter((qe) => inRange(qe.fechaHoraReporte, start, end)).length,
      cerrados: qes.filter((qe) => inRange(qe.fechaCierre, start, end)).length,
    }
  })
}

function buildTendenciaMensualKpis(
  qes: QualityEvent[],
  ncs: NoConformidad[],
  incidentes: Incidente[],
): JefeCalidadDashboardData['tendenciaMensualKpis'] {
  const meses = ultimosMeses(12)
  return {
    'KPI-01': meses.map((periodo) => ({ periodo, valor: calcularKpi01(qes, periodo) })),
    'KPI-04': meses.map((periodo) => ({ periodo, valor: calcularKpi04(incidentes, periodo) })),
    'KPI-05': meses.map((periodo) => ({ periodo, valor: calcularKpi05(qes, ncs, periodo) })),
  }
}

const ALL_QE_STATUSES: QEStatus[] = [
  'ABIERTO',
  'EN_INVESTIGACION',
  'ANALISIS_COMPLETADO',
  'EN_EJECUCION',
  'PENDIENTE_CIERRE',
  'CERRADO',
  'EN_VERIFICACION',
  'VERIFICADO',
  'REABIERTO',
]

function buildJefeCalidadData(): JefeCalidadDashboardData {
  const qes = getQeStore()
  const ncs = getNonconformitiesStore()
  const incidentes = getIncidentsStore()

  const qeCriticosAbiertos = qes
    .filter((qe) => qe.severidad === 'CRITICA' && qe.estado !== 'CERRADO' && qe.estado !== 'VERIFICADO')
    .map(toQEResumen)

  const ncPendientesVerificacion = ncs
    .filter((nc) => nc.estado === 'CERRADA' && !nc.resultadoVerificacion)
    .map(toNCResumen)

  const distribucionQEPorTipo = qes.reduce<Record<QEType, number>>((acc, qe) => {
    acc[qe.tipo] = (acc[qe.tipo] ?? 0) + 1
    return acc
  }, {} as Record<QEType, number>)

  // Desglose organizacional completo (sin filtro por área ni usuario), a diferencia
  // de buildSupervisorData.qePorEstado que sí filtra por areasAsignadas.
  const qePorEstado = qes.reduce<Record<QEStatus, number>>(
    (acc, qe) => {
      acc[qe.estado] += 1
      return acc
    },
    ALL_QE_STATUSES.reduce((acc, estado) => ({ ...acc, [estado]: 0 }), {} as Record<QEStatus, number>),
  )

  // Origen QE + NC únicamente (INCIDENTE excluido a propósito, ver design.md decisión 2):
  // se pasa un array vacío de incidentes a collectACsWithOrigin.
  const accionesCorrectivasPorVencer = collectACsWithOrigin(qes, ncs, [])
    .filter(
      ({ ac }) =>
        ac.estado !== 'CERRADA' &&
        ac.estado !== 'COMPLETADA' &&
        calcularEstadoSemaforoDesdeFecha(ac.plazoFecha).diasHabilesRestantes <= 5,
    )
    .map(({ ac, origenTipo, origenId }) => toACResumen(ac, origenTipo, origenId))

  return {
    kpis: calcularKpis(currentPeriodo()),
    qeCriticosAbiertos,
    ncPendientesVerificacion,
    distribucionQEPorTipo,
    qePorEstado,
    accionesCorrectivasPorVencer,
    tendenciaMensualVolumen: buildTendenciaMensualVolumen(qes),
    tendenciaMensualKpis: buildTendenciaMensualKpis(qes, ncs, incidentes),
  }
}

function buildTendenciaTrimestral(
  qes: QualityEvent[],
  ncs: NoConformidad[],
): { periodo: string; qeCerrados: number; ncCerradas: number }[] {
  return ultimosTrimestres(4).map((periodo) => {
    const { start, end } = quarterRangeFromLabel(periodo)
    return {
      periodo,
      qeCerrados: qes.filter((qe) => inRange(qe.fechaCierre, start, end)).length,
      ncCerradas: ncs.filter((nc) => inRange(nc.fechaCierre, start, end)).length,
    }
  })
}

function clasificarTendencia(actual: number, anterior: number): 'SUBE' | 'BAJA' | 'ESTABLE' {
  const diff = actual - anterior
  if (Math.abs(diff) < 2) return 'ESTABLE'
  return diff > 0 ? 'SUBE' : 'BAJA'
}

function buildComparativaMensual(
  qes: QualityEvent[],
  ncs: NoConformidad[],
  incidentes: Incidente[],
): AltaDireccionDashboardData['comparativaMensual'] {
  const [mesAnterior, mesActual] = ultimosMeses(2)

  function comparar(actual: number, anterior: number) {
    return { actual, anterior, tendencia: clasificarTendencia(actual, anterior) }
  }

  return {
    'KPI-01': comparar(calcularKpi01(qes, mesActual), calcularKpi01(qes, mesAnterior)),
    'KPI-04': comparar(calcularKpi04(incidentes, mesActual), calcularKpi04(incidentes, mesAnterior)),
    'KPI-05': comparar(calcularKpi05(qes, ncs, mesActual), calcularKpi05(qes, ncs, mesAnterior)),
  }
}

function buildReaperturas(qes: QualityEvent[]): QEReaperturaResumen[] {
  return qes
    .filter((qe) => qe.ciclo > 1)
    .map((qe) => {
      const reaperturas = qe.auditTrail
        .filter((e) => e.estadoNuevo === 'REABIERTO')
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      const fechaReapertura = reaperturas[0]?.timestamp ?? qe.actualizadoEn
      return { ...toQEResumen(qe), ciclo: qe.ciclo, fechaReapertura }
    })
    .sort((a, b) => new Date(b.fechaReapertura).getTime() - new Date(a.fechaReapertura).getTime())
}

function buildAcsConSolicitudAjustePlazo(qes: QualityEvent[]): ACSolicitudAjustePlazoResumen[] {
  return qes
    .filter((qe) => qe.severidad === 'ALTA' || qe.severidad === 'CRITICA')
    .flatMap((qe) =>
      qe.accionesCorrectivas
        .filter((ac) => ac.solicitudesAjustePlazo.some((s) => s.estado === 'PENDIENTE'))
        .map((ac) => ({
          qeId: qe.id,
          qeNumero: qe.numero,
          qeSeveridad: qe.severidad,
          acId: ac.id,
          acDescripcion: ac.descripcion,
          plazoFechaActual: ac.plazoFecha,
          solicitudesAjustePlazo: ac.solicitudesAjustePlazo,
        })),
    )
}

function buildAltaDireccionData(): AltaDireccionDashboardData {
  const qes = getQeStore()
  const docs = getDocumentsStore().filter((d) => !d.deletedAt)
  const ncs = getNonconformitiesStore().filter((nc) => !nc.deletedAt)
  const incidentes = getIncidentsStore().filter((inc) => !inc.deletedAt)

  const qesAbiertos = qes.filter((qe) => qe.estado !== 'CERRADO' && qe.estado !== 'VERIFICADO')
  const qesVencidos = qesAbiertos.filter((qe) => {
    const plazo = plazoMaximoQEPorEstado(qe.estado, qe.severidad)
    if (plazo === undefined) return false
    return contarDiasHabiles(new Date(fechaEntradaEstadoActual(qe)), new Date()) > plazo
  })

  const resumenPorModulo = {
    documentos: {
      total: docs.length,
      publicados: docs.filter((d) => d.estado === 'PUBLICADO').length,
      vencidosRevision: docs.filter(
        (d) => !!d.fechaRevisionProxima && new Date(d.fechaRevisionProxima).getTime() < Date.now(),
      ).length,
    },
    noConformidades: {
      total: ncs.length,
      abiertas: ncs.filter((nc) => nc.estado === 'ABIERTA').length,
      cerradas: ncs.filter((nc) => nc.estado === 'CERRADA').length,
    },
    incidentes: {
      total: incidentes.length,
      conLesionados: incidentes.filter((inc) => inc.huboLesionados).length,
    },
    qualityEvents: {
      total: qes.length,
      criticosAbiertos: qes.filter(
        (qe) => qe.severidad === 'CRITICA' && qe.estado !== 'CERRADO' && qe.estado !== 'VERIFICADO',
      ).length,
      abiertos: qesAbiertos.length,
      vencidos: qesVencidos.length,
    },
  }

  const alertasCriticas = qes
    .filter((qe) => qe.severidad === 'CRITICA' && qe.estado !== 'CERRADO' && qe.estado !== 'VERIFICADO')
    .map(toQEResumen)

  return {
    kpisEstrategicos: calcularKpis(currentPeriodo()),
    resumenPorModulo,
    alertasCriticas,
    tendenciaTrimestral: buildTendenciaTrimestral(qes, ncs),
    comparativaMensual: buildComparativaMensual(qes, ncs, incidentes),
    reaperturas: buildReaperturas(qes),
    acsConSolicitudAjustePlazo: buildAcsConSolicitudAjustePlazo(qes),
  }
}

function buildHallazgosPorNorma(hallazgosO3: QualityEvent[]): AuditorDashboardData['hallazgosPorNorma'] {
  const conteos = new Map<NormaISO, number>()
  for (const qe of hallazgosO3) {
    const norma = qe.normativaVinculada?.norma ?? 'OTRA'
    conteos.set(norma, (conteos.get(norma) ?? 0) + 1)
  }
  return [...conteos.entries()].map(([norma, total]) => ({ norma, total })).sort((a, b) => b.total - a.total)
}

function buildHallazgosPorEstado(hallazgosO3: QualityEvent[]): Record<QEStatus, number> {
  return hallazgosO3.reduce(
    (acc, qe) => {
      acc[qe.estado] += 1
      return acc
    },
    ALL_QE_STATUSES.reduce((acc, estado) => ({ ...acc, [estado]: 0 }), {} as Record<QEStatus, number>),
  )
}

function buildEvidenciasHallazgos(hallazgosO3: QualityEvent[]): AuditorDashboardData['evidenciasHallazgos'] {
  const conEvidencia = hallazgosO3.filter((qe) => qe.documentosVinculados.length > 0).length
  return { conEvidencia, sinEvidencia: hallazgosO3.length - conEvidencia }
}

function buildTasaCierreEnPlazoPorArea(qes: QualityEvent[]): AuditorDashboardData['tasaCierreEnPlazoPorArea'] {
  const { start, end } = monthRange(currentPeriodo())
  const cerrados = qeCerradosEnPeriodo(qes, start, end)

  const porArea = new Map<string, QualityEvent[]>()
  for (const qe of cerrados) {
    const grupo = porArea.get(qe.areaAfectada) ?? []
    grupo.push(qe)
    porArea.set(qe.areaAfectada, grupo)
  }

  return [...porArea.entries()]
    .map(([area, grupo]) => {
      const enPlazo = grupo.filter((qe) => {
        const dias = contarDiasHabiles(new Date(qe.fechaHoraReporte), new Date(qe.fechaCierre!))
        return dias <= PLAZO_MAXIMO_QE_DIAS_HABILES[qe.severidad]
      })
      return { area, tasaCierreEnPlazo: pct(enPlazo.length, grupo.length), totalCerrados: grupo.length }
    })
    .sort((a, b) => a.tasaCierreEnPlazo - b.tasaCierreEnPlazo)
}

function buildJefeControlDocumentarioData(): JefeControlDocDashboardData {
  return {}
}

function buildAuditorData(): AuditorDashboardData {
  const qes = getQeStore()
  const hallazgosO3 = qes.filter((qe) => qe.origen === 'O3_HALLAZGO_AUDITORIA')

  return {
    hallazgosPorNorma: buildHallazgosPorNorma(hallazgosO3),
    hallazgosPorEstado: buildHallazgosPorEstado(hallazgosO3),
    evidenciasHallazgos: buildEvidenciasHallazgos(hallazgosO3),
    tasaCierreEnPlazoPorArea: buildTasaCierreEnPlazoPorArea(qes),
  }
}

function buildDashboardSummary(usuario: MockUser): DashboardSummaryData | undefined {
  const rol = getDashboardDataTypeForRole(usuario.rol)
  if (!rol) return undefined

  switch (rol) {
    case 'OPERARIO':
      return { rol, data: buildOperarioData(usuario) }
    case 'SUPERVISOR':
      return { rol, data: buildSupervisorData(usuario) }
    case 'JEFE_CALIDAD':
      return { rol, data: buildJefeCalidadData() }
    case 'ALTA_DIRECCION':
      return { rol, data: buildAltaDireccionData() }
    case 'AUDITOR':
      return { rol, data: buildAuditorData() }
    case 'JEFE_CONTROL_DOC':
      return { rol, data: buildJefeControlDocumentarioData() }
  }
}

export const dashboardHandlers = [
  http.get('/api/dashboard/kpis', async ({ request }) => {
    await delay(LATENCY)
    const url = new URL(request.url)
    const periodo = url.searchParams.get('periodo') ?? currentPeriodo()
    return HttpResponse.json({ success: true, data: calcularKpis(periodo) })
  }),

  http.get('/api/dashboard/summary', async ({ request }) => {
    await delay(LATENCY)
    const usuario = getUserFromRequest(request)
    if (!usuario) {
      return HttpResponse.json({ success: false, data: null, message: 'No autenticado' }, { status: 401 })
    }

    const summary = buildDashboardSummary(usuario)
    if (!summary) {
      return HttpResponse.json(
        { success: false, data: null, message: 'Rol sin acceso al dashboard' },
        { status: 403 },
      )
    }

    return HttpResponse.json({ success: true, data: summary })
  }),
]
