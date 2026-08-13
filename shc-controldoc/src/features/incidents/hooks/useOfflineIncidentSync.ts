import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  listPending,
  markSyncing,
  markSynced,
  markError,
  markRetryPending,
  retry as retryQueueEntry,
  type QueuedIncident,
} from '../../../lib/offlineQueue'
import { SYNC_MESSAGE_TYPE } from '../../../lib/offlineSyncMessage'
import { useAuthStore } from '../../../stores/authStore'
import { useOfflineQueueStore } from '../stores/offlineQueueStore'
import { useCreateIncidentOfflineSync } from './useIncidents'
import { classifySubmitError } from '../utils/classifySubmitError'
import type { CreateIncidentInput } from '../schemas/createIncident.schema'
import type { IncidentEvidencia } from '../types/incident.types'

// Máximo de intentos fallidos consecutivos clasificados como error de red
// antes de degradar una entrada a `status: 'error'` (m7-f3-hardening
// design.md D1) — evita un loop infinito con señal "flapping" mientras sigue
// permitiendo que un corte de conexión normal se resuelva solo, sin acción
// del usuario.
const MAX_SYNC_RETRIES = 3

function buildEvidenciasFromBlobs(
  blobs: Blob[],
  captions: (string | undefined)[] | undefined,
  creadoPorId: string,
): IncidentEvidencia[] {
  return blobs.map((blob, i) => {
    const caption = captions?.[i]
    return {
      id: `ev-offline-${Date.now()}-${i}`,
      url: URL.createObjectURL(blob),
      nombre: `foto-${i + 1}.jpg`,
      tipo: 'imagen',
      tamanioKb: Math.round(blob.size / 1024),
      creadoEn: new Date().toISOString(),
      creadoPor: creadoPorId,
      ...(caption ? { descripcion: caption } : {}),
    }
  })
}

/**
 * Orquesta la sincronización FIFO de la cola offline (m7-f2-offline-sync
 * design.md D3/D5): un reporte a la vez, en orden de creación, disparada por
 * el evento `online` del hilo principal y por el mensaje que reenvía el
 * Service Worker al recibir su evento `sync` (Background Sync API). Usa
 * `useCreateIncidentOfflineSync` para el envío real — variante de
 * `useCreateIncident` (mismo camino que usan el formulario de escritorio y
 * el envío online del formulario mobile) que además envía el `empresaId`
 * capturado al encolar (m7-f2-offline-sync design.md D8).
 *
 * El estado observable de la cola (`items`/`pendingCount`/`syncingId`/`hasErrors`)
 * vive en `offlineQueueStore` (m7-f2-indicador-offline design.md D1/D2), no
 * aquí — este hook solo se invoca una vez, desde `MobileShell`, para que los
 * listeners de sincronización vivan mientras el usuario está en cualquier
 * vista mobile, no solo en el formulario. El formulario ya no invoca este
 * hook: encolar un reporte nuevo llama a `notifyIncidentEnqueued()`
 * (`offlineQueueStore.ts`), que usa el `syncTrigger` que este hook registra.
 */
