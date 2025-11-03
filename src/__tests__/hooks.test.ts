import { Type as t } from '@sinclair/typebox'
import { describe, expect, it } from 'vitest'
import { Norte } from '../norte'
import { NorteError, Router } from '../router'
import type { AfterHook, BeforeHook, NorteStore } from '../types'

interface TestStore extends NorteStore {
  userId?: string
  authenticated?: boolean
  requestId?: string
}

describe('Hooks (beforeHandler and afterHandler)', () => {
  it('should execute beforeHandler and populate store', async () => {
    const app = new Norte<TestStore>()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const authHook: BeforeHook<TestStore> = async ({ store, headers }) => {
      const token = headers.get('authorization')
      if (!token) {
        throw new NorteError('UNAUTHORIZED', 'Missing authorization token')
      }
      return { ...store, userId: 'user-123', authenticated: true }
    }

    const usersRouter = new Router<TestStore>('users', {
      schema: userSchema,
      beforeHandler: [authHook],
    })

    usersRouter.list({}, async ({ store }) => {
      expect(store.userId).toBe('user-123')
      expect(store.authenticated).toBe(true)
      return [{ id: store.userId || '', name: 'Alice' }]
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users', {
      method: 'GET',
      headers: { authorization: 'Bearer token123' },
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([{ id: 'user-123', name: 'Alice' }])
  })

  it('should reject request in beforeHandler if unauthorized', async () => {
    const app = new Norte<TestStore>()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const authHook: BeforeHook<TestStore> = async ({ headers }) => {
      const token = headers.get('authorization')
      if (!token) {
        throw new NorteError('UNAUTHORIZED', 'Missing authorization token')
      }
      return {}
    }

    const usersRouter = new Router<TestStore>('users', {
      schema: userSchema,
      beforeHandler: [authHook],
    })

    usersRouter.list({}, async () => {
      return [{ id: '1', name: 'Alice' }]
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data).toEqual({
      error: 'UNAUTHORIZED',
      message: 'Missing authorization token',
    })
  })

  it('should execute afterHandler and modify response', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const addHeaderHook: AfterHook = async ({ headers, result }) => {
      if (!(result instanceof NorteError)) {
        headers.set('X-Custom-Header', 'custom-value')
        headers.set('X-Total-Count', '1')
      }
    }

    const usersRouter = new Router('users', {
      schema: userSchema,
      afterHandler: [addHeaderHook],
    })

    usersRouter.read({}, async () => {
      return { id: '1', name: 'Alice' }
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users/1', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('X-Custom-Header')).toBe('custom-value')
    expect(res.headers.get('X-Total-Count')).toBe('1')
  })

  it('should execute afterHandler and modify response status', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const customStatusHook: AfterHook = async ({ response }) => {
      response.status = 202 // Change status to Accepted
    }

    const usersRouter = new Router('users', {
      schema: userSchema,
      afterHandler: [customStatusHook],
    })

    usersRouter.read({}, async () => {
      return { id: '1', name: 'Alice' }
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users/1', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(202)
  })

  it('should execute multiple beforeHandlers in order', async () => {
    const app = new Norte<TestStore>()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const executionOrder: string[] = []

    const firstHook: BeforeHook<TestStore> = async ({ store }) => {
      executionOrder.push('first')
      return { ...store, requestId: 'req-123' }
    }

    const secondHook: BeforeHook<TestStore> = async ({ store }) => {
      executionOrder.push('second')
      expect(store.requestId).toBe('req-123') // Check that first hook ran
      return { ...store, userId: 'user-456' }
    }

    const usersRouter = new Router<TestStore>('users', {
      schema: userSchema,
      beforeHandler: [firstHook, secondHook],
    })

    usersRouter.list({}, async ({ store }) => {
      expect(store.requestId).toBe('req-123')
      expect(store.userId).toBe('user-456')
      return [{ id: '1', name: 'Alice' }]
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    expect(executionOrder).toEqual(['first', 'second'])
  })

  it('should execute multiple afterHandlers in order', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const executionOrder: string[] = []

    const firstHook: AfterHook = async ({ headers }) => {
      executionOrder.push('first')
      headers.set('X-First', 'true')
    }

    const secondHook: AfterHook = async ({ headers }) => {
      executionOrder.push('second')
      expect(headers.get('X-First')).toBe('true') // Check that first hook ran
      headers.set('X-Second', 'true')
    }

    const usersRouter = new Router('users', {
      schema: userSchema,
      afterHandler: [firstHook, secondHook],
    })

    usersRouter.read({}, async () => {
      return { id: '1', name: 'Alice' }
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users/1', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('X-First')).toBe('true')
    expect(res.headers.get('X-Second')).toBe('true')
    expect(executionOrder).toEqual(['first', 'second'])
  })

  it('should merge router-level and route-level beforeHandlers', async () => {
    const app = new Norte<TestStore>()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const executionOrder: string[] = []

    const routerHook: BeforeHook<TestStore> = async ({ store }) => {
      executionOrder.push('router')
      return { ...store, requestId: 'req-123' }
    }

    const routeHook: BeforeHook<TestStore> = async ({ store }) => {
      executionOrder.push('route')
      expect(store.requestId).toBe('req-123')
      return { ...store, userId: 'user-456' }
    }

    const usersRouter = new Router<TestStore>('users', {
      schema: userSchema,
      beforeHandler: [routerHook],
    })

    usersRouter.list(
      {
        beforeHandler: [routeHook],
      },
      async ({ store }) => {
        expect(store.requestId).toBe('req-123')
        expect(store.userId).toBe('user-456')
        return [{ id: '1', name: 'Alice' }]
      },
    )

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    expect(executionOrder).toEqual(['router', 'route'])
  })

  it('should merge router-level and route-level afterHandlers', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const executionOrder: string[] = []

    const routerHook: AfterHook = async ({ headers }) => {
      executionOrder.push('router')
      headers.set('X-Router', 'true')
    }

    const routeHook: AfterHook = async ({ headers }) => {
      executionOrder.push('route')
      expect(headers.get('X-Router')).toBe('true')
      headers.set('X-Route', 'true')
    }

    const usersRouter = new Router('users', {
      schema: userSchema,
      afterHandler: [routerHook],
    })

    usersRouter.read(
      {
        afterHandler: [routeHook],
      },
      async () => {
        return { id: '1', name: 'Alice' }
      },
    )

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users/1', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('X-Router')).toBe('true')
    expect(res.headers.get('X-Route')).toBe('true')
    expect(executionOrder).toEqual(['router', 'route'])
  })

  it('should provide access to request in beforeHandler', async () => {
    const app = new Norte<TestStore>()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const requestHook: BeforeHook<TestStore> = async ({ request, store }) => {
      const url = new URL(request.url)
      return { ...store, hostname: url.hostname }
    }

    const usersRouter = new Router<TestStore>('users', {
      schema: userSchema,
      beforeHandler: [requestHook],
    })

    usersRouter.list({}, async ({ store }) => {
      expect(store.hostname).toBe('localhost')
      return [{ id: '1', name: 'Alice' }]
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
  })

  it('should provide logger in hooks and handler', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    let logCalled = false

    const loggingHook: BeforeHook = async ({ log, store }) => {
      expect(typeof log.info).toBe('function')
      expect(typeof log.error).toBe('function')
      expect(typeof log.warn).toBe('function')
      expect(typeof log.debug).toBe('function')
      logCalled = true
      return store
    }

    const usersRouter = new Router('users', {
      schema: userSchema,
      beforeHandler: [loggingHook],
    })

    usersRouter.list({}, async ({ log }) => {
      expect(typeof log.info).toBe('function')
      return [{ id: '1', name: 'Alice' }]
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    expect(logCalled).toBe(true)
  })
})
