import { Type as t } from '@sinclair/typebox'
import { describe, expect, it } from 'vitest'
import { Norte } from '../norte'
import { Router } from '../router'

describe('Pagination', () => {
  it('should provide pagination context in list handler', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.list(
      {
        query: t.Object({
          page: t.Number({ default: 1 }),
          limit: t.Number({ default: 10 }),
        }),
      },
      async ({ query, pagination }) => {
        expect(pagination).toBeDefined()
        expect(pagination.page).toBe((query as { page: number }).page)
        expect(pagination.limit).toBe((query as { limit: number }).limit)
        expect(pagination.offset).toBe(
          ((query as { page: number }).page - 1) *
            (query as { limit: number }).limit,
        )

        return [
          { id: '1', name: 'User 1' },
          { id: '2', name: 'User 2' },
        ]
      },
    )

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users?page=1&limit=10', {
      method: 'GET',
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(2)
  })

  it('should calculate correct offset for pagination', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.list(
      {
        query: t.Object({
          page: t.Number(),
          limit: t.Number(),
        }),
      },
      async ({ pagination }) => {
        // Page 2 with limit 10 should have offset 10
        expect(pagination.offset).toBe(10)
        return [{ id: '11', name: 'User 11' }]
      },
    )

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users?page=2&limit=10', {
      method: 'GET',
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
  })

  it('should use default pagination values when not provided', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.list(
      {
        query: t.Object({
          page: t.Number({ default: 1 }),
          limit: t.Number({ default: 20 }),
        }),
      },
      async ({ pagination }) => {
        expect(pagination.page).toBe(1)
        expect(pagination.limit).toBe(20)
        expect(pagination.offset).toBe(0)
        return []
      },
    )

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
  })

  it('should handle different page sizes', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.list(
      {
        query: t.Object({
          page: t.Number(),
          limit: t.Number(),
        }),
      },
      async ({ pagination }) => {
        // Page 5 with limit 25 should have offset 100
        expect(pagination.page).toBe(5)
        expect(pagination.limit).toBe(25)
        expect(pagination.offset).toBe(100)

        // Simulate returning a page of results
        const results: Array<{ id: string; name: string }> = []
        for (let i = 0; i < pagination.limit; i++) {
          results.push({
            id: String(pagination.offset + i + 1),
            name: `User ${pagination.offset + i + 1}`,
          })
        }
        return results
      },
    )

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users?page=5&limit=25', {
      method: 'GET',
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(25)
    expect(data[0]).toEqual({ id: '101', name: 'User 101' })
    expect(data[24]).toEqual({ id: '125', name: 'User 125' })
  })

  it('should validate pagination parameters', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.list(
      {
        query: t.Object({
          page: t.Number({ minimum: 1 }),
          limit: t.Number({ minimum: 1, maximum: 100 }),
        }),
      },
      async () => [],
    )

    app.register(usersRouter)

    // Invalid: page less than 1
    const req1 = new Request('http://localhost/v1/users?page=0&limit=10', {
      method: 'GET',
    })
    const res1 = await app.fetch(req1)
    expect(res1.status).toBe(400)

    // Invalid: limit greater than 100
    const req2 = new Request('http://localhost/v1/users?page=1&limit=200', {
      method: 'GET',
    })
    const res2 = await app.fetch(req2)
    expect(res2.status).toBe(400)

    // Valid
    const req3 = new Request('http://localhost/v1/users?page=1&limit=50', {
      method: 'GET',
    })
    const res3 = await app.fetch(req3)
    expect(res3.status).toBe(200)
  })

  it('should work with custom pagination field names', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.list(
      {
        query: t.Object({
          pageNumber: t.Number({ default: 1 }),
          pageSize: t.Number({ default: 10 }),
        }),
      },
      async ({ query }) => {
        const pageNumber = (query as { pageNumber: number }).pageNumber
        const pageSize = (query as { pageSize: number }).pageSize
        const offset = (pageNumber - 1) * pageSize

        // Simulate paginated results
        const results: Array<{ id: string; name: string }> = []
        for (let i = 0; i < pageSize; i++) {
          results.push({
            id: String(offset + i + 1),
            name: `User ${offset + i + 1}`,
          })
        }
        return results
      },
    )

    app.register(usersRouter)

    const req = new Request(
      'http://localhost/v1/users?pageNumber=3&pageSize=5',
      {
        method: 'GET',
      },
    )
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(5)
    expect(data[0]).toEqual({ id: '11', name: 'User 11' })
    expect(data[4]).toEqual({ id: '15', name: 'User 15' })
  })

  it('should handle first page correctly', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.list(
      {
        query: t.Object({
          page: t.Number(),
          limit: t.Number(),
        }),
      },
      async ({ pagination }) => {
        expect(pagination.page).toBe(1)
        expect(pagination.offset).toBe(0)

        return [
          { id: '1', name: 'First User' },
          { id: '2', name: 'Second User' },
        ]
      },
    )

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users?page=1&limit=10', {
      method: 'GET',
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data[0].id).toBe('1')
  })

  it('should handle empty results for valid page', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.list(
      {
        query: t.Object({
          page: t.Number(),
          limit: t.Number(),
        }),
      },
      async ({ pagination }) => {
        // Page 100 might have no results
        expect(pagination.page).toBe(100)
        return []
      },
    )

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users?page=100&limit=10', {
      method: 'GET',
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([])
  })

  it('should coerce string query params to numbers', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.list(
      {
        query: t.Object({
          page: t.Number(),
          limit: t.Number(),
        }),
      },
      async ({ query, pagination }) => {
        // Even though query params come as strings, they should be coerced to numbers
        expect(typeof (query as { page: number }).page).toBe('number')
        expect(typeof (query as { limit: number }).limit).toBe('number')
        expect(pagination.page).toBe(3)
        expect(pagination.limit).toBe(15)
        return []
      },
    )

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users?page=3&limit=15', {
      method: 'GET',
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
  })

  it('should work with additional query filters alongside pagination', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', { schema: userSchema })
    usersRouter.list(
      {
        query: t.Object({
          page: t.Number({ default: 1 }),
          limit: t.Number({ default: 10 }),
          search: t.Optional(t.String()),
          status: t.Optional(t.String()),
        }),
      },
      async ({ query, pagination }) => {
        const search = (query as { search?: string }).search
        const status = (query as { status?: string }).status

        expect(pagination.page).toBe(2)
        expect(pagination.limit).toBe(20)
        expect(search).toBe('john')
        expect(status).toBe('active')

        return [
          { id: '21', name: 'John Doe' },
          { id: '42', name: 'Johnny Smith' },
        ]
      },
    )

    app.register(usersRouter)

    const req = new Request(
      'http://localhost/v1/users?page=2&limit=20&search=john&status=active',
      { method: 'GET' },
    )
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(2)
  })
})
