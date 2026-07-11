import { useMemo } from 'react'
import { useAuthStore } from '../../../stores/authStore'
import { useQualityEvents } from '../../quality-events/hooks/useQualityEvents'
import { useNonconformities } from '../../nonconformities/hooks/useNonconformities'
import { useIncidents } from '../../incidents/hooks/useIncidents'
import { useDocuments } from '../../documents/hooks/useDocuments'
import {
  extraerAccionesQE,
  extraerAccionesAC,
  extraerAccionesDocumento,
  ordenarAccionesRequeridas,
} from '../utils/accionesRequeridas.utils'
import type { AccionRequerida } from '../types/accionesRequeridas.types'

const PAGE_SIZE = 200

export function useAccionesRequeridas(): { items: AccionRequerida[]; isLoading: boolean } {
  const user = useAuthStore((s) => s.user)
  const qe = useQualityEvents({ page: 1, pageSize: PAGE_SIZE })
  const nc = useNonconformities({ page: 1, pageSize: PAGE_SIZE })
  const inc = useIncidents({ page: 1, pageSize: PAGE_SIZE })
  const docs = useDocuments({ page: 1, pageSize: PAGE_SIZE })

  const isLoading = qe.isLoading || nc.isLoading || inc.isLoading || docs.isLoading

  const items = useMemo(() => {
    if (!user) return []
    const qes = qe.data?.items ?? []
    const ncs = nc.data?.items ?? []
    const incidentes = inc.data?.items ?? []
    const documentos = docs.data?.items ?? []

    return ordenarAccionesRequeridas([
      ...extraerAccionesQE(qes, user),
      ...extraerAccionesAC(qes, ncs, incidentes, user),
      ...extraerAccionesDocumento(documentos, user),
    ])
  }, [user, qe.data, nc.data, inc.data, docs.data])

  return { items, isLoading }
}
