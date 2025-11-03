import { Type as t } from '@sinclair/typebox'
import { describe, expect, it } from 'vitest'
import { Norte } from '../norte'
import { Router } from '../router'

describe('Schema Validation', () => {
  it('should validate body schema and reject invalid data', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.create(
      {
        body: t.Object({
          name: t.String({ minLength: 3 }),
          email: t.String(),
        }),
      },
      async ({ body }) => {
        return {
          id: '123',
          name: (body as { name: string }).name,
        }
      },
    )

    app.register(usersRouter)

    const req1 = new Request('http://localhost/v1/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'ab', email: 'test@example.com' }),
    })
    const res1 = await app.fetch(req1)

    expect(res1.status).toBe(400)
    const data1 = await res1.json()
    expect(data1.error).toBe('INVALID_INPUT')
    expect(data1.message).toContain('Body validation failed')

    const req2 = new Request('http://localhost/v1/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' }),
    })
    const res2 = await app.fetch(req2)

    expect(res2.status).toBe(400)
    const data2 = await res2.json()
    expect(data2.error).toBe('INVALID_INPUT')
  })

  it('should validate query parameters', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.list(
      {
        query: t.Object({
          limit: t.Number({ minimum: 1, maximum: 100 }),
          page: t.Number({ minimum: 1 }),
        }),
      },
      async ({ query }) => {
        const limit = (query as { limit: number }).limit
        return [{ id: '1', name: `User page ${limit}` }]
      },
    )

    app.register(usersRouter)

    const req1 = new Request('http://localhost/v1/users?limit=10&page=1', {
      method: 'GET',
    })
    const res1 = await app.fetch(req1)
    expect(res1.status).toBe(200)

    const req2 = new Request('http://localhost/v1/users?limit=200&page=1', {
      method: 'GET',
    })
    const res2 = await app.fetch(req2)
    expect(res2.status).toBe(400)
    const data2 = await res2.json()
    expect(data2.error).toBe('INVALID_INPUT')
    expect(data2.message).toContain('Query validation failed')
  })

  it('should validate path parameters', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.read(
      {
        param: t.Object({
          userId: t.String({ pattern: '^[0-9]+$' }), // Only numbers
        }),
      },
      async ({ param }) => {
        return {
          id: (param as { userId: string }).userId,
          name: 'Test User',
        }
      },
    )

    app.register(usersRouter)

    const req1 = new Request('http://localhost/v1/users/123', { method: 'GET' })
    const res1 = await app.fetch(req1)
    expect(res1.status).toBe(200)

    const req2 = new Request('http://localhost/v1/users/abc', { method: 'GET' })
    const res2 = await app.fetch(req2)
    expect(res2.status).toBe(400)
    const data2 = await res2.json()
    expect(data2.error).toBe('INVALID_INPUT')
    expect(data2.message).toContain('Param validation failed')
  })

  it('should coerce types when possible', async () => {
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
      async ({ query }) => {
        const limit = (query as { limit: number }).limit
        expect(typeof limit).toBe('number')
        return [{ id: '1', name: 'User' }]
      },
    )

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users?limit=20', {
      method: 'GET',
    })
    const res = await app.fetch(req)
    expect(res.status).toBe(200)
  })

  it('should apply default values from schema', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.list(
      {
        query: t.Object({
          limit: t.Number({ default: 10 }),
        }),
      },
      async ({ query }) => {
        const limit = (query as { limit: number }).limit
        expect(limit).toBe(10)
        return [{ id: '1', name: 'User' }]
      },
    )

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users', { method: 'GET' })
    const res = await app.fetch(req)
    expect(res.status).toBe(200)
  })

  it('should validate response schema for single objects', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.read({}, async () => {
      return { id: '1' } as { id: string; name: string }
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users/1', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('INVALID_OUTPUT')
    expect(data.message).toContain('Response validation failed')
  })

  it('should validate response schema for arrays (list)', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.list({}, async () => {
      return [{ id: '1', name: 'Alice' }, { id: '2' }] as {
        id: string
        name: string
      }[]
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('INVALID_OUTPUT')
    expect(data.message).toContain('Response validation failed')
  })

  it('should reject invalid JSON body', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.create(
      {
        body: t.Object({ name: t.String() }),
      },
      async () => ({ id: '1', name: 'Test' }),
    )

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'invalid json{',
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('INVALID_INPUT')
    expect(data.message).toContain('Invalid JSON body')
  })
})
