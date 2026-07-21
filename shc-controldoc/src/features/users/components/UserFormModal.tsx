import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { X, Loader2 } from 'lucide-react'
import { useAreas } from '../../areas/hooks/useAreas'
import { UserAvatar } from '../../../components/ui/UserAvatar'
import { createUserSchema } from '../schemas/createUser.schema'
import type { CreateUserInput } from '../schemas/createUser.schema'
import { updateUserSchema } from '../schemas/updateUser.schema'
import { validateAvatarFile } from '../schemas/avatarFile.schema'
import { useCreateUser, useUpdateUser } from '../hooks/useUsers'
import { TemporaryPasswordModal } from './TemporaryPasswordModal'
import type { User, UserRole } from '../../../types/auth.types'

const ROLE_VALUES: UserRole[] = [
  'OPERARIO',
  'SUPERVISOR',
  'JEFE_CALIDAD_SYST',
  'JEFE_CONTROL_DOCUMENTARIO',
  'AUDITOR_INTERNO',
  'ALTA_DIRECCION',
  'ADMINISTRADOR_SISTEMA',
]

type UserFormValues = CreateUserInput

interface UserFormModalProps {
  user?: User
  onClose: () => void
}

export function UserFormModal({ user, onClose }: UserFormModalProps) {
  const { t } = useTranslation('users')
  const { t: tAuth } = useTranslation('auth')
  const isEdit = !!user

  const [avatarBase64, setAvatarBase64] = useState<string | undefined>(user?.avatarUrl)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [createdResult, setCreatedResult] = useState<{ nombre: string; password: string } | null>(null)

  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const isPending = createUser.isPending || updateUser.isPending
  const { data: areas = [] } = useAreas()
  const areasActivas = areas.filter((a) => a.activo)

  const resolver = zodResolver(
    isEdit ? updateUserSchema : createUserSchema,
  ) as unknown as Resolver<UserFormValues>

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver,
    defaultValues: {
      nombre: user?.nombre ?? '',
      apellido: user?.apellido ?? '',
      email: user?.email ?? '',
      rol: user?.rol ?? 'OPERARIO',
      areaId: user?.areaId ?? '',
      areaIds: user?.areaIds ?? [],
    },
  })

  const rol = watch('rol')
  const showAreasAsignadas = rol === 'SUPERVISOR'

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateAvatarFile(file)
    if (!validation.ok) {
      setAvatarError(t(validation.message ?? ''))
      return
    }
    setAvatarError(null)

    const reader = new FileReader()
    reader.onload = () => setAvatarBase64(reader.result as string)
    reader.readAsDataURL(file)
  }

  const onSubmit = (data: UserFormValues) => {
    if (isEdit && user) {
      updateUser.mutate(
        {
          id: user.id,
          data: {
            nombre: data.nombre,
            apellido: data.apellido,
            email: data.email,
            rol: data.rol,
            ...(data.areaId ? { areaId: data.areaId } : {}),
            ...(data.areaIds ? { areaIds: data.areaIds } : {}),
            ...(avatarBase64 !== user.avatarUrl ? { avatarBase64 } : {}),
          },
        },
        {
          onSuccess: () => {
            toast.success(t('form.toasts.actualizado'))
            onClose()
          },
          onError: () => toast.error(t('form.toasts.actualizarError')),
        },
      )
      return
    }

    createUser.mutate(
      {
        nombre: data.nombre ?? '',
        apellido: data.apellido ?? '',
        email: data.email,
        rol: data.rol,
        ...(data.areaId ? { areaId: data.areaId } : {}),
        ...(data.areaIds ? { areaIds: data.areaIds } : {}),
        ...(avatarBase64 ? { avatarBase64 } : {}),
      },
      {
        onSuccess: (created) => {
          setCreatedResult({
            nombre: `${data.nombre ?? ''} ${data.apellido ?? ''}`,
            password: created.temporaryPassword,
          })
        },
        onError: () => toast.error(t('form.toasts.crearError')),
      },
    )
  }

  const inputBase =
    'h-10 w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral/40 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'
  const labelBase = 'mb-1 block text-sm font-medium text-body-strong dark:text-on-dark'

  if (createdResult) {
    return (
      <TemporaryPasswordModal
        nombre={createdResult.nombre}
        password={createdResult.password}
        onClose={() => {
          setCreatedResult(null)
          onClose()
        }}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4 dark:bg-black/60">
      <div className="relative w-full max-w-lg rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('form.actions.cancelar')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>

        <h2 className="mb-4 font-medium text-ink dark:text-on-dark">
          {isEdit ? t('form.titles.editar') : t('form.titles.crear')}
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="flex items-center gap-4">
            <UserAvatar
              user={{
                nombre: watch('nombre') || user?.nombre || '?',
                apellido: watch('apellido') || user?.apellido || '',
                avatarUrl: avatarBase64,
                rol,
              }}
              size="lg"
            />
            <div>
              <label htmlFor="avatarFile" className="cursor-pointer text-sm text-coral hover:text-coral-dark">
                {t('form.avatar.subir')}
              </label>
              <input
                id="avatarFile"
                type="file"
                accept="image/jpeg,image/png"
                className="sr-only"
                onChange={handleAvatarChange}
              />
              {avatarError && (
                <p role="alert" className="mt-1 text-xs text-error">
                  {avatarError}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="nombre" className={labelBase}>
                {t('form.fields.nombre')}
              </label>
              <input id="nombre" className={inputBase} {...register('nombre')} />
              {errors.nombre && (
                <p className="mt-1 text-xs text-error">{t(errors.nombre.message ?? '')}</p>
              )}
            </div>
            <div>
              <label htmlFor="apellido" className={labelBase}>
                {t('form.fields.apellido')}
              </label>
              <input id="apellido" className={inputBase} {...register('apellido')} />
              {errors.apellido && (
                <p className="mt-1 text-xs text-error">{t(errors.apellido.message ?? '')}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="email" className={labelBase}>
              {t('form.fields.email')}
            </label>
            <input id="email" type="email" className={inputBase} {...register('email')} />
            {errors.email && <p className="mt-1 text-xs text-error">{t(errors.email.message ?? '')}</p>}
          </div>

          <div>
            <label htmlFor="rol" className={labelBase}>
              {t('form.fields.rol')}
            </label>
            <select id="rol" className={inputBase} {...register('rol')}>
              {ROLE_VALUES.map((r) => (
                <option key={r} value={r}>
                  {tAuth(`roles.${r}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="areaId" className={labelBase}>
              {t('form.fields.area')}
            </label>
            <select id="areaId" className={inputBase} {...register('areaId')}>
              <option value="">{t('form.fields.seleccionar')}</option>
              {areasActivas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
            {errors.areaId && <p className="mt-1 text-xs text-error">{t(errors.areaId.message ?? '')}</p>}
          </div>

          {showAreasAsignadas && (
            <div>
              <span className={labelBase}>{t('form.fields.areasAsignadas')}</span>
              <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto rounded-md border border-hairline p-2 dark:border-hairline/20">
                {areasActivas.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm text-ink dark:text-on-dark">
                    <input type="checkbox" value={a.id} {...register('areaIds')} />
                    {a.nombre}
                  </label>
                ))}
              </div>
              {errors.areaIds && (
                <p className="mt-1 text-xs text-error">{t(errors.areaIds.message ?? '')}</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft disabled:opacity-60"
            >
              {t('form.actions.cancelar')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending && <Loader2 size={15} className="animate-spin" />}
              {t('form.actions.guardar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
