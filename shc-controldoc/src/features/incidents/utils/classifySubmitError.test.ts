import { describe, it, expect } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { classifySubmitError } from './classifySubmitError'

function buildAxiosError(overrides: Partial<AxiosError> = {}): AxiosError {
  const error = new AxiosError('mensaje', overrides.code, {
    headers: new AxiosHeaders(),
  } as never)
  return Object.assign(error, overrides)
}

describe('classifySubmitError', () => {
  it('clasifica como network cuando error.code es ERR_NETWORK', () => {
    const error = buildAxiosError({ code: 'ERR_NETWORK' })
    expect(classifySubmitError(error)).toBe('network')
  })

  it('clasifica como network cuando no hay error.response', () => {
    const error = buildAxiosError({ code: undefined, response: undefined })
    expect(classifySubmitError(error)).toBe('network')
  })

  it('clasifica como invalid-envelope ante el bug de coordinación de Service Workers', () => {
    const error = buildAxiosError({
      code: 'ERR_INVALID_RESPONSE_ENVELOPE',
      response: { status: 200, data: '<html></html>' } as never,
    })
    expect(classifySubmitError(error)).toBe('invalid-envelope')
  })

  it('clasifica como server cuando hay error.response de un error real (4xx/5xx)', () => {
    const error = buildAxiosError({
      code: undefined,
      response: { status: 400, data: { message: 'Descripción muy corta' } } as never,
    })
    expect(classifySubmitError(error)).toBe('server')
  })

  it('clasifica como server ante un error que no es de axios', () => {
    expect(classifySubmitError(new Error('otro error'))).toBe('server')
    expect(classifySubmitError('string error')).toBe('server')
    expect(classifySubmitError(undefined)).toBe('server')
  })
})
