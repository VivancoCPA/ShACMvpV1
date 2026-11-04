import { useTranslation } from 'react-i18next'

interface LastChangeNoteProps {
  nombre?: string | null
  fecha?: string | null
  emptyText: string
}

/** "Último cambio: {nombre}, {fecha}" — fecha con Intl.DateTimeFormat en el idioma activo. */
export function LastChangeNote({ nombre, fecha, emptyText }: LastChangeNoteProps) {
  const { t, i18n } = useTranslation('sesion')

  if (!nombre || !fecha) {
    return <p className="text-xs text-muted dark:text-on-dark-soft">{emptyText}</p>
  }

  const formatted = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(fecha),
  )
  return <p className="text-xs text-muted dark:text-on-dark-soft">{t('config.lastChange', { nombre, fecha: formatted })}</p>
}
