import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { RoleGuard } from './RoleGuard'
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
            path: '/nonconformities',
            element: <NonconformityListPage />,
            handle: { breadcrumb: 'nonconformities' },
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
            path: '/nonconformities/:id',
            element: <NonconformityDetailPage />,
            handle: { breadcrumb: 'nonconformities' },
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
