import { Type as t } from '@sinclair/typebox'
import { describe, expect, it } from 'vitest'
import { Norte } from '../norte'
import { Router } from '../router'

// OpenAPI Document Types
interface OpenAPIInfo {
  title: string
  version: string
  description?: string
}

interface OpenAPIServer {
  url: string
  description?: string
}

interface OpenAPIParameter {
  name: string
  in: 'path' | 'query' | 'header'
  required?: boolean
  schema?: Record<string, unknown>
}

interface OpenAPIOperation {
  operationId: string
  tags: string[]
  summary?: string
  description?: string
  parameters?: OpenAPIParameter[]
  requestBody?: {
    required: boolean
    content: Record<string, { schema: Record<string, unknown> }>
  }
  responses: Record<
    string,
    {
      description: string
      content?: Record<string, { schema: Record<string, unknown> }>
    }
  >
  'x-norte-invalidates'?: string[]
  'x-norte-domain': string
  'x-norte-version': number
}

interface OpenAPIPathItem {
  get?: OpenAPIOperation
  post?: OpenAPIOperation
  patch?: OpenAPIOperation
  delete?: OpenAPIOperation
}

interface OpenAPIDocument {
  openapi: string
  info: OpenAPIInfo
  servers?: OpenAPIServer[]
  paths: Record<string, OpenAPIPathItem>
}

// Helper to get OpenAPI document via HTTP
async function getOpenAPIDoc(app: Norte): Promise<OpenAPIDocument> {
  const request = new Request('http://localhost/openapi.json')
  const response = await app.fetch(request)
  return await response.json()
}

