import { calcularDiasHabilesRestantes } from '../../utils/businessDays'
import type { QualityEvent } from '../../features/quality-events/types/qualityEvent.types'
import type { NoConformidad } from '../../features/nonconformities/types/nonconformity.types'
import type { Incidente } from '../../features/incidents/types/incident.types'
import { inicioDiaLimaUtc, rangoMesActualLima } from '../../features/acciones-correctivas/utils/limaFechas'
import type {
  ACEstadoNormalizado,
  ACListadoContadores,
  ACOrigenTipo,
  AccionCorrectivaListadoItem,
} from '../../features/acciones-correctivas/types/accionesCorrectivasListado.types'

// Única definición de "AC vencida" en MSW (espejo de DashboardKpiCalculator.EsAcVencida): la usan
// KPI-08 y las listas de AC vencidas del dashboard (dashboard-alertas-coherentes D4) y el listado
// de acciones correctivas (modulo-acciones-correctivas D14). Se evalúa sobre el estado ORIGINAL.
export function esAcVencida(ac: { estado: string; plazoFecha: string }, ahora: number): boolean {
  return ac.estado !== 'CERRADA' && ac.estado !== 'COMPLETADA' && new Date(ac.plazoFecha).getTime() < ahora
}

// D2: VENCIDA de NC no es un estado normalizado (no se sabe si se llegó a iniciar).
export function normalizarEstadoAC(estado: string): ACEstadoNormalizado {
  switch (estado) {
    case 'PENDIENTE':
      return 'PENDIENTE'
    case 'COMPLETADA':
      return 'PENDIENTE_VERIFICACION'
    case 'CERRADA':
      return 'CERRADA'
    default:
      return 'EN_EJECUCION'
  }
}

interface ACOrigenCrudo {
  id: string
  titulo?: string
  descripcion: string
  tipo: AccionCorrectivaListadoItem['tipo']
  prioridad?: string
  responsableId: string
  responsableNombre: string
  plazoFecha: string
  estado: string
  creadoEn: string
  fechaCierre?: string
  ejecutadaEn?: string | null
  verificadaEn?: string | null
  verificadaPorNombre?: string | null
}

function toItem(
  ac: ACOrigenCrudo,
  origen: { tipo: ACOrigenTipo; id: string; numero: string; areaId: string },
  areaNombre: (areaId: string) => string | null,
  ahora: number,
): AccionCorrectivaListadoItem {
  const esQe = origen.tipo === 'QE'
  return {
    id: ac.id,
    origenTipo: origen.tipo,
    origenId: origen.id,
    origenNumero: origen.numero,
    titulo: ac.titulo ?? '',
    descripcion: ac.descripcion,
    tipo: ac.tipo ?? 'CORRECTIVA',
    prioridad: ac.prioridad ?? '',
    responsableId: ac.responsableId,
    responsableNombre: ac.responsableNombre,
    areaId: origen.areaId,
    areaNombre: areaNombre(origen.areaId),
    plazoFecha: ac.plazoFecha,
    estadoNormalizado: normalizarEstadoAC(ac.estado),
    estadoOriginal: ac.estado,
    ejecutadaEn: esQe ? (ac.ejecutadaEn ?? null) : null,
    verificadaEn: esQe ? (ac.verificadaEn ?? null) : null,
    verificadaPorNombre: esQe ? (ac.verificadaPorNombre ?? null) : null,
    creadoEn: ac.creadoEn,
    // D5: en QE, verificar cierra la AC — verificadaEn es la fecha de cierre si fechaCierre falta.
    fechaCierre: ac.fechaCierre ?? (esQe ? (ac.verificadaEn ?? null) : null),
    vencida: esAcVencida(ac, ahora),
    diasHabilesRestantes: calcularDiasHabilesRestantes(new Date(ahora), new Date(ac.plazoFecha)),
  }
}

