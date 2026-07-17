import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FormProvider } from 'react-hook-form'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { ErrorBoundary } from '../../../components/shared/ErrorBoundary'
import { DocumentForm } from '../components/DocumentForm'
import { useDocumentForm } from '../hooks/useDocumentForm'
import { useAuthStore } from '../../../stores/authStore'
import { mockUsers } from '../../../mocks/fixtures/documents.fixtures'
import { getDocumentPermissions } from '../permissions'
import type { DocRole } from '../../../types/documents.types'

export function DocumentFormPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation('documents')
  const navigate = useNavigate()
  const mode = id ? 'edit' : 'create'
  const userRole = useAuthStore((s) => s.user?.rol ?? 'OPERARIO')
  const userId = useAuthStore((s) => s.user?.id ?? null)

  const { form, documento, isDocLoading, isSubmitting, onSubmit } = useDocumentForm({
    mode,
    documentId: id,
  })

  const title = t(mode === 'create' ? 'form.title_create' : 'form.title_edit')

  // Edit mode: loading state
  if (mode === 'edit' && isDocLoading) {
    return (
      <PageWrapper title={title}>
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-hairline dark:bg-surface-dark-elevated" />
          ))}
        </div>
      </PageWrapper>
    )
  }

  // DocumentEditGuard already restricted access to this route to the document's real
  // autorId or a global JEFE_CONTROL_DOCUMENTARIO/JEFE_CALIDAD_SYST, so docRole here only
  // ever resolves to AUTOR or JEFE_CALIDAD — never REVISOR/APROBADOR/OPERARIO.
  const isJefeCalidadGlobal =
    userRole === 'JEFE_CALIDAD_SYST' || userRole === 'JEFE_CONTROL_DOCUMENTARIO'
  const isAuthor = !!documento && documento.autorId === userId
  const docRole: DocRole = isAuthor ? 'AUTOR' : isJefeCalidadGlobal ? 'JEFE_CALIDAD' : 'OPERARIO'
  const perms = documento
    ? getDocumentPermissions(documento.estado, docRole, {
        archivoOriginalBloqueado: documento.archivoOriginalBloqueado,
      })
    : null

  // Full document editing (all fields) requires canEdit — AUTOR only in BORRADOR,
  // JEFE_CALIDAD in BORRADOR or EN_REVISION.
  const canEditFull = mode === 'create' || (perms?.canEdit ?? false)

  // Edit mode is BORRADOR-only. Replacing just the archivo original in EN_REVISION
  // (RN-DOC-018) goes through the dedicated modal on DocumentDetailPage instead.
  if (mode === 'edit' && documento && !canEditFull) {
    return (
      <PageWrapper title={title}>
        <div className="rounded-lg border border-error/30 bg-error/5 p-6 dark:border-error/20 dark:bg-error/10">
          <p className="text-sm font-medium text-error">
            {t('form.error_not_borrador')}
          </p>
          <p className="mt-1 text-xs text-muted dark:text-on-dark-soft">
            {t('common:statuses.' + documento.estado)}
          </p>
          <button
            type="button"
            onClick={() => navigate('/documents')}
            className="mt-4 rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-elevated"
          >
            {t('form.btn_cancel')}
          </button>
        </div>
      </PageWrapper>
    )
  }

  const descriptionLocked = mode === 'edit' && !canEditFull
  const isAutorOrJefe = mode === 'create'
    ? !(['OPERARIO', 'SUPERVISOR'] as typeof userRole[]).includes(userRole)
    : (perms?.canViewArchivoOriginal ?? false)

  return (
    <PageWrapper title={title}>
      <ErrorBoundary>
        <div className="mx-auto max-w-2xl rounded-xl bg-surface-card p-8 dark:bg-surface-dark-elevated">
          <FormProvider {...form}>
            <DocumentForm
              mode={mode}
              isLoading={isSubmitting}
              mockUsers={mockUsers}
              descriptionLocked={descriptionLocked}
              existingFileUrl={documento?.archivoUrl}
              userRole={userRole}
              isUploading={isSubmitting}
              onSubmit={onSubmit}
              isAutorOrJefe={isAutorOrJefe}
              existingArchivoOriginalNombre={documento?.archivoOriginalNombre ?? null}
              archivoOriginalBloqueado={documento?.archivoOriginalBloqueado ?? false}
              existingArchivoDistribucionUrl={documento?.archivoDistribucionUrl ?? null}
            />
          </FormProvider>
        </div>
      </ErrorBoundary>
    </PageWrapper>
  )
}
