import { OpenAPIHono } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import type { MiddlewareHandler } from 'hono'
import { createMiddleware } from 'hono/factory'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import type { z } from 'zod'
import { Router } from './router'

// Define simple auth types to replace better-auth types
interface User {
  id: string
  email?: string
  name?: string
  [key: string]: unknown
}

interface Session {
  id: string
  userId: string
  expiresAt: Date
  [key: string]: unknown
}

declare module 'hono' {
  interface ContextVariableMap {
    session: Session | null
    user: User | null
  }
}

// Simple auth configuration interface to replace BetterAuthOptions
interface AuthConfig {
  // Basic auth configuration options
  sessionExpiry?: number
  [key: string]: unknown
}

interface NorteConfig {
  title: string
  version?: string
  authConfig?: AuthConfig
}

export class Norte {
  private config: NorteConfig
  private scalarSources: Array<{ url: string; title: string }> = [
    { url: '/docs', title: 'Api' },
  ]
  private hono: OpenAPIHono
  private isInitialized = false

  constructor(config: NorteConfig) {
    this.config = config
    this.hono = new OpenAPIHono()
    this.setupMiddlewares()
  }

  private ensureInitialized() {
    if (!this.isInitialized) {
      if (this.config.authConfig) {
        this.setupAuth(this.config.authConfig)
      }
      this.setupDocs()
      this.setupHealthcheck()
      this.isInitialized = true
    }
  }

  private setupHealthcheck() {
    this.hono.get('/healthcheck', (c) => c.text('OK', 200))
  }

  public middleware(...args: MiddlewareHandler[]) {
    return this.hono.use(...args)
  }

  private setupMiddlewares() {
    this.middleware(logger())
    this.middleware(prettyJSON())
  }

  private setupAuth(_authConfig: AuthConfig) {
    // Simple auth middleware setup - users need to implement their own auth logic
    this.hono.use('*', this.authMiddleware())
    // Remove the auth endpoints and scalar sources since we're no longer using better-auth
  }

  private authMiddleware() {
    return createMiddleware(async (c, next) => {
      // Default implementation - sets no user/session
      // Users should override this with their own auth logic
      c.set('user', null)
      c.set('session', null)
      return next()
    })
  }

  private setupDocs() {
    const openApi = {
      openapi: '3.1.0',
      info: {
        title: this.config.title,
        version: this.config.version || '1.0.0',
      },
    }
    this.hono.doc31('/docs', openApi)
    this.hono.getOpenAPI31Document(openApi)

    // Setup Scalar API documentation
    this.hono.get(
      '/',
      Scalar({
        pageTitle: this.config.title,
        sources: this.scalarSources,
      }),
    )
  }

  public register<TResponse extends z.ZodType, TDomain extends string = string>(
    router: Router<TResponse, TDomain>,
  ) {
    return this.hono.route('/', Router.getRouter(router))
  }

  public fetch = new Proxy(
    (request: Request) => {
      this.ensureInitialized()
      return this.hono.fetch(request)
    },
    {
      get: (target, prop) => {
        if (prop === 'fetch') return target
        this.ensureInitialized()
        return this.hono[prop as keyof typeof this.hono]
      },
    },
  )
}
