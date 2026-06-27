import { describe, it, expect } from 'vitest'
import { createNCSchema } from './createNC.schema'

const validPayload = {
  dominio: 'CALIDAD' as const,
  origen: 'INSPECCION_INTERNA' as const,
  tipo: 'PROCESO' as const,
  severidad: 'BAJA' as const,
  titulo: 'Desvío en procedimiento de pesaje',
  areaAfectada: 'Almacén de minerales',
  descripcion: 'Descripción válida con más de diez caracteres.',
  fechaDeteccion: '2025-01-15',
  fechaCierre: '2025-02-15',
}

describe('createNCSchema', () => {
  it('accepts a valid payload', () => {
    const result = createNCSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('defaults documentosVinculados to []', () => {
    const result = createNCSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.documentosVinculados).toEqual([])
    }
  })

  it('rejects missing origen', () => {
    const { origen: _origen, ...withoutOrigen } = validPayload
    const result = createNCSchema.safeParse(withoutOrigen)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('origen')
    }
  })

  it('rejects missing titulo', () => {
    const { titulo: _titulo, ...withoutTitulo } = validPayload
    const result = createNCSchema.safeParse(withoutTitulo)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('titulo')
    }
  })

  it('rejects missing fechaCierre', () => {
    const { fechaCierre: _fechaCierre, ...withoutFechaCierre } = validPayload
    const result = createNCSchema.safeParse(withoutFechaCierre)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('fechaCierre')
    }
  })

  it('rejects descripcion shorter than 10 characters', () => {
    const result = createNCSchema.safeParse({ ...validPayload, descripcion: 'Corto' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('descripcion')
    }
  })

  it('accepts valid payload without optional fields', () => {
    const result = createNCSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.mineralInvolucrado).toBeUndefined()
      expect(result.data.turno).toBeUndefined()
    }
  })

  it('accepts TODOS as turno value', () => {
    const result = createNCSchema.safeParse({ ...validPayload, turno: 'TODOS' })
    expect(result.success).toBe(true)
  })

  it('rejects fechaCierre equal to fechaDeteccion', () => {
    const result = createNCSchema.safeParse({
      ...validPayload,
      fechaDeteccion: '2025-01-15',
      fechaCierre: '2025-01-15',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('fechaCierre')
    }
  })

  it('rejects fechaCierre before fechaDeteccion', () => {
    const result = createNCSchema.safeParse({
      ...validPayload,
      fechaDeteccion: '2025-03-01',
      fechaCierre: '2025-02-15',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0])
      expect(paths).toContain('fechaCierre')
    }
  })

  it('accepts fechaCierre after fechaDeteccion', () => {
    const result = createNCSchema.safeParse({
      ...validPayload,
      fechaDeteccion: '2025-01-01',
      fechaCierre: '2025-01-02',
    })
    expect(result.success).toBe(true)
  })
})
