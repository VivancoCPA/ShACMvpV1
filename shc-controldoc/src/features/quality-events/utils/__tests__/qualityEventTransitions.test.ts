import { describe, it, expect } from 'vitest'
import { getValidQETransitions } from '../qualityEventTransitions'

describe('getValidQETransitions', () => {
  it('ABIERTO → EN_INVESTIGACION', () => {
    expect(getValidQETransitions('ABIERTO')).toEqual(['EN_INVESTIGACION'])
  })

  it('EN_INVESTIGACION → ANALISIS_COMPLETADO', () => {
    expect(getValidQETransitions('EN_INVESTIGACION')).toEqual(['ANALISIS_COMPLETADO'])
  })

  it('ANALISIS_COMPLETADO → EN_EJECUCION', () => {
    expect(getValidQETransitions('ANALISIS_COMPLETADO')).toEqual(['EN_EJECUCION'])
  })

  it('EN_EJECUCION → PENDIENTE_CIERRE', () => {
    expect(getValidQETransitions('EN_EJECUCION')).toEqual(['PENDIENTE_CIERRE'])
  })

  it('PENDIENTE_CIERRE → CERRADO', () => {
    expect(getValidQETransitions('PENDIENTE_CIERRE')).toEqual(['CERRADO'])
  })

  it('CERRADO → EN_VERIFICACION', () => {
    expect(getValidQETransitions('CERRADO')).toEqual(['EN_VERIFICACION'])
  })

  it('EN_VERIFICACION → VERIFICADO | REABIERTO', () => {
    const transitions = getValidQETransitions('EN_VERIFICACION')
    expect(transitions).toContain('VERIFICADO')
    expect(transitions).toContain('REABIERTO')
    expect(transitions).toHaveLength(2)
  })

  it('VERIFICADO is terminal (empty array)', () => {
    expect(getValidQETransitions('VERIFICADO')).toEqual([])
  })

  it('REABIERTO → EN_INVESTIGACION', () => {
    expect(getValidQETransitions('REABIERTO')).toEqual(['EN_INVESTIGACION'])
  })
})
