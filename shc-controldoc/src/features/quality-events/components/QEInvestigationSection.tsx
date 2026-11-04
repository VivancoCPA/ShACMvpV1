import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { X, Sparkles, Loader2 } from 'lucide-react'
import type { AxiosError } from 'axios'
import { useUserNames } from '../../users/hooks/useUserNames'
import { useAuthStore } from '../../../stores/authStore'
import { useUpdateQualityEvent } from '../hooks/useUpdateQualityEvent'
import { useAprobarCausaRaiz } from '../hooks/useAprobarCausaRaiz'
import { useFuncionalidades } from '../hooks/useFuncionalidades'
import { useAsistenteIA } from '../hooks/useAsistenteIA'
import { useCreateQEAccion } from '../hooks/useCreateQEAccion'
import { AgregarQEACModal } from './QEACSection'
import { AC_CREATE_VISIBLE_STATES } from '../constants/accionCorrectivaQE.constants'
import type { CreateQEACInput } from '../schemas/createQEAccion.schema'
import { esResponsableInvestigacion } from '../utils/qualityEventPermissions'
import type {
  QualityEvent,
  AnalisisCausaRaizMetodo,
  CincoPorques,
  Ishikawa,
  IshikawaCategoria,
  QualityEventUpdateInput,
  AccionSugeridaIA,
  OrigenIA,
  OrigenIAValor,
  SugerenciaCausaRaizIA,
} from '../types/qualityEvent.types'

const ISHIKAWA_CATEGORIAS: IshikawaCategoria[] = [
  'METODO',
  'MAQUINA',
  'MATERIAL',
  'MANO_DE_OBRA',
  'MEDICION',
  'MEDIO_AMBIENTE',
]

const causaRaizSchema = z.string().min(100).max(500)

interface QEInvestigationSectionProps {
  qe: QualityEvent
}

interface FormValues {
  metodoAnalisis: AnalisisCausaRaizMetodo
  cincoPorques: CincoPorques[]
  ishikawa: Ishikawa[]
  causaRaizDefinitiva: string
}

type ApiErrorBody = { message?: string; errorCode?: string }

function getApiError(error: unknown): ApiErrorBody {
  return (error as AxiosError<ApiErrorBody>)?.response?.data ?? {}
}

function buildDefaultCincoPorques(existing?: CincoPorques[]): CincoPorques[] {
  return [1, 2, 3, 4, 5].map((n) => existing?.[n - 1] ?? { pregunta: `¿Por qué ${n}?`, respuesta: '' })
}

function buildDefaultIshikawa(existing?: Ishikawa[]): Ishikawa[] {
  return ISHIKAWA_CATEGORIAS.map(
    (categoria) => existing?.find((i) => i.categoria === categoria) ?? { categoria, causa: '' },
  )
}

// Valores que el usuario copió desde la sugerencia IA con "Usar" — base para la marca IA / IA (editado).
interface AplicadoIA {
  causaRaiz?: string
  cincoPorques?: CincoPorques[]
  ishikawa?: Ishikawa[]
}

// Bloques del panel que siguen visibles (cada uno se oculta con Usar o Descartar).
// Solo uno de cincoPorques/ishikawa: la sugerencia sigue el método pedido (qe-asistente-ia-ishikawa).
interface PanelIA {
  causaRaiz?: string
  cincoPorques?: CincoPorques[]
  ishikawa?: Ishikawa[]
  acciones: AccionSugeridaIA[]
}

function origenCampo<T>(aplicado: T | undefined, actual: T, iguales: (a: T, b: T) => boolean): OrigenIAValor | undefined {
  if (aplicado === undefined) return undefined
  return iguales(aplicado, actual) ? 'IA' : 'IA_EDITADO'
}

const mismasRespuestas = (a: CincoPorques[], b: CincoPorques[]) =>
  a.length === b.length && a.every((p, i) => p.pregunta === b[i]?.pregunta && p.respuesta === b[i]?.respuesta)

