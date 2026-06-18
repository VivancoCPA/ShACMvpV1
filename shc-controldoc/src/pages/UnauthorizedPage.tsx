import { Link } from 'react-router-dom'

export function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 dark:bg-surface-dark">
      <p className="text-6xl font-display font-normal text-error">403</p>
      <h1 className="mt-4 text-xl font-medium text-ink dark:text-on-dark">
        Acceso denegado
      </h1>
      <p className="mt-2 text-sm text-muted dark:text-on-dark-soft">
        No tienes permisos para acceder a esta sección.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-md border border-hairline bg-canvas px-5 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-elevated"
      >
        Volver al inicio
      </Link>
    </div>
  )
}
