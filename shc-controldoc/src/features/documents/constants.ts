import type { DocStatus, DocFilters, DocType } from '../../types/documents.types'

export const QUERY_KEYS = {
  documents: {
    all: ['documents'] as const,
    list: (filters: DocFilters) => ['documents', 'list', filters] as const,
    detail: (id: string) => ['documents', 'detail', id] as const,
    versionesByCodigo: (codigo: string) => ['documents', 'versiones', codigo] as const,
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

export const AREAS_SHAC: string[] = [
  'Calidad',
  'Control Documentario',
  'Operaciones',
  'SyST',
  'Auditoría',
  'RR.HH.',
  'Gerencia',
  'Almacén',
  'Logística',
]

export const DOC_STATUS_TRANSITIONS: Record<DocStatus, DocStatus[]> = {
  BORRADOR: ['EN_REVISION'],
  EN_REVISION: ['EN_APROBACION', 'BORRADOR'],
  EN_APROBACION: ['PUBLICADO', 'BORRADOR'],
  PUBLICADO: ['OBSOLETO', 'EN_REVISION_PERIODICA'],
  OBSOLETO: [],
  EN_REVISION_PERIODICA: ['BORRADOR', 'PUBLICADO'],
}
