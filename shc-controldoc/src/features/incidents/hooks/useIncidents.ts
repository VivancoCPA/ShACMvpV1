import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  getIncidents,
  getIncident,
  createIncident,
  updateIncident,
  updateIncidentStatus,
  deleteIncident,
  restoreIncident,
  vincularQEIncidente,
  createAC,
  updateAC,
  cerrarAC,
} from '../api/incidents.api'
import type { IncidentFilters } from '../api/incidents.api'
import type { CreateIncidentInput, UpdateIncidentInvestigacionInput } from '../schemas/createIncident.schema'
import type { CreateACIncidenteInput } from '../schemas/createAC.schema'
import type { CerrarACIncidenteInput } from '../schemas/cerrarAC.schema'
import type { IncidentStatus, AccionCorrectivaIncidente } from '../types/incident.types'

export const INCIDENT_QUERY_KEYS = {
  all: ['incidents'] as const,
  list: (filters: IncidentFilters) => ['incidents', 'list', filters] as const,
  detail: (id: string) => ['incidents', 'detail', id] as const,
} as const

export function useIncidents(filters: IncidentFilters = {}) {
  return useQuery({
    queryKey: INCIDENT_QUERY_KEYS.list(filters),
    queryFn: () => getIncidents(filters),
  })
}

export function useIncident(id: string) {
  return useQuery({
    queryKey: INCIDENT_QUERY_KEYS.detail(id),
    queryFn: () => getIncident(id),
    enabled: !!id,
  })
}

export function useCreateIncident() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('incidents')

  return useMutation({
    mutationFn: (data: CreateIncidentInput) => createIncident(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INCIDENT_QUERY_KEYS.all })
      toast.success(t('toasts.created'))
    },
    onError: () => {
      toast.error(t('toasts.createError'))
    },
  })
}

export function useUpdateIncident() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('incidents')

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UpdateIncidentInvestigacionInput> }) =>
      updateIncident(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INCIDENT_QUERY_KEYS.all })
      toast.success(t('toasts.updated'))
    },
    onError: () => {
      toast.error(t('toasts.updateError'))
    },
  })
}

// RN-QE-001 — vincula el Incidente origen a un QE recién creado (origen O1_INCIDENTE_CAMPO).
// No emite toast de éxito: la creación del QE ya notifica al usuario y esta escritura es
// un efecto secundario interno, no una acción que el usuario haya iniciado directamente.
export function useVincularQE() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('incidents')

  return useMutation({
    mutationFn: ({ id, qeId }: { id: string; qeId: string }) => vincularQEIncidente(id, qeId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: INCIDENT_QUERY_KEYS.detail(variables.id) })
    },
    onError: () => {
      toast.error(t('toasts.vincularQEError'))
    },
  })
}

export function useUpdateIncidentStatus() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('incidents')

  return useMutation({
    mutationFn: ({ id, estado, comentario }: { id: string; estado: IncidentStatus; comentario?: string }) =>
      updateIncidentStatus(id, { estado, comentario }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INCIDENT_QUERY_KEYS.all })
      toast.success(t('toasts.statusUpdated'))
    },
    onError: () => {
      toast.error(t('toasts.statusUpdateError'))
    },
  })
}

export function useDeleteIncident() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('incidents')

  return useMutation({
    mutationFn: (id: string) => deleteIncident(id),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: INCIDENT_QUERY_KEYS.all })
      toast.success(t('toasts.deleted', { numero: data.numero }))
    },
    onError: () => {
      toast.error(t('toasts.deleteError'))
    },
  })
}

export function useRestoreIncident() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('incidents')

  return useMutation({
    mutationFn: (id: string) => restoreIncident(id),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: INCIDENT_QUERY_KEYS.all })
      toast.success(t('toasts.restored', { numero: data.numero }))
    },
    onError: () => {
      toast.error(t('toasts.restoreError'))
    },
  })
}

export function useCreateACIncidente(incidenteId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('incidents')

  return useMutation({
    mutationFn: (data: CreateACIncidenteInput) => createAC(incidenteId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: INCIDENT_QUERY_KEYS.detail(incidenteId),
      })
      toast.success(t('toasts.acCreada'))
    },
    onError: () => {
      toast.error(t('toasts.acCreateError'))
    },
  })
}

export function useUpdateACIncidente(incidenteId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('incidents')

  return useMutation({
    mutationFn: ({ acId, data }: { acId: string; data: Partial<AccionCorrectivaIncidente> }) =>
      updateAC(incidenteId, acId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: INCIDENT_QUERY_KEYS.detail(incidenteId),
      })
      toast.success(t('toasts.acUpdated'))
    },
    onError: () => {
      toast.error(t('toasts.acUpdateError'))
    },
  })
}

export function useCerrarACIncidente(incidenteId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('incidents')

  return useMutation({
    mutationFn: ({ acId, data }: { acId: string; data: CerrarACIncidenteInput }) =>
      cerrarAC(incidenteId, acId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: INCIDENT_QUERY_KEYS.detail(incidenteId),
      })
      toast.success(t('toasts.acCerrada'))
    },
    onError: () => {
      toast.error(t('toasts.acCerrarError'))
    },
  })
}
