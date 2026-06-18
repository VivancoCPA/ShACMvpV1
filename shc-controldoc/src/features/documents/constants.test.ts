import { describe, it, expect } from 'vitest'
import { QUERY_KEYS, DOC_STATUS_COLORS, DOC_STATUS_TRANSITIONS } from './constants'
import type { DocStatus } from '../../types/documents.types'

const ALL_STATUSES: DocStatus[] = [
  'BORRADOR',
  'EN_REVISION',
  'EN_APROBACION',
  'PUBLICADO',
  'OBSOLETO',
  'EN_REVISION_PERIODICA',
]

describe('QUERY_KEYS.documents', () => {
  it('all returns the base tuple', () => {
    expect(QUERY_KEYS.documents.all).toEqual(['documents'])
  })

  it('list returns a scoped key with filters', () => {
    const key = QUERY_KEYS.documents.list({ estado: 'PUBLICADO' })
    expect(key).toEqual(['documents', 'list', { estado: 'PUBLICADO' }])
  })

  it('list returns a scoped key with empty filters', () => {
    const key = QUERY_KEYS.documents.list({})
    expect(key).toEqual(['documents', 'list', {}])
  })

  it('detail returns an id-scoped key', () => {
    const key = QUERY_KEYS.documents.detail('doc-123')
    expect(key).toEqual(['documents', 'detail', 'doc-123'])
  })
})

describe('DOC_STATUS_COLORS', () => {
  it.each(ALL_STATUSES)('has a defined non-empty color for %s', (status) => {
    expect(DOC_STATUS_COLORS[status]).toBeDefined()
    expect(DOC_STATUS_COLORS[status].length).toBeGreaterThan(0)
  })

  it('maps PUBLICADO to the success token', () => {
    expect(DOC_STATUS_COLORS['PUBLICADO']).toBe('success')
  })

  it('maps OBSOLETO to a muted token', () => {
    expect(DOC_STATUS_COLORS['OBSOLETO']).toMatch(/muted/)
  })

  it('maps EN_REVISION_PERIODICA to the amber token', () => {
    expect(DOC_STATUS_COLORS['EN_REVISION_PERIODICA']).toBe('amber')
  })
})

describe('DOC_STATUS_TRANSITIONS', () => {
  it.each(ALL_STATUSES)('has a defined transitions array for %s', (status) => {
    expect(DOC_STATUS_TRANSITIONS[status]).toBeDefined()
    expect(Array.isArray(DOC_STATUS_TRANSITIONS[status])).toBe(true)
  })

  it('BORRADOR can only transition to EN_REVISION', () => {
    expect(DOC_STATUS_TRANSITIONS['BORRADOR']).toEqual(['EN_REVISION'])
  })

  it('OBSOLETO has no valid next states (terminal)', () => {
    expect(DOC_STATUS_TRANSITIONS['OBSOLETO']).toEqual([])
  })

  it('EN_REVISION_PERIODICA can transition to BORRADOR and PUBLICADO', () => {
    expect(DOC_STATUS_TRANSITIONS['EN_REVISION_PERIODICA']).toContain('BORRADOR')
    expect(DOC_STATUS_TRANSITIONS['EN_REVISION_PERIODICA']).toContain('PUBLICADO')
  })

  it('PUBLICADO can transition to EN_REVISION_PERIODICA', () => {
    expect(DOC_STATUS_TRANSITIONS['PUBLICADO']).toContain('EN_REVISION_PERIODICA')
  })

  it('EN_REVISION can go forward to EN_APROBACION or back to BORRADOR', () => {
    expect(DOC_STATUS_TRANSITIONS['EN_REVISION']).toContain('EN_APROBACION')
    expect(DOC_STATUS_TRANSITIONS['EN_REVISION']).toContain('BORRADOR')
  })

  it('EN_APROBACION can go forward to PUBLICADO or back to BORRADOR', () => {
    expect(DOC_STATUS_TRANSITIONS['EN_APROBACION']).toContain('PUBLICADO')
    expect(DOC_STATUS_TRANSITIONS['EN_APROBACION']).toContain('BORRADOR')
  })
})
