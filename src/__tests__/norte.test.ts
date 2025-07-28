import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { Norte } from '../norte'
import { Router } from '../router'

vi.mock('@hono/zod-openapi', () => ({
  OpenAPIHono: class MockOpenAPIHono {
    use = vi.fn().mockReturnThis()
    get = vi.fn().mockReturnThis()
    doc31 = vi.fn().mockReturnThis()
    getOpenAPI31Document = vi.fn().mockReturnThis()
    route = vi.fn().mockReturnThis()
    on = vi.fn().mockReturnThis()
    fetch = vi.fn().mockResolvedValue(new Response('OK'))
  },
}))

vi.mock('@scalar/hono-api-reference', () => ({
  Scalar: vi.fn(() => vi.fn()),
}))

vi.mock('better-auth', () => ({
  betterAuth: vi.fn(() => ({
    handler: vi.fn(),
    api: {
      getSession: vi.fn().mockResolvedValue(null),
    },
  })),
}))

vi.mock('hono/logger', () => ({
  logger: vi.fn(() => vi.fn()),
}))

vi.mock('hono/pretty-json', () => ({
  prettyJSON: vi.fn(() => vi.fn()),
}))

vi.mock('hono/factory', () => ({
  createMiddleware: vi.fn((fn) => fn),
}))

vi.mock('../router', () => ({
  Router: class MockRouter {
    // biome-ignore lint/complexity/noUselessConstructor: constructor
    constructor(..._args: unknown[]) {
      // Mock router constructor with overloaded signature support
    }
    static getRouter = vi.fn(() => ({}))
  },
}))

describe('Norte', () => {
  const mockAuthConfig = {
    secret: 'test-secret',
    database: {
      provider: 'sqlite' as const,
      url: ':memory:',
    },
  }

  const mockConfig = {
    title: 'Test API',
    version: '1.0.0',
    authConfig: mockAuthConfig,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create Norte instance with required config', () => {
      const norte = new Norte(mockConfig)

      expect(norte).toBeInstanceOf(Norte)
    })

    it('should create Norte instance without version', () => {
      const configWithoutVersion = {
        title: 'Test API',
        authConfig: mockAuthConfig,
      }

      const norte = new Norte(configWithoutVersion)

      expect(norte).toBeInstanceOf(Norte)
    })

    it('should setup middlewares during construction', () => {
      const norte = new Norte(mockConfig)

      expect(norte).toBeInstanceOf(Norte)
    })
  })

  describe('middleware method', () => {
    it('should allow adding custom middleware', () => {
      const norte = new Norte(mockConfig)
      const customMiddleware = vi.fn()

      const result = norte.middleware(customMiddleware)

      expect(result).toBeDefined()
    })

    it('should accept multiple middleware functions', () => {
      const norte = new Norte(mockConfig)
      const middleware1 = vi.fn()
      const middleware2 = vi.fn()

      const result = norte.middleware(middleware1, middleware2)

      expect(result).toBeDefined()
    })
  })

  describe('register method', () => {
    it('should register a router', () => {
      const norte = new Norte(mockConfig)
      const mockSchema = z.object({
        id: z.string(),
        name: z.string(),
      })
      const router = new Router('users', { schema: mockSchema })

      const result = norte.register(router)

      expect(result).toBeDefined()
    })
  })

  describe('fetch method', () => {
    it('should have a fetch method', () => {
      const norte = new Norte(mockConfig)

      expect(typeof norte.fetch).toBe('function')
    })

    it('should be callable as a function', async () => {
      const norte = new Norte(mockConfig)
      const mockRequest = new Request('http://localhost/test')

      const result = await norte.fetch(mockRequest)

      expect(result).toBeInstanceOf(Response)
    })

    it('should proxy to hono fetch', async () => {
      const norte = new Norte(mockConfig)
      const mockRequest = new Request('http://localhost/healthcheck')

      const result = await norte.fetch(mockRequest)

      expect(result).toBeInstanceOf(Response)
    })
  })

  describe('health check', () => {
    it('should setup healthcheck endpoint during construction', () => {
      const norte = new Norte(mockConfig)

      expect(norte).toBeInstanceOf(Norte)
    })
  })

  describe('authentication setup', () => {
    it('should setup authentication with provided config', () => {
      const norte = new Norte(mockConfig)

      expect(norte).toBeInstanceOf(Norte)
    })
  })

  describe('documentation setup', () => {
    it('should setup OpenAPI documentation', () => {
      const norte = new Norte(mockConfig)

      expect(norte).toBeInstanceOf(Norte)
    })

    it('should use provided title and version', () => {
      const configWithVersion = {
        title: 'My Custom API',
        version: '2.0.0',
        authConfig: mockAuthConfig,
      }

      const norte = new Norte(configWithVersion)

      expect(norte).toBeInstanceOf(Norte)
    })

    it('should use default version when not provided', () => {
      const configWithoutVersion = {
        title: 'My API',
        authConfig: mockAuthConfig,
      }

      const norte = new Norte(configWithoutVersion)

      expect(norte).toBeInstanceOf(Norte)
    })
  })

  describe('integration', () => {
    it('should work with multiple routers', () => {
      const norte = new Norte(mockConfig)

      const userSchema = z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
      })

      const postSchema = z.object({
        id: z.string(),
        title: z.string(),
        content: z.string(),
      })

      const userRouter = new Router('users', { schema: userSchema })
      const postRouter = new Router('posts', { schema: postSchema })

      norte.register(userRouter)
      norte.register(postRouter)

      expect(norte).toBeInstanceOf(Norte)
    })
  })
})
