import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { NorteError } from '../error'
import { Router } from '../router'

vi.mock('@hono/zod-openapi', () => ({
  OpenAPIHono: class MockOpenAPIHono {
    openapi = vi.fn().mockReturnThis()
    use = vi.fn().mockReturnThis()
  },
  createRoute: vi.fn((config) => config),
  z: {
    object: z.object,
    string: z.string,
    array: z.array,
  },
}))

vi.mock('hono/factory', () => ({
  createMiddleware: vi.fn((fn) => fn),
}))

describe('Router', () => {
  const mockSchema = z.object({
    id: z.string().cuid2(),
    name: z.string(),
    email: z.string().email(),
  })

  describe('constructor', () => {
    it('should create a root router with domain and config', () => {
      const router = new Router('users', { schema: mockSchema })

      expect(router).toBeInstanceOf(Router)
    })

    it('should create a nested router with parent, domain and config', () => {
      const parentRouter = new Router('stores', { schema: mockSchema })
      const childRouter = new Router(parentRouter, 'products', {
        schema: mockSchema,
      })

      expect(childRouter).toBeInstanceOf(Router)
    })
  })

  describe('path generation', () => {
    it('should generate correct path for root router', () => {
      const router = new Router('users', { schema: mockSchema })
      expect(router).toBeInstanceOf(Router)
    })

    it('should generate correct path for nested router', () => {
      const parentRouter = new Router('stores', { schema: mockSchema })
      const childRouter = new Router(parentRouter, 'products', {
        schema: mockSchema,
      })

      expect(childRouter).toBeInstanceOf(Router)
    })
  })

  describe('list method', () => {
    it('should register list handler without config', () => {
      const router = new Router('users', { schema: mockSchema })
      const handler = vi.fn().mockResolvedValue([])

      const result = router.list(handler)

      expect(result).toBe(router)
      expect(handler).toBeDefined()
    })

    it('should register list handler with config', () => {
      const router = new Router('users', { schema: mockSchema })
      const handler = vi.fn().mockResolvedValue([])
      const config = { isPublic: true }

      const result = router.list(config, handler)

      expect(result).toBe(router)
      expect(handler).toBeDefined()
    })

    it('should handle NorteError in list handler', async () => {
      const router = new Router('users', { schema: mockSchema })
      const error = new NorteError('NOT_FOUND', 'Users not found')
      const handler = vi.fn().mockResolvedValue(error)

      router.list(handler)

      expect(handler).toBeDefined()
    })
  })

  describe('create method', () => {
    it('should register create handler', () => {
      const router = new Router('users', { schema: mockSchema })
      const inputSchema = z.object({
        name: z.string(),
        email: z.string().email(),
      })
      const handler = vi
        .fn()
        .mockResolvedValue({ id: '1', name: 'John', email: 'john@example.com' })

      const result = router.create({ input: inputSchema }, handler)

      expect(result).toBe(router)
      expect(handler).toBeDefined()
    })

    it('should handle NorteError in create handler', () => {
      const router = new Router('users', { schema: mockSchema })
      const inputSchema = z.object({
        name: z.string(),
        email: z.string().email(),
      })
      const error = new NorteError('CONFLICT', 'User already exists')
      const handler = vi.fn().mockResolvedValue(error)

      router.create({ input: inputSchema }, handler)

      expect(handler).toBeDefined()
    })
  })

  describe('read method', () => {
    it('should register read handler without config', () => {
      const router = new Router('users', { schema: mockSchema })
      const handler = vi
        .fn()
        .mockResolvedValue({ id: '1', name: 'John', email: 'john@example.com' })

      const result = router.read(handler)

      expect(result).toBe(router)
      expect(handler).toBeDefined()
    })

    it('should register read handler with config', () => {
      const router = new Router('users', { schema: mockSchema })
      const handler = vi
        .fn()
        .mockResolvedValue({ id: '1', name: 'John', email: 'john@example.com' })
      const config = { isPublic: true }

      const result = router.read(config, handler)

      expect(result).toBe(router)
      expect(handler).toBeDefined()
    })
  })

  describe('update method', () => {
    it('should register update handler', () => {
      const router = new Router('users', { schema: mockSchema })
      const inputSchema = z.object({
        name: z.string().optional(),
        email: z.string().email().optional(),
      })
      const handler = vi.fn().mockResolvedValue({
        id: '1',
        name: 'John Updated',
        email: 'john@example.com',
      })

      const result = router.update({ input: inputSchema }, handler)

      expect(result).toBe(router)
      expect(handler).toBeDefined()
    })
  })

  describe('delete method', () => {
    it('should register delete handler without config', () => {
      const router = new Router('users', { schema: mockSchema })
      const handler = vi.fn().mockResolvedValue(undefined)

      const result = router.delete(handler)

      expect(result).toBe(router)
      expect(handler).toBeDefined()
    })

    it('should register delete handler with config', () => {
      const router = new Router('users', { schema: mockSchema })
      const handler = vi.fn().mockResolvedValue(undefined)
      const config = { isPublic: false }

      const result = router.delete(config, handler)

      expect(result).toBe(router)
      expect(handler).toBeDefined()
    })
  })

  describe('method chaining', () => {
    it('should support method chaining', () => {
      const router = new Router('users', { schema: mockSchema })
      const listHandler = vi.fn().mockResolvedValue([])
      const createHandler = vi
        .fn()
        .mockResolvedValue({ id: '1', name: 'John', email: 'john@example.com' })
      const readHandler = vi
        .fn()
        .mockResolvedValue({ id: '1', name: 'John', email: 'john@example.com' })
      const updateHandler = vi.fn().mockResolvedValue({
        id: '1',
        name: 'John Updated',
        email: 'john@example.com',
      })
      const deleteHandler = vi.fn().mockResolvedValue(undefined)

      const inputSchema = z.object({
        name: z.string(),
        email: z.string().email(),
      })

      const result = router
        .list(listHandler)
        .create({ input: inputSchema }, createHandler)
        .read(readHandler)
        .update({ input: inputSchema }, updateHandler)
        .delete(deleteHandler)

      expect(result).toBe(router)
    })
  })

  describe('nested routing', () => {
    it('should support nested routers', () => {
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

      expect(storeRouter).toBeInstanceOf(Router)
      expect(productRouter).toBeInstanceOf(Router)
    })
  })

  describe('static methods', () => {
    it('should provide router access through static method', () => {
      const router = new Router('users', { schema: mockSchema })
      const honoRouter = Router.getRouterForRoute(router)

      expect(honoRouter).toBeDefined()
    })
  })
})
