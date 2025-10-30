import { Type as t } from '@sinclair/typebox'
import { describe, expect, it } from 'vitest'
import { Norte } from '../norte'
import { Router } from '../router'

describe('Basic CRUD Operations', () => {
  it('should handle .list() route', async () => {
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

    const req = new Request('http://localhost/v1/users', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/json')
    const data = await res.json()
    expect(data).toEqual([
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ])
  })

  it('should handle .create() route with POST', async () => {
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

    const req = new Request('http://localhost/v1/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Charlie' }),
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data).toEqual({ id: '123', name: 'Charlie' })
  })

  it('should handle .read() route with path parameter', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.read({}, async ({ param }) => {
      return {
        id: (param as { userId: string }).userId,
        name: 'Alice',
      }
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users/456', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ id: '456', name: 'Alice' })
  })

  it('should handle .update() route with PATCH', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.update(
      {
        body: t.Object({
          name: t.String(),
        }),
      },
      async ({ param, body }) => {
        return {
          id: (param as { userId: string }).userId,
          name: (body as { name: string }).name,
        }
      },
    )

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users/789', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Alice' }),
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ id: '789', name: 'Updated Alice' })
  })

  it('should handle .delete() route with DELETE', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.delete({}, async ({ param }) => {
      // Delete should return the deleted object to satisfy schema validation
      return { id: (param as { userId: string }).userId, name: 'Deleted' }
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users/999', {
      method: 'DELETE',
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(204)
    const text = await res.text()
    expect(text).toBe('')
  })

  it('should return 404 for non-existent routes', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.list({}, async () => [])

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/nonexistent', {
      method: 'GET',
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data).toEqual({
      error: 'NOT_FOUND',
      message: 'Route not found',
    })
  })

  it('should return 404 for unsupported HTTP method', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.list({}, async () => [])

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users', { method: 'PUT' })
    const res = await app.fetch(req)

    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data).toEqual({
      error: 'NOT_FOUND',
      message: 'Route not found',
    })
  })
})
