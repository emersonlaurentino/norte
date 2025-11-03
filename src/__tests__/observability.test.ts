import { Type as t } from '@sinclair/typebox'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Norte } from '../norte'
import { Router } from '../router'
import type { BeforeHookContext, NorteLogger, NorteStore } from '../types'

describe('Observability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Structured Logging with Pino', () => {
    it('should inject logger with requestId in handler', async () => {
      const app = new Norte()
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })

      let capturedLog: NorteLogger | null = null

      const usersRouter = new Router('users', { schema: userSchema })
      usersRouter.list({}, async ({ log }) => {
        capturedLog = log
        log.info({ test: 'data' }, 'Test log message')
        return [{ id: '1', name: 'Alice' }]
      })

      app.register(usersRouter)

      const req = new Request('http://localhost/v1/users', { method: 'GET' })
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      expect(capturedLog).toBeDefined()
      const logger = capturedLog as unknown as NorteLogger
      expect(logger.bindings).toBeDefined()
      expect(logger.bindings()).toHaveProperty('requestId')
      expect(typeof logger.bindings().requestId).toBe('string')
      expect(logger.bindings().requestId).toMatch(/^[a-f0-9-]+$/)
    })

    it('should inject logger with requestId in beforeHandler hooks', async () => {
      const app = new Norte()
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })

      let capturedLog: NorteLogger | null = null

      const testHook = async ({
        log,
        store,
      }: BeforeHookContext<NorteStore>) => {
        capturedLog = log
        log.info({ hook: 'before' }, 'Before hook executed')
        return store
      }

      const usersRouter = new Router('users', {
        schema: userSchema,
        beforeHandler: [testHook],
      })
      usersRouter.list({}, async () => [{ id: '1', name: 'Alice' }])

      app.register(usersRouter)

      const req = new Request('http://localhost/v1/users', { method: 'GET' })
      await app.fetch(req)

      expect(capturedLog).toBeDefined()
      const logger = capturedLog as unknown as NorteLogger
      expect(logger.bindings).toBeDefined()
      expect(logger.bindings()).toHaveProperty('requestId')
    })

    it('should inject logger with requestId in afterHandler hooks', async () => {
      const app = new Norte()
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })

      let capturedLog: NorteLogger | null = null

      const afterHook = async ({ log }: { log: NorteLogger }) => {
        capturedLog = log
        log.info({ hook: 'after' }, 'After hook executed')
      }

      const usersRouter = new Router('users', {
        schema: userSchema,
        afterHandler: [afterHook],
      })
      usersRouter.list({}, async () => [{ id: '1', name: 'Alice' }])

      app.register(usersRouter)

      const req = new Request('http://localhost/v1/users', { method: 'GET' })
      await app.fetch(req)

      expect(capturedLog).toBeDefined()
      const logger = capturedLog as unknown as NorteLogger
      expect(logger.bindings).toBeDefined()
      expect(logger.bindings()).toHaveProperty('requestId')
    })

    it('should generate unique requestId for each request', async () => {
      const app = new Norte()
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })

      const requestIds: string[] = []

      const usersRouter = new Router('users', { schema: userSchema })
      usersRouter.list({}, async ({ log }) => {
        requestIds.push(log.bindings().requestId as string)
        return [{ id: '1', name: 'Alice' }]
      })

      app.register(usersRouter)

      for (let i = 0; i < 3; i++) {
        const req = new Request('http://localhost/v1/users', { method: 'GET' })
        await app.fetch(req)
      }

      expect(requestIds).toHaveLength(3)
      expect(new Set(requestIds).size).toBe(3)
    })

    it('should use custom requestId from X-Request-ID header if provided', async () => {
      const app = new Norte()
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })

      let capturedRequestId: string | null = null

      const usersRouter = new Router('users', { schema: userSchema })
      usersRouter.list({}, async ({ log }) => {
        capturedRequestId = log.bindings().requestId as string
        return [{ id: '1', name: 'Alice' }]
      })

      app.register(usersRouter)

      const customRequestId = 'custom-request-id-123'
      const req = new Request('http://localhost/v1/users', {
        method: 'GET',
        headers: {
          'X-Request-ID': customRequestId,
        },
      })
      await app.fetch(req)

      expect(capturedRequestId).toBe(customRequestId)
    })

    it('should support child logger with additional bindings', async () => {
      const app = new Norte()
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })

      let parentBindings: Record<string, unknown> | null = null
      let childBindings: Record<string, unknown> | null = null

      const usersRouter = new Router('users', { schema: userSchema })
      usersRouter.list({}, async ({ log }) => {
        parentBindings = log.bindings()

        const childLog = log.child({ userId: '123', operation: 'list' })
        childBindings = childLog.bindings()

        childLog.info({ test: 'child' }, 'Child log')

        return [{ id: '1', name: 'Alice' }]
      })

      app.register(usersRouter)

      const req = new Request('http://localhost/v1/users', { method: 'GET' })
      await app.fetch(req)

      expect(parentBindings).toHaveProperty('requestId')
      expect(childBindings).toHaveProperty('requestId')
      expect(childBindings).toHaveProperty('userId', '123')
      expect(childBindings).toHaveProperty('operation', 'list')
      const child = childBindings as unknown as Record<string, unknown>
      const parent = parentBindings as unknown as Record<string, unknown>
      expect(child.requestId).toBe(parent.requestId)
    })
  })

  describe('Logger Configuration', () => {
    it('should use custom logger configuration', async () => {
      const customLogger: { level: 'debug'; name: string } = {
        level: 'debug',
        name: 'custom-api',
      }

      const app = new Norte({ logger: customLogger })
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })

      let capturedLog: NorteLogger | null = null

      const usersRouter = new Router('users', { schema: userSchema })
      usersRouter.list({}, async ({ log }) => {
        capturedLog = log
        return [{ id: '1', name: 'Alice' }]
      })

      app.register(usersRouter)

      const req = new Request('http://localhost/v1/users', { method: 'GET' })
      await app.fetch(req)

      expect(capturedLog).toBeDefined()
      const logger = capturedLog as unknown as NorteLogger
      expect(logger.level).toBe('debug')
    })

    it('should allow disabling logger', async () => {
      const app = new Norte({ logger: false })
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })

      let capturedLog: NorteLogger | null = null

      const usersRouter = new Router('users', { schema: userSchema })
      usersRouter.list({}, async ({ log }) => {
        capturedLog = log
        return [{ id: '1', name: 'Alice' }]
      })

      app.register(usersRouter)

      const req = new Request('http://localhost/v1/users', { method: 'GET' })
      await app.fetch(req)

      expect(capturedLog).toBeDefined()
      const logger = capturedLog as unknown as NorteLogger
      expect(logger.level).toBe('silent')
    })
  })

  describe('OpenTelemetry Integration (Optional)', () => {
    it('should add trace_id to logger bindings when telemetry is enabled', async () => {
      const app = new Norte({
        telemetry: {
          enabled: true,
        },
      })
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })

      let capturedBindings: Record<string, unknown> | null = null

      const usersRouter = new Router('users', { schema: userSchema })
      usersRouter.list({}, async ({ log }) => {
        capturedBindings = log.bindings()
        return [{ id: '1', name: 'Alice' }]
      })

      app.register(usersRouter)

      const req = new Request('http://localhost/v1/users', { method: 'GET' })
      await app.fetch(req)

      expect(capturedBindings).toHaveProperty('requestId')
      expect(capturedBindings).toHaveProperty('trace_id')
      const bindings = capturedBindings as unknown as { trace_id: string }
      expect(typeof bindings.trace_id).toBe('string')
    })

    it('should extract traceParent from headers when provided', async () => {
      const app = new Norte({
        telemetry: {
          enabled: true,
        },
      })
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })

      let capturedBindings: Record<string, unknown> | null = null

      const usersRouter = new Router('users', { schema: userSchema })
      usersRouter.list({}, async ({ log }) => {
        capturedBindings = log.bindings()
        return [{ id: '1', name: 'Alice' }]
      })

      app.register(usersRouter)

      const traceParent =
        '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'
      const req = new Request('http://localhost/v1/users', {
        method: 'GET',
        headers: {
          traceparent: traceParent,
        },
      })
      await app.fetch(req)

      expect(capturedBindings).toHaveProperty('trace_id')
      const bindings = capturedBindings as unknown as { trace_id: string }
      expect(bindings.trace_id).toBe('0af7651916cd43dd8448eb211c80319c')
    })

    it('should work without telemetry when not configured', async () => {
      const app = new Norte()
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })

      let capturedBindings: Record<string, unknown> | null = null

      const usersRouter = new Router('users', { schema: userSchema })
      usersRouter.list({}, async ({ log }) => {
        capturedBindings = log.bindings()
        return [{ id: '1', name: 'Alice' }]
      })

      app.register(usersRouter)

      const req = new Request('http://localhost/v1/users', { method: 'GET' })
      await app.fetch(req)

      expect(capturedBindings).toHaveProperty('requestId')
      expect(capturedBindings).not.toHaveProperty('trace_id')
    })
  })

  describe('X-Request-ID Header', () => {
    it('should include X-Request-ID header in successful responses', async () => {
      const app = new Norte()
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })

      const usersRouter = new Router('users', { schema: userSchema })
      usersRouter.list({}, async () => {
        return [{ id: '1', name: 'Alice' }]
      })

      app.register(usersRouter)

      const req = new Request('http://localhost/v1/users', { method: 'GET' })
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      expect(res.headers.get('X-Request-ID')).toBeTruthy()
      expect(res.headers.get('X-Request-ID')).toMatch(/^[a-f0-9-]+$/)
    })

    it('should include X-Request-ID header in error responses', async () => {
      const app = new Norte()
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })

      const usersRouter = new Router('users', { schema: userSchema })
      usersRouter.read({}, async () => {
        throw new Error('Test error')
      })

      app.register(usersRouter)

      const req = new Request('http://localhost/v1/users/1', { method: 'GET' })
      const res = await app.fetch(req)

      expect(res.status).toBe(500)
      expect(res.headers.get('X-Request-ID')).toBeTruthy()
      expect(res.headers.get('X-Request-ID')).toMatch(/^[a-f0-9-]+$/)
    })

    it('should include X-Request-ID header in 404 responses', async () => {
      const app = new Norte()

      const req = new Request('http://localhost/v1/nonexistent', { method: 'GET' })
      const res = await app.fetch(req)

      expect(res.status).toBe(404)
      expect(res.headers.get('X-Request-ID')).toBeTruthy()
      expect(res.headers.get('X-Request-ID')).toMatch(/^[a-f0-9-]+$/)
    })

    it('should include X-Request-ID header in OpenAPI JSON response', async () => {
      const app = new Norte()

      const req = new Request('http://localhost/openapi.json', { method: 'GET' })
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      expect(res.headers.get('X-Request-ID')).toBeTruthy()
      expect(res.headers.get('X-Request-ID')).toMatch(/^[a-f0-9-]+$/)
    })

    it('should include X-Request-ID header in Scalar UI response', async () => {
      const app = new Norte()

      const req = new Request('http://localhost/', { method: 'GET' })
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      expect(res.headers.get('X-Request-ID')).toBeTruthy()
      expect(res.headers.get('X-Request-ID')).toMatch(/^[a-f0-9-]+$/)
    })

    it('should include X-Request-ID header in raw route responses', async () => {
      const app = new Norte()

      app.raw('GET', '/test', () => {
        return () => new Response(JSON.stringify({ test: 'data' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      })

      const req = new Request('http://localhost/test', { method: 'GET' })
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      expect(res.headers.get('X-Request-ID')).toBeTruthy()
      expect(res.headers.get('X-Request-ID')).toMatch(/^[a-f0-9-]+$/)
    })

    it('should use custom X-Request-ID from request header if provided', async () => {
      const app = new Norte()
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })

      const usersRouter = new Router('users', { schema: userSchema })
      usersRouter.list({}, async () => {
        return [{ id: '1', name: 'Alice' }]
      })

      app.register(usersRouter)

      const customRequestId = 'custom-request-id-123'
      const req = new Request('http://localhost/v1/users', {
        method: 'GET',
        headers: {
          'X-Request-ID': customRequestId,
        },
      })
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      expect(res.headers.get('X-Request-ID')).toBe(customRequestId)
    })

    it('should preserve custom X-Request-ID header if handler sets it', async () => {
      const app = new Norte()
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })

      const usersRouter = new Router('users', { schema: userSchema })
      usersRouter.list({}, async () => {
        return new Response(JSON.stringify([{ id: '1', name: 'Alice' }]), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'X-Request-ID': 'custom-from-handler',
          },
        })
      })

      app.register(usersRouter)

      const req = new Request('http://localhost/v1/users', { method: 'GET' })
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      // Se o handler já definiu, mantém o valor do handler
      expect(res.headers.get('X-Request-ID')).toBe('custom-from-handler')
    })

    it('should include X-Request-ID header in responses with custom status codes', async () => {
      const app = new Norte()
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })

      const usersRouter = new Router('users', { schema: userSchema })
      usersRouter.create({}, async () => {
        return { id: '1', name: 'Alice' }
      })

      app.register(usersRouter)

      const req = new Request('http://localhost/v1/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Alice' }),
      })
      const res = await app.fetch(req)

      expect(res.status).toBe(201)
      expect(res.headers.get('X-Request-ID')).toBeTruthy()
    })

    it('should include X-Request-ID header in 204 No Content responses', async () => {
      const app = new Norte()
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })

      const usersRouter = new Router('users', { schema: userSchema })
      usersRouter.delete({}, async ({ param }) => {
        return { id: (param as { userId: string }).userId, name: 'Deleted' }
      })

      app.register(usersRouter)

      const req = new Request('http://localhost/v1/users/1', { method: 'DELETE' })
      const res = await app.fetch(req)

      expect(res.status).toBe(204)
      expect(res.headers.get('X-Request-ID')).toBeTruthy()
    })

    it('should have the same requestId in header and logger', async () => {
      const app = new Norte()
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })

      let capturedRequestId: string | undefined = undefined

      const usersRouter = new Router('users', { schema: userSchema })
      usersRouter.list({}, async ({ log }) => {
        // Captura o requestId do logger
        capturedRequestId = log.requestId || (log.bindings().requestId as string)
        return [{ id: '1', name: 'Alice' }]
      })

      app.register(usersRouter)

      const req = new Request('http://localhost/v1/users', { method: 'GET' })
      const res = await app.fetch(req)

      const headerRequestId = res.headers.get('X-Request-ID')

      expect(headerRequestId).toBeTruthy()
      expect(capturedRequestId).toBeTruthy()
      expect(headerRequestId).toBe(capturedRequestId)
    })

    it('should maintain same requestId even when bindings() fails', async () => {
      const app = new Norte()
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })

      let capturedRequestId: string | undefined = undefined

      const usersRouter = new Router('users', { schema: userSchema })
      usersRouter.list({}, async ({ log }) => {
        // Captura o requestId diretamente da propriedade (não via bindings)
        capturedRequestId = log.requestId
        return [{ id: '1', name: 'Alice' }]
      })

      app.register(usersRouter)

      const req = new Request('http://localhost/v1/users', { method: 'GET' })
      const res = await app.fetch(req)

      const headerRequestId = res.headers.get('X-Request-ID')

      expect(headerRequestId).toBeTruthy()
      expect(capturedRequestId).toBeTruthy()
      expect(headerRequestId).toBe(capturedRequestId)
    })
  })
})
