import { Type as t } from '@sinclair/typebox'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Norte } from '../norte'
import { Router } from '../router'

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

      let capturedLog: any = null

      const usersRouter = new Router('users', { schema: userSchema })
      usersRouter.list({}, async ({ log }) => {
        // Capture the logger to verify it has requestId
        capturedLog = log
        log.info({ test: 'data' }, 'Test log message')
        return [{ id: '1', name: 'Alice' }]
      })

      app.register(usersRouter)

      const req = new Request('http://localhost/v1/users', { method: 'GET' })
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      expect(capturedLog).toBeDefined()
      // Logger should be a Pino instance with requestId in bindings
      expect(capturedLog.bindings).toBeDefined()
      expect(capturedLog.bindings()).toHaveProperty('requestId')
      expect(typeof capturedLog.bindings().requestId).toBe('string')
      expect(capturedLog.bindings().requestId).toMatch(/^[a-f0-9-]+$/) // UUID format
    })

    it('should inject logger with requestId in beforeHandler hooks', async () => {
      const app = new Norte()
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })

      let capturedLog: any = null

      const testHook = async ({ log, store }: any) => {
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
      expect(capturedLog.bindings).toBeDefined()
      expect(capturedLog.bindings()).toHaveProperty('requestId')
    })

    it('should inject logger with requestId in afterHandler hooks', async () => {
      const app = new Norte()
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })

      let capturedLog: any = null

      const afterHook = async ({ log }: any) => {
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
      expect(capturedLog.bindings).toBeDefined()
      expect(capturedLog.bindings()).toHaveProperty('requestId')
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
        requestIds.push(log.bindings().requestId)
        return [{ id: '1', name: 'Alice' }]
      })

      app.register(usersRouter)

      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        const req = new Request('http://localhost/v1/users', { method: 'GET' })
        await app.fetch(req)
      }

      // All requestIds should be unique
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
        capturedRequestId = log.bindings().requestId
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

      let parentBindings: any = null
      let childBindings: any = null

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
      expect(childBindings.requestId).toBe(parentBindings.requestId)
    })
  })

  describe('Logger Configuration', () => {
    it('should use custom logger configuration', async () => {
      const customLogger = {
        level: 'debug',
        name: 'custom-api',
      }

      const app = new Norte({ logger: customLogger })
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })

      let capturedLog: any = null

      const usersRouter = new Router('users', { schema: userSchema })
      usersRouter.list({}, async ({ log }) => {
        capturedLog = log
        return [{ id: '1', name: 'Alice' }]
      })

      app.register(usersRouter)

      const req = new Request('http://localhost/v1/users', { method: 'GET' })
      await app.fetch(req)

      expect(capturedLog).toBeDefined()
      expect(capturedLog.level).toBe('debug')
    })

    it('should allow disabling logger', async () => {
      const app = new Norte({ logger: false })
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })

      let capturedLog: any = null

      const usersRouter = new Router('users', { schema: userSchema })
      usersRouter.list({}, async ({ log }) => {
        capturedLog = log
        return [{ id: '1', name: 'Alice' }]
      })

      app.register(usersRouter)

      const req = new Request('http://localhost/v1/users', { method: 'GET' })
      await app.fetch(req)

      // Logger should be a noop logger
      expect(capturedLog).toBeDefined()
      expect(capturedLog.level).toBe('silent')
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

      let capturedBindings: any = null

      const usersRouter = new Router('users', { schema: userSchema })
      usersRouter.list({}, async ({ log }) => {
        capturedBindings = log.bindings()
        return [{ id: '1', name: 'Alice' }]
      })

      app.register(usersRouter)

      const req = new Request('http://localhost/v1/users', { method: 'GET' })
      await app.fetch(req)

      expect(capturedBindings).toHaveProperty('requestId')
      // When telemetry is enabled, should have trace_id
      expect(capturedBindings).toHaveProperty('trace_id')
      expect(typeof capturedBindings.trace_id).toBe('string')
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

      let capturedBindings: any = null

      const usersRouter = new Router('users', { schema: userSchema })
      usersRouter.list({}, async ({ log }) => {
        capturedBindings = log.bindings()
        return [{ id: '1', name: 'Alice' }]
      })

      app.register(usersRouter)

      // W3C Trace Context format
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
      // Extract trace-id from traceParent (32 hex chars after version-traceId)
      expect(capturedBindings.trace_id).toBe('0af7651916cd43dd8448eb211c80319c')
    })

    it('should work without telemetry when not configured', async () => {
      const app = new Norte()
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })

      let capturedBindings: any = null

      const usersRouter = new Router('users', { schema: userSchema })
      usersRouter.list({}, async ({ log }) => {
        capturedBindings = log.bindings()
        return [{ id: '1', name: 'Alice' }]
      })

      app.register(usersRouter)

      const req = new Request('http://localhost/v1/users', { method: 'GET' })
      await app.fetch(req)

      expect(capturedBindings).toHaveProperty('requestId')
      // When telemetry is NOT enabled, should NOT have trace_id
      expect(capturedBindings).not.toHaveProperty('trace_id')
    })
  })
})
