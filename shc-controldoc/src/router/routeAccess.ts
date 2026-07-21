import { matchRoutes, type RouteObject } from 'react-router-dom'
import type { UserRole } from '../types/auth.types'

/**
 * Grupos de roles por sección — única fuente de verdad. `router/index.tsx`
 * pasa estas mismas constantes a cada `<RoleGuard requiredRoles={...} />`,
 * y `ROUTE_ACCESS_TABLE` (más abajo) las asocia a cada path concreto para
 * que `isRouteAllowedForRole` pueda validar un pathname fuera del árbol de
 * rutas (p.ej. antes de navegar tras login). Si agregas una ruta nueva con
 * `requiredRoles` en el router, agrega también su entrada aquí — de lo
 * contrario `isRouteAllowedForRole` la tratará como abierta a cualquier rol
 * autenticado.
 */
export const ROUTE_ROLE_GROUPS = {
  documentsView: [
    'OPERARIO',
    'SUPERVISOR',
    'JEFE_CALIDAD_SYST',
    'JEFE_CONTROL_DOCUMENTARIO',
    'AUDITOR_INTERNO',
    'ALTA_DIRECCION',
  ],
  documentsCreate: ['JEFE_CONTROL_DOCUMENTARIO', 'JEFE_CALIDAD_SYST'],
  nonconformitiesView: [
    'SUPERVISOR',
    'JEFE_CALIDAD_SYST',
    'JEFE_CONTROL_DOCUMENTARIO',
    'AUDITOR_INTERNO',
    'ALTA_DIRECCION',
  ],
  nonconformitiesCreate: ['SUPERVISOR', 'JEFE_CALIDAD_SYST'],
  incidentsView: ['OPERARIO', 'SUPERVISOR', 'JEFE_CALIDAD_SYST', 'AUDITOR_INTERNO', 'ALTA_DIRECCION'],
  incidentsEdit: ['SUPERVISOR', 'JEFE_CALIDAD_SYST'],
  qualityEventsView: [
    'OPERARIO',
    'SUPERVISOR',
    'JEFE_CALIDAD_SYST',
    'JEFE_CONTROL_DOCUMENTARIO',
    'AUDITOR_INTERNO',
    'ALTA_DIRECCION',
  ],
  qualityEventsCreate: ['OPERARIO', 'SUPERVISOR', 'JEFE_CALIDAD_SYST'],
  dashboard: [
    'OPERARIO',
    'SUPERVISOR',
    'JEFE_CALIDAD_SYST',
    'JEFE_CONTROL_DOCUMENTARIO',
    'AUDITOR_INTERNO',
    'ALTA_DIRECCION',
  ],
  usersAdmin: ['ADMINISTRADOR_SISTEMA'],
  locationsAdmin: ['ADMINISTRADOR_SISTEMA', 'JEFE_CALIDAD_SYST'],
} satisfies Record<string, UserRole[]>

interface RouteAccessEntry {
  path: string
  requiredRoles?: UserRole[]
}

/**
 * Espejo plano de los paths protegidos por rol en `router/index.tsx`.
 * Rutas ausentes de esta tabla (dev-only, `/perfil`, `DocumentEditGuard`,
 * etc.) solo requieren sesión autenticada — `isRouteAllowedForRole` las
 * trata como permitidas para cualquier rol.
 */
export const ROUTE_ACCESS_TABLE: RouteAccessEntry[] = [
  { path: '/documentos', requiredRoles: ROUTE_ROLE_GROUPS.documentsView },
  { path: '/documentos/:id', requiredRoles: ROUTE_ROLE_GROUPS.documentsView },
  { path: '/documents/new', requiredRoles: ROUTE_ROLE_GROUPS.documentsCreate },
  { path: '/nonconformities', requiredRoles: ROUTE_ROLE_GROUPS.nonconformitiesView },
  { path: '/nonconformities/new', requiredRoles: ROUTE_ROLE_GROUPS.nonconformitiesCreate },
  { path: '/nonconformities/:id', requiredRoles: ROUTE_ROLE_GROUPS.nonconformitiesView },
  { path: '/incidents', requiredRoles: ROUTE_ROLE_GROUPS.incidentsView },
  { path: '/incidents/nuevo', requiredRoles: ROUTE_ROLE_GROUPS.incidentsView },
  { path: '/incidents/:id', requiredRoles: ROUTE_ROLE_GROUPS.incidentsView },
  { path: '/incidents/:id/editar', requiredRoles: ROUTE_ROLE_GROUPS.incidentsEdit },
  { path: '/quality-events', requiredRoles: ROUTE_ROLE_GROUPS.qualityEventsView },
  { path: '/quality-events/nuevo', requiredRoles: ROUTE_ROLE_GROUPS.qualityEventsCreate },
  { path: '/quality-events/:id/editar', requiredRoles: ROUTE_ROLE_GROUPS.qualityEventsCreate },
  { path: '/quality-events/:id', requiredRoles: ROUTE_ROLE_GROUPS.qualityEventsView },
  { path: '/dashboard', requiredRoles: ROUTE_ROLE_GROUPS.dashboard },
  { path: '/usuarios', requiredRoles: ROUTE_ROLE_GROUPS.usersAdmin },
  { path: '/admin/areas', requiredRoles: ROUTE_ROLE_GROUPS.usersAdmin },
  { path: '/admin/locales', requiredRoles: ROUTE_ROLE_GROUPS.locationsAdmin },
  { path: '/admin/locales/new', requiredRoles: ROUTE_ROLE_GROUPS.locationsAdmin },
  { path: '/admin/locales/:id/editar', requiredRoles: ROUTE_ROLE_GROUPS.locationsAdmin },
  { path: '/admin/locales/:localId/zonas/new', requiredRoles: ROUTE_ROLE_GROUPS.locationsAdmin },
  {
    path: '/admin/locales/:localId/zonas/:zonaId/editar',
    requiredRoles: ROUTE_ROLE_GROUPS.locationsAdmin,
  },
  { path: '/admin/locales/:id', requiredRoles: ROUTE_ROLE_GROUPS.locationsAdmin },
]

const matchableRoutes: RouteObject[] = ROUTE_ACCESS_TABLE.map(({ path, requiredRoles }) => ({
  path,
  handle: requiredRoles,
}))

/**
 * ¿Puede `rol` acceder a `pathname`? Usa `matchRoutes` (el mismo algoritmo
 * de especificidad de react-router) para resolver el path concreto entre
 * entradas literales y con parámetros, evitando reimplementar el matching.
 * Paths fuera de `ROUTE_ACCESS_TABLE` se consideran permitidos — solo
 * exigen sesión autenticada, igual que en el router.
 */
export function isRouteAllowedForRole(pathname: string, rol: UserRole): boolean {
  const matches = matchRoutes(matchableRoutes, pathname)
  if (!matches || matches.length === 0) return true

  const requiredRoles = matches[matches.length - 1]?.route.handle as UserRole[] | undefined
  if (!requiredRoles) return true

  return requiredRoles.includes(rol)
}
