import { OpenAPIHono, type z } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import type { BetterAuthOptions, Session, User } from 'better-auth'
import { betterAuth } from 'better-auth'
import type { MiddlewareHandler } from 'hono'
import { createMiddleware } from 'hono/factory'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { Router } from './router'

declare module 'hono' {
  interface ContextVariableMap {
    session: Session | null
    user: User | null
  }
}

interface NorteConfig {
  title: string
  version?: string
  authConfig: BetterAuthOptions
}

export class Norte {
  private config: NorteConfig
  private scalarSources: Array<{ url: string; title: string }> = [
    { url: '/docs', title: 'Api' },
  ]
  private hono: OpenAPIHono

  constructor(config: NorteConfig) {
    this.config = config
    this.hono = new OpenAPIHono()
    this.setupMiddlewares()
    this.setupAuth(config.authConfig)
    this.setupDocs()
    this.setupHealthcheck()
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

  private setupAuth(authConfig: BetterAuthOptions) {
    const auth = betterAuth(authConfig)
    this.hono.use('*', this.authMiddleware(auth))
    this.scalarSources.push({
      url: '/auth/open-api/generate-schema',
      title: 'Auth',
    })
    this.hono.on(['POST', 'GET'], '/auth/**', (c) => auth.handler(c.req.raw))
    this.hono.get(
      '/',
      Scalar({
        pageTitle: this.config.title,
        sources: this.scalarSources,
      }),
    )
  }

  private authMiddleware(auth: ReturnType<typeof betterAuth>) {
    return createMiddleware(async (c, next) => {
      const headers = c.req.raw.headers
      const session = await auth.api.getSession({ headers })
      if (!session) {
        c.set('user', null)
        c.set('session', null)
        return next()
      }
      c.set('user', session.user)
      c.set('session', session.session)
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
  }

  public register<TResponse extends z.ZodTypeAny>(router: Router<TResponse>) {
    return this.hono.route('/', Router.getRouterForRoute(router))
  }

  public fetch = new Proxy((request: Request) => this.hono.fetch(request), {
    get: (target, prop) => {
      if (prop === 'fetch') return target
      return this.hono[prop as keyof typeof this.hono]
    },
  })
}
