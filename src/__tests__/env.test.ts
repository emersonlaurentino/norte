import { Type } from '@sinclair/typebox'
import { beforeEach, describe, expect, test } from 'vitest'
import { Norte } from '../norte'
import { Router } from '../router'
import type { NorteStore } from '../types'

// Extend the Bindings interface to add custom environment variables
declare module '../types' {
  interface Bindings {
    DATABASE_URL?: string
    API_KEY?: string
    KV?: {
      get: (key: string) => Promise<string | null>
      put: (key: string, value: string) => Promise<void>
    }
  }
}

describe('Environment Bindings (env)', () => {
  let app: Norte
  let router: Router

  beforeEach(() => {
    // Initialize app without env - it will be loaded automatically
    app = new Norte({
      logger: false,
    })

    router = new Router('posts', {
      schema: Type.Object({
        id: Type.String(),
        title: Type.String(),
      }),
    })
  })

  test('should access env in handler (from process.env)', async () => {
    // Set process.env for testing
    process.env.DATABASE_URL = 'postgres://localhost:5432/testdb'
    process.env.API_KEY = 'secret-api-key-123'

    router.create(
      {
        body: Type.Object({
          title: Type.String(),
        }),
      },
      async (ctx) => {
        // Access env variables
        const dbUrl = ctx.env.DATABASE_URL
        const apiKey = ctx.env.API_KEY

        return {
          id: '1',
          title: (ctx.body as { title: string }).title,
          dbUrl,
          apiKey,
        }
      },
    )

    app.register(router)

    const req = new Request('http://localhost/v1/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Post' }),
    })

    const res = await app.fetch(req)
    const data = await res.json()

    expect(data).toMatchObject({
      id: '1',
      title: 'Test Post',
      dbUrl: 'postgres://localhost:5432/testdb',
      apiKey: 'secret-api-key-123',
    })

    // Clean up
    delete process.env.DATABASE_URL
    delete process.env.API_KEY
  })

  test('should access env in beforeHandler hook', async () => {
    process.env.DATABASE_URL = 'postgres://localhost:5432/testdb'

    const logs: string[] = []

    router.create(
      {
        body: Type.Object({
          title: Type.String(),
        }),
        beforeHandler: [
          async (ctx) => {
            // Access env in before hook
            const dbUrl = ctx.env.DATABASE_URL
            logs.push(`Before hook: ${dbUrl}`)
            return ctx.store
          },
        ],
      },
      async (ctx) => {
        return {
          id: '1',
          title: (ctx.body as { title: string }).title,
        }
      },
    )

    app.register(router)

    const req = new Request('http://localhost/v1/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Post' }),
    })

    await app.fetch(req)

    expect(logs).toContain('Before hook: postgres://localhost:5432/testdb')

    delete process.env.DATABASE_URL
  })

  test('should access env in afterHandler hook', async () => {
    process.env.API_KEY = 'secret-api-key-123'

    const logs: string[] = []

    router.create(
      {
        body: Type.Object({
          title: Type.String(),
        }),
        afterHandler: [
          async (ctx) => {
            // Access env in after hook
            const apiKey = ctx.env.API_KEY
            logs.push(`After hook: ${apiKey}`)
          },
        ],
      },
      async (ctx) => {
        return {
          id: '1',
          title: (ctx.body as { title: string }).title,
        }
      },
    )

    app.register(router)

    const req = new Request('http://localhost/v1/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Post' }),
    })

    await app.fetch(req)

    expect(logs).toContain('After hook: secret-api-key-123')

    delete process.env.API_KEY
  })

  test('should access KV binding in handler (Cloudflare Workers)', async () => {
    router.read(
      {
        param: Type.Object({
          postId: Type.String(),
        }),
      },
      async (ctx) => {
        // Access KV binding
        const value = await ctx.env.KV?.get('test-key')

        return {
          id: (ctx.param as { postId: string }).postId,
          title: 'Post from KV',
          cachedValue: value,
        }
      },
    )

    app.register(router)

    const req = new Request('http://localhost/v1/posts/123', {
      method: 'GET',
    })

    // Simulate Cloudflare Workers env
    const cloudflareEnv = {
      KV: {
        get: async (key: string) => {
          if (key === 'test-key') return 'test-value'
          return null
        },
        put: async (_key: string, _value: string) => {
          // Mock implementation
        },
      },
    }

    const res = await app.fetch(req, cloudflareEnv)
    const data = await res.json()

    expect(data).toMatchObject({
      id: '123',
      title: 'Post from KV',
      cachedValue: 'test-value',
    })
  })

  test('should work with raw routes', async () => {
    process.env.DATABASE_URL = 'postgres://localhost:5432/testdb'

    app.raw('GET', '/health', async (ctx) => {
      // Access env in raw route
      const dbUrl = ctx.env.DATABASE_URL

      return new Response(
        JSON.stringify({
          status: 'healthy',
          database: dbUrl,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    })

    const req = new Request('http://localhost/health', {
      method: 'GET',
    })

    const res = await app.fetch(req)
    const data = await res.json()

    expect(data).toMatchObject({
      status: 'healthy',
      database: 'postgres://localhost:5432/testdb',
    })

    delete process.env.DATABASE_URL
  })

  test('should work with empty env', async () => {
    const appNoEnv = new Norte({
      logger: false,
    })

    const routerNoEnv = new Router('posts', {
      schema: Type.Object({
        id: Type.String(),
        title: Type.String(),
      }),
    })

    routerNoEnv.read(
      {
        param: Type.Object({
          postId: Type.String(),
        }),
      },
      async (ctx) => {
        // env should exist but be empty
        const hasEnv = ctx.env !== undefined

        return {
          id: (ctx.param as { postId: string }).postId,
          title: 'Test Post',
          hasEnv,
        }
      },
    )

    appNoEnv.register(routerNoEnv)

    const req = new Request('http://localhost/v1/posts/123', {
      method: 'GET',
    })

    const res = await appNoEnv.fetch(req)
    const data = await res.json()

    expect(data).toMatchObject({
      id: '123',
      title: 'Test Post',
      hasEnv: true,
    })
  })
})

