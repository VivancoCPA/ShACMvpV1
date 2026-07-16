import { getUsersStore } from './auth.fixtures'
import { seedLegacyNames } from './seedLegacyNames.fixtures'

export function resolveUserDisplayName(id: string): string {
  const real = getUsersStore().find((u) => u.id === id)
  if (real) return `${real.nombre} ${real.apellido}`

  const legacy = seedLegacyNames[id]
  if (legacy) return `${legacy.nombre} ${legacy.apellido}`

  return id
}
