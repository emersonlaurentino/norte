import { Type as t } from '@sinclair/typebox'
import { describe, expect, it } from 'vitest'
import { Norte } from '../norte'
import { Router } from '../router'

describe('Native Versioning', () => {
  it('should generate /v1/ path when version is 1', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', {
      schema: userSchema,
      version: 1,
    })
    usersRouter.list({}, async () => {
      return [{ id: '1', name: 'Alice' }]
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/v1/users', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([{ id: '1', name: 'Alice' }])
  })

  it('should default to version 1 when no version is specified', async () => {
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
    const data = await res.json()
    expect(data).toEqual([{ id: '1', name: 'Alice' }])
  })

  it('should generate /v2/ path when version is 2', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
      email: t.String(),
    })

    const usersRouter = new Router('users', {
      schema: userSchema,
      version: 2,
    })
    usersRouter.list({}, async () => {
      return [{ id: '1', name: 'Alice', email: 'alice@example.com' }]
    })

    app.register(usersRouter)

    const req = new Request('http://localhost/v2/users', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([
      { id: '1', name: 'Alice', email: 'alice@example.com' },
    ])
  })

  it('should support multiple versions of the same domain', async () => {
    const app = new Norte()
    const userSchemaV1 = t.Object({
      id: t.String(),
      name: t.String(),
    })
    const userSchemaV2 = t.Object({
      id: t.String(),
      name: t.String(),
      email: t.String(),
    })

    // Version 1
    const usersRouterV1 = new Router('users', {
      schema: userSchemaV1,
      version: 1,
    })
    usersRouterV1.list({}, async () => {
      return [{ id: '1', name: 'Alice' }]
    })

    // Version 2
    const usersRouterV2 = new Router('users', {
      schema: userSchemaV2,
      version: 2,
    })
    usersRouterV2.list({}, async () => {
      return [{ id: '1', name: 'Alice', email: 'alice@example.com' }]
    })

    app.register(usersRouterV1)
    app.register(usersRouterV2)

    // Test v1
    const reqV1 = new Request('http://localhost/v1/users', { method: 'GET' })
    const resV1 = await app.fetch(reqV1)
    expect(resV1.status).toBe(200)
    const dataV1 = await resV1.json()
    expect(dataV1).toEqual([{ id: '1', name: 'Alice' }])

    // Test v2
    const reqV2 = new Request('http://localhost/v2/users', { method: 'GET' })
    const resV2 = await app.fetch(reqV2)
    expect(resV2.status).toBe(200)
    const dataV2 = await resV2.json()
    expect(dataV2).toEqual([
      { id: '1', name: 'Alice', email: 'alice@example.com' },
    ])
  })

  it('should apply version to all CRUD operations', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', {
      schema: userSchema,
      version: 2,
    })

    usersRouter.list({}, async () => [{ id: '1', name: 'Alice' }])
    usersRouter.create(
      { body: t.Object({ name: t.String() }) },
      async ({ body }) => ({ id: '1', name: (body as { name: string }).name }),
    )
    usersRouter.read({}, async ({ param }) => ({
      id: (param as { userId: string }).userId,
      name: 'Alice',
    }))
    usersRouter.update(
      { body: t.Object({ name: t.String() }) },
      async ({ param, body }) => ({
        id: (param as { userId: string }).userId,
        name: (body as { name: string }).name,
      }),
    )
    usersRouter.delete({}, async ({ param }) => ({
      id: (param as { userId: string }).userId,
      name: 'Deleted',
    }))

    app.register(usersRouter)

    // Test list - GET /v2/users
    const listReq = new Request('http://localhost/v2/users', { method: 'GET' })
    const listRes = await app.fetch(listReq)
    expect(listRes.status).toBe(200)

    // Test create - POST /v2/users
    const createReq = new Request('http://localhost/v2/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Bob' }),
    })
    const createRes = await app.fetch(createReq)
    expect(createRes.status).toBe(201)

    // Test read - GET /v2/users/:userId
    const readReq = new Request('http://localhost/v2/users/123', {
      method: 'GET',
    })
    const readRes = await app.fetch(readReq)
    expect(readRes.status).toBe(200)

    // Test update - PATCH /v2/users/:userId
    const updateReq = new Request('http://localhost/v2/users/123', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    })
    const updateRes = await app.fetch(updateReq)
    expect(updateRes.status).toBe(200)

    // Test delete - DELETE /v2/users/:userId
    const deleteReq = new Request('http://localhost/v2/users/123', {
      method: 'DELETE',
    })
    const deleteRes = await app.fetch(deleteReq)
    expect(deleteRes.status).toBe(204)
  })

  it('should apply version to nested routers', async () => {
    const app = new Norte()
    const storeSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })
    const productSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const storesRouter = new Router('stores', {
      schema: storeSchema,
      version: 2,
    })
    storesRouter.list({}, async () => [{ id: '1', name: 'Store 1' }])

    const productsRouter = new Router(storesRouter, 'products', {
      schema: productSchema,
    })
    productsRouter.list({}, async () => [{ id: '1', name: 'Product 1' }])

    app.register(storesRouter)
    app.register(productsRouter)

    // Parent should be at /v2/stores
    const storesReq = new Request('http://localhost/v2/stores', {
      method: 'GET',
    })
    const storesRes = await app.fetch(storesReq)
    expect(storesRes.status).toBe(200)

    // Child should be at /v2/stores/:storeId/products
    const productsReq = new Request('http://localhost/v2/stores/123/products', {
      method: 'GET',
    })
    const productsRes = await app.fetch(productsReq)
    expect(productsRes.status).toBe(200)
  })

  it('should work with custom routes and versioning', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', {
      schema: userSchema,
      version: 2,
    })

    usersRouter.create({}, async () => {
      return { id: '1', name: 'Created User' }
    })

    app.register(usersRouter)

    // Add a raw route that works with versioned path
    app.raw('POST', '/v2/users/search', async () => {
      return new Response(
        JSON.stringify({ id: '1', name: 'Found User' }),
        { headers: { 'content-type': 'application/json' } },
      )
    })

    const req = new Request('http://localhost/v2/users/search', {
      method: 'POST',
    })
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ id: '1', name: 'Found User' })
  })

  it('should return 404 when accessing wrong version', async () => {
    const app = new Norte()
    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', {
      schema: userSchema,
      version: 2,
    })
    usersRouter.list({}, async () => [{ id: '1', name: 'Alice' }])

    app.register(usersRouter)

    // Try to access v1 when only v2 exists
    const req = new Request('http://localhost/v1/users', { method: 'GET' })
    const res = await app.fetch(req)

    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data).toEqual({
      error: 'NOT_FOUND',
      message: 'Route not found',
    })
  })
})
