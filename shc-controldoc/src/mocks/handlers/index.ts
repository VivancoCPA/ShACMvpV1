import type { RequestHandler } from 'msw'
import { documentHandlers } from './documents.handlers'
import { authHandlers } from './auth.handlers'
import { nonconformityHandlers } from './nonconformities.handlers'
import { incidentHandlers } from './incidents.handlers'
import { localesHandlers } from './locales.handlers'
import { qualityEventHandlers } from './quality-events.handlers'
import { dashboardHandlers } from './dashboard.handlers'
import { userHandlers } from './users.handlers'

export const handlers: RequestHandler[] = [
  ...authHandlers,
  ...documentHandlers,
  ...nonconformityHandlers,
  ...localesHandlers,
  ...incidentHandlers,
  ...qualityEventHandlers,
  ...dashboardHandlers,
  ...userHandlers,
]
