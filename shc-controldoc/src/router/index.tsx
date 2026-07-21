import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { RoleGuard } from './RoleGuard'
import { DocumentEditGuard } from './DocumentEditGuard'
import { getDefaultRouteForRole } from './getDefaultRoute'
import { ROUTE_ROLE_GROUPS } from './routeAccess'
import { useAuthStore } from '../stores/authStore'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '../features/auth/pages/ResetPasswordPage'
import { DocumentsPage } from '../features/documents/pages/DocumentsPage'
import { DocumentFormPage } from '../features/documents/pages/DocumentFormPage'
import { DocumentDetailPage } from '../features/documents/pages/DocumentDetailPage'
import { NonconformityListPage } from '../features/nonconformities/pages/NonconformityListPage'
import { NonconformityNewPage } from '../features/nonconformities/pages/NonconformityNewPage'
import { NonconformityDetailPage } from '../features/nonconformities/pages/NonconformityDetailPage'
import { IncidentListPage } from '../features/incidents/pages/IncidentListPage'
import { IncidentNewPage } from '../features/incidents/pages/IncidentNewPage'
import { IncidentEditPage } from '../features/incidents/pages/IncidentEditPage'
import { IncidentDetailPage } from '../features/incidents/pages/IncidentDetailPage'
import { QualityEventListPage } from '../features/quality-events/pages/QualityEventListPage'
import { QualityEventForm } from '../features/quality-events/pages/QualityEventForm'
import { QualityEventDetail } from '../features/quality-events/pages/QualityEventDetail'
import { NotFoundPage } from '../pages/NotFoundPage'
import { UnauthorizedPage } from '../pages/UnauthorizedPage'
import { LocalesAdminPage } from '../features/locations/pages/LocalesAdminPage'
import { LocalDetailPage } from '../features/locations/pages/LocalDetailPage'
import { LocalNewPage } from '../features/locations/pages/LocalNewPage'
import { LocalEditPage } from '../features/locations/pages/LocalEditPage'
import { ZonaFormPage } from '../features/locations/pages/ZonaFormPage'
import { AreasAdminPage } from '../features/areas/pages/AreasAdminPage'
import { SemaforoPreviewPage } from '../pages/dev/SemaforoPreviewPage'
import { DevResetMocksPage } from '../pages/dev/DevResetMocksPage'
import { DashboardPage } from '../features/dashboard/pages/DashboardPage'
import { ProfilePage } from '../features/users/pages/ProfilePage'
import { UsersListPage } from '../features/users/pages/UsersListPage'

function DefaultRouteRedirect() {
  const user = useAuthStore((state) => state.user)
  return <Navigate to={getDefaultRouteForRole(user?.rol ?? 'OPERARIO')} replace />
}

