import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import {
  ejecutarQEAccion,
  eliminarEvidenciaAC,
  iniciarQEAccion,
  subirEvidenciaAC,
  verificarQEAccion,
} from '../api/quality-events.api'
import type { EjecutarQEACInput } from '../schemas/ejecutarQEAccion.schema'
import type { VerificarQEACInput } from '../schemas/verificarQEAccion.schema'
import type { QualityEvent } from '../types/qualityEvent.types'
import { QE_QUERY_KEYS } from './useQualityEvents'
import { QE_AUDIT_TRAIL_QUERY_KEY } from './useQEAuditTrail'
import { INCIDENT_QUERY_KEYS } from '../../incidents/hooks/useIncidents'
import { QUERY_KEYS as NC_QUERY_KEYS } from '../../nonconformities/hooks/useNonconformities'
import { invalidarDashboard } from '../../dashboard/utils/invalidarDashboard'

// ac-ejecucion-verificacion-evidencias: flujo responsable (iniciar → evidencias → ejecutar) y JCA
// (verificar). Cada paso refresca el detalle, la lista de QE (pendientes del dashboard) y el dashboard.
const CODIGOS_CONOCIDOS = ['SOLO_RESPONSABLE_AC', 'SOLO_JCA_VERIFICA'] as const

type ApiError = AxiosError<{ message?: string; errorCode?: string }>

function invalidarQE(queryClient: QueryClient, qeId: string) {
  invalidarDashboard(queryClient)
  void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.all })
  void queryClient.invalidateQueries({ queryKey: QE_AUDIT_TRAIL_QUERY_KEY(qeId) })
}

function useMostrarError() {
  const { t } = useTranslation('qualityEvents')
  return (error: unknown, fallback: string) => {
    const data = (error as ApiError).response?.data
    const codigo = CODIGOS_CONOCIDOS.find((c) => c === data?.errorCode)
    toast.error(codigo ? t(`errors.${codigo}`) : (data?.message ?? fallback))
  }
}

export function useIniciarQEAccion(qeId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('qualityEvents')
  const mostrarError = useMostrarError()

  return useMutation({
    mutationFn: (acId: string) => iniciarQEAccion(qeId, acId),
    onSuccess: () => {
      invalidarQE(queryClient, qeId)
      toast.success(t('detail.acSection.toasts.iniciada'))
    },
    onError: (error) => mostrarError(error, t('detail.acSection.toasts.error')),
  })
}

export function useSubirEvidenciaAC(qeId: string, acId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: (porcentaje: number) => void }) =>
      subirEvidenciaAC(qeId, acId, file, onProgress),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(qeId) })
    },
  })
}

export function useEliminarEvidenciaAC(qeId: string, acId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('qualityEvents')
  const mostrarError = useMostrarError()

  return useMutation({
    mutationFn: (evidenciaId: string) => eliminarEvidenciaAC(qeId, acId, evidenciaId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(qeId) })
    },
    onError: (error) => mostrarError(error, t('detail.acSection.toasts.error')),
  })
}

export function useEjecutarQEAccion(qeId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('qualityEvents')
  const mostrarError = useMostrarError()

  return useMutation({
    mutationFn: ({ acId, data }: { acId: string; data: EjecutarQEACInput }) => ejecutarQEAccion(qeId, acId, data),
    onSuccess: () => {
      invalidarQE(queryClient, qeId)
      toast.success(t('detail.acSection.toasts.ejecutada'))
    },
    onError: (error) => mostrarError(error, t('detail.acSection.toasts.error')),
  })
}

export function useVerificarQEAccion(qeId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('qualityEvents')
  const mostrarError = useMostrarError()

  return useMutation({
    mutationFn: ({ acId, data }: { acId: string; data: VerificarQEACInput }) => verificarQEAccion(qeId, acId, data),
    onSuccess: (_ac, { data }) => {
      invalidarQE(queryClient, qeId)
      // Aprobar la última AC puede pasar el QE a PENDIENTE_CIERRE y, con él, al incidente/NC
      // vinculado. La respuesta es la AC, así que el vínculo se lee del QE en caché.
      const qe = queryClient.getQueryData<QualityEvent>(QE_QUERY_KEYS.detail(qeId))
      if (!qe || qe.incidenteId) void queryClient.invalidateQueries({ queryKey: INCIDENT_QUERY_KEYS.all })
      if (qe?.ncId) void queryClient.invalidateQueries({ queryKey: NC_QUERY_KEYS.nonconformities.all })
      toast.success(data.aprobada ? t('detail.acSection.toasts.verificada') : t('detail.acSection.toasts.devuelta'))
    },
    onError: (error) => mostrarError(error, t('detail.acSection.toasts.error')),
  })
}
