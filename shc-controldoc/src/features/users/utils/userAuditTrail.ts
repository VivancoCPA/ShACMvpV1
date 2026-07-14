import type { UserAuditTrailEntry } from '../types/userManagement.types'

let auditTrailLog: UserAuditTrailEntry[] = []

export function getUserAuditTrailLog(): UserAuditTrailEntry[] {
  return auditTrailLog
}

export function recordUserAuditTrail(
  entry: Omit<UserAuditTrailEntry, 'id' | 'timestamp' | 'generadoPorIA' | 'entidadTipo'>,
): void {
  auditTrailLog = [
    ...auditTrailLog,
    {
      ...entry,
      id: `aud-usr-${auditTrailLog.length + 1}`,
      entidadTipo: 'Usuario',
      timestamp: new Date().toISOString(),
      generadoPorIA: false,
    },
  ]
}
