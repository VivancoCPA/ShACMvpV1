import type { Notificacion } from '../../types/notification.types'

// Semilla con al menos una notificación por `tipo`. Todo `usuarioId` aquí debe
// resolver en `getUsersStore()` (auth.fixtures.ts) — ver notificationGeneration.test.ts
// para la verificación automatizada de este invariante (CA de notification-msw-fixtures).
export const notificationFixtures: Notificacion[] = [
  {
    id: 'notif-001',
    usuarioId: 'user-operario-001',
    tipo: 'CAMBIO_ESTADO',
    entidadTipo: 'QE',
    entidadId: 'qe-2026-001',
    entidadCodigo: 'QE-2026-001',
    mensaje: 'El Quality Event QE-2026-001 cambió a estado EN_INVESTIGACION.',
    leida: false,
    createdAt: '2026-07-15T14:30:00.000Z',
    link: '/quality-events/qe-2026-001',
  },
  {
    id: 'notif-002',
    usuarioId: 'user-jefedocs-001',
    tipo: 'ASIGNACION',
    entidadTipo: 'DOCUMENTO',
    entidadId: 'doc-001',
    entidadCodigo: 'POL-CD-001',
    mensaje: 'Se te asignó como aprobador del documento POL-CD-001.',
    leida: false,
    createdAt: '2026-07-16T09:00:00.000Z',
    link: '/documents/doc-001',
  },
  {
    id: 'notif-003',
    usuarioId: 'user-supervisor-001',
    tipo: 'VENCIMIENTO',
    entidadTipo: 'AC',
    entidadId: 'ac-nc-001-1',
    entidadCodigo: 'NC-CAL-2026-001',
    mensaje: 'La acción correctiva de NC-CAL-2026-001 vence en 3 días hábiles.',
    leida: true,
    createdAt: '2026-07-14T08:15:00.000Z',
    link: '/nonconformities/nc-001',
  },
]

let notifications: Notificacion[] = [...notificationFixtures]

// Store mutable compartido entre notifications.handlers.ts y cualquier otro
// dominio que necesite crear notificaciones (documents/quality-events/
// nonconformities/incidents .handlers.ts vía notificationGeneration.ts).
export function getNotificationsStore(): Notificacion[] {
  return notifications
}

export function addNotification(n: Notificacion): void {
  notifications = [...notifications, n]
}

export function resetStore(): void {
  notifications = [...notificationFixtures]
}
