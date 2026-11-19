import { describe, it, expect } from 'vitest'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { getServerErrorMessage } from './serverErrorMessage'

function axiosErrorWith(status: number, data: unknown): AxiosError {
  const response: AxiosResponse = {
    status,
    statusText: '',
    data,
    headers: {},
    config: { headers: new AxiosHeaders() },
  }
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, response)
}

describe('getServerErrorMessage', () => {
  it('devuelve el message del servidor ante un 400', () => {
    const error = axiosErrorWith(400, { success: false, message: "Valor inválido en el campo 'turno'." })
    expect(getServerErrorMessage(error, 'genérico')).toBe("Valor inválido en el campo 'turno'.")
  })

  it('usa el fallback ante un 500 aunque traiga message', () => {
    const error = axiosErrorWith(500, { success: false, message: 'Error interno del servidor.' })
    expect(getServerErrorMessage(error, 'genérico')).toBe('genérico')
  })

  it('usa el fallback ante un 400 sin message', () => {
    expect(getServerErrorMessage(axiosErrorWith(400, ''), 'genérico')).toBe('genérico')
  })

  it('usa el fallback para errores que no son de Axios', () => {
    expect(getServerErrorMessage(new Error('boom'), 'genérico')).toBe('genérico')
  })
})
