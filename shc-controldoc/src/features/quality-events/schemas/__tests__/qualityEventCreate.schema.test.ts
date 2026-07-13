import { describe, it, expect } from 'vitest'
import { cincoPorquesSchema, ishikawaSchema, qualityEventCreateSchema } from '../qualityEventCreate.schema'

const validPorque = { pregunta: '¿Por qué ocurrió?', respuesta: 'Porque fallaron los controles' }
const fivePorques = Array(5).fill(validPorque)

describe('cincoPorquesSchema', () => {
  it('accepts exactly 5 entries', () => {
    expect(cincoPorquesSchema.safeParse(fivePorques).success).toBe(true)
  })

  it('rejects fewer than 5 entries', () => {
    expect(cincoPorquesSchema.safeParse([validPorque]).success).toBe(false)
  })

  it('rejects more than 5 entries', () => {
    expect(cincoPorquesSchema.safeParse(Array(6).fill(validPorque)).success).toBe(false)
  })

  it('rejects entry with empty pregunta', () => {
    const data = [...Array(4).fill(validPorque), { pregunta: '', respuesta: 'Respuesta' }]
    const result = cincoPorquesSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('ishikawaSchema', () => {
  it('rejects empty array', () => {
    expect(ishikawaSchema.safeParse([]).success).toBe(false)
  })

  it('rejects entry with invalid categoria', () => {
    const result = ishikawaSchema.safeParse([{ categoria: 'PERSONA', causa: 'Falta de capacitación' }])
    expect(result.success).toBe(false)
  })

  it('rejects entry with causa shorter than 5 characters', () => {
    const result = ishikawaSchema.safeParse([{ categoria: 'METODO', causa: 'Err' }])
    expect(result.success).toBe(false)
  })

  it('accepts valid entries across multiple categories', () => {
    const result = ishikawaSchema.safeParse([
      { categoria: 'METODO', causa: 'Procedimiento desactualizado' },
      { categoria: 'MANO_DE_OBRA', causa: 'Personal no capacitado en el proceso' },
    ])
    expect(result.success).toBe(true)
  })
})

const basePayload = {
  tipo: 'SST' as const,
  severidad: 'ALTA' as const,
  descripcion: 'Descripción del evento de calidad',
  areaAfectada: 'Almacén',
  turno: 'DIA' as const,
  fechaHoraEvento: '2025-06-01T08:00:00Z',
}

describe('qualityEventCreateSchema', () => {
  it('O1: rejects when incidenteId is absent', () => {
    const result = qualityEventCreateSchema.safeParse({ origen: 'O1_INCIDENTE_CAMPO', ...basePayload })
    expect(result.success).toBe(false)
  })

  it('O1: accepts when incidenteId is present', () => {
    const result = qualityEventCreateSchema.safeParse({
      origen: 'O1_INCIDENTE_CAMPO',
      ...basePayload,
      incidenteId: 'inc-001',
    })
    expect(result.success).toBe(true)
  })

  it('O2: rejects when ncId is absent', () => {
    const result = qualityEventCreateSchema.safeParse({
      origen: 'O2_NC_DETECTADA',
      ...basePayload,
      tipo: 'CALIDAD',
      severidad: 'MEDIA',
      areaAfectada: 'Control',
      turno: 'TARDE',
    })
    expect(result.success).toBe(false)
  })

  it('O3: rejects when hallazgoCodigo and normativaVinculada are absent', () => {
    const result = qualityEventCreateSchema.safeParse({
      origen: 'O3_HALLAZGO_AUDITORIA',
      ...basePayload,
      tipo: 'CALIDAD',
      severidad: 'BAJA',
      areaAfectada: 'Operaciones',
      turno: 'NOCHE',
    })
    expect(result.success).toBe(false)
  })

  it('O3: rejects when normativaVinculada is absent', () => {
    const result = qualityEventCreateSchema.safeParse({
      origen: 'O3_HALLAZGO_AUDITORIA',
      ...basePayload,
      tipo: 'CALIDAD',
      severidad: 'BAJA',
      areaAfectada: 'Operaciones',
      turno: 'NOCHE',
      hallazgoCodigo: 'HAL-2026-010',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('normativaVinculada'))).toBe(true)
    }
  })

  it('O3: rejects when hallazgoCodigo is absent', () => {
    const result = qualityEventCreateSchema.safeParse({
      origen: 'O3_HALLAZGO_AUDITORIA',
      ...basePayload,
      tipo: 'CALIDAD',
      severidad: 'BAJA',
      areaAfectada: 'Operaciones',
      turno: 'NOCHE',
      normativaVinculada: { norma: 'ISO_9001_2015', clausula: '8.4.1' },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('hallazgoCodigo'))).toBe(true)
    }
  })

  it('O3: rejects normativaVinculada with norma OTRA and no normaOtraDetalle', () => {
    const result = qualityEventCreateSchema.safeParse({
      origen: 'O3_HALLAZGO_AUDITORIA',
      ...basePayload,
      tipo: 'OPERACIONAL',
      severidad: 'MEDIA',
      areaAfectada: 'Zona de Pesaje',
      turno: 'DIA',
      hallazgoCodigo: 'HAL-2026-011',
      normativaVinculada: { norma: 'OTRA', clausula: '3.2' },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join('.') === 'normativaVinculada.normaOtraDetalle')).toBe(true)
    }
  })

  it('O3: accepts a valid ISO normativaVinculada', () => {
    const result = qualityEventCreateSchema.safeParse({
      origen: 'O3_HALLAZGO_AUDITORIA',
      ...basePayload,
      fechaHoraEvento: '2025-06-01T08:00',
      tipo: 'CALIDAD',
      severidad: 'BAJA',
      areaAfectada: 'Operaciones',
      turno: 'NOCHE',
      hallazgoCodigo: 'HAL-2026-010',
      normativaVinculada: { norma: 'ISO_9001_2015', clausula: '8.4.1' },
    })
    expect(result.success).toBe(true)
  })

  it('O3: accepts a valid OTRA normativaVinculada with normaOtraDetalle', () => {
    const result = qualityEventCreateSchema.safeParse({
      origen: 'O3_HALLAZGO_AUDITORIA',
      ...basePayload,
      fechaHoraEvento: '2025-06-01T08:00',
      tipo: 'OPERACIONAL',
      severidad: 'MEDIA',
      areaAfectada: 'Zona de Pesaje',
      turno: 'DIA',
      hallazgoCodigo: 'HAL-2026-011',
      normativaVinculada: { norma: 'OTRA', clausula: '3.2', normaOtraDetalle: 'Auditoría Operacional' },
    })
    expect(result.success).toBe(true)
  })

  it('O4: rejects when reporteExternoRef is absent', () => {
    const result = qualityEventCreateSchema.safeParse({
      origen: 'O4_REPORTE_EXTERNO',
      ...basePayload,
      tipo: 'ADUANERO',
      severidad: 'CRITICA',
      areaAfectada: 'Importación',
    })
    expect(result.success).toBe(false)
  })

  it('O4: accepts valid reporteExternoRef', () => {
    const result = qualityEventCreateSchema.safeParse({
      origen: 'O4_REPORTE_EXTERNO',
      ...basePayload,
      tipo: 'ADUANERO',
      severidad: 'CRITICA',
      areaAfectada: 'Importación',
      reporteExternoRef: { nombreCliente: 'Minera ABC', fechaRecepcion: '2025-06-01' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-datetime fechaHoraEvento', () => {
    const result = qualityEventCreateSchema.safeParse({
      origen: 'O1_INCIDENTE_CAMPO',
      ...basePayload,
      fechaHoraEvento: '01/06/2025',
      incidenteId: 'inc-001',
    })
    expect(result.success).toBe(false)
  })

  it('rejects descripcion shorter than 10 characters', () => {
    const result = qualityEventCreateSchema.safeParse({
      origen: 'O1_INCIDENTE_CAMPO',
      ...basePayload,
      descripcion: 'Corto',
      incidenteId: 'inc-001',
    })
    expect(result.success).toBe(false)
  })
})
