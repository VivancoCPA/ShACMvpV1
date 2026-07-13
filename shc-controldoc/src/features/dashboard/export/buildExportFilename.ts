import type { DashboardExportRol } from './dashboardExport.types'

const ROL_SLUG: Record<DashboardExportRol, string> = {
  JEFE_CALIDAD_SYST: 'jefe-calidad',
  ALTA_DIRECCION: 'alta-direccion',
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

export function buildExportFilename(rol: DashboardExportRol, extension: 'xlsx' | 'pdf', now: Date): string {
  const yyyy = now.getFullYear()
  const mm = pad2(now.getMonth() + 1)
  const dd = pad2(now.getDate())
  const hh = pad2(now.getHours())
  const min = pad2(now.getMinutes())
  return `SHAC-Informe-Ejecutivo-${ROL_SLUG[rol]}-${yyyy}${mm}${dd}-${hh}${min}.${extension}`
}
