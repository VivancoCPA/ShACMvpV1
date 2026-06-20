import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FormProvider } from 'react-hook-form'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { ErrorBoundary } from '../../../components/shared/ErrorBoundary'
import { DocumentForm } from '../components/DocumentForm'
import { useDocumentForm } from '../hooks/useDocumentForm'
import { useAuthStore } from '../../../stores/authStore'
import { mockUsers } from '../../../mocks/fixtures/documents.fixtures'

export function DocumentFormPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation('documents')
  const navigate = useNavigate()
  const mode = id ? 'edit' : 'create'
  const userRole = useAuthStore((s) => s.user?.rol ?? 'OPERARIO')

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

  // Edit mode: block non-BORRADOR documents
  if (mode === 'edit' && documento && documento.estado !== 'BORRADOR') {
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

  const descriptionLocked = mode === 'edit' && !!documento && documento.estado !== 'BORRADOR'

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
            />
          </FormProvider>
        </div>
      </ErrorBoundary>
    </PageWrapper>
  )
}
