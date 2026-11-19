import { isAccionCorrectivaTipo } from '../../../constants/accionCorrectivaTipo.constants'
import { rangoMesActualLima } from './limaFechas'
import {
  AC_ESTADOS_NORMALIZADOS,
  AC_ORIGEN_TIPOS,
  type ACEstadoNormalizado,
  type ACListadoContadores,
  type ACListadoFiltros,
  type ACListadoOrden,
  type ACOrigenTipo,
} from '../types/accionesCorrectivasListado.types'

// Filtros del listado de AC ↔ URL (modulo-acciones-correctivas): la URL es la única fuente de
// verdad, para que los filtros sobrevivan a F5 y se puedan compartir. Valores desconocidos se ignoran.

export const AC_PAGE_SIZE = 25

const ORDENES: readonly ACListadoOrden[] = ['plazo', 'creado', 'estado']
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/
const CLAVES_FECHA = ['plazoDesde', 'plazoHasta', 'creadaDesde', 'creadaHasta', 'cerradaDesde', 'cerradaHasta'] as const

function esEstado(v: string): v is ACEstadoNormalizado {
  return (AC_ESTADOS_NORMALIZADOS as readonly string[]).includes(v)
}

function esOrigen(v: string | null): v is ACOrigenTipo {
  return v !== null && (AC_ORIGEN_TIPOS as readonly string[]).includes(v)
}

function esOrden(v: string | null): v is ACListadoOrden {
  return v !== null && (ORDENES as readonly string[]).includes(v)
}

export function filtrosDesdeUrl(params: URLSearchParams): ACListadoFiltros {
  const f: ACListadoFiltros = {}
  const estados = (params.get('estado') ?? '').split(',').filter(esEstado)
  if (estados.length > 0) f.estado = [...new Set(estados)]
  if (params.get('vencida') === 'true') f.vencida = true
  if (params.get('porVencer') === 'true') f.porVencer = true
  const tipo = params.get('tipo')
  if (isAccionCorrectivaTipo(tipo)) f.tipo = tipo
  const origen = params.get('origenTipo')
  if (esOrigen(origen)) f.origenTipo = origen
  const responsableId = params.get('responsableId')
  if (responsableId) f.responsableId = responsableId
  const areaId = params.get('areaId')
  if (areaId) f.areaId = areaId
  for (const clave of CLAVES_FECHA) {
    const v = params.get(clave)
    if (v && FECHA_RE.test(v)) f[clave] = v
  }
  const search = params.get('search')?.trim()
  if (search) f.search = search
  const orden = params.get('orden')
  if (esOrden(orden)) f.orden = orden
  if (params.get('dir') === 'desc') f.dir = 'desc'
  const page = Number(params.get('page'))
  f.page = Number.isInteger(page) && page > 1 ? page : 1
  f.pageSize = AC_PAGE_SIZE
  return f
}

/** Serializa a URL omitiendo valores por defecto (page 1, pageSize, orden plazo asc). */
export function filtrosAUrl(f: ACListadoFiltros): URLSearchParams {
  const p = new URLSearchParams()
  if (f.estado?.length) p.set('estado', f.estado.join(','))
  if (f.vencida) p.set('vencida', 'true')
  if (f.porVencer) p.set('porVencer', 'true')
  if (f.tipo) p.set('tipo', f.tipo)
  if (f.origenTipo) p.set('origenTipo', f.origenTipo)
  if (f.responsableId) p.set('responsableId', f.responsableId)
  if (f.areaId) p.set('areaId', f.areaId)
  for (const clave of CLAVES_FECHA) {
    const v = f[clave]
    if (v) p.set(clave, v)
  }
  if (f.search) p.set('search', f.search)
  if (f.orden && f.orden !== 'plazo') p.set('orden', f.orden)
  if (f.dir === 'desc') p.set('dir', 'desc')
  if (f.page && f.page > 1) p.set('page', String(f.page))
  return p
}

// --- Tarjetas de contadores (D4): cada una fija los filtros de estado y nada más ---

export type ACContadorClave = keyof ACListadoContadores

type FiltrosDeEstado = Pick<ACListadoFiltros, 'estado' | 'vencida' | 'porVencer' | 'cerradaDesde' | 'cerradaHasta'>

export function filtrosDeEstadoDeTarjeta(clave: ACContadorClave, ahora: Date = new Date()): FiltrosDeEstado {
  switch (clave) {
    case 'abiertas':
      return { estado: ['PENDIENTE', 'EN_EJECUCION'] }
    case 'enEjecucion':
      return { estado: ['EN_EJECUCION'] }
    case 'pendientesVerificacion':
      return { estado: ['PENDIENTE_VERIFICACION'] }
    case 'porVencer':
      return { porVencer: true }
    case 'vencidas':
      return { vencida: true }
    case 'cerradasPeriodo': {
      const mes = rangoMesActualLima(ahora)
      return { estado: ['CERRADA'], cerradaDesde: mes.desde, cerradaHasta: mes.hasta }
    }
  }
}

function clavesDeEstado(f: FiltrosDeEstado): string {
  return JSON.stringify([
    [...(f.estado ?? [])].sort(),
    f.vencida ?? false,
    f.porVencer ?? false,
    f.cerradaDesde ?? null,
    f.cerradaHasta ?? null,
  ])
}

export function tarjetaActiva(f: ACListadoFiltros, clave: ACContadorClave, ahora: Date = new Date()): boolean {
  return clavesDeEstado(f) === clavesDeEstado(filtrosDeEstadoDeTarjeta(clave, ahora))
}

function sinFiltrosDeEstado(f: ACListadoFiltros): ACListadoFiltros {
  const { estado: _e, vencida: _v, porVencer: _p, cerradaDesde: _cd, cerradaHasta: _ch, ...resto } = f
  void _e
  void _v
  void _p
  void _cd
  void _ch
  return resto
}

/** Clic en una tarjeta: reemplaza los filtros de estado por los suyos; segundo clic los quita. Vuelve a página 1. */
export function alternarTarjeta(f: ACListadoFiltros, clave: ACContadorClave, ahora: Date = new Date()): ACListadoFiltros {
  const base = { ...sinFiltrosDeEstado(f), page: 1 }
  return tarjetaActiva(f, clave, ahora) ? base : { ...base, ...filtrosDeEstadoDeTarjeta(clave, ahora) }
}

// --- Navegación al origen (D10) ---

export function rutaOrigenAC(origenTipo: ACOrigenTipo, origenId: string): string {
  switch (origenTipo) {
    case 'QE':
      return `/quality-events/${origenId}#qe-ac-section`
    case 'NC':
      return `/nonconformities/${origenId}`
    case 'INCIDENTE':
      return `/incidents/${origenId}`
  }
}

