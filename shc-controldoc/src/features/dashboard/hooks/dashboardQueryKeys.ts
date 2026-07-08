export const DASHBOARD_QUERY_KEYS = {
  all: ['dashboard'] as const,
  kpis: (periodo?: string) => ['dashboard', 'kpis', periodo ?? 'current'] as const,
  summary: () => ['dashboard', 'summary'] as const,
} as const
