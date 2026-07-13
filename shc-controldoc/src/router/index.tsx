import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { RoleGuard } from './RoleGuard'
import { DocumentEditGuard } from './DocumentEditGuard'
import { getDefaultRouteForRole } from './getDefaultRoute'
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
import { ComingSoon } from './ComingSoonPages'
import { SemaforoPreviewPage } from '../pages/dev/SemaforoPreviewPage'
import { DashboardPage } from '../features/dashboard/pages/DashboardPage'
import { ProfilePage } from '../features/users/pages/ProfilePage'

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
          // Account self-service — not linked in Sidebar, only reachable via TopNav dropdown or direct URL. No RBAC restriction beyond auth.
          { path: '/perfil', element: <ProfilePage />, handle: { breadcrumb: 'myProfile' } },
          {
            element: (
              <RoleGuard
                requiredRoles={[
                  'OPERARIO',
                  'SUPERVISOR',
                  'JEFE_CALIDAD_SYST',
                  'JEFE_CONTROL_DOCUMENTARIO',
                  'AUDITOR_INTERNO',
                  'ALTA_DIRECCION',
                ]}
              />
            ),
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
            element: (
              <RoleGuard
                requiredRoles={['JEFE_CONTROL_DOCUMENTARIO', 'JEFE_CALIDAD_SYST']}
              />
            ),
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
            element: (
              <RoleGuard
                requiredRoles={[
                  'OPERARIO',
                  'SUPERVISOR',
                  'JEFE_CALIDAD_SYST',
                  'JEFE_CONTROL_DOCUMENTARIO',
                  'AUDITOR_INTERNO',
                  'ALTA_DIRECCION',
                ]}
              />
            ),
            children: [
              {
                path: '/nonconformities',
                element: <NonconformityListPage />,
                handle: { breadcrumb: 'nonconformities' },
              },
            ],
          },
          {
            element: (
              <RoleGuard requiredRoles={['SUPERVISOR', 'JEFE_CALIDAD_SYST']} />
            ),
            children: [
              {
                path: '/nonconformities/new',
                element: <NonconformityNewPage />,
                handle: { breadcrumb: 'nonconformities' },
              },
            ],
          },
          {
            element: (
              <RoleGuard
                requiredRoles={[
                  'OPERARIO',
                  'SUPERVISOR',
                  'JEFE_CALIDAD_SYST',
                  'JEFE_CONTROL_DOCUMENTARIO',
                  'AUDITOR_INTERNO',
                  'ALTA_DIRECCION',
                ]}
              />
            ),
            children: [
              {
                path: '/nonconformities/:id',
                element: <NonconformityDetailPage />,
                handle: { breadcrumb: 'nonconformities' },
              },
            ],
          },
          {
            element: (
              <RoleGuard
                requiredRoles={[
                  'OPERARIO',
                  'SUPERVISOR',
                  'JEFE_CALIDAD_SYST',
                  'AUDITOR_INTERNO',
                  'ALTA_DIRECCION',
                ]}
              />
            ),
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
            element: (
              <RoleGuard requiredRoles={['SUPERVISOR', 'JEFE_CALIDAD_SYST']} />
            ),
            children: [
              {
                path: '/incidents/:id/editar',
                element: <IncidentEditPage />,
                handle: { breadcrumb: 'incidents' },
              },
            ],
          },
          {
            element: (
              <RoleGuard
                requiredRoles={[
                  'OPERARIO',
                  'SUPERVISOR',
                  'JEFE_CALIDAD_SYST',
                  'JEFE_CONTROL_DOCUMENTARIO',
                  'AUDITOR_INTERNO',
                  'ALTA_DIRECCION',
                ]}
              />
            ),
            children: [
              {
                path: '/quality-events',
                element: <QualityEventListPage />,
                handle: { breadcrumb: 'qualityEvents' },
              },
            ],
          },
          {
            element: (
              <RoleGuard
                requiredRoles={['OPERARIO', 'SUPERVISOR', 'JEFE_CALIDAD_SYST']}
              />
            ),
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
            element: (
              <RoleGuard
                requiredRoles={[
                  'OPERARIO',
                  'SUPERVISOR',
                  'JEFE_CALIDAD_SYST',
                  'JEFE_CONTROL_DOCUMENTARIO',
                  'AUDITOR_INTERNO',
                  'ALTA_DIRECCION',
                ]}
              />
            ),
            children: [
              {
                path: '/quality-events/:id',
                element: <QualityEventDetail />,
                handle: { breadcrumb: 'qualityEvents' },
              },
            ],
          },
          {
            element: (
              <RoleGuard
                requiredRoles={[
                  'OPERARIO',
                  'SUPERVISOR',
                  'JEFE_CALIDAD_SYST',
                  'JEFE_CONTROL_DOCUMENTARIO',
                  'AUDITOR_INTERNO',
                  'ALTA_DIRECCION',
                ]}
              />
            ),
            children: [
              {
                path: '/dashboard',
                element: <DashboardPage />,
                handle: { breadcrumb: 'dashboard' },
              },
            ],
          },
          {
            element: <RoleGuard requiredRoles={['JEFE_CALIDAD_SYST', 'ALTA_DIRECCION']} />,
            children: [
              {
                path: '/usuarios',
                element: <ComingSoon label="Usuarios y Roles" />,
                handle: { breadcrumb: 'users' },
              },
            ],
          },
          {
            element: (
              <RoleGuard requiredRoles={['ADMINISTRADOR_SISTEMA', 'JEFE_CALIDAD_SYST']} />
            ),
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
