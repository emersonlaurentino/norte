import { Type as t } from '@sinclair/typebox'
import { describe, expect, it } from 'vitest'
import { Norte } from '../norte'
import { Router } from '../router'

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

    expect(openapi.openapi).toBe('3.0.3')
    expect(openapi.info.title).toBe('Test API')
    expect(openapi.info.version).toBe('1.0.0')
    expect(openapi.info.description).toBe('Test API description')

    const paths = openapi.paths
    expect(paths).toBeDefined()

    expect(paths['/v1/users']).toBeDefined()
    expect(paths['/v1/users'].get).toBeDefined()
    const getOp = paths['/v1/users'].get as OpenAPIOperation
    expect(getOp.operationId).toBe('listUser')
    expect(getOp.tags).toEqual(['users'])
    expect(getOp['x-norte-domain']).toBe('users')
    expect(getOp['x-norte-version']).toBe(1)

    expect(paths['/v1/users'].post).toBeDefined()
    const postOp = paths['/v1/users'].post as OpenAPIOperation
    expect(postOp.operationId).toBe('createUser')
    expect(postOp.requestBody).toBeDefined()
    expect(postOp.requestBody?.required).toBe(true)

    expect(paths['/v1/users/{userId}']).toBeDefined()
    expect(paths['/v1/users/{userId}'].get).toBeDefined()
    const readOp = paths['/v1/users/{userId}'].get as OpenAPIOperation
    expect(readOp.operationId).toBe('readUser')
    expect(readOp.parameters).toBeDefined()

    expect(paths['/v1/users/{userId}'].patch).toBeDefined()
    const patchOp = paths['/v1/users/{userId}'].patch as OpenAPIOperation
    expect(patchOp.operationId).toBe('updateUser')

    expect(paths['/v1/users/{userId}'].delete).toBeDefined()
    const deleteOp = paths['/v1/users/{userId}'].delete as OpenAPIOperation
    expect(deleteOp.operationId).toBe('deleteUser')
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

    const postOp = paths['/v1/users'].post as OpenAPIOperation
    expect(postOp['x-norte-invalidates']).toBeDefined()
    expect(postOp['x-norte-invalidates']).toContain('GET /v1/users')

    const patchOp = paths['/v1/users/{userId}'].patch as OpenAPIOperation
    expect(patchOp['x-norte-invalidates']).toBeDefined()
    expect(patchOp['x-norte-invalidates']).toContain('PATCH /v1/users')

    const deleteOp = paths['/v1/users/{userId}'].delete as OpenAPIOperation
    expect(deleteOp['x-norte-invalidates']).toBeDefined()
    expect(deleteOp['x-norte-invalidates']).toContain('DELETE /v1/users')
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

    expect(paths['/v1/users']).toBeDefined()
    expect(paths['/v2/users']).toBeDefined()

    const v1Op = paths['/v1/users'].get as OpenAPIOperation
    const v2Op = paths['/v2/users'].get as OpenAPIOperation
    expect(v1Op['x-norte-version']).toBe(1)
    expect(v2Op['x-norte-version']).toBe(2)
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

    expect(paths['/v1/stores/{storeId}/products']).toBeDefined()
    expect(paths['/v1/stores/{storeId}/products'].get).toBeDefined()
    expect(paths['/v1/stores/{storeId}/products'].get?.operationId).toBe(
      'listProduct',
    )

    const params = paths['/v1/stores/{storeId}/products'].get?.parameters || []
    expect(params.some((p) => p.name === 'storeId')).toBe(false)
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

    const request = new Request('http://localhost/openapi.json')
    const response = await app.fetch(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(response.headers.get('cache-control')).toBe(
      'no-store, no-cache, must-revalidate',
    )

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

    const request1 = new Request('http://localhost/openapi.json')
    const response1 = await app.fetch(request1)
    const doc1 = await response1.json()

    const request2 = new Request('http://localhost/openapi.json')
    const response2 = await app.fetch(request2)
    const doc2 = await response2.json()

    expect(doc1).toEqual(doc2)
    expect(response1.headers.get('cache-control')).toBe(
      'no-store, no-cache, must-revalidate',
    )
    expect(response2.headers.get('cache-control')).toBe(
      'no-store, no-cache, must-revalidate',
    )
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

    const createOp = paths['/v1/users'].post as OpenAPIOperation
    expect(createOp.requestBody).toBeDefined()
    if (createOp.requestBody) {
      expect(createOp.requestBody.required).toBe(true)
      expect(createOp.requestBody.content['application/json']).toBeDefined()
      expect(
        createOp.requestBody.content['application/json'].schema,
      ).toBeDefined()
    }
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

    const listOp = paths['/v1/users'].get as OpenAPIOperation
    expect(listOp.responses['200']).toBeDefined()
    const listResponse = listOp.responses['200']
    const listSchema = listResponse.content?.['application/json']
      .schema as Record<string, unknown>
    expect(listSchema.type).toBe('array')
    const listItems = listSchema.items as Record<string, unknown>
    expect(listItems.type).toBe('object')
    const listProperties = listItems.properties as Record<string, unknown>
    expect(listProperties.id).toBeDefined()
    expect(listProperties.name).toBeDefined()
    expect(listProperties.email).toBeDefined()

    const readOp = paths['/v1/users/{userId}'].get as OpenAPIOperation
    expect(readOp.responses['200']).toBeDefined()
    const readResponse = readOp.responses['200']
    const readSchema = readResponse.content?.['application/json']
      .schema as Record<string, unknown>
    expect(readSchema.type).toBe('object')
    const readProperties = readSchema.properties as Record<string, unknown>
    expect(readProperties.id).toBeDefined()
    expect(readProperties.name).toBeDefined()
    expect(readProperties.email).toBeDefined()
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

    const deleteOp = paths['/v1/users/{userId}'].delete as OpenAPIOperation
    expect(deleteOp.responses['204']).toBeDefined()
    const deleteResponse = deleteOp.responses['204']
    expect(deleteResponse.description).toBe('No content')
    expect(deleteResponse.content).toBeUndefined()
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
    expect(openapi.servers?.[0].url).toBe('http://localhost')
  })
})
