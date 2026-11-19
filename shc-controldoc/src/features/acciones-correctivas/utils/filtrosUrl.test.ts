import { describe, expect, it } from 'vitest'
import { alternarTarjeta, filtrosAUrl, filtrosDesdeUrl, rutaOrigenAC, tarjetaActiva } from './filtrosUrl'
import { rangoMesActualLima } from './limaFechas'
import { isRouteAllowedForRole } from '../../../router/routeAccess'

describe('filtrosUrl', () => {
  it('ida y vuelta por la URL conserva los filtros (sobreviven a F5)', () => {
    const params = new URLSearchParams(
      'estado=PENDIENTE,EN_EJECUCION&origenTipo=INCIDENTE&tipo=MEJORA&areaId=area-001&plazoDesde=2026-11-01&search=balanza&orden=estado&dir=desc&page=3',
    )
    const f = filtrosDesdeUrl(params)
    expect(f).toMatchObject({
      estado: ['PENDIENTE', 'EN_EJECUCION'],
      origenTipo: 'INCIDENTE',
      tipo: 'MEJORA',
      areaId: 'area-001',
      plazoDesde: '2026-11-01',
      search: 'balanza',
      orden: 'estado',
      dir: 'desc',
      page: 3,
      pageSize: 25,
    })
    expect(filtrosDesdeUrl(filtrosAUrl(f))).toEqual(f)
  })

  it('ignora valores desconocidos', () => {
    const f = filtrosDesdeUrl(new URLSearchParams('estado=VENCIDA&origenTipo=XYZ&tipo=OTRA&plazoDesde=ayer&page=-2'))
    expect(f).toEqual({ page: 1, pageSize: 25 })
  })

  it('clic en Vencidas pone vencida=true y un segundo clic lo quita', () => {
    const base = filtrosDesdeUrl(new URLSearchParams('origenTipo=QE&estado=CERRADA&page=4'))
    const conVencidas = alternarTarjeta(base, 'vencidas')
    expect(conVencidas).toMatchObject({ origenTipo: 'QE', vencida: true, page: 1 })
    expect(conVencidas.estado).toBeUndefined()
    expect(filtrosAUrl(conVencidas).toString()).toBe('vencida=true&origenTipo=QE')
    expect(tarjetaActiva(conVencidas, 'vencidas')).toBe(true)
    expect(tarjetaActiva(conVencidas, 'porVencer')).toBe(false)

    const sinVencidas = alternarTarjeta(conVencidas, 'vencidas')
    expect(sinVencidas.vencida).toBeUndefined()
    expect(tarjetaActiva(sinVencidas, 'vencidas')).toBe(false)
  })

  it('Abiertas está activa con los dos estados en cualquier orden; En ejecución no', () => {
    const f = filtrosDesdeUrl(new URLSearchParams('estado=EN_EJECUCION,PENDIENTE'))
    expect(tarjetaActiva(f, 'abiertas')).toBe(true)
    expect(tarjetaActiva(f, 'enEjecucion')).toBe(false)
  })

  it('Cerradas fija estado CERRADA y el rango del mes actual en Lima', () => {
    const ahora = new Date('2026-12-01T03:00:00Z') // 30/11 22:00 en Lima
    expect(rangoMesActualLima(ahora)).toEqual({ desde: '2026-11-01', hasta: '2026-11-30' })
    const f = alternarTarjeta({ page: 1 }, 'cerradasPeriodo', ahora)
    expect(f).toMatchObject({ estado: ['CERRADA'], cerradaDesde: '2026-11-01', cerradaHasta: '2026-11-30' })
    expect(tarjetaActiva(f, 'cerradasPeriodo', ahora)).toBe(true)
  })

  it('ruta al origen y acceso por rol', () => {
    expect(rutaOrigenAC('QE', 'qe-1')).toBe('/quality-events/qe-1#qe-ac-section')
    expect(rutaOrigenAC('NC', 'nc-1')).toBe('/nonconformities/nc-1')
    expect(rutaOrigenAC('INCIDENTE', 'inc-1')).toBe('/incidents/inc-1')
    expect(isRouteAllowedForRole('/nonconformities/nc-1', 'OPERARIO')).toBe(false)
    expect(isRouteAllowedForRole('/quality-events/qe-1', 'OPERARIO')).toBe(true)
  })

  it('/acciones-correctivas: los 6 roles operativos sí, administración no', () => {
    for (const rol of ['OPERARIO', 'SUPERVISOR', 'JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'AUDITOR_INTERNO', 'ALTA_DIRECCION'] as const) {
      expect(isRouteAllowedForRole('/acciones-correctivas', rol)).toBe(true)
    }
    for (const rol of ['ADMINISTRADOR_SISTEMA', 'ADMINISTRADOR_EMPRESA', 'SUPERADMIN'] as const) {
      expect(isRouteAllowedForRole('/acciones-correctivas', rol)).toBe(false)
      expect(isRouteAllowedForRole('/acciones-correctivas/ac-1', rol)).toBe(false)
    }
  })
})
