import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { useDocumentDetail } from '../hooks/useDocumentDetail'
import { DocumentDetailHeader } from '../components/DocumentDetailHeader'
import { DocumentActionPanel } from '../components/DocumentActionPanel'
import { DocumentHistorial } from '../components/DocumentHistorial'
import { DocumentAuditTrail } from '../components/DocumentAuditTrail'

type Tab = 'detail' | 'historial' | 'auditTrail'

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-8">
      <div className="h-6 w-1/3 rounded-lg bg-surface-soft dark:bg-surface-dark-soft" />
      <div className="h-8 w-2/3 rounded-lg bg-surface-soft dark:bg-surface-dark-soft" />
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-surface-soft dark:bg-surface-dark-soft" />
        ))}
      </div>
    </div>
  )
}

export function DocumentDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation('documents')
  const [activeTab, setActiveTab] = useState<Tab>('detail')

  const { documento, isLoading, isError } = useDocumentDetail(id)

  const tabs: { key: Tab; label: string }[] = [
    { key: 'detail', label: t('detail.tabs.detail') },
    { key: 'historial', label: t('detail.tabs.historial') },
    { key: 'auditTrail', label: t('detail.tabs.auditTrail') },
  ]

  return (
    <div className="min-h-screen bg-canvas dark:bg-surface-dark">
      {/* Back button */}
      <div className="border-b border-hairline bg-canvas px-6 py-3 dark:border-hairline/20 dark:bg-surface-dark">
        <button
          onClick={() => navigate('/documentos')}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-body dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('detail.backToList')}
        </button>
      </div>

      {isLoading && <DetailSkeleton />}

      {isError && !isLoading && (
        <div className="flex items-center justify-center py-24 text-sm text-error">
          {t('errors.loadError')}
        </div>
      )}

      {documento && (
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Left column — 2/3 */}
            <div className="lg:col-span-2">
              <DocumentDetailHeader documento={documento} />

              {/* Tab bar */}
              <div className="mt-8 border-b border-hairline dark:border-hairline/20">
                <nav className="-mb-px flex gap-6" aria-label="Document sections">
                  {tabs.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={`pb-3 text-sm font-medium transition-colors ${
                        activeTab === key
                          ? 'border-b-2 border-coral text-coral'
                          : 'text-muted hover:text-body dark:text-on-dark-soft dark:hover:text-on-dark'
                      }`}
                      aria-current={activeTab === key ? 'page' : undefined}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab content */}
              <div className="mt-6">
                {activeTab === 'detail' && (
                  <div className="space-y-4 text-sm text-body dark:text-on-dark">
                    {documento.descripcion ? (
                      <p>{documento.descripcion}</p>
                    ) : (
                      <p className="text-muted dark:text-on-dark-soft">—</p>
                    )}
                  </div>
                )}
                {activeTab === 'historial' && <DocumentHistorial documento={documento} />}
                {activeTab === 'auditTrail' && <DocumentAuditTrail documento={documento} />}
              </div>
            </div>

            {/* Right column — 1/3 */}
            <div className="lg:col-span-1">
              <DocumentActionPanel documento={documento} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
