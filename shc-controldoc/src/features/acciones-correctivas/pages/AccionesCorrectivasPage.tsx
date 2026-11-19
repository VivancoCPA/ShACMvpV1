import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { FileSpreadsheet } from 'lucide-react'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { ErrorBoundary } from '../../../components/shared/ErrorBoundary'
import { useAuthStore } from '../../../stores/authStore'
import { ACContadores } from '../components/ACContadores'
import { ACFiltrosBar } from '../components/ACFiltrosBar'
import { ACTabla } from '../components/ACTabla'
import { useAccionesCorrectivasListado } from '../hooks/useAccionesCorrectivasListado'
import { exportarAccionesCorrectivas } from '../api/accionesCorrectivasListado.api'
import { descargarAccionesCorrectivasXlsx } from '../utils/exportAccionesCorrectivas'
import { filtrosAUrl, filtrosDesdeUrl } from '../utils/filtrosUrl'
import type { ACListadoFiltros } from '../types/accionesCorrectivasListado.types'
import type { User } from '../../../types/auth.types'

function errorCodeDe(error: unknown): string | undefined {
  return isAxiosError(error) ? (error.response?.data as { errorCode?: string } | undefined)?.errorCode : undefined
}

function AccionesCorrectivasContenido({ user }: { user: User }) {
  const { t, i18n } = useTranslation('accionesCorrectivas')
  const [searchParams, setSearchParams] = useSearchParams()
  const filtros = useMemo(() => filtrosDesdeUrl(searchParams), [searchParams])
  const setFiltros = (next: ACListadoFiltros) => setSearchParams(filtrosAUrl(next))

  const { data, isLoading, isError } = useAccionesCorrectivasListado(filtros)
  const empresaNombre = useAuthStore(
    (s) => s.empresasDisponibles.find((e) => e.id === s.empresaActivaId)?.razonSocial ?? s.empresaActivaId ?? '',
  )

  const exportar = useMutation({
    mutationFn: () => exportarAccionesCorrectivas(filtros),
    onSuccess: (items) => descargarAccionesCorrectivasXlsx(items, i18n, empresaNombre),
    onError: (error) => {
      toast.error(
        errorCodeDe(error) === 'EXPORT_DEMASIADAS_FILAS' ? t('errors.EXPORT_DEMASIADAS_FILAS') : t('errors.exportar'),
      )
    },
  })

  const acciones = (
    <button
      type="button"
      onClick={() => exportar.mutate()}
      disabled={exportar.isPending}
      className="flex items-center gap-2 rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-soft disabled:opacity-60 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
    >
      <FileSpreadsheet size={16} aria-hidden="true" />
      {exportar.isPending ? t('exportando') : t('exportar')}
    </button>
  )

  return (
    <PageWrapper title={user.rol === 'OPERARIO' ? t('titleMias') : t('title')} actions={acciones}>
      <ACContadores contadores={data?.contadores} filtros={filtros} onChange={setFiltros} />
      <ACFiltrosBar filtros={filtros} onChange={setFiltros} user={user} />
      {isError ? (
        <p role="alert" className="py-8 text-center text-sm text-error dark:text-error">
          {t('errors.cargar')}
        </p>
      ) : isLoading ? (
        <p className="py-8 text-center text-sm text-muted dark:text-on-dark-soft">{t('cargando')}</p>
      ) : (
        <ACTabla
          items={data?.items ?? []}
          pagination={data?.pagination}
          filtros={filtros}
          onChange={setFiltros}
          rol={user.rol}
        />
      )}
    </PageWrapper>
  )
}

// Listado unificado de acciones correctivas (modulo-acciones-correctivas). La visibilidad por rol la
// resuelve el servidor; aquí solo cambia el título y el filtro de responsable del OPERARIO.
export function AccionesCorrectivasPage() {
  const user = useAuthStore((s) => s.user)
  if (!user) return null
  return (
    <ErrorBoundary>
      <AccionesCorrectivasContenido user={user} />
    </ErrorBoundary>
  )
}
