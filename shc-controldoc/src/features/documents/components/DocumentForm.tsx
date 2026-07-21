import { useState, useEffect, useRef } from 'react'
import { useFormContext, useWatch, Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Calendar } from 'lucide-react'
import { FileUploadField } from './FileUploadField'
import type { DocumentFormInput } from '../schemas/documentForm.schema'
import type { MockUser } from '../../../mocks/fixtures/documents.fixtures'
import type { UserRole } from '../../../types/auth.types'
import { DOC_TYPES } from '../constants'
import { useAreas } from '../../areas/hooks/useAreas'

function fileNameFromUrl(url: string): string {
  return url.split('/').pop() ?? url
}

const CONFIDENCIALIDAD_VALUES = ['PUBLICO', 'INTERNO', 'CONFIDENCIAL', 'RESTRINGIDO'] as const
const ALL_ROLES: UserRole[] = [
  'OPERARIO',
  'SUPERVISOR',
  'JEFE_CALIDAD_SYST',
  'JEFE_CONTROL_DOCUMENTARIO',
  'AUDITOR_INTERNO',
  'ALTA_DIRECCION',
]

const CONFIDENCIALIDAD_EDIT_ROLES: Set<UserRole> = new Set([
  'JEFE_CONTROL_DOCUMENTARIO',
  'ALTA_DIRECCION',
])

// ── Date helpers ────────────────────────────────────────────────────────────

