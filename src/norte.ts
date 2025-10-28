import { OpenAPIHono } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import type { MiddlewareHandler } from 'hono'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import type { z } from 'zod'
import { Router } from './router'

interface NorteConfig {
  title: string
  version?: string
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
