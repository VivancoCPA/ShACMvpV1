import type { RequestHandler } from 'msw'
import { documentHandlers } from './documents.handlers'
import { authHandlers } from './auth.handlers'
import { nonconformityHandlers } from './nonconformities.handlers'

export const handlers: RequestHandler[] = [
  ...authHandlers,
  ...documentHandlers,
  ...nonconformityHandlers,
]
