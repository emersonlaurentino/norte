import { Type as t } from '@sinclair/typebox'
import { describe, expect, it } from 'vitest'
import { Norte } from '../norte'
import { Router } from '../router'

describe('Response Schema Validation', () => {
  it('should validate response for .read() - valid response', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
      email: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.read({}, async () => {
      return {
        id: '1',
        name: 'Alice',
        email: 'alice@example.com',
      }
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/users/1', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({
      id: '1',
      name: 'Alice',
      email: 'alice@example.com',
    })
  })

  it('should reject invalid response for .read() - missing required field', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
      email: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.read({}, async () => {
      return {
        id: '1',
        name: 'Alice',
        // Missing email
      } as { id: string; name: string; email: string }
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/users/1', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('INVALID_OUTPUT')
    expect(data.message).toContain('Response validation failed')
  })

  it('should reject invalid response for .read() - wrong field type', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
      age: t.Number(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.read({}, async () => {
      return {
        id: '1',
        name: 'Alice',
        age: 'not-a-number', // Should be number
      } as unknown as { id: string; name: string; age: number }
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/users/1', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('INVALID_OUTPUT')
  })

  it('should validate response for .list() - valid array', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.list({}, async () => {
      return [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
      ]
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/users', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(2)
  })

  it('should validate response for .list() - reject if not array', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.list({}, async () => {
      return { id: '1', name: 'Alice' } as unknown as Array<{
        id: string
        name: string
      }>
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/users', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('INVALID_OUTPUT')
    expect(data.message).toContain('List method must return an array')
  })

  it('should validate response for .list() - reject invalid array items', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.list({}, async () => {
      return [
        { id: '1', name: 'Alice' },
        { id: '2' }, // Missing name
        { id: '3', name: 'Charlie' },
      ] as Array<{ id: string; name: string }>
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/users', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('INVALID_OUTPUT')
    expect(data.message).toContain('Response validation failed for item 1')
  })

  it('should validate response for .create() - valid response', async () => {
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
      async ({ body }) => {
        return {
          id: 'new-id',
          name: (body as { name: string }).name,
        }
      },
    )

    app.register(usersRouter)

    const req = new Request('http://localhost/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Bob' }),
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(201)
  })

  it('should reject invalid response for .create()', async () => {
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
      async () => {
        return {
          id: 'new-id',
          // Missing name
        } as { id: string; name: string }
      },
    )

    app.register(usersRouter)

    const req = new Request('http://localhost/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Bob' }),
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('INVALID_OUTPUT')
  })

  it('should validate response for .update() - valid response', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.update(
      {
        body: t.Object({ name: t.String() }),
      },
      async ({ param, body }) => {
        return {
          id: (param as { userId: string }).userId,
          name: (body as { name: string }).name,
        }
      },
    )

    app.register(usersRouter)

    const req = new Request('http://localhost/users/1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name' }),
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
  })

  it('should reject invalid response for .update()', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.update(
      {
        body: t.Object({ name: t.String() }),
      },
      async ({ param }) => {
        return {
          id: (param as { userId: string }).userId,
          // Missing name
        } as { id: string; name: string }
      },
    )

    app.register(usersRouter)

    const req = new Request('http://localhost/users/1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name' }),
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('INVALID_OUTPUT')
  })

  it('should allow Response object to bypass validation', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.read({}, async () => {
      // Return a Response object with invalid data (should not be validated)
      return new Response(JSON.stringify({ invalid: 'data' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/users/1', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ invalid: 'data' })
  })

  it('should validate complex nested schema', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      profile: t.Object({
        name: t.String(),
        age: t.Number(),
        address: t.Object({
          street: t.String(),
          city: t.String(),
        }),
      }),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.read({}, async () => {
      return {
        id: '1',
        profile: {
          name: 'Alice',
          age: 30,
          address: {
            street: '123 Main St',
            city: 'New York',
          },
        },
      }
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/users/1', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
  })

  it('should reject invalid complex nested schema', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      profile: t.Object({
        name: t.String(),
        age: t.Number(),
        address: t.Object({
          street: t.String(),
          city: t.String(),
        }),
      }),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.read({}, async () => {
      return {
        id: '1',
        profile: {
          name: 'Alice',
          age: 30,
          address: {
            street: '123 Main St',
            // Missing city
          },
        },
      } as {
        id: string
        profile: {
          name: string
          age: number
          address: { street: string; city: string }
        }
      }
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/users/1', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('INVALID_OUTPUT')
  })

  it('should validate optional fields correctly', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
      email: t.Optional(t.String()),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.read({}, async () => {
      return {
        id: '1',
        name: 'Alice',
        // email is optional, so it's OK to omit
      }
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/users/1', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
  })

  it('should validate array fields in schema', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
      tags: t.Array(t.String()),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.read({}, async () => {
      return {
        id: '1',
        name: 'Alice',
        tags: ['admin', 'user'],
      }
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/users/1', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.tags).toHaveLength(2)
  })

  it('should reject invalid array field types', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
      tags: t.Array(t.String()),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.read({}, async () => {
      return {
        id: '1',
        name: 'Alice',
        tags: ['admin', true, { obj: 'value' }], // Invalid types that can't be coerced
      } as unknown as { id: string; name: string; tags: string[] }
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/users/1', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('INVALID_OUTPUT')
  })

  it('should validate empty array for .list()', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.list({}, async () => {
      return []
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/users', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([])
  })
})
