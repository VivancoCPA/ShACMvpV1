import { useQuery } from '@tanstack/react-query'
import { getQEAuditTrail } from '../api/quality-events.api'

export const QE_AUDIT_TRAIL_QUERY_KEY = (qeId: string) => ['quality-events', 'audit-trail', qeId] as const

export function useQEAuditTrail(qeId: string) {
  return useQuery({
    queryKey: QE_AUDIT_TRAIL_QUERY_KEY(qeId),
    queryFn: () => getQEAuditTrail(qeId),
    enabled: Boolean(qeId),
  })
}
