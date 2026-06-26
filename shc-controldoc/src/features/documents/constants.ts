import type { DocStatus, DocFilters, DocType } from '../../types/documents.types'
// AREAS_SHAC moved to src/constants/shared.constants.ts — re-exported for backward compatibility
export { AREAS_SHAC } from '../../constants/shared.constants'

export const QUERY_KEYS = {
  documents: {
    all: ['documents'] as const,
    list: (filters: DocFilters) => ['documents', 'list', filters] as const,
    detail: (id: string) => ['documents', 'detail', id] as const,
    versionesByCodigo: (codigo: string) => ['documents', 'versiones', codigo] as const,
    pendientesCount: (userId: string) => ['documents', 'pendientesCount', userId] as const,
  },
} as const

export const DOC_STATUS_COLORS: Record<DocStatus, string> = {
  BORRADOR: 'muted',
  EN_REVISION: 'teal',
  EN_APROBACION: 'amber',
  PUBLICADO: 'success',
  OBSOLETO: 'muted-soft',
  EN_REVISION_PERIODICA: 'amber',
}

export const DOC_TYPES: DocType[] = ['POL', 'PRC', 'INS', 'REG', 'INF', 'MAT', 'PLAN']

export const DOC_STATUSES: DocStatus[] = [
  'BORRADOR',
  'EN_REVISION',
  'EN_APROBACION',
  'PUBLICADO',
  'OBSOLETO',
  'EN_REVISION_PERIODICA',
]


export const DOC_STATUS_TRANSITIONS: Record<DocStatus, DocStatus[]> = {
  BORRADOR: ['EN_REVISION'],
  EN_REVISION: ['EN_APROBACION', 'BORRADOR'],
  EN_APROBACION: ['PUBLICADO', 'BORRADOR'],
  PUBLICADO: ['OBSOLETO', 'EN_REVISION_PERIODICA'],
  OBSOLETO: [],
  EN_REVISION_PERIODICA: ['BORRADOR', 'PUBLICADO'],
}
