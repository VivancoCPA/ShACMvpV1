import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 dark:bg-surface-dark">
      <p className="text-8xl font-display font-normal text-coral">404</p>
      <h1 className="mt-4 text-xl font-medium text-ink dark:text-on-dark">
        Página no encontrada
      </h1>
      <p className="mt-2 text-sm text-muted dark:text-on-dark-soft">
        La ruta que buscas no existe.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-md bg-coral px-5 py-2 text-sm font-medium text-white hover:bg-coral-dark"
      >
        Volver al inicio
      </Link>
    </div>
  )
}
