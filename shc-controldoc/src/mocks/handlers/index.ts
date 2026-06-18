import type { RequestHandler } from 'msw'
import { documentHandlers } from './documents.handlers'
import { authHandlers } from './auth.handlers'

export const handlers: RequestHandler[] = [...authHandlers, ...documentHandlers]
