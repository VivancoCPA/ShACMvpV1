import { describe, it, expect } from 'vitest'
import { resolverPolitica, validarParametros, validarSeguridadEmpresa } from './politicaSesion'
import { PARAMETROS_SESION_SEMILLA as semilla } from '../../../mocks/fixtures/sesion.fixtures'

describe('resolverPolitica', () => {
  it('sin valores de empresa usa el default global', () => {
    expect(resolverPolitica(semilla)).toEqual({ inactividadMinutos: 30, sesionMaximaHoras: 12 })
  })

  it('usa el valor de la empresa cuando existe', () => {
    expect(resolverPolitica(semilla, 5, null)).toEqual({ inactividadMinutos: 5, sesionMaximaHoras: 12 })
  })

  it('ajusta al límite más cercano un valor que quedó fuera de rango', () => {
    const endurecido = { ...semilla, inactividadMaxMinutos: 60 }
    expect(resolverPolitica(endurecido, 200, null).inactividadMinutos).toBe(60)
  })

  it('nunca devuelve una inactividad mayor que la sesión máxima', () => {
    const raro = { ...semilla, inactividadMinMinutos: 120, inactividadDefaultMinutos: 120 }
    expect(resolverPolitica(raro, null, 1)).toEqual({ inactividadMinutos: 60, sesionMaximaHoras: 1 })
  })
})

describe('validarSeguridadEmpresa', () => {
  it('acepta valores dentro de rango y null', () => {
    expect(validarSeguridadEmpresa(semilla, 5, null)).toEqual({})
  })

  it('rechaza inactividad fuera de rango', () => {
    expect(validarSeguridadEmpresa(semilla, 2, null)).toHaveProperty('inactividadMinutos')
  })

  it('rechaza sesión máxima menor que la inactividad', () => {
    expect(validarSeguridadEmpresa(semilla, 120, 1)).toHaveProperty('sesionMaximaHoras')
  })
})

describe('validarParametros', () => {
  it('acepta la semilla', () => {
    expect(validarParametros(semilla)).toEqual({})
  })

  it('rechaza un mínimo bajo el piso absoluto de 5 min', () => {
    expect(validarParametros({ ...semilla, inactividadMinMinutos: 1 })).toHaveProperty('inactividadMinMinutos')
  })

  it('rechaza un default fuera de sus límites', () => {
    expect(validarParametros({ ...semilla, inactividadDefaultMinutos: 300 })).toHaveProperty('inactividadDefaultMinutos')
  })
})