export function useOfflineIncidentSync() {
  const { t } = useTranslation('incidents')
  const userId = useAuthStore((s) => s.user?.id)
  const createMutation = useCreateIncidentOfflineSync()
  const isSyncingRef = useRef(false)
  // `t`/`userId`/`createMutation` se leen vía ref, no como dependencias de los
  // `useCallback` de abajo: si `syncOne`/`runSyncCycle` cambiaran de identidad
  // en cada render (p. ej. porque `t` no está memoizado), los efectos que
  // dependen de `runSyncCycle` (listener `online`, listener de mensajes del
  // SW) se re-suscribirían constantemente y dispararían ciclos de sync
  // adicionales no intencionados en cada re-render. Con refs, `syncOne` y
  // `runSyncCycle` quedan estables durante todo el ciclo de vida del hook.
  const tRef = useRef(t)
  tRef.current = t
  const userIdRef = useRef(userId)
  userIdRef.current = userId
  const createMutationRef = useRef(createMutation)
  createMutationRef.current = createMutation
  // Evita que un ciclo de sync en curso siga arrancando entradas nuevas
  // después de que el componente que monta el hook se desmonte — p. ej. el
  // usuario navega fuera de `/m/*` mientras sincroniza. La entrada ya en
  // vuelo se deja terminar (no se aborta el request a mitad), pero no se
  // inicia ninguna entrada adicional una vez desmontado. Escribir en el store
  // (a diferencia de `useState`) no depende de que el componente siga
  // montado, así que esta guardia ya no protege al store, solo al loop.
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const syncOne = useCallback(async (entry: QueuedIncident) => {
    await markSyncing(entry.localId)
    await useOfflineQueueStore.getState().refresh()
    try {
      const evidencias = buildEvidenciasFromBlobs(
        entry.photoBlobs,
        entry.photoCaptions,
        userIdRef.current ?? 'user-mock',
      )
      const payload: CreateIncidentInput = {
        ...entry.payload,
        ...(evidencias.length > 0 ? { evidencias } : {}),
        ...(entry.geoUbicacion ? { geoUbicacion: entry.geoUbicacion } : {}),
      }
      await createMutationRef.current.mutateAsync({ data: payload, empresaId: entry.empresaId })
      await markSynced(entry.localId)
    } catch (error) {
      // Clasificación de error (m7-f3-hardening design.md D1), reutilizando el
      // mismo criterio que el submit inicial del formulario (D6 de Fase 2):
      // un fallo de red se reintenta solo (vuelve a `pending`) hasta agotar
      // MAX_SYNC_RETRIES intentos consecutivos; un fallo de backend/envelope
      // inválido pasa a `error` de inmediato, sin reintento automático, porque
      // reintentar no va a cambiar el resultado.
      const classification = classifySubmitError(error)
      const isNetworkFailure = classification === 'network'
      const retriesExhausted = (entry.retryCount ?? 0) >= MAX_SYNC_RETRIES
      if (isNetworkFailure && !retriesExhausted) {
        await markRetryPending(entry.localId)
      } else {
        const message = tRef.current(
          isNetworkFailure ? 'mobile.offline.retriesExhaustedError' : 'mobile.offline.syncErrorToast',
        )
        await markError(entry.localId, message)
        if (isMountedRef.current) toast.error(message)
      }
    } finally {
      await useOfflineQueueStore.getState().refresh()
    }
  }, [])

  const runSyncCycle = useCallback(async () => {
    if (isSyncingRef.current) return
    isSyncingRef.current = true
    try {
      // Cada entrada se intenta como máximo una vez POR CICLO: `listPending()`
      // sigue incluyendo `status: 'error'`, así que sin este `attempted` set
      // una entrada recién fallida sería `pending[0]` de nuevo en la próxima
      // iteración — reintento infinito dentro del mismo ciclo en vez de pasar
      // a la siguiente (ver design.md D5 y el requirement "un reporte fallido
      // no bloquea a los siguientes"). Un ciclo *futuro* (online/sync/retry)
      // sí puede volver a intentar una entrada en error — eso es intencional.
      const attempted = new Set<number>()
      let pending = (await listPending()).filter((entry) => !attempted.has(entry.localId))
      while (isMountedRef.current && pending.length > 0) {
        const next = pending[0]
        attempted.add(next.localId)
        await syncOne(next)
        pending = (await listPending()).filter((entry) => !attempted.has(entry.localId))
      }
    } finally {
      isSyncingRef.current = false
    }
  }, [syncOne])

  useEffect(() => {
    void useOfflineQueueStore.getState().refresh()
  }, [])

  useEffect(() => {
    const onOnline = () => void runSyncCycle()
    window.addEventListener('online', onOnline)
    if (navigator.onLine) void runSyncCycle()
    return () => window.removeEventListener('online', onOnline)
  }, [runSyncCycle])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      if ((event.data as { type?: string } | undefined)?.type === SYNC_MESSAGE_TYPE) void runSyncCycle()
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [runSyncCycle])

  // Registra este ciclo FIFO como el `syncTrigger` del store mientras el hook
  // está montado, para que `notifyIncidentEnqueued()` (llamado desde el
  // formulario, fuera de este árbol de componentes) pueda dispararlo sin
  // necesitar una segunda instancia del hook (m7-f2-indicador-offline
  // design.md D2).
  useEffect(() => {
    const trigger = () => void runSyncCycle()
    useOfflineQueueStore.getState().setSyncTrigger(trigger)
    return () => {
      if (useOfflineQueueStore.getState().syncTrigger === trigger) {
        useOfflineQueueStore.getState().setSyncTrigger(null)
      }
    }
  }, [runSyncCycle])

  const retry = useCallback(
    async (localId: number) => {
      await retryQueueEntry(localId)
      await useOfflineQueueStore.getState().refresh()
      void runSyncCycle()
    },
    [runSyncCycle],
  )

  return { retry }
}