// Une las AC de los tres orígenes (ya acotados a la empresa activa por el caller), excluyendo
// orígenes eliminados — mismo universo que AccionesCorrectivasQuery en el backend.
export function unificarAccionesCorrectivas(
  qes: QualityEvent[],
  ncs: NoConformidad[],
  incidentes: Incidente[],
  areaNombre: (areaId: string) => string | null,
  ahora: number = Date.now(),
): AccionCorrectivaListadoItem[] {
  return [
    ...qes
      .filter((qe) => !qe.deletedAt)
      .flatMap((qe) =>
        qe.accionesCorrectivas.map((ac) =>
          toItem(ac, { tipo: 'QE', id: qe.id, numero: qe.numero, areaId: qe.areaId }, areaNombre, ahora),
        ),
      ),
    ...ncs
      .filter((nc) => !nc.deletedAt)
      .flatMap((nc) =>
        nc.accionesCorrectivas.map((ac) =>
          toItem(ac, { tipo: 'NC', id: nc.id, numero: nc.numero, areaId: nc.areaId }, areaNombre, ahora),
        ),
      ),
    ...incidentes
      .filter((inc) => !inc.deletedAt)
      .flatMap((inc) =>
        (inc.accionesCorrectivas ?? []).map((ac) =>
          toItem(ac, { tipo: 'INCIDENTE', id: inc.id, numero: inc.numero, areaId: inc.areaId }, areaNombre, ahora),
        ),
      ),
  ]
}

// --- Filtros, contadores y orden del listado (espejo de AccionesCorrectivasFiltros, D4/D7) ---

export const AC_PAGE_SIZE_DEFAULT = 25
export const AC_PAGE_SIZE_MAX = 100
export const AC_EXPORT_MAX_FILAS = 5000
const POR_VENCER_DIAS_HABILES = 5
const DIA_MS = 24 * 60 * 60 * 1000

const ESTADOS: readonly ACEstadoNormalizado[] = ['PENDIENTE', 'EN_EJECUCION', 'PENDIENTE_VERIFICACION', 'CERRADA']
const TIPOS: readonly string[] = ['CORRECTIVA', 'PREVENTIVA', 'MEJORA']
const ORIGENES: readonly ACOrigenTipo[] = ['QE', 'NC', 'INCIDENTE']
const ORDENES: readonly string[] = ['plazo', 'creado', 'estado']

export interface ACFiltrosMock {
  estados: ACEstadoNormalizado[]
  vencida: boolean | null
  porVencer: boolean | null
  tipo: string | null
  origenTipo: ACOrigenTipo | null
  responsableId: string | null
  areaId: string | null
  plazoDesde: string | null
  plazoHasta: string | null
  creadaDesde: string | null
  creadaHasta: string | null
  cerradaDesde: string | null
  cerradaHasta: string | null
  search: string | null
  orden: string
  desc: boolean
  page: number
  pageSize: number
}

function esEstadoNormalizado(v: string): v is ACEstadoNormalizado {
  return (ESTADOS as readonly string[]).includes(v)
}

function esOrigenTipo(v: string): v is ACOrigenTipo {
  return (ORIGENES as readonly string[]).includes(v)
}

function parseBool(v: string | null, nombre: string): boolean | null {
  if (v === null) return null
  if (v === 'true') return true
  if (v === 'false') return false
  throw new Error(`El parámetro '${nombre}' debe ser true o false.`)
}

