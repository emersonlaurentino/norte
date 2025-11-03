import { Type as t } from '@sinclair/typebox'
import { describe, expect, it, vi } from 'vitest'
import { Norte } from '../norte'
import { NorteError, Router } from '../router'

describe('Error Handling', () => {
  it('should handle NorteError with NOT_FOUND', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.read({}, async ({ param }) => {
      const userId = (param as { userId: string }).userId
      if (userId === 'nonexistent') {
        throw new NorteError('NOT_FOUND', 'User not found')
      }
      return { id: userId, name: 'Alice' }
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users/nonexistent', {
      method: 'GET',
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data).toEqual({
      error: 'NOT_FOUND',
      message: 'User not found',
    })
  })

  it('should handle NorteError with UNAUTHORIZED', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.list({}, async () => {
      throw new NorteError('UNAUTHORIZED', 'Authentication required')
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data).toEqual({
      error: 'UNAUTHORIZED',
      message: 'Authentication required',
    })
  })

  it('should handle NorteError with FORBIDDEN', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.update({}, async () => {
      throw new NorteError('FORBIDDEN', 'You do not have permission')
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users/1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data).toEqual({
      error: 'FORBIDDEN',
      message: 'You do not have permission',
    })
  })

  it('should handle NorteError with CONFLICT', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      email: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.create(
      {
        body: t.Object({ email: t.String() }),
      },
      async () => {
        throw new NorteError('CONFLICT', 'Email already exists')
      },
    )

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data).toEqual({
      error: 'CONFLICT',
      message: 'Email already exists',
    })
  })

  it('should handle NorteError with INTERNAL_SERVER_ERROR', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.list({}, async () => {
      throw new NorteError(
        'INTERNAL_SERVER_ERROR',
        'Database connection failed',
      )
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data).toEqual({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Database connection failed',
    })
  })

  it('should handle NorteError with custom error code (defaults to 500)', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.list({}, async () => {
      throw new NorteError('CUSTOM_ERROR', 'Something went wrong')
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data).toEqual({
      error: 'CUSTOM_ERROR',
      message: 'Something went wrong',
    })
  })

  it('should handle unexpected errors as INTERNAL_SERVER_ERROR', async () => {
    // Mock console.error to avoid polluting test output
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.list({}, async () => {
      throw new Error('Unexpected error')
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data).toEqual({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    })

    consoleErrorSpy.mockRestore()
  })

  it('should handle errors thrown in beforeHandler', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', {
      schema: userSchema,
      beforeHandler: [
        async () => {
          throw new NorteError('UNAUTHORIZED', 'Token invalid')
        },
      ],
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
      message: 'Token invalid',
    })
  })

  it('should handle async errors in handler', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.list({}, async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      throw new NorteError('NOT_FOUND', 'No users found')
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data).toEqual({
      error: 'NOT_FOUND',
      message: 'No users found',
    })
  })

  it('should handle validation errors for missing required fields', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.create(
      {
        body: t.Object({
          name: t.String(),
          email: t.String(),
        }),
      },
      async ({ body }) => {
        return {
          id: '1',
          name: (body as { name: string }).name,
        }
      },
    )

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' }), // Missing email
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('INVALID_INPUT')
    expect(data.message).toContain('Body validation failed')
  })

  it('should handle validation errors for wrong types', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.list(
      {
        query: t.Object({
          limit: t.Number(),
        }),
      },
      async () => [],
    )

    app.register(usersRouter)

    // Can't coerce "notanumber" to number
    const req = new Request('http://localhost/v1/users?limit=notanumber', {
      method: 'GET',
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('INVALID_INPUT')
  })

  it('should provide error helper in beforeHandler', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', {
      schema: userSchema,
      beforeHandler: [
        async ({ headers, error }) => {
          const token = headers.get('authorization')
          if (!token) {
            throw error('UNAUTHORIZED', 'Missing token')
          }
          return {}
        },
      ],
    })

    usersRouter.list({}, async () => [])

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data).toEqual({
      error: 'UNAUTHORIZED',
      message: 'Missing token',
    })
  })

  it('should handle errors in afterHandler gracefully', async () => {
    // Mock console.error to avoid polluting test output
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', {
      schema: userSchema,
      afterHandler: [
        async () => {
          throw new Error('After handler error')
        },
      ],
    })

    usersRouter.read({}, async () => {
      return { id: '1', name: 'Alice' }
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users/1', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('INTERNAL_SERVER_ERROR')

    consoleErrorSpy.mockRestore()
  })

  it('should handle empty domain error', () => {
    expect(() => {
      new Router('', { schema: t.Object({ id: t.String() }) })
    }).toThrow('The domain of the Router cannot be empty.')
  })

  it('should handle missing schema for child router', () => {
    const parentRouter = new Router('parent', {
      schema: t.Object({ id: t.String() }),
    })

    expect(() => {
      // biome-ignore lint/suspicious/noExplicitAny: any
      new Router(parentRouter, 'child', undefined as any)
    }).toThrow('RouterOptions is required for nested routers.')
  })

  it('should allow raw routes for custom HTTP handling', async () => {
    const app = new Norte()

    // Raw route - for documentation or other custom responses
    app.raw('GET', '/docs/api', () => {
      return async () => {
        return new Response('API Documentation', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        })
      }
    })

    const req = new Request('http://localhost/docs/api', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/html')
    const text = await res.text()
    expect(text).toBe('API Documentation')
  })
})