// Ishikawa: se compara por categoría, no por posición.
const mismasCausas = (a: Ishikawa[], b: Ishikawa[]) =>
  a.every((item) => b.find((i) => i.categoria === item.categoria)?.causa === item.causa)

function MarcaIA({ origen }: { origen: OrigenIAValor | undefined }) {
  const { t } = useTranslation('qualityEvents')
  if (!origen) return null
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-pill bg-amber/15 px-2 py-0.5 text-[11px] font-medium text-amber dark:bg-amber/20 dark:text-amber">
      <Sparkles size={10} aria-hidden="true" />
      {origen === 'IA' ? t('detail.investigation.ia.marca') : t('detail.investigation.ia.marcaEditada')}
    </span>
  )
}

function BloqueSugerencia({
  titulo,
  children,
  onUsar,
  onDescartar,
}: {
  titulo: string
  children: ReactNode
  onUsar?: () => void
  onDescartar: () => void
}) {
  const { t } = useTranslation('qualityEvents')
  return (
    <div className="rounded-md border border-hairline bg-canvas p-3 dark:border-hairline/20 dark:bg-surface-dark">
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft">{titulo}</p>
      <div className="text-sm text-body dark:text-on-dark-soft">{children}</div>
      <div className="mt-2 flex gap-2">
        {onUsar && (
          <button
            type="button"
            onClick={onUsar}
            className="rounded-sm bg-coral px-3 py-1 text-xs font-medium text-white hover:bg-coral-dark dark:bg-coral dark:text-white dark:hover:bg-coral-dark"
          >
            {t('detail.investigation.ia.usar')}
          </button>
        )}
        <button
          type="button"
          onClick={onDescartar}
          className="rounded-sm border border-hairline px-3 py-1 text-xs font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:text-on-dark dark:hover:bg-surface-dark-soft"
        >
          {t('detail.investigation.ia.descartar')}
        </button>
      </div>
    </div>
  )
}

// Las preguntas que propone la IA se muestran como guía bajo el label; solo la respuesta es editable.
function PreguntaSugerida({ pregunta, n }: { pregunta: string | undefined; n: number }) {
  if (!pregunta || pregunta === `¿Por qué ${n}?`) return null
  return <p className="mb-1 text-xs text-muted dark:text-on-dark-soft">{pregunta}</p>
}

