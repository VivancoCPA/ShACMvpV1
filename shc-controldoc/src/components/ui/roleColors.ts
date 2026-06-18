import type { UserRole } from '../../types/auth.types'

export const ROLE_BG_CLASSES: Record<UserRole, string> = {
  OPERARIO: 'bg-muted/20 text-muted',
  SUPERVISOR: 'bg-teal/20 text-teal',
  JEFE_CALIDAD_SYST: 'bg-coral/20 text-coral',
  JEFE_CONTROL_DOCUMENTARIO: 'bg-amber/20 text-amber',
  AUDITOR_INTERNO: 'bg-success/20 text-success',
  ALTA_DIRECCION: 'bg-error/20 text-error',
}

export const ROLE_AVATAR_BG: Record<UserRole, string> = {
  OPERARIO: 'bg-muted/30',
  SUPERVISOR: 'bg-teal/30',
  JEFE_CALIDAD_SYST: 'bg-coral/30',
  JEFE_CONTROL_DOCUMENTARIO: 'bg-amber/30',
  AUDITOR_INTERNO: 'bg-success/30',
  ALTA_DIRECCION: 'bg-error/30',
}
