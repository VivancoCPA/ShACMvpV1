import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { RoleGuard } from './RoleGuard'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '../features/auth/pages/ResetPasswordPage'
import { DocumentsPage } from '../features/documents/pages/DocumentsPage'
import { DocumentFormPage } from '../features/documents/pages/DocumentFormPage'
import { DocumentDetailPage } from '../features/documents/pages/DocumentDetailPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { UnauthorizedPage } from '../pages/UnauthorizedPage'

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-4xl">🚧</p>
      <h2 className="mt-4 text-lg font-medium text-ink dark:text-on-dark">{label}</h2>
      <p className="mt-1 text-sm text-muted dark:text-on-dark-soft">Próximamente</p>
    </div>
  )
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
          { index: true, element: <Navigate to="/documentos" replace /> },
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
            element: (
              <RoleGuard
                requiredRoles={[
                  'JEFE_CONTROL_DOCUMENTARIO',
                  'JEFE_CALIDAD_SYST',
                  'SUPERVISOR',
                ]}
              />
            ),
            children: [
              {
                path: '/documents/:id/edit',
                element: <DocumentFormPage />,
                handle: { breadcrumb: 'documents' },
              },
            ],
          },
          {
            path: '/no-conformidades',
            element: <ComingSoon label="No Conformidades" />,
            handle: { breadcrumb: 'nonconformities' },
          },
          {
            path: '/incidentes',
            element: <ComingSoon label="Incidentes SyST" />,
            handle: { breadcrumb: 'incidents' },
          },
          {
            path: '/quality-events',
            element: <ComingSoon label="Quality Events" />,
            handle: { breadcrumb: 'qualityEvents' },
          },
          {
            path: '/dashboard',
            element: <ComingSoon label="Dashboard" />,
            handle: { breadcrumb: 'dashboard' },
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
        ],
      },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
])