function isoToDisplay(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function displayToISO(display: string): string | null {
  const match = display.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  const [, d, m, y] = match
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

// ── LocaleDateInput ─────────────────────────────────────────────────────────

interface DateFieldRef {
  value: string | undefined
  onChange: (v: string) => void
  onBlur: () => void
}

function LocaleDateInput({
  id,
  field,
  className,
  disabled = false,
}: {
  id: string
  field: DateFieldRef
  className: string
  disabled?: boolean
}) {
  const [display, setDisplay] = useState(isoToDisplay(field.value ?? ''))
  const dateRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDisplay(isoToDisplay(field.value ?? ''))
  }, [field.value])

  const openPicker = () => {
    const input = dateRef.current as (HTMLInputElement & { showPicker?: () => void }) | null
    input?.showPicker?.()
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        className={`${className} !pr-10`}
        value={display}
        disabled={disabled}
        onChange={(e) => setDisplay(e.target.value)}
        onBlur={() => {
          const iso = displayToISO(display)
          if (iso) {
            field.onChange(iso)
            setDisplay(isoToDisplay(iso))
          } else if (!display) {
            field.onChange('')
          }
          field.onBlur()
        }}
      />
      {/* Hidden date input — provides the native calendar picker */}
      <input
        ref={dateRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        value={field.value ?? ''}
        disabled={disabled}
        onChange={(e) => {
          const iso = e.target.value
          if (iso) {
            field.onChange(iso)
            setDisplay(isoToDisplay(iso))
          }
        }}
      />
      <button
        type="button"
        aria-label="Abrir calendario"
        onClick={openPicker}
        disabled={disabled}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 dark:text-on-dark-soft dark:hover:text-on-dark"
      >
        <Calendar size={16} />
      </button>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface DocumentFormProps {
  mode: 'create' | 'edit'
  isLoading: boolean
  mockUsers: MockUser[]
  descriptionLocked: boolean
  existingFileUrl?: string
  userRole: UserRole
  isUploading?: boolean
  onSubmit: (e: React.FormEvent) => void
  isAutorOrJefe?: boolean
  existingArchivoOriginalNombre?: string | null
  archivoOriginalBloqueado?: boolean
  existingArchivoDistribucionUrl?: string | null
}

function FieldError({ name }: { name: string }) {
  const { formState: { errors } } = useFormContext<DocumentFormInput>()
  const msg = (errors as Record<string, { message?: string }>)[name]?.message
  if (!msg) return null
  return <p role="alert" className="mt-1 text-xs text-error">{msg}</p>
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-sm font-medium text-ink dark:text-on-dark"
    >
      {children}
    </label>
  )
}

const inputCls =
  'h-10 w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder-muted-soft focus:outline-none focus:ring-2 focus:ring-coral/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark dark:placeholder-on-dark-soft'

const selectCls =
  'h-10 w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark'

const textareaCls =
  'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder-muted-soft focus:outline-none focus:ring-2 focus:ring-coral/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark dark:placeholder-on-dark-soft'

// ── Main component ───────────────────────────────────────────────────────────

export function DocumentForm({
  mode: _mode,
  isLoading,
  mockUsers,
  descriptionLocked,
  existingFileUrl,
  userRole,
  isUploading = false,
  onSubmit,
  isAutorOrJefe = false,
  existingArchivoOriginalNombre,
  archivoOriginalBloqueado = false,
  existingArchivoDistribucionUrl,
}: DocumentFormProps) {
  const { t } = useTranslation('documents')
  const navigate = useNavigate()
  const { register, control, formState: { errors } } = useFormContext<DocumentFormInput>()

  const confidencialidad = useWatch({ control, name: 'confidencialidad' })
  const canEditConfidencialidad = CONFIDENCIALIDAD_EDIT_ROLES.has(userRole)
  const { data: areas = [] } = useAreas()
  const areasActivas = areas.filter((a) => a.activo)

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">

      {/* Titulo — full width */}
      <div>
        <Label htmlFor="titulo">{t('form.field_titulo')}</Label>
        <input
          id="titulo"
          type="text"
          className={inputCls}
          {...register('titulo')}
        />
        <FieldError name="titulo" />
      </div>

      {/* Row: Tipo + Area */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="tipo">{t('form.field_tipo')}</Label>
          <select id="tipo" className={selectCls} {...register('tipo')}>
            {DOC_TYPES.map((tipo) => (
              <option key={tipo} value={tipo}>{t(`types.${tipo}`)}</option>
            ))}
          </select>
          <FieldError name="tipo" />
        </div>

        <div>
          <Label htmlFor="areaId">{t('form.field_area')}</Label>
          <select id="areaId" className={selectCls} {...register('areaId')}>
            <option value="" disabled>— Seleccionar —</option>
            {areasActivas.map((area) => (
              <option key={area.id} value={area.id}>{area.nombre}</option>
            ))}
          </select>
          <FieldError name="areaId" />
        </div>
      </div>

      {/* Row: Version + Confidencialidad */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="version">{t('form.field_version')}</Label>
          <input
            id="version"
            type="text"
            className={inputCls}
            placeholder="v1.0"
            {...register('version')}
          />
          <FieldError name="version" />
        </div>

        <div>
          <Label htmlFor="confidencialidad">{t('form.field_confidencialidad')}</Label>
          <select
            id="confidencialidad"
            className={selectCls}
            disabled={!canEditConfidencialidad}
            {...register('confidencialidad')}
          >
            {CONFIDENCIALIDAD_VALUES.map((val) => (
              <option key={val} value={val}>
                {t(`form.confidencialidad_${val.toLowerCase()}`)}
              </option>
            ))}
          </select>
          <FieldError name="confidencialidad" />
        </div>
      </div>

      {/* Roles Autorizados — full width, conditional */}
      {confidencialidad === 'RESTRINGIDO' && (
        <div>
          <Label htmlFor="rolesAutorizados">{t('form.field_roles_autorizados')}</Label>
          <p className="mb-1.5 text-xs text-muted dark:text-on-dark-soft">
            {t('form.hint_restringido')}
          </p>
          <Controller
            control={control}
            name="rolesAutorizados"
            render={({ field }) => (
              <select
                id="rolesAutorizados"
                multiple
                size={6}
                className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark"
                value={field.value ?? []}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map(
                    (o) => o.value as UserRole,
                  )
                  field.onChange(selected)
                }}
              >
                {ALL_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {t(`auth:roles.${role}`)}
                  </option>
                ))}
              </select>
            )}
          />
          {errors.rolesAutorizados && (
            <p role="alert" className="mt-1 text-xs text-error">
              {errors.rolesAutorizados.message ??
                (errors.rolesAutorizados as { root?: { message?: string } }).root?.message}
            </p>
          )}
        </div>
      )}

      {/* Row: Revisor + Aprobador */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="revisorId">{t('form.field_revisor')}</Label>
          <select id="revisorId" className={selectCls} {...register('revisorId')}>
            <option value="">—</option>
            {mockUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.nombreCompleto}</option>
            ))}
          </select>
          <FieldError name="revisorId" />
        </div>

        <div>
          <Label htmlFor="aprobadorId">{t('form.field_aprobador')}</Label>
          <select id="aprobadorId" className={selectCls} {...register('aprobadorId')}>
            <option value="">—</option>
            {mockUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.nombreCompleto}</option>
            ))}
          </select>
          <FieldError name="aprobadorId" />
        </div>
      </div>

      {/* Row: Fecha Vigencia + Fecha Revisión Próxima */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="fechaVigencia">{t('form.field_vigencia')}</Label>
          <Controller
            control={control}
            name="fechaVigencia"
            render={({ field }) => (
              <LocaleDateInput id="fechaVigencia" field={field} className={inputCls} />
            )}
          />
          <FieldError name="fechaVigencia" />
        </div>

        <div>
          <Label htmlFor="fechaRevisionProxima">{t('form.field_revision')}</Label>
          <Controller
            control={control}
            name="fechaRevisionProxima"
            render={({ field }) => (
              <LocaleDateInput id="fechaRevisionProxima" field={field} className={inputCls} />
            )}
          />
          <FieldError name="fechaRevisionProxima" />
        </div>
      </div>

      {/* Descripcion — full width textarea */}
      <div>
        <Label htmlFor="descripcion">{t('form.field_descripcion')}</Label>
        <textarea
          id="descripcion"
          rows={4}
          className={textareaCls}
          disabled={descriptionLocked}
          {...register('descripcion')}
        />
        <FieldError name="descripcion" />
      </div>

      {/* Archivo original editable — solo Autor y JEFE_CONTROL_DOCUMENTARIO (RN-DOC-013, RN-DOC-016) */}
      {isAutorOrJefe && (
        <div>
          <Label htmlFor="archivoOriginalFile">{t('form.archivoOriginal.label')}</Label>
          <p className="mb-1.5 text-xs text-muted dark:text-on-dark-soft">
            {t('form.archivoOriginal.hint')}
          </p>
          <Controller
            control={control}
            name="archivoOriginalFile"
            render={({ field }) => (
              <FileUploadField
                value={field.value ?? null}
                onChange={field.onChange}
                existingFileName={existingArchivoOriginalNombre ?? undefined}
                variant="original"
                disabled={archivoOriginalBloqueado}
                frozenMessage={archivoOriginalBloqueado ? t('form.archivoOriginal.congelado') : undefined}
                replaceLabel={t('form.archivoOriginal.reemplazar')}
                isUploading={isUploading}
              />
            )}
          />
        </div>
      )}

      {/* PDF de distribución — informativo para todos los roles con acceso */}
      <div>
        <Label htmlFor="archivoDistribucion">{t('form.archivoDistribucion.label')}</Label>
        <p className="mb-1.5 text-xs text-muted dark:text-on-dark-soft">
          {t('form.archivoDistribucion.hint')}
        </p>
        {existingArchivoDistribucionUrl ? (
          <div className="flex items-center gap-3 rounded-lg border border-hairline bg-surface-soft px-4 py-3 dark:border-hairline/30 dark:bg-surface-dark-elevated">
            <span className="text-lg text-muted dark:text-on-dark-soft">📄</span>
            <span className="flex-1 truncate text-sm text-ink dark:text-on-dark">
              {fileNameFromUrl(existingArchivoDistribucionUrl)}
            </span>
          </div>
        ) : (
          <p className="rounded-lg border border-hairline/50 bg-surface-soft px-4 py-3 text-sm text-muted dark:border-hairline/20 dark:bg-surface-dark-elevated dark:text-on-dark-soft">
            {t('form.archivoDistribucion.autoGenerado')}
          </p>
        )}
      </div>

      {/* Action buttons — right aligned */}
      <div className="flex justify-end gap-3 border-t border-hairline pt-5 dark:border-hairline/20">
        <button
          type="button"
          onClick={() => navigate('/documents')}
          className="rounded-md border border-hairline bg-canvas px-5 py-2.5 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-elevated"
        >
          {t('form.btn_cancel')}
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-md bg-coral px-5 py-2.5 text-sm font-medium text-white hover:bg-coral-dark focus:outline-none focus:ring-2 focus:ring-coral/50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-coral-dark"
        >
          {isLoading ? '…' : t('form.btn_save')}
        </button>
      </div>
    </form>
  )
}
