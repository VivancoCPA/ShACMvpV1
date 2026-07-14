const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png'])

export interface AvatarFileValidationResult {
  ok: boolean
  message?: string
}

// RN-USR-007: tipo image/jpeg|image/png, tamaño <=2MB. Función pura (no z.instanceof(File))
// para poder validarla también en el handler MSW sin depender del realm de `File` del test.
export function validateAvatarFile(file: { type: string; size: number }): AvatarFileValidationResult {
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    return { ok: false, message: 'users:form.validation.avatarFormatoInvalido' }
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, message: 'users:form.validation.avatarTamanoInvalido' }
  }
  return { ok: true }
}
