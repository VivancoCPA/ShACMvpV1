import { useParams } from 'react-router-dom'

export function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-4xl">🚧</p>
      <h2 className="mt-4 text-lg font-medium text-ink dark:text-on-dark">{label}</h2>
      <p className="mt-1 text-sm text-muted dark:text-on-dark-soft">Próximamente</p>
    </div>
  )
}

export function LocalNewComingSoon() {
  return <ComingSoon label="Nuevo local" />
}

export function LocalEditComingSoon() {
  const { id } = useParams()
  return <ComingSoon label={`Editar local ${id}`} />
}

export function ZonaNewComingSoon() {
  const { localId } = useParams()
  return <ComingSoon label={`Nueva zona (local ${localId})`} />
}

export function ZonaEditComingSoon() {
  const { localId, zonaId } = useParams()
  return <ComingSoon label={`Editar zona ${zonaId} (local ${localId})`} />
}
