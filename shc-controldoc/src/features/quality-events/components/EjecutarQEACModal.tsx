import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Camera, Upload, X } from 'lucide-react'
import { useEliminarEvidenciaAC, useSubirEvidenciaAC } from '../hooks/useAccionCorrectivaFlujo'
import {
  EJECUTAR_DESCRIPCION_MAX,
  EJECUTAR_DESCRIPCION_MIN,
  ejecutarQEAccionSchema,
  type EjecutarQEACInput,
} from '../schemas/ejecutarQEAccion.schema'
import {
  EVIDENCIA_AC_ACCEPT,
  EVIDENCIA_AC_EXTENSIONES,
  EVIDENCIA_AC_MAX_ARCHIVOS,
  EVIDENCIA_AC_MAX_BYTES,
} from '../constants/evidenciaAC.constants'
import { EvidenciaACItem } from './EvidenciaACItem'
import type { AccionCorrectivaQE, EvidenciaACQE } from '../types/qualityEvent.types'

interface SubidaEnCurso {
  clave: string
  nombre: string
  progreso: number
}

function esPantallaTactil(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false
}

// "Marcar como ejecutada" (ac-ejecucion-verificacion-evidencias): el responsable sube de 1 a 5
// archivos (cada uno al seleccionarlo) y describe qué demuestran. El cierre lo hace el JCA.
export function EjecutarQEACModal({
  qeId,
  ac,
  onConfirm,
  onClose,
  isPending,
}: {
  qeId: string
  ac: AccionCorrectivaQE
  onConfirm: (data: EjecutarQEACInput) => void
  onClose: () => void
  isPending: boolean
}) {
  const { t } = useTranslation('qualityEvents')
  const subir = useSubirEvidenciaAC(qeId, ac.id)
  const eliminar = useEliminarEvidenciaAC(qeId, ac.id)
  const inputArchivosRef = useRef<HTMLInputElement>(null)
  const inputCamaraRef = useRef<HTMLInputElement>(null)

  // Estado de UI de la carga (no campos de formulario): las evidencias ya subidas parten de la AC
  // (p.ej. tras una devolución se conservan) y se actualizan con cada subida/borrado.
  const [subidas, setSubidas] = useState<EvidenciaACQE[]>(() => ac.evidencias ?? [])
  const [enCurso, setEnCurso] = useState<SubidaEnCurso[]>([])
  const [errorArchivos, setErrorArchivos] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [mostrarCamara] = useState(esPantallaTactil)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<EjecutarQEACInput>({
    resolver: zodResolver(ejecutarQEAccionSchema),
    mode: 'onChange',
    defaultValues: { descripcionEvidencia: ac.descripcionEvidencia ?? '' },
  })
  const largoDescripcion = (watch('descripcionEvidencia') ?? '').trim().length

  const agregarArchivos = (files: FileList | null) => {
    if (!files || files.length === 0) return
    setErrorArchivos(null)
    let disponibles = EVIDENCIA_AC_MAX_ARCHIVOS - subidas.length - enCurso.length

    for (const file of Array.from(files)) {
      const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
      if (!EVIDENCIA_AC_EXTENSIONES.includes(extension)) {
        setErrorArchivos(t('detail.acSection.evidencias.errorTipo', { nombre: file.name }))
        continue
      }
      if (file.size > EVIDENCIA_AC_MAX_BYTES) {
        setErrorArchivos(t('detail.acSection.evidencias.errorTamano', { nombre: file.name }))
        continue
      }
      if (disponibles <= 0) {
        setErrorArchivos(t('detail.acSection.evidencias.errorMaximo'))
        break
      }
      disponibles -= 1

      const clave = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`
      setEnCurso((prev) => [...prev, { clave, nombre: file.name, progreso: 0 }])
      subir.mutate(
        {
          file,
          onProgress: (progreso) =>
            setEnCurso((prev) => prev.map((s) => (s.clave === clave ? { ...s, progreso } : s))),
        },
        {
          onSuccess: (evidencia) => setSubidas((prev) => [...prev, evidencia]),
          onError: (error) => {
            const mensaje = (error as { response?: { data?: { message?: string } } }).response?.data?.message
            setErrorArchivos(mensaje ?? t('detail.acSection.evidencias.errorSubida', { nombre: file.name }))
          },
          onSettled: () => setEnCurso((prev) => prev.filter((s) => s.clave !== clave)),
        },
      )
    }
  }

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    agregarArchivos(e.target.files)
    e.target.value = ''
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setArrastrando(false)
    agregarArchivos(e.dataTransfer.files)
  }

  const onQuitar = (evidenciaId: string) => {
    eliminar.mutate(evidenciaId, {
      onSuccess: () => setSubidas((prev) => prev.filter((ev) => ev.id !== evidenciaId)),
    })
  }

  const puedeConfirmar = subidas.length > 0 && enCurso.length === 0 && isValid && !isPending
  const limiteAlcanzado = subidas.length + enCurso.length >= EVIDENCIA_AC_MAX_ARCHIVOS

  const botonSecundario =
    'flex items-center gap-1.5 rounded-md border border-hairline bg-canvas px-3 py-2 text-sm font-medium text-ink hover:bg-surface-soft disabled:opacity-60 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 dark:bg-black/60">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qeac-ejecutar-title"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('detail.acSection.actions.cancel')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>

        <h2 id="qeac-ejecutar-title" className="mb-1 font-medium text-ink dark:text-on-dark">
          {t('detail.acSection.ejecutarModal.title')}
        </h2>
        <p className="mb-4 text-sm text-muted dark:text-on-dark-soft">{t('detail.acSection.ejecutarModal.body')}</p>

        <form onSubmit={(e) => void handleSubmit(onConfirm)(e)} className="space-y-4">
          <div>
            <p className="mb-1 text-sm font-medium text-body dark:text-on-dark-soft">
              {t('detail.acSection.evidencias.titulo')} <span className="text-error">*</span>
            </p>
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setArrastrando(true)
              }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={onDrop}
              className={`rounded-md border-2 border-dashed p-4 text-center ${
                arrastrando
                  ? 'border-coral bg-coral/5 dark:border-coral dark:bg-coral/10'
                  : 'border-hairline dark:border-hairline/20'
              }`}
            >
              <p className="mb-3 text-xs text-muted dark:text-on-dark-soft">{t('detail.acSection.evidencias.ayuda')}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  className={botonSecundario}
                  disabled={limiteAlcanzado}
                  onClick={() => inputArchivosRef.current?.click()}
                >
                  <Upload size={14} aria-hidden="true" />
                  {t('detail.acSection.evidencias.elegir')}
                </button>
                {mostrarCamara && (
                  <button
                    type="button"
                    className={botonSecundario}
                    disabled={limiteAlcanzado}
                    onClick={() => inputCamaraRef.current?.click()}
                  >
                    <Camera size={14} aria-hidden="true" />
                    {t('detail.acSection.evidencias.tomarFoto')}
                  </button>
                )}
              </div>
              <input
                ref={inputArchivosRef}
                type="file"
                multiple
                accept={EVIDENCIA_AC_ACCEPT}
                className="hidden"
                data-testid="qeac-evidencias-input"
                aria-label={t('detail.acSection.evidencias.elegir')}
                onChange={onInputChange}
              />
              <input
                ref={inputCamaraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                aria-label={t('detail.acSection.evidencias.tomarFoto')}
                onChange={onInputChange}
              />
            </div>

            {errorArchivos && (
              <p role="alert" className="mt-1 text-xs text-error">
                {errorArchivos}
              </p>
            )}

            {(subidas.length > 0 || enCurso.length > 0) && (
              <ul className="mt-3 space-y-2">
                {subidas.map((ev) => (
                  <EvidenciaACItem
                    key={ev.id}
                    qeId={qeId}
                    acId={ac.id}
                    evidencia={ev}
                    onQuitar={() => onQuitar(ev.id)}
                    quitando={eliminar.isPending}
                  />
                ))}
                {enCurso.map((s) => (
                  <li key={s.clave} className="rounded-md border border-hairline p-2 dark:border-hairline/20">
                    <p className="truncate text-sm text-body dark:text-on-dark-soft">
                      {t('detail.acSection.evidencias.subiendo', { nombre: s.nombre })}
                    </p>
                    <div
                      role="progressbar"
                      aria-valuenow={s.progreso}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={s.nombre}
                      className="mt-1 h-1.5 w-full overflow-hidden rounded-pill bg-hairline dark:bg-surface-dark-soft"
                    >
                      <div className="h-full bg-coral dark:bg-coral" style={{ width: `${s.progreso}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label htmlFor="qeac-descripcionEvidencia" className="mb-1 block text-sm font-medium text-body dark:text-on-dark-soft">
              {t('detail.acSection.evidencias.descripcion')} <span className="text-error">*</span>
            </label>
            <textarea
              id="qeac-descripcionEvidencia"
              rows={3}
              maxLength={EJECUTAR_DESCRIPCION_MAX}
              className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark"
              {...register('descripcionEvidencia')}
            />
            <div className="mt-1 flex justify-between gap-2 text-xs">
              <span className="text-error">{errors.descripcionEvidencia?.message}</span>
              <span
                className={
                  largoDescripcion < EJECUTAR_DESCRIPCION_MIN ? 'text-muted dark:text-on-dark-soft' : 'text-success dark:text-success'
                }
              >
                {t('detail.acSection.ejecutarModal.contador', {
                  actual: largoDescripcion,
                  min: EJECUTAR_DESCRIPCION_MIN,
                  max: EJECUTAR_DESCRIPCION_MAX,
                })}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className={botonSecundario}>
              {t('detail.acSection.actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={!puedeConfirmar}
              className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-60 dark:bg-coral dark:hover:bg-coral-dark"
            >
              {t('detail.acSection.ejecutarModal.confirmar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
