import type { UserRole } from '../../types/auth.types'
import { ROLE_AVATAR_BG } from './roleColors'

const SIZE_CLASSES = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
}

// detalle-documento-dos-columnas (D4): `rol` pasa a opcional — el lookup de nombres
// (`user-names-lookup`) no expone rol a propósito (superficie mínima), así que la ficha de
// responsables del detalle de documento usa `UserAvatar` sin él. Sin `rol`, el fondo de
// fallback es un color neutro fijo en vez de `ROLE_AVATAR_BG[rol]`.
const NEUTRAL_AVATAR_BG = 'bg-surface-cream dark:bg-surface-dark-elevated'

interface UserAvatarProps {
  user: {
    nombre: string
    apellido: string
    avatarUrl?: string
    rol?: UserRole
  }
  size?: 'sm' | 'md' | 'lg'
}

export function UserAvatar({ user, size = 'md' }: UserAvatarProps) {
  const sizeClass = SIZE_CLASSES[size]
  const initials = `${user.nombre.charAt(0)}${user.apellido.charAt(0)}`.toUpperCase()
  const bgClass = user.rol ? ROLE_AVATAR_BG[user.rol] : NEUTRAL_AVATAR_BG

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={`${user.nombre} ${user.apellido}`}
        className={`${sizeClass} rounded-full object-cover`}
      />
    )
  }

  return (
    <span
      className={`${sizeClass} ${bgClass} inline-flex items-center justify-center rounded-full font-medium text-ink dark:text-on-dark`}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}