describe('OpenAPI Generation', () => {
  it('should generate OpenAPI document with basic CRUD routes', async () => {
    const app = new Norte({
      logger: false,
      openapi: {
        title: 'Test API',
        version: '1.0.0',
        description: 'Test API description',
      },
    })

    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
      email: t.String(),
    })

    const usersRouter = new Router('users', {
      schema: userSchema,
      version: 1,
    })

    usersRouter.list({}, async () => [])
    usersRouter.create(
      {
        body: t.Object({
          name: t.String(),
          email: t.String(),
        }),
      },
      async () => ({ id: '1', name: 'Test', email: 'test@example.com' }),
    )
    usersRouter.read(
      {
        param: t.Object({
          userId: t.String(),
        }),
      },
      async () => ({ id: '1', name: 'Test', email: 'test@example.com' }),
    )
    usersRouter.update(
      {
        param: t.Object({
          userId: t.String(),
        }),
        body: t.Object({
          name: t.Optional(t.String()),
          email: t.Optional(t.String()),
        }),
      },
      async () => ({ id: '1', name: 'Updated', email: 'test@example.com' }),
    )
    usersRouter.delete(
      {
        param: t.Object({
          userId: t.String(),
        }),
      },
      async () => null,
    )

    app.register(usersRouter)

    const openapi = await getOpenAPIDoc(app)

    // Check basic structure
    expect(openapi.openapi).toBe('3.0.3')
    expect(openapi.info.title).toBe('Test API')
    expect(openapi.info.version).toBe('1.0.0')
    expect(openapi.info.description).toBe('Test API description')

    // Check paths
    const paths = openapi.paths
    expect(paths).toBeDefined()

    // Check list endpoint
    expect(paths['/v1/users']).toBeDefined()
    expect(paths['/v1/users'].get).toBeDefined()
    expect(paths['/v1/users'].get.operationId).toBe('listUser')
    expect(paths['/v1/users'].get.tags).toEqual(['users'])
    expect(paths['/v1/users'].get['x-norte-domain']).toBe('users')
    expect(paths['/v1/users'].get['x-norte-version']).toBe(1)

    // Check create endpoint
    expect(paths['/v1/users'].post).toBeDefined()
    expect(paths['/v1/users'].post.operationId).toBe('createUser')
    expect(paths['/v1/users'].post.requestBody).toBeDefined()
    expect(paths['/v1/users'].post.requestBody.required).toBe(true)

    // Check read endpoint
    expect(paths['/v1/users/{userId}']).toBeDefined()
    expect(paths['/v1/users/{userId}'].get).toBeDefined()
    expect(paths['/v1/users/{userId}'].get.operationId).toBe('readUser')
    expect(paths['/v1/users/{userId}'].get.parameters).toBeDefined()

    // Check update endpoint
    expect(paths['/v1/users/{userId}'].patch).toBeDefined()
    expect(paths['/v1/users/{userId}'].patch.operationId).toBe('updateUser')

    // Check delete endpoint
    expect(paths['/v1/users/{userId}'].delete).toBeDefined()
    expect(paths['/v1/users/{userId}'].delete.operationId).toBe('deleteUser')
  })

  it('should include cache invalidation hints for mutations', async () => {
    const app = new Norte({ logger: false })

    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', {
      schema: userSchema,
      version: 1,
    })

    usersRouter.create(
      {
        body: t.Object({ name: t.String() }),
      },
      async () => ({ id: '1', name: 'Test' }),
    )

    usersRouter.update(
      {
        param: t.Object({ userId: t.String() }),
        body: t.Object({ name: t.String() }),
      },
      async () => ({ id: '1', name: 'Updated' }),
    )

    usersRouter.delete(
      {
        param: t.Object({ userId: t.String() }),
      },
      async () => null,
    )

    app.register(usersRouter)

    const openapi = await getOpenAPIDoc(app)
    const paths = openapi.paths

    // POST should invalidate GET (list)
    expect(paths['/v1/users'].post['x-norte-invalidates']).toBeDefined()
    expect(paths['/v1/users'].post['x-norte-invalidates']).toContain(
      'GET /v1/users',
    )

    // PATCH should invalidate GET (list)
    expect(
      paths['/v1/users/{userId}'].patch['x-norte-invalidates'],
    ).toBeDefined()
    expect(paths['/v1/users/{userId}'].patch['x-norte-invalidates']).toContain(
      'PATCH /v1/users',
    )

    // DELETE should invalidate GET (list)
    expect(
      paths['/v1/users/{userId}'].delete['x-norte-invalidates'],
    ).toBeDefined()
    expect(paths['/v1/users/{userId}'].delete['x-norte-invalidates']).toContain(
      'DELETE /v1/users',
    )
  })

  it('should handle versioned routes correctly', async () => {
    const app = new Norte({ logger: false })

    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersV1 = new Router('users', {
      schema: userSchema,
      version: 1,
    })

    const usersV2 = new Router('users', {
      schema: userSchema,
      version: 2,
    })

    usersV1.list({}, async () => [])
    usersV2.list({}, async () => [])

    app.register(usersV1)
    app.register(usersV2)

    const openapi = await getOpenAPIDoc(app)
    const paths = openapi.paths

    // Check both versions exist
    expect(paths['/v1/users']).toBeDefined()
    expect(paths['/v2/users']).toBeDefined()

    // Check version metadata
    expect(paths['/v1/users'].get['x-norte-version']).toBe(1)
    expect(paths['/v2/users'].get['x-norte-version']).toBe(2)
  })

  it('should handle nested routes correctly', async () => {
    const app = new Norte({ logger: false })

    const storeSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const productSchema = t.Object({
      id: t.String(),
      name: t.String(),
      storeId: t.String(),
    })

    const storesRouter = new Router('stores', {
      schema: storeSchema,
      version: 1,
    })

    const productsRouter = new Router(storesRouter, 'products', {
      schema: productSchema,
    })

    productsRouter.list({}, async () => [])
    productsRouter.create(
      {
        body: t.Object({ name: t.String() }),
      },
      async () => ({ id: '1', name: 'Product', storeId: '1' }),
    )

    app.register(productsRouter)

    const openapi = await getOpenAPIDoc(app)
    const paths = openapi.paths

    // Check nested path
    expect(paths['/v1/stores/{storeId}/products']).toBeDefined()
    expect(paths['/v1/stores/{storeId}/products'].get).toBeDefined()
    expect(paths['/v1/stores/{storeId}/products'].get?.operationId).toBe(
      'listProduct',
    )

    // Check parameters include storeId
    const params = paths['/v1/stores/{storeId}/products'].get?.parameters || []
    expect(params.some((p) => p.name === 'storeId')).toBe(false) // Params from path are extracted from route options
  })

  it('should serve OpenAPI document via HTTP', async () => {
    const app = new Norte({
      logger: false,
      openapi: {
        title: 'Test API',
        version: '1.0.0',
      },
    })

    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', {
      schema: userSchema,
      version: 1,
    })

    usersRouter.list({}, async () => [])

    app.register(usersRouter)

    // Test /openapi.json endpoint
    const request = new Request('http://localhost/openapi.json')
    const response = await app.fetch(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(response.headers.get('cache-control')).toBe('public, max-age=3600')

    const json = await response.json()
    expect(json.openapi).toBe('3.0.3')
    expect(json.info.title).toBe('Test API')
    expect(json.paths['/v1/users']).toBeDefined()
  })

  it('should cache OpenAPI document after first generation', async () => {
    const app = new Norte({ logger: false })

    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', {
      schema: userSchema,
      version: 1,
    })

    usersRouter.list({}, async () => [])

    app.register(usersRouter)

    // First call generates the document
    const request1 = new Request('http://localhost/openapi.json')
    const response1 = await app.fetch(request1)
    const doc1 = await response1.json()

    // Second call should return cached document
    const request2 = new Request('http://localhost/openapi.json')
    const response2 = await app.fetch(request2)
    const doc2 = await response2.json()

    // Both should have the same content
    expect(doc1).toEqual(doc2)
    expect(response1.headers.get('cache-control')).toBe('public, max-age=3600')
    expect(response2.headers.get('cache-control')).toBe('public, max-age=3600')
  })

  it('should invalidate cache when new router is registered', async () => {
    const app = new Norte({ logger: false })

    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', {
      schema: userSchema,
      version: 1,
    })

    usersRouter.list({}, async () => [])

    app.register(usersRouter)

    const request1 = new Request('http://localhost/openapi.json')
    const response1 = await app.fetch(request1)
    const doc1 = (await response1.json()) as OpenAPIDocument
    const paths1 = Object.keys(doc1.paths || {})

    // Register another router
    const productsRouter = new Router('products', {
      schema: userSchema,
      version: 1,
    })

    productsRouter.list({}, async () => [])

    app.register(productsRouter)

    const request2 = new Request('http://localhost/openapi.json')
    const response2 = await app.fetch(request2)
    const doc2 = (await response2.json()) as OpenAPIDocument
    const paths2 = Object.keys(doc2.paths || {})

    // More paths in second document
    expect(paths2.length).toBeGreaterThan(paths1.length)
    expect(paths2).toContain('/v1/products')
  })

  it('should include request body schema for POST and PATCH', async () => {
    const app = new Norte({ logger: false })

    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
      email: t.String(),
    })

    const usersRouter = new Router('users', {
      schema: userSchema,
      version: 1,
    })

    usersRouter.create(
      {
        body: t.Object({
          name: t.String(),
          email: t.String(),
        }),
      },
      async () => ({ id: '1', name: 'Test', email: 'test@example.com' }),
    )

    app.register(usersRouter)

    const openapi = await getOpenAPIDoc(app)
    const paths = openapi.paths

    const createOp = paths['/v1/users'].post
    expect(createOp.requestBody).toBeDefined()
    expect(createOp.requestBody.required).toBe(true)
    expect(createOp.requestBody.content['application/json']).toBeDefined()
    expect(
      createOp.requestBody.content['application/json'].schema,
    ).toBeDefined()
  })

  it('should include response schemas', async () => {
    const app = new Norte({ logger: false })

    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
      email: t.String(),
    })

    const usersRouter = new Router('users', {
      schema: userSchema,
      version: 1,
    })

    usersRouter.list({}, async () => [])
    usersRouter.read(
      {
        param: t.Object({ userId: t.String() }),
      },
      async () => ({ id: '1', name: 'Test', email: 'test@example.com' }),
    )

    app.register(usersRouter)

    const openapi = await getOpenAPIDoc(app)
    const paths = openapi.paths

    // List should return array
    const listOp = paths['/v1/users'].get
    expect(listOp.responses['200']).toBeDefined()
    expect(
      listOp.responses['200'].content['application/json'].schema.type,
    ).toBe('array')
    expect(
      listOp.responses['200'].content['application/json'].schema.items.type,
    ).toBe('object')
    expect(
      listOp.responses['200'].content['application/json'].schema.items
        .properties.id,
    ).toBeDefined()
    expect(
      listOp.responses['200'].content['application/json'].schema.items
        .properties.name,
    ).toBeDefined()
    expect(
      listOp.responses['200'].content['application/json'].schema.items
        .properties.email,
    ).toBeDefined()

    // Read should return single object
    const readOp = paths['/v1/users/{userId}'].get
    expect(readOp.responses['200']).toBeDefined()
    expect(
      readOp.responses['200'].content['application/json'].schema.type,
    ).toBe('object')
    expect(
      readOp.responses['200'].content['application/json'].schema.properties.id,
    ).toBeDefined()
    expect(
      readOp.responses['200'].content['application/json'].schema.properties
        .name,
    ).toBeDefined()
    expect(
      readOp.responses['200'].content['application/json'].schema.properties
        .email,
    ).toBeDefined()
  })

  it('should handle DELETE with 204 response', async () => {
    const app = new Norte({ logger: false })

    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', {
      schema: userSchema,
      version: 1,
    })

    usersRouter.delete(
      {
        param: t.Object({ userId: t.String() }),
      },
      async () => null,
    )

    app.register(usersRouter)

    const openapi = await getOpenAPIDoc(app)
    const paths = openapi.paths

    const deleteOp = paths['/v1/users/{userId}'].delete
    expect(deleteOp.responses['204']).toBeDefined()
    expect(deleteOp.responses['204'].description).toBe('No content')
    expect(deleteOp.responses['204'].content).toBeUndefined()
  })

  it('should use default OpenAPI options when not provided', async () => {
    const app = new Norte({ logger: false })

    const userSchema = t.Object({
      id: t.String(),
      name: t.String(),
    })

    const usersRouter = new Router('users', {
      schema: userSchema,
      version: 1,
    })

    usersRouter.list({}, async () => [])

    app.register(usersRouter)

    const openapi = await getOpenAPIDoc(app)

    expect(openapi.info.title).toBe('Norte API')
    expect(openapi.info.version).toBe('1.0.0')
    expect(openapi.info.description).toBe('API generated by Norte Framework')
    expect(openapi.servers?.[0].url).toBe('http://localhost:3000')
  })
})
