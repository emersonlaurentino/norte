export { z } from '@hono/zod-openapi'
export * from './error'
export * from './norte'
export * from './router'

// Export auth types for users
export type AuthConfig = {
  sessionExpiry?: number
  [key: string]: unknown
}

export type User = {
  id: string
  email?: string
  name?: string
  [key: string]: unknown
}

export type Session = {
  id: string
  userId: string
  expiresAt: Date
  [key: string]: unknown
}
