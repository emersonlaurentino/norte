import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { type ErrorCode, NorteError } from '../error'
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
    openapi = vi.fn().mockReturnThis()
    fetch = vi.fn().mockResolvedValue(new Response('OK'))
  },
  createRoute: vi.fn((config) => config),
  z: {
    object: z.object,
    string: z.string,
    array: z.array,
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

describe('Integration Tests', () => {
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

  describe('Norte with Router integration', () => {
    it('should integrate Norte and Router successfully', () => {
      const norte = new Norte(mockConfig)

      const userSchema = z.object({
        id: z.string().cuid2(),
        name: z.string(),
        email: z.string().email(),
      })

      const userRouter = new Router('users', { schema: userSchema })

      userRouter
        .list(() => [])
        .create(
          { input: z.object({ name: z.string(), email: z.string() }) },
          () => ({
            id: 'test-id',
            name: 'Test User',
            email: 'test@example.com',
          }),
        )
        .read(() => ({
          id: 'test-id',
          name: 'Test User',
          email: 'test@example.com',
        }))
        .update({ input: z.object({ name: z.string().optional() }) }, () => ({
          id: 'test-id',
          name: 'Updated User',
          email: 'test@example.com',
        }))
        .delete(() => undefined)

      const result = norte.register(userRouter)

      expect(result).toBeDefined()
      expect(norte).toBeInstanceOf(Norte)
      expect(userRouter).toBeInstanceOf(Router)
    })

    it('should handle multiple routers with Norte', () => {
      const norte = new Norte(mockConfig)

      const userSchema = z.object({
        id: z.string().cuid2(),
        name: z.string(),
        email: z.string().email(),
      })

      const postSchema = z.object({
        id: z.string().cuid2(),
        title: z.string(),
        content: z.string(),
        authorId: z.string().cuid2(),
      })

      const userRouter = new Router('users', { schema: userSchema })
      const postRouter = new Router('posts', { schema: postSchema })

      userRouter.list(() => [])
      postRouter.list(() => [])

      norte.register(userRouter)
      norte.register(postRouter)

      expect(norte).toBeInstanceOf(Norte)
    })

    it('should handle nested routers', () => {
      const norte = new Norte(mockConfig)

      const storeSchema = z.object({
        id: z.string().cuid2(),
        name: z.string(),
      })

      const productSchema = z.object({
        id: z.string().cuid2(),
        name: z.string(),
        storeId: z.string().cuid2(),
      })

      const storeRouter = new Router('stores', { schema: storeSchema })
      const productRouter = new Router(storeRouter, 'products', {
        schema: productSchema,
      })

      storeRouter.list(() => [])
      productRouter.list(() => [])

      norte.register(storeRouter)

      expect(norte).toBeInstanceOf(Norte)
      expect(storeRouter).toBeInstanceOf(Router)
      expect(productRouter).toBeInstanceOf(Router)
    })
  })

  describe('Error handling integration', () => {
    it('should work with NorteError in router handlers', () => {
      const norte = new Norte(mockConfig)

      const userSchema = z.object({
        id: z.string().cuid2(),
        name: z.string(),
        email: z.string().email(),
      })

      const userRouter = new Router('users', { schema: userSchema })

      userRouter.list(() => new NorteError('NOT_FOUND', 'No users found'))

      norte.register(userRouter)

      expect(norte).toBeInstanceOf(Norte)
    })

    it('should handle different error types', () => {
      const errorTypes: Array<[ErrorCode, number]> = [
        ['NOT_FOUND', 404],
        ['INVALID_INPUT', 400],
        ['UNAUTHORIZED', 401],
        ['FORBIDDEN', 403],
        ['CONFLICT', 409],
        ['INTERNAL_SERVER_ERROR', 500],
      ]

      errorTypes.forEach(([code, status]) => {
        const error = new NorteError(code, `Test ${code} error`)
        expect(error.code).toBe(code)
        expect(error.statusCode).toBe(status)
      })
    })
  })

  describe('Configuration integration', () => {
    it('should work with minimal configuration', () => {
      const minimalConfig = {
        title: 'Minimal API',
        authConfig: mockAuthConfig,
      }

      const norte = new Norte(minimalConfig)

      const userSchema = z.object({
        id: z.string(),
        name: z.string(),
      })

      const userRouter = new Router('users', { schema: userSchema })
      userRouter.list(() => [])

      norte.register(userRouter)

      expect(norte).toBeInstanceOf(Norte)
    })

    it('should work with public routes', () => {
      const norte = new Norte(mockConfig)

      const publicSchema = z.object({
        id: z.string(),
        data: z.string(),
      })

      const publicRouter = new Router('public', { schema: publicSchema })

      publicRouter.list({ isPublic: true }, () => [])

      norte.register(publicRouter)

      expect(norte).toBeInstanceOf(Norte)
    })
  })

  describe('Method chaining integration', () => {
    it('should support full CRUD operations with method chaining', () => {
      const norte = new Norte(mockConfig)

      const userSchema = z.object({
        id: z.string().cuid2(),
        name: z.string(),
        email: z.string().email(),
      })

      const inputSchema = z.object({
        name: z.string(),
        email: z.string().email(),
      })

      const updateSchema = z.object({
        name: z.string().optional(),
        email: z.string().email().optional(),
      })

      const userRouter = new Router('users', { schema: userSchema })
        .list(() => [])
        .create({ input: inputSchema }, () => ({
          id: 'test-id',
          name: 'Test User',
          email: 'test@example.com',
        }))
        .read(() => ({
          id: 'test-id',
          name: 'Test User',
          email: 'test@example.com',
        }))
        .update({ input: updateSchema }, () => ({
          id: 'test-id',
          name: 'Updated User',
          email: 'updated@example.com',
        }))
        .delete(() => undefined)

      norte.register(userRouter)

      expect(norte).toBeInstanceOf(Norte)
      expect(userRouter).toBeInstanceOf(Router)
    })
  })
})