/** Lanza `Error` con el mensaje del 400 ante un valor inválido. */
export function parseFiltrosAC(params: URLSearchParams, paginar = true): ACFiltrosMock {
  const crudos = params
    .getAll('estado')
    .flatMap((e) => e.split(','))
    .map((e) => e.trim())
    .filter(Boolean)
  const invalido = crudos.find((e) => !esEstadoNormalizado(e))
  if (invalido) throw new Error(`El parámetro 'estado' admite ${ESTADOS.join(', ')}; se recibió '${invalido}'.`)
  const estados = [...new Set(crudos.filter(esEstadoNormalizado))]

  const tipo = params.get('tipo')
  if (tipo !== null && !TIPOS.includes(tipo)) throw new Error("El parámetro 'tipo' debe ser CORRECTIVA, PREVENTIVA o MEJORA.")
  const origenRaw = params.get('origenTipo')
  if (origenRaw !== null && !esOrigenTipo(origenRaw)) throw new Error("El parámetro 'origenTipo' debe ser QE, NC o INCIDENTE.")
  const orden = params.get('orden') ?? 'plazo'
  if (!ORDENES.includes(orden)) throw new Error("El parámetro 'orden' debe ser plazo, creado o estado.")
  const dir = params.get('dir')
  if (dir !== null && dir !== 'asc' && dir !== 'desc') throw new Error("El parámetro 'dir' debe ser asc o desc.")

  const page = Number(params.get('page') ?? 1)
  const pageSize = Number(params.get('pageSize') ?? AC_PAGE_SIZE_DEFAULT)
  if (paginar) {
    if (!Number.isInteger(page) || page < 1) throw new Error("El parámetro 'page' debe ser mayor o igual a 1.")
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > AC_PAGE_SIZE_MAX)
      throw new Error(`El parámetro 'pageSize' debe estar entre 1 y ${AC_PAGE_SIZE_MAX}.`)
  }

  return {
    estados,
    vencida: parseBool(params.get('vencida'), 'vencida'),
    porVencer: parseBool(params.get('porVencer'), 'porVencer'),
    tipo,
    origenTipo: origenRaw !== null && esOrigenTipo(origenRaw) ? origenRaw : null,
    responsableId: params.get('responsableId') || null,
    areaId: params.get('areaId') || null,
    plazoDesde: params.get('plazoDesde'),
    plazoHasta: params.get('plazoHasta'),
    creadaDesde: params.get('creadaDesde'),
    creadaHasta: params.get('creadaHasta'),
    cerradaDesde: params.get('cerradaDesde'),
    cerradaHasta: params.get('cerradaHasta'),
    search: params.get('search')?.trim() || null,
    orden,
    desc: dir === 'desc',
    page,
    pageSize,
  }
}

/** Filtros base: en el backend van a SQL y también acotan los contadores. */
export function aplicarFiltrosBaseAC(items: AccionCorrectivaListadoItem[], f: ACFiltrosMock): AccionCorrectivaListadoItem[] {
  const s = f.search?.toLowerCase()
  return items.filter(
    (a) =>
      (!f.tipo || a.tipo === f.tipo) &&
      (!f.origenTipo || a.origenTipo === f.origenTipo) &&
      (!f.responsableId || a.responsableId === f.responsableId) &&
      (!f.areaId || a.areaId === f.areaId) &&
      // Plazo: fecha de calendario, rango inclusivo.
      (!f.plazoDesde || a.plazoFecha.slice(0, 10) >= f.plazoDesde) &&
      (!f.plazoHasta || a.plazoFecha.slice(0, 10) <= f.plazoHasta) &&
      // Creación: días de calendario en Lima.
      (!f.creadaDesde || new Date(a.creadoEn).getTime() >= inicioDiaLimaUtc(f.creadaDesde)) &&
      (!f.creadaHasta || new Date(a.creadoEn).getTime() < inicioDiaLimaUtc(f.creadaHasta) + DIA_MS) &&
      (!s ||
        a.descripcion.toLowerCase().includes(s) ||
        a.titulo.toLowerCase().includes(s) ||
        a.origenNumero.toLowerCase().includes(s)),
  )
}

function esAbierta(a: AccionCorrectivaListadoItem): boolean {
  return a.estadoNormalizado === 'PENDIENTE' || a.estadoNormalizado === 'EN_EJECUCION'
}