function PinModal({
  onConfirm,
  onClose,
  isPending,
  pinIncorrecto,
  noPinConfigured,
}: {
  onConfirm: (pin: string) => void
  onClose: () => void
  isPending: boolean
  /** El servidor respondió PIN_INCORRECTO — se muestra dentro del modal, sin cerrarlo. */
  pinIncorrecto: boolean
  /** Sin PIN: tienePinFirma === false o el servidor respondió PIN_NO_CONFIGURADO (ver QECierreSection). */
  noPinConfigured: boolean
}) {
  const { t } = useTranslation('qualityEvents')
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = () => {
    if (!/^\d{4}$/.test(pin)) {
      setError(true)
      return
    }
    setError(false)
    onConfirm(pin)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60">
      <div className="relative w-full max-w-sm rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('detail.investigation.pinModal.cancel')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>
        <h2 className="mb-1 font-medium text-ink dark:text-on-dark">
          {t('detail.investigation.pinModal.title')}
        </h2>

        {noPinConfigured ? (
          <div className="mb-4 rounded-md border border-hairline bg-surface-card px-3.5 py-2.5 text-sm text-body dark:border-hairline/20 dark:bg-surface-dark-elevated dark:text-on-dark">
            <p className="mb-1.5">{t('detail.investigation.pinModal.noPinConfigured')}</p>
            <Link to="/perfil#pin-firma" className="font-medium text-coral hover:underline dark:text-coral">
              {t('detail.investigation.pinModal.configurePinLink')}
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted dark:text-on-dark-soft">
              {t('detail.investigation.pinModal.body')}
            </p>
            <label htmlFor="qe-pin-input" className="sr-only">
              {t('detail.investigation.pinModal.placeholder')}
            </label>
            <input
              id="qe-pin-input"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={t('detail.investigation.pinModal.placeholder')}
              className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark"
            />
            {error && <p className="mt-1 text-xs text-error dark:text-error">{t('detail.investigation.pinModal.error')}</p>}
            {!error && pinIncorrecto && (
              <p role="alert" className="mt-1 text-xs text-error dark:text-error">
                {t('detail.investigation.errors.PIN_INCORRECTO')}
              </p>
            )}
            <Link
              to="/perfil#pin-firma"
              className="mt-1.5 inline-block text-xs text-coral hover:underline dark:text-coral"
            >
              {t('detail.investigation.pinModal.forgotPinLink')}
            </Link>
          </>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
          >
            {t('detail.investigation.pinModal.cancel')}
          </button>
          {!noPinConfigured && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-60 dark:bg-coral dark:text-white dark:hover:bg-coral-dark"
            >
              {t('detail.investigation.pinModal.confirm')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function QEInvestigationSection({ qe }: QEInvestigationSectionProps) {
  const { t, i18n } = useTranslation('qualityEvents')
  const user = useAuthStore((s) => s.user)
  const updateQE = useUpdateQualityEvent()
  const aprobarCausaRaiz = useAprobarCausaRaiz()
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [pinIncorrecto, setPinIncorrecto] = useState(false)
  const [pinNoConfigurado, setPinNoConfigurado] = useState(false)
  const { data: funcionalidades } = useFuncionalidades()
  const asistenteIA = useAsistenteIA()
  const createAC = useCreateQEAccion(qe.id)
  const [panelIA, setPanelIA] = useState<PanelIA | null>(null)
  const [aplicadoIA, setAplicadoIA] = useState<AplicadoIA>({})
  const [accionACrear, setAccionACrear] = useState<AccionSugeridaIA | null>(null)

  const isJefeCalidad = user?.rol === 'JEFE_CALIDAD_SYST'
  const causaRaizFirmada = Boolean(qe.causaRaizFirmadaEn)
  // PRD §1.3 (estado 3): el responsable investigador completa el análisis; solo el JCA lo aprueba.
  const isEditable =
    !qe.deletedAt &&
    !!user &&
    (isJefeCalidad || esResponsableInvestigacion(qe, user)) &&
    (qe.estado === 'EN_INVESTIGACION' || qe.estado === 'ANALISIS_COMPLETADO')
  const isCausaRaizEditable = isEditable && !causaRaizFirmada

  const { register, watch, setValue, getValues, reset, formState: { errors, isDirty }, clearErrors, setError } =
    useForm<FormValues>({
      defaultValues: {
        metodoAnalisis: qe.metodoAnalisis ?? '5_PORQUES',
        cincoPorques: buildDefaultCincoPorques(qe.cincoPorques),
        ishikawa: buildDefaultIshikawa(qe.ishikawa),
        causaRaizDefinitiva: qe.causaRaizDefinitiva ?? '',
      },
    })

  const metodo = watch('metodoAnalisis')
  const causaRaizValue = watch('causaRaizDefinitiva') ?? ''
  const cincoPorquesValue = watch('cincoPorques')
  const ishikawaValue = watch('ishikawa')

  // qe-asistente-ia: botón visible solo con la funcionalidad activa en el servidor y para quien
  // puede editar la causa raíz (mismas reglas que el endpoint). Crear AC: mismas reglas que QEACSection.
  const puedeAsistirIA = funcionalidades?.asistenteIA === true && isCausaRaizEditable
  const puedeCrearAC = !qe.deletedAt && isJefeCalidad && AC_CREATE_VISIBLE_STATES.includes(qe.estado)

  // Marca IA / IA (editado): derivada en render comparando con lo que se copió desde la sugerencia.
  const origenCausaRaiz = origenCampo(aplicadoIA.causaRaiz, causaRaizValue, (a, b) => a === b)
  const origenCincoPorques =
    metodo === '5_PORQUES' ? origenCampo(aplicadoIA.cincoPorques, cincoPorquesValue, mismasRespuestas) : undefined
  const origenIshikawa =
    metodo === 'ISHIKAWA' ? origenCampo(aplicadoIA.ishikawa, ishikawaValue, mismasCausas) : undefined

  const errorMessage = (error: unknown): string => {
    const { errorCode, message } = getApiError(error)
    if (errorCode) return t(`errors.${errorCode}`, { defaultValue: message ?? errorCode })
    return message ?? t('detail.investigation.errors.generico')
  }

  const handleToolSwitch = (target: AnalisisCausaRaizMetodo) => {
    if (!isEditable || target === metodo) return
    toast(t('detail.investigation.switchToastMessage'), {
      action: {
        label: t('detail.investigation.confirmarCambio'),
        onClick: () => {
          setValue('metodoAnalisis', target, { shouldDirty: true })
          if (target === 'ISHIKAWA') {
            setValue('cincoPorques', buildDefaultCincoPorques(), { shouldDirty: true })
          } else {
            setValue('ishikawa', buildDefaultIshikawa(), { shouldDirty: true })
          }
        },
      },
    })
  }

  // Solo la lista de la herramienta activa: el servidor limpia la otra. La causa raíz deja de
  // enviarse una vez firmada (el servidor rechaza cambiarla con CAUSA_RAIZ_FIRMADA).
  const guardarAnalisis = async (): Promise<boolean> => {
    const values = getValues()
    const data: QualityEventUpdateInput = {
      metodoAnalisis: values.metodoAnalisis,
      ...(values.metodoAnalisis === '5_PORQUES'
        ? { cincoPorques: values.cincoPorques }
        : { ishikawa: values.ishikawa }),
      ...(causaRaizFirmada ? {} : { causaRaizDefinitiva: values.causaRaizDefinitiva }),
    }
    // Solo los campos aplicados desde la sugerencia que efectivamente viajan en esta llamada.
    const origenIA: OrigenIA = {
      ...(origenCausaRaiz && !causaRaizFirmada ? { causaRaiz: origenCausaRaiz } : {}),
      ...(origenCincoPorques ? { cincoPorques: origenCincoPorques } : {}),
      ...(origenIshikawa ? { ishikawa: origenIshikawa } : {}),
    }
    if (origenIA.causaRaiz || origenIA.cincoPorques || origenIA.ishikawa) data.origenIA = origenIA
    try {
      await updateQE.mutateAsync({ id: qe.id, data })
      reset(values)
      toast.success(t('detail.investigation.guardado'))
      return true
    } catch (error: unknown) {
      toast.error(errorMessage(error))
      return false
    }
  }

  const onGuardar = () => {
    void guardarAnalisis()
  }

  // El servidor aprueba lo que tiene guardado: los cambios pendientes se guardan antes del PIN.
  const onAprobarClick = async () => {
    const result = causaRaizSchema.safeParse(getValues('causaRaizDefinitiva').trim())
    if (!result.success) {
      setError('causaRaizDefinitiva', {
        type: 'manual',
        message: t('detail.investigation.errors.causaRaizLength'),
      })
      return
    }
    clearErrors('causaRaizDefinitiva')
    if (isDirty && !(await guardarAnalisis())) return
    setPinIncorrecto(false)
    setPinNoConfigurado(false)
    setPinModalOpen(true)
  }

  const onPinConfirm = (pin: string) => {
    setPinIncorrecto(false)
    aprobarCausaRaiz.mutate(
      { id: qe.id, pin },
      {
        onSuccess: () => setPinModalOpen(false),
        onError: (error: unknown) => {
          const { errorCode } = getApiError(error)
          if (errorCode === 'PIN_INCORRECTO') {
            setPinIncorrecto(true)
          } else if (errorCode === 'PIN_NO_CONFIGURADO') {
            setPinNoConfigurado(true)
          } else {
            setPinModalOpen(false)
            toast.error(errorMessage(error))
          }
        },
      },
    )
  }

  // El método visible en el formulario, aunque no esté guardado (qe-asistente-ia-ishikawa D6).
  const onAsistirIA = () => {
    asistenteIA.mutate({ id: qe.id, metodo }, {
      onSuccess: (sugerencia: SugerenciaCausaRaizIA) =>
        setPanelIA({
          causaRaiz: sugerencia.causaRaizProbable,
          cincoPorques: sugerencia.cincoPorques ?? undefined,
          ishikawa: sugerencia.ishikawa ?? undefined,
          acciones: sugerencia.accionesSugeridas,
        }),
      onError: (error: unknown) => {
        const { errorCode, message } = getApiError(error)
        toast.error(
          errorCode === 'IA_LIMITE_DIARIO'
            ? t('errors.IA_LIMITE_DIARIO')
            : (message ?? t('detail.investigation.errors.generico')),
        )
      },
    })
  }

  const ocultarBloque = (bloque: 'causaRaiz' | 'cincoPorques' | 'ishikawa') =>
    setPanelIA((p) => (p ? { ...p, [bloque]: undefined } : p))

  const usarCausaRaiz = (sugerida: string) => {
    setValue('causaRaizDefinitiva', sugerida, { shouldDirty: true })
    clearErrors('causaRaizDefinitiva')
    setAplicadoIA((a) => ({ ...a, causaRaiz: sugerida }))
    ocultarBloque('causaRaiz')
  }

  const nombreMetodo = (m: AnalisisCausaRaizMetodo) =>
    m === '5_PORQUES' ? t('detail.investigation.tool5Porques') : t('detail.investigation.toolIshikawa')

  // Una sola confirmación: la de cambio de método si el usuario cambió mientras esperaba la
  // respuesta, o la de reemplazo si ya había datos en el análisis (qe-asistente-ia-ishikawa D6).
  const confirmarYAplicar = (metodoSugerido: AnalisisCausaRaizMetodo, mensajeReemplazo: string, aplicar: () => void) => {
    const values = getValues()
    const confirmar = (mensaje: string) =>
      toast(mensaje, { action: { label: t('detail.investigation.confirmarCambio'), onClick: aplicar } })
    if (values.metodoAnalisis !== metodoSugerido) {
      confirmar(t('detail.investigation.ia.confirmarCambioMetodo', { metodo: nombreMetodo(metodoSugerido) }))
      return
    }
    const hayDatos =
      values.cincoPorques.some((p) => p.respuesta.trim() !== '') || values.ishikawa.some((i) => i.causa.trim() !== '')
    if (hayDatos) confirmar(mensajeReemplazo)
    else aplicar()
  }

  const usarCincoPorques = (sugeridos: CincoPorques[]) => {
    confirmarYAplicar('5_PORQUES', t('detail.investigation.ia.confirmarReemplazo'), () => {
      const filas = sugeridos.map((p) => ({ ...p }))
      setValue('metodoAnalisis', '5_PORQUES', { shouldDirty: true })
      setValue('cincoPorques', filas, { shouldDirty: true })
      setValue('ishikawa', buildDefaultIshikawa(), { shouldDirty: true })
      setAplicadoIA((a) => ({ ...a, cincoPorques: filas }))
      ocultarBloque('cincoPorques')
    })
  }

  // Filas en el orden de ISHIKAWA_CATEGORIAS, buscadas por categoría (la IA puede devolverlas en otro orden).
  const usarIshikawa = (sugeridos: Ishikawa[]) => {
    confirmarYAplicar('ISHIKAWA', t('detail.investigation.ia.confirmarReemplazoIshikawa'), () => {
      const filas = buildDefaultIshikawa(sugeridos).map((i) => ({ ...i }))
      setValue('metodoAnalisis', 'ISHIKAWA', { shouldDirty: true })
      setValue('ishikawa', filas, { shouldDirty: true })
      setValue('cincoPorques', buildDefaultCincoPorques(), { shouldDirty: true })
      setAplicadoIA((a) => ({ ...a, ishikawa: filas }))
      ocultarBloque('ishikawa')
    })
  }

  const onCrearAC = async (data: CreateQEACInput) => {
    await createAC.mutateAsync(data)
    setAccionACrear(null)
  }

  const { getName } = useUserNames([qe.causaRaizAprobadaPorId])
  const aprobadorNombre = qe.causaRaizAprobadaPorId
    ? getName(qe.causaRaizAprobadaPorId)
    : undefined

  const inputClass =
    'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'
  const labelClass = 'mb-1 block text-sm font-medium text-body dark:text-on-dark-soft'

  return (
    <section
      aria-labelledby="qe-investigation-title"
      className="rounded-lg border border-hairline bg-surface-card p-6 dark:border-hairline/20 dark:bg-surface-dark-elevated"
    >
      {pinModalOpen && (
        <PinModal
          onConfirm={onPinConfirm}
          onClose={() => setPinModalOpen(false)}
          isPending={aprobarCausaRaiz.isPending}
          pinIncorrecto={pinIncorrecto}
          noPinConfigured={user?.tienePinFirma === false || pinNoConfigurado}
        />
      )}

      {accionACrear && (
        <AgregarQEACModal
          onConfirm={onCrearAC}
          onClose={() => setAccionACrear(null)}
          isPending={createAC.isPending}
          defaultValues={{ descripcion: accionACrear.descripcion }}
          ayuda={
            <p className="rounded-md bg-surface-cream px-3.5 py-2.5 text-xs text-body dark:bg-surface-dark-soft dark:text-on-dark-soft">
              <Sparkles size={12} className="mr-1 inline text-amber dark:text-amber" aria-hidden="true" />
              {t('detail.investigation.ia.ayudaAC', {
                tipo: t(`detail.investigation.ia.tipoAccion.${accionACrear.tipo}`),
                rol: accionACrear.rolResponsableSugerido,
                dias: accionACrear.plazoDiasHabiles,
              })}
            </p>
          }
        />
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 id="qe-investigation-title" className="text-base font-medium text-ink dark:text-on-dark">
          {t('detail.investigation.title')}
        </h2>
        {puedeAsistirIA && (
          <button
            type="button"
            onClick={onAsistirIA}
            disabled={asistenteIA.isPending}
            className="flex items-center gap-1.5 rounded-md border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-soft disabled:opacity-60 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
          >
            {asistenteIA.isPending ? (
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles size={13} aria-hidden="true" />
            )}
            {asistenteIA.isPending ? t('detail.investigation.ia.analizando') : t('detail.investigation.asistirIA')}
          </button>
        )}
      </div>

      {panelIA && (panelIA.causaRaiz || panelIA.cincoPorques || panelIA.ishikawa || panelIA.acciones.length > 0) && (
        <div
          role="region"
          aria-label={t('detail.investigation.ia.etiqueta')}
          className="mb-4 space-y-3 rounded-lg border border-amber/40 bg-surface-cream p-4 dark:border-amber/30 dark:bg-surface-dark-soft"
        >
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink dark:text-on-dark">
            <Sparkles size={14} className="text-amber dark:text-amber" aria-hidden="true" />
            {t('detail.investigation.ia.etiqueta')}
            {funcionalidades?.asistenteIASimulado === true && (
              <span className="text-muted dark:text-on-dark-soft">{t('detail.investigation.ia.simulado')}</span>
            )}
          </p>

          {panelIA.causaRaiz && (
            <BloqueSugerencia
              titulo={t('detail.investigation.ia.causaRaizProbable')}
              onUsar={() => usarCausaRaiz(panelIA.causaRaiz!)}
              onDescartar={() => ocultarBloque('causaRaiz')}
            >
              <p className="whitespace-pre-wrap">{panelIA.causaRaiz}</p>
            </BloqueSugerencia>
          )}

          {panelIA.cincoPorques && (
            <BloqueSugerencia
              titulo={t('detail.investigation.tool5Porques')}
              onUsar={() => usarCincoPorques(panelIA.cincoPorques!)}
              onDescartar={() => ocultarBloque('cincoPorques')}
            >
              <ol className="list-decimal space-y-1 pl-5">
                {panelIA.cincoPorques.map((p, i) => (
                  <li key={i}>
                    <span className="font-medium text-ink dark:text-on-dark">{p.pregunta}</span> {p.respuesta}
                  </li>
                ))}
              </ol>
            </BloqueSugerencia>
          )}

          {panelIA.ishikawa && (
            <BloqueSugerencia
              titulo={t('detail.investigation.ia.bloqueIshikawa')}
              onUsar={() => usarIshikawa(panelIA.ishikawa!)}
              onDescartar={() => ocultarBloque('ishikawa')}
            >
              <ul className="space-y-1">
                {buildDefaultIshikawa(panelIA.ishikawa).map((i) => (
                  <li key={i.categoria}>
                    <span className="font-medium text-ink dark:text-on-dark">
                      {t(`detail.investigation.ishikawaCategoria.${i.categoria}`)}:
                    </span>{' '}
                    {i.causa}
                  </li>
                ))}
              </ul>
            </BloqueSugerencia>
          )}

          {panelIA.acciones.length > 0 && (
            <BloqueSugerencia
              titulo={t('detail.investigation.ia.accionesSugeridas')}
              onDescartar={() => setPanelIA((p) => (p ? { ...p, acciones: [] } : p))}
            >
              <ul className="space-y-2">
                {panelIA.acciones.map((accion, i) => (
                  <li key={i} className="flex items-start justify-between gap-3">
                    <div>
                      <p>{accion.descripcion}</p>
                      <p className="mt-0.5 text-xs text-muted dark:text-on-dark-soft">
                        {t('detail.investigation.ia.ayudaAC', {
                          tipo: t(`detail.investigation.ia.tipoAccion.${accion.tipo}`),
                          rol: accion.rolResponsableSugerido,
                          dias: accion.plazoDiasHabiles,
                        })}
                      </p>
                    </div>
                    {puedeCrearAC && (
                      <button
                        type="button"
                        onClick={() => setAccionACrear(accion)}
                        className="shrink-0 rounded-sm border border-coral/50 px-3 py-1 text-xs font-medium text-coral hover:bg-coral/10 dark:border-coral/50 dark:text-coral dark:hover:bg-coral/10"
                      >
                        {t('detail.investigation.ia.crearAC')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </BloqueSugerencia>
          )}
        </div>
      )}

      {/* Tool toggle */}
      <div className="mb-4">
        <span className={labelClass}>
          {t('detail.investigation.metodoAnalisis')}
          <MarcaIA origen={origenCincoPorques ?? origenIshikawa} />
        </span>
        {isEditable ? (
          <div className="flex gap-4">
            {(['5_PORQUES', 'ISHIKAWA'] as const).map((tool) => (
              <label key={tool} className="flex items-center gap-1.5 text-sm text-body dark:text-on-dark-soft">
                <input
                  type="radio"
                  name="metodoAnalisis"
                  checked={metodo === tool}
                  onChange={() => handleToolSwitch(tool)}
                  className="accent-coral"
                />
                {tool === '5_PORQUES'
                  ? t('detail.investigation.tool5Porques')
                  : t('detail.investigation.toolIshikawa')}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-body dark:text-on-dark">
            {metodo === '5_PORQUES'
              ? t('detail.investigation.tool5Porques')
              : t('detail.investigation.toolIshikawa')}
          </p>
        )}
      </div>

      {/* 5 Porqués table */}
      {metodo === '5_PORQUES' && (
        <div className="mb-4 space-y-3">
          {[0, 1, 2, 3, 4].map((idx) => (
            <div key={idx}>
              <label htmlFor={`porque-${idx}`} className={labelClass}>
                {t('detail.investigation.porque', { n: idx + 1 })}
              </label>
              <PreguntaSugerida pregunta={cincoPorquesValue?.[idx]?.pregunta} n={idx + 1} />
              {isEditable ? (
                <textarea
                  id={`porque-${idx}`}
                  rows={2}
                  className={inputClass}
                  placeholder={t('detail.investigation.respuestaPlaceholder')}
                  {...register(`cincoPorques.${idx}.respuesta` as const)}
                />
              ) : (
                <p className="text-sm text-body dark:text-on-dark-soft">
                  {qe.cincoPorques?.[idx]?.respuesta || '—'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ishikawa categories */}
      {metodo === 'ISHIKAWA' && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ISHIKAWA_CATEGORIAS.map((categoria, idx) => (
            <div key={categoria}>
              <label htmlFor={`ishikawa-${categoria}`} className={labelClass}>
                {t(`detail.investigation.ishikawaCategoria.${categoria}`)}
              </label>
              {isEditable ? (
                <textarea
                  id={`ishikawa-${categoria}`}
                  rows={2}
                  className={inputClass}
                  placeholder={t('detail.investigation.respuestaPlaceholder')}
                  {...register(`ishikawa.${idx}.causa` as const)}
                />
              ) : (
                <p className="text-sm text-body dark:text-on-dark-soft">
                  {qe.ishikawa?.find((i) => i.categoria === categoria)?.causa || '—'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Causa raíz definitiva */}
      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="causaRaizDefinitiva" className="block text-sm font-medium text-body dark:text-on-dark-soft">
            {t('detail.investigation.causaRaizDefinitiva')}
            <MarcaIA origen={origenCausaRaiz} />
          </label>
          {isCausaRaizEditable && (
            <span className="text-xs text-muted dark:text-on-dark-soft">{causaRaizValue.length}/500</span>
          )}
        </div>

        {qe.causaRaizFirmadaEn ? (
          <>
            <p className="whitespace-pre-wrap text-sm text-body dark:text-on-dark-soft">
              {qe.causaRaizDefinitiva}
            </p>
            <p className="mt-2 text-xs text-success dark:text-success">
              {t('detail.investigation.aprobadoPor', {
                nombre: aprobadorNombre,
                fecha: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }).format(
                  new Date(qe.causaRaizFirmadaEn),
                ),
              })}
            </p>
          </>
        ) : isCausaRaizEditable ? (
          <>
            <textarea
              id="causaRaizDefinitiva"
              rows={4}
              maxLength={500}
              className={inputClass}
              placeholder={t('detail.investigation.causaRaizPlaceholder')}
              {...register('causaRaizDefinitiva')}
            />
            {errors.causaRaizDefinitiva && (
              <p className="mt-1 text-xs text-error dark:text-error">{errors.causaRaizDefinitiva.message}</p>
            )}
          </>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-body dark:text-on-dark-soft">
            {qe.causaRaizDefinitiva || '—'}
          </p>
        )}
      </div>

      {isEditable && (
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onGuardar}
            disabled={updateQE.isPending}
            className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-60 dark:bg-coral dark:text-white dark:hover:bg-coral-dark"
          >
            {t('detail.investigation.guardar')}
          </button>
          {isJefeCalidad && isCausaRaizEditable && causaRaizValue.length > 0 && (
            <button
              type="button"
              onClick={() => void onAprobarClick()}
              disabled={updateQE.isPending}
              className="rounded-md border border-success/40 px-4 py-2 text-sm font-medium text-success hover:bg-success/10 disabled:opacity-60 dark:border-success/40 dark:text-success dark:hover:bg-success/10"
            >
              {t('detail.investigation.aprobarCausaRaiz')}
            </button>
          )}
          {!isJefeCalidad && !causaRaizFirmada && (
            <p className="text-xs text-muted dark:text-on-dark-soft">
              {t('detail.investigation.pendienteAprobacion')}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
