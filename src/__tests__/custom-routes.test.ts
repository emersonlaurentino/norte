import { describe, expect, it } from 'vitest'
import { Type as t } from '@sinclair/typebox'
import { Norte } from '../norte'
import { Router } from '../router'

describe('Custom Routes', () => {
  it('should handle .custom() with custom HTTP method', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.custom('GET', '/search', {}, async ({ query }) => {
      const q = (query as { q: string }).q
      return { id: '1', name: `Search result for: ${q}` }
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/users/search?q=test', {
      method: 'GET',
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ id: '1', name: 'Search result for: test' })
  })

  it('should handle .custom() with POST method', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.custom(
      'POST',
      '/bulk',
      {
        body: t.Object({
          items: t.Array(t.String()),
        }),
      },
      async ({ body }) => {
        const items = (body as { items: string[] }).items
        return { id: 'bulk', name: `Created ${items.length} items` }
      },
    )

    app.register(usersRouter)

    const req = new Request('http://localhost/users/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: ['item1', 'item2', 'item3'] }),
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(201) // POST defaults to 201
    const data = await res.json()
    expect(data).toEqual({ id: 'bulk', name: 'Created 3 items' })
  })

  it('should handle .custom() with PUT method', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.custom(
      'PUT',
      '/sync',
      {
        body: t.Object({
          data: t.String(),
        }),
      },
      async ({ body }) => {
        const data = (body as { data: string }).data
        return { id: 'sync', name: `Synced: ${data}` }
      },
    )

    app.register(usersRouter)

    const req = new Request('http://localhost/users/sync', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: 'test-data' }),
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ id: 'sync', name: 'Synced: test-data' })
  })

  it('should handle .custom() with path parameters', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.custom(
      'POST',
      '/:userId/activate',
      {},
      async ({ param }) => {
        const userId = (param as { userId: string }).userId
        return { id: userId, name: 'User activated' }
      },
    )

    app.register(usersRouter)

    const req = new Request('http://localhost/users/user123/activate', {
      method: 'POST',
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(201) // POST defaults to 201
    const data = await res.json()
    expect(data).toEqual({ id: 'user123', name: 'User activated' })
  })

  it('should handle .custom() with Response object return', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.custom('GET', '/csv', {}, async () => {
      return new Response('id,name\n1,Alice\n2,Bob', {
        status: 200,
        headers: {
          'content-type': 'text/csv',
          'content-disposition': 'attachment; filename="users.csv"',
        },
      })
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/users/csv', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/csv')
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="users.csv"',
    )
    const text = await res.text()
    expect(text).toBe('id,name\n1,Alice\n2,Bob')
  })

  it('should handle .custom() with custom status code via Response', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.custom('POST', '/webhook', {}, async () => {
      return new Response(null, { status: 202 }) // Accepted
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/users/webhook', {
      method: 'POST',
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(202)
  })

  it('should handle .custom() with validation on custom paths', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.custom(
      'POST',
      '/export',
      {
        body: t.Object({
          format: t.Union([t.Literal('json'), t.Literal('csv')]),
        }),
      },
      async ({ body }) => {
        const format = (body as { format: string }).format
        return { id: 'export', name: `Exporting as ${format}` }
      },
    )

    app.register(usersRouter)

    // Valid format
    const req1 = new Request('http://localhost/users/export', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ format: 'json' }),
    })
    const res1 = await app.fetch(req1)
    expect(res1.status).toBe(201) // POST defaults to 201

    // Invalid format
    const req2 = new Request('http://localhost/users/export', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ format: 'xml' }),
    })
    const res2 = await app.fetch(req2)
    expect(res2.status).toBe(400)
    const data2 = await res2.json()
    expect(data2.error).toBe('INVALID_INPUT')
  })

  it('should handle .custom() with hooks', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    let hookCalled = false

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.custom(
      'GET',
      '/special',
      {
        beforeHandler: [
          async ({ store }) => {
            hookCalled = true
            return store
          },
        ],
      },
      async () => {
        return { id: 'special', name: 'Special route' }
      },
    )

    app.register(usersRouter)

    const req = new Request('http://localhost/users/special', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    expect(hookCalled).toBe(true)
  })

  it('should handle .custom() with nested parameters', async () => {
    const app = new Norte()

    const storeSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const productSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const storesRouter = new Router('stores', { schema: storeSchema })
    const productsRouter = new Router(storesRouter, 'products', {
      schema: productSchema,
    })

    // Custom route: POST /stores/:storeId/products/import
    productsRouter.custom(
      'POST',
      '/import',
      {
        body: t.Object({
          count: t.Number(),
        }),
      },
      async ({ param, body }) => {
        const storeId = (param as { storeId: string }).storeId
        const count = (body as { count: number }).count
        return { id: 'import', name: `Imported ${count} products to store ${storeId}` }
      },
    )

    app.register(productsRouter)

    const req = new Request('http://localhost/stores/s1/products/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ count: 10 }),
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(201) // POST defaults to 201
    const data = await res.json()
    expect(data).toEqual({ id: 'import', name: 'Imported 10 products to store s1' })
  })

  it('should handle .custom() with multiple path segments', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.custom(
      'GET',
      '/stats/summary',
      {},
      async () => {
        return { id: 'stats', name: 'User statistics summary' }
      },
    )

    app.register(usersRouter)

    const req = new Request('http://localhost/users/stats/summary', {
      method: 'GET',
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ id: 'stats', name: 'User statistics summary' })
  })

  it('should handle .custom() with lowercase http method', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.custom('get', '/ping', {}, async () => {
      return { id: 'ping', name: 'pong' }
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/users/ping', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ id: 'ping', name: 'pong' })
  })
})