export function esPorVencerAC(a: AccionCorrectivaListadoItem): boolean {
  return !a.vencida && esAbierta(a) && a.diasHabilesRestantes <= POR_VENCER_DIAS_HABILES
}

interface RangoMs {
  desde: number
  hastaExcl: number
}

function rangoCierre(f: ACFiltrosMock, ahora: Date): RangoMs {
  if (!f.cerradaDesde && !f.cerradaHasta) {
    const mes = rangoMesActualLima(ahora)
    return { desde: inicioDiaLimaUtc(mes.desde), hastaExcl: inicioDiaLimaUtc(mes.hasta) + DIA_MS }
  }
  return {
    desde: f.cerradaDesde ? inicioDiaLimaUtc(f.cerradaDesde) : -Infinity,
    hastaExcl: f.cerradaHasta ? inicioDiaLimaUtc(f.cerradaHasta) + DIA_MS : Infinity,
  }
}

function cerradaEnRango(a: AccionCorrectivaListadoItem, r: RangoMs): boolean {
  if (!a.fechaCierre) return false
  const ms = new Date(a.fechaCierre).getTime()
  return ms >= r.desde && ms < r.hastaExcl
}

/** Filtros de estado: solo filtran filas, nunca cambian los contadores. */
export function aplicarFiltrosDeEstadoAC(
  items: AccionCorrectivaListadoItem[],
  f: ACFiltrosMock,
  ahora: Date,
): AccionCorrectivaListadoItem[] {
  const rango = f.cerradaDesde || f.cerradaHasta ? rangoCierre(f, ahora) : null
  return items.filter(
    (a) =>
      (f.estados.length === 0 || f.estados.includes(a.estadoNormalizado)) &&
      (f.vencida === null || a.vencida === f.vencida) &&
      (f.porVencer === null || esPorVencerAC(a) === f.porVencer) &&
      (!rango || cerradaEnRango(a, rango)),
  )
}

export function contarAC(base: AccionCorrectivaListadoItem[], f: ACFiltrosMock, ahora: Date): ACListadoContadores {
  const rango = rangoCierre(f, ahora)
  return {
    abiertas: base.filter(esAbierta).length,
    enEjecucion: base.filter((a) => a.estadoNormalizado === 'EN_EJECUCION').length,
    pendientesVerificacion: base.filter((a) => a.estadoNormalizado === 'PENDIENTE_VERIFICACION').length,
    porVencer: base.filter(esPorVencerAC).length,
    vencidas: base.filter((a) => a.vencida).length,
    cerradasPeriodo: base.filter((a) => a.estadoNormalizado === 'CERRADA' && cerradaEnRango(a, rango)).length,
  }
}

function ms(iso: string): number {
  return new Date(iso).getTime()
}

/** D7: plazo (vencidas primero, luego plazo asc), creado (desc), estado (orden del flujo, luego plazo). */
export function ordenarAC(items: AccionCorrectivaListadoItem[], f: ACFiltrosMock): AccionCorrectivaListadoItem[] {
  const s = f.desc ? -1 : 1
  const porId = (a: AccionCorrectivaListadoItem, b: AccionCorrectivaListadoItem) => a.id.localeCompare(b.id)
  const cmp = (a: AccionCorrectivaListadoItem, b: AccionCorrectivaListadoItem): number => {
    if (f.orden === 'creado') return -s * (ms(a.creadoEn) - ms(b.creadoEn)) || porId(a, b)
    if (f.orden === 'estado')
      return (
        s * (ESTADOS.indexOf(a.estadoNormalizado) - ESTADOS.indexOf(b.estadoNormalizado)) ||
        ms(a.plazoFecha) - ms(b.plazoFecha) ||
        porId(a, b)
      )
    return s * (Number(b.vencida) - Number(a.vencida)) || s * (ms(a.plazoFecha) - ms(b.plazoFecha)) || porId(a, b)
  }
  return [...items].sort(cmp)
}