export const router = createBrowserRouter([
  // Public routes
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/no-autorizado', element: <UnauthorizedPage /> },

  // Protected routes
  {
    element: <RoleGuard />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DefaultRouteRedirect /> },
          // Dev-only preview route — not linked in Sidebar, no RBAC restriction beyond auth.
          { path: '/dev/semaforo-preview', element: <SemaforoPreviewPage /> },
          // Dev-only mock reset tool — not linked in Sidebar, no RBAC restriction beyond auth.
          { path: '/dev/reset-mocks', element: <DevResetMocksPage /> },
          // Account self-service — not linked in Sidebar, only reachable via TopNav dropdown or direct URL. No RBAC restriction beyond auth.
          { path: '/perfil', element: <ProfilePage />, handle: { breadcrumb: 'myProfile' } },
          {
            element: <RoleGuard requiredRoles={ROUTE_ROLE_GROUPS.documentsView} />,
            children: [
              {
                path: '/documentos',
                element: <DocumentsPage />,
                handle: { breadcrumb: 'documents' },
              },
              {
                path: '/documentos/:id',
                element: <DocumentDetailPage />,
                handle: { breadcrumb: 'documents' },
              },
            ],
          },
          // English-path aliases used by form navigation
          { path: '/documents', element: <Navigate to="/documentos" replace /> },
          {
            element: <RoleGuard requiredRoles={ROUTE_ROLE_GROUPS.documentsCreate} />,
            children: [
              {
                path: '/documents/new',
                element: <DocumentFormPage />,
                handle: { breadcrumb: 'documents' },
              },
            ],
          },
          {
            element: <DocumentEditGuard />,
            children: [
              {
                path: '/documents/:id/edit',
                element: <DocumentFormPage />,
                handle: { breadcrumb: 'documents' },
              },
            ],
          },
          {
            element: <RoleGuard requiredRoles={ROUTE_ROLE_GROUPS.nonconformitiesView} />,
            children: [
              {
                path: '/nonconformities',
                element: <NonconformityListPage />,
                handle: { breadcrumb: 'nonconformities' },
              },
            ],
          },
          {
            element: <RoleGuard requiredRoles={ROUTE_ROLE_GROUPS.nonconformitiesCreate} />,
            children: [
              {
                path: '/nonconformities/new',
                element: <NonconformityNewPage />,
                handle: { breadcrumb: 'nonconformities' },
              },
            ],
          },
          {
            element: <RoleGuard requiredRoles={ROUTE_ROLE_GROUPS.nonconformitiesView} />,
            children: [
              {
                path: '/nonconformities/:id',
                element: <NonconformityDetailPage />,
                handle: { breadcrumb: 'nonconformities' },
              },
            ],
          },
          {
            element: <RoleGuard requiredRoles={ROUTE_ROLE_GROUPS.incidentsView} />,
            children: [
              {
                path: '/incidents',
                element: <IncidentListPage />,
                handle: { breadcrumb: 'incidents' },
              },
              {
                path: '/incidents/nuevo',
                element: <IncidentNewPage />,
                handle: { breadcrumb: 'incidents' },
              },
              {
                path: '/incidents/:id',
                element: <IncidentDetailPage />,
                handle: { breadcrumb: 'incidents' },
              },
            ],
          },
          {
            element: <RoleGuard requiredRoles={ROUTE_ROLE_GROUPS.incidentsEdit} />,
            children: [
              {
                path: '/incidents/:id/editar',
                element: <IncidentEditPage />,
                handle: { breadcrumb: 'incidents' },
              },
            ],
          },
          {
            element: <RoleGuard requiredRoles={ROUTE_ROLE_GROUPS.qualityEventsView} />,
            children: [
              {
                path: '/quality-events',
                element: <QualityEventListPage />,
                handle: { breadcrumb: 'qualityEvents' },
              },
            ],
          },
          {
            element: <RoleGuard requiredRoles={ROUTE_ROLE_GROUPS.qualityEventsCreate} />,
            children: [
              {
                path: '/quality-events/nuevo',
                element: <QualityEventForm />,
                handle: { breadcrumb: 'qualityEvents' },
              },
              {
                path: '/quality-events/:id/editar',
                element: <QualityEventForm />,
                handle: { breadcrumb: 'qualityEvents' },
              },
            ],
          },
          {
            element: <RoleGuard requiredRoles={ROUTE_ROLE_GROUPS.qualityEventsView} />,
            children: [
              {
                path: '/quality-events/:id',
                element: <QualityEventDetail />,
                handle: { breadcrumb: 'qualityEvents' },
              },
            ],
          },
          {
            element: <RoleGuard requiredRoles={ROUTE_ROLE_GROUPS.dashboard} />,
            children: [
              {
                path: '/dashboard',
                element: <DashboardPage />,
                handle: { breadcrumb: 'dashboard' },
              },
            ],
          },
          {
            element: <RoleGuard requiredRoles={ROUTE_ROLE_GROUPS.usersAdmin} />,
            children: [
              {
                path: '/usuarios',
                element: <UsersListPage />,
                handle: { breadcrumb: 'users' },
              },
              {
                path: '/admin/areas',
                element: <AreasAdminPage />,
                handle: { breadcrumb: 'areas' },
              },
            ],
          },
          {
            element: <RoleGuard requiredRoles={ROUTE_ROLE_GROUPS.locationsAdmin} />,
            children: [
              {
                path: '/admin/locales',
                element: <LocalesAdminPage />,
                handle: { breadcrumb: 'locations' },
              },
              {
                path: '/admin/locales/new',
                element: <LocalNewPage />,
                handle: { breadcrumb: 'locations' },
              },
              {
                path: '/admin/locales/:id/editar',
                element: <LocalEditPage />,
                handle: { breadcrumb: 'locations' },
              },
              {
                path: '/admin/locales/:localId/zonas/new',
                element: <ZonaFormPage />,
                handle: { breadcrumb: 'locations' },
              },
              {
                path: '/admin/locales/:localId/zonas/:zonaId/editar',
                element: <ZonaFormPage />,
                handle: { breadcrumb: 'locations' },
              },
              {
                path: '/admin/locales/:id',
                element: <LocalDetailPage />,
                handle: { breadcrumb: 'locations' },
              },
            ],
          },
        ],
      },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
])
