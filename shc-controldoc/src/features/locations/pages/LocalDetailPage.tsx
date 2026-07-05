import { useParams } from 'react-router-dom'

export function LocalDetailPage() {
  const { id } = useParams()

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-4xl">🚧</p>
      <h2 className="mt-4 text-lg font-medium text-ink dark:text-on-dark">
        Detalle de Local {id}
      </h2>
      <p className="mt-1 text-sm text-muted dark:text-on-dark-soft">Próximamente</p>
    </div>
  )
}
