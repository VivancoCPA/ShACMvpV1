export type RelativeTimeUnit = 'justNow' | 'minutesAgo' | 'hoursAgo' | 'daysAgo'

export interface RelativeTimeParts {
  unit: RelativeTimeUnit
  count: number
}

export function getRelativeTimeParts(createdAt: string, now: Date = new Date()): RelativeTimeParts {
  const diffMs = now.getTime() - new Date(createdAt).getTime()
  const diffMinutes = Math.floor(diffMs / 60_000)

  if (diffMinutes < 1) return { unit: 'justNow', count: 0 }
  if (diffMinutes < 60) return { unit: 'minutesAgo', count: diffMinutes }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return { unit: 'hoursAgo', count: diffHours }

  const diffDays = Math.floor(diffHours / 24)
  return { unit: 'daysAgo', count: diffDays }
}
