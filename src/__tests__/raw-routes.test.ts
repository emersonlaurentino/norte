import { Type as t } from '@sinclair/typebox'
import { describe, expect, it } from 'vitest'
import { Norte } from '../norte'
import { Router } from '../router'

describe('Raw Routes', () => {
  describe('Basic Routes', () => {
    it('should handle simple GET route', async () => {
      const app = new Norte()

      app.raw('GET', '/health', () => {
        return () => new Response('OK', { status: 200 })
      })

      const req = new Request('http://localhost/health', { method: 'GET' })
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toBe('OK')
    })

    it('should handle simple POST route with body in context', async () => {
      const app = new Norte()

      app.raw('POST', '/webhook', () => {
        return async ({ body }) => {
          return new Response(JSON.stringify({ received: body }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        }
      })

      const req = new Request('http://localhost/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
      })
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({ received: { test: 'data' } })
    })

    it('should handle Response with custom content-type (HTML)', async () => {
      const app = new Norte()

      app.raw('GET', '/docs', () => {
        return () => {
          return new Response('<html><body>Documentation</body></html>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          })
        }
      })

      const req = new Request('http://localhost/docs', { method: 'GET' })
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('text/html')
      const text = await res.text()
      expect(text).toBe('<html><body>Documentation</body></html>')
    })

    it('should handle Response with custom content-type (CSV)', async () => {
      const app = new Norte()

      app.raw('GET', '/export', () => {
        return () => {
          return new Response('id,name\n1,Alice\n2,Bob', {
            status: 200,
            headers: {
              'content-type': 'text/csv',
              'content-disposition': 'attachment; filename="users.csv"',
            },
          })
        }
      })

      const req = new Request('http://localhost/export', { method: 'GET' })
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('text/csv')
      expect(res.headers.get('content-disposition')).toBe(
        'attachment; filename="users.csv"',
      )
      const text = await res.text()
      expect(text).toBe('id,name\n1,Alice\n2,Bob')
    })

    it('should handle custom status code', async () => {
      const app = new Norte()

      app.raw('POST', '/accepted', () => {
        return () => new Response(null, { status: 202 })
      })

      const req = new Request('http://localhost/accepted', { method: 'POST' })
      const res = await app.fetch(req)

      expect(res.status).toBe(202)
    })
  })

  describe('Method Wildcards', () => {
    it('should handle wildcard method * with specific path', async () => {
      const app = new Norte()

      app.raw('*', '/api/echo', () => {
        return async ({ request }) => {
          return new Response(JSON.stringify({ method: request.method }), {
            headers: { 'content-type': 'application/json' },
          })
        }
      })

      // Test different methods
      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

      for (const method of methods) {
        const req = new Request('http://localhost/api/echo', { method })
        const res = await app.fetch(req)

        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data.method).toBe(method)
      }
    })

    it('should capture all HTTP methods with wildcard', async () => {
      const app = new Norte()

      let callCount = 0

      app.raw('*', '/counter', () => {
        return () => {
          callCount++
          return new Response(`Called ${callCount} times`)
        }
      })

      await app.fetch(
        new Request('http://localhost/counter', { method: 'GET' }),
      )
      await app.fetch(
        new Request('http://localhost/counter', { method: 'POST' }),
      )
      await app.fetch(
        new Request('http://localhost/counter', { method: 'PUT' }),
      )

      expect(callCount).toBe(3)
    })
  })

  describe('Multiple Methods Array', () => {
    it('should handle array of methods for same path', async () => {
      const app = new Norte()

      app.raw(['PUT', 'DELETE'], '/post', () => {
        return ({ request }) => {
          return new Response(`${request.method} /post`, { status: 200 })
        }
      })

      const putReq = new Request('http://localhost/post', { method: 'PUT' })
      const putRes = await app.fetch(putReq)
      expect(putRes.status).toBe(200)
      expect(await putRes.text()).toBe('PUT /post')

      const deleteReq = new Request('http://localhost/post', {
        method: 'DELETE',
      })
      const deleteRes = await app.fetch(deleteReq)
      expect(deleteRes.status).toBe(200)
      expect(await deleteRes.text()).toBe('DELETE /post')
    })

    it('should not match methods not in array', async () => {
      const app = new Norte()

      app.raw(['PUT', 'DELETE'], '/post', () => {
        return ({ request }) => {
          return new Response(`${request.method} /post`, { status: 200 })
        }
      })

      const getReq = new Request('http://localhost/post', { method: 'GET' })
      const getRes = await app.fetch(getReq)
      expect(getRes.status).toBe(404)

      const postReq = new Request('http://localhost/post', { method: 'POST' })
      const postRes = await app.fetch(postReq)
      expect(postRes.status).toBe(404)
    })

    it('should handle multiple methods with JSON response', async () => {
      const app = new Norte()

      app.raw(['GET', 'POST', 'PUT'], '/api/resource', () => {
        return async ({ request }) => {
          const data = { method: request.method, timestamp: Date.now() }
          return new Response(JSON.stringify(data), {
            headers: { 'content-type': 'application/json' },
          })
        }
      })

      const methods = ['GET', 'POST', 'PUT']
      for (const method of methods) {
        const req = new Request('http://localhost/api/resource', { method })
        const res = await app.fetch(req)
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data.method).toBe(method)
        expect(typeof data.timestamp).toBe('number')
      }
    })

    it('should handle array with single method', async () => {
      const app = new Norte()

      app.raw(['PATCH'], '/update', () => {
        return () => new Response('Updated', { status: 200 })
      })

      const patchReq = new Request('http://localhost/update', {
        method: 'PATCH',
      })
      const patchRes = await app.fetch(patchReq)
      expect(patchRes.status).toBe(200)
      expect(await patchRes.text()).toBe('Updated')

      const postReq = new Request('http://localhost/update', { method: 'POST' })
      const postRes = await app.fetch(postReq)
      expect(postRes.status).toBe(404)
    })

    it('should handle multiple arrays on same path (different methods)', async () => {
      const app = new Norte()

      app.raw(['GET', 'POST'], '/data', () => {
        return () => new Response('Read/Write operations')
      })

      app.raw(['PUT', 'DELETE'], '/data', () => {
        return () => new Response('Update/Delete operations')
      })

      const getReq = new Request('http://localhost/data', { method: 'GET' })
      const getRes = await app.fetch(getReq)
      expect(await getRes.text()).toBe('Read/Write operations')

      const putReq = new Request('http://localhost/data', { method: 'PUT' })
      const putRes = await app.fetch(putReq)
      expect(await putRes.text()).toBe('Update/Delete operations')
    })

    it('should handle array of methods with path parameters', async () => {
      const app = new Norte()

      app.raw(['PUT', 'PATCH'], '/users/:id', () => {
        return ({ request, param }) => {
          return new Response(
            JSON.stringify({
              action: 'update',
              method: request.method,
              id: param.id,
            }),
            { headers: { 'content-type': 'application/json' } },
          )
        }
      })

      const putReq = new Request('http://localhost/users/123', {
        method: 'PUT',
      })
      const putRes = await app.fetch(putReq)
      const putData = await putRes.json()
      expect(putData).toEqual({ action: 'update', method: 'PUT', id: '123' })

      const patchReq = new Request('http://localhost/users/456', {
        method: 'PATCH',
      })
      const patchRes = await app.fetch(patchReq)
      const patchData = await patchRes.json()
      expect(patchData).toEqual({
        action: 'update',
        method: 'PATCH',
        id: '456',
      })
    })

    it('should handle array of methods with async handler', async () => {
      const app = new Norte()

      app.raw(['POST', 'PUT'], '/async-resource', () => {
        return async ({ request }) => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          return new Response(
            JSON.stringify({ processed: true, method: request.method }),
            { headers: { 'content-type': 'application/json' } },
          )
        }
      })

      const postReq = new Request('http://localhost/async-resource', {
        method: 'POST',
      })
      const postRes = await app.fetch(postReq)
      const postData = await postRes.json()
      expect(postData).toEqual({ processed: true, method: 'POST' })

      const putReq = new Request('http://localhost/async-resource', {
        method: 'PUT',
      })
      const putRes = await app.fetch(putReq)
      const putData = await putRes.json()
      expect(putData).toEqual({ processed: true, method: 'PUT' })
    })

    it('should handle errors in array methods', async () => {
      const app = new Norte()

      app.raw(['GET', 'POST'], '/error-route', () => {
        return () => {
          throw new Error('Handler error')
        }
      })

      const getReq = new Request('http://localhost/error-route', {
        method: 'GET',
      })
      const getRes = await app.fetch(getReq)
      expect(getRes.status).toBe(500)

      const postReq = new Request('http://localhost/error-route', {
        method: 'POST',
      })
      const postRes = await app.fetch(postReq)
      expect(postRes.status).toBe(500)
    })
  })

  describe('Path Wildcards', () => {
    it('should handle catch-all wildcard for multi-level paths', async () => {
      const app = new Norte()

      app.raw('*', '/auth/*', () => {
        return ({ request }) => {
          const url = new URL(request.url)
          return new Response(JSON.stringify({ path: url.pathname }), {
            headers: { 'content-type': 'application/json' },
          })
        }
      })

      // Single level: /auth/signin
      const req1 = new Request('http://localhost/auth/signin', {
        method: 'POST',
      })
      const res1 = await app.fetch(req1)
      const data1 = await res1.json()
      expect(data1.path).toBe('/auth/signin')

      // Multi-level: /auth/api/signin
      const req2 = new Request('http://localhost/auth/api/signin', {
        method: 'POST',
      })
      const res2 = await app.fetch(req2)
      const data2 = await res2.json()
      expect(data2.path).toBe('/auth/api/signin')

      // Deep nesting: /auth/api/v1/signin
      const req3 = new Request('http://localhost/auth/api/v1/signin', {
        method: 'GET',
      })
      const res3 = await app.fetch(req3)
      const data3 = await res3.json()
      expect(data3.path).toBe('/auth/api/v1/signin')
    })

    it('should handle path wildcard with specific method', async () => {
      const app = new Norte()

      app.raw('GET', '/api/v1/:wildcard', () => {
        return ({ request }) => {
          const url = new URL(request.url)
          return new Response(JSON.stringify({ path: url.pathname }), {
            headers: { 'content-type': 'application/json' },
          })
        }
      })

      const req1 = new Request('http://localhost/api/v1/users', {
        method: 'GET',
      })
      const res1 = await app.fetch(req1)
      const data1 = await res1.json()
      expect(data1.path).toBe('/api/v1/users')

      const req2 = new Request('http://localhost/api/v1/posts', {
        method: 'GET',
      })
      const res2 = await app.fetch(req2)
      const data2 = await res2.json()
      expect(data2.path).toBe('/api/v1/posts')
    })

    it('should handle path wildcard with method wildcard', async () => {
      const app = new Norte()

      app.raw('*', '/api/auth/:action', () => {
        return ({ request }) => {
          const url = new URL(request.url)
          return new Response(
            JSON.stringify({
              method: request.method,
              path: url.pathname,
            }),
            { headers: { 'content-type': 'application/json' } },
          )
        }
      })

      // Test different combinations
      const tests = [
        { method: 'GET', path: '/api/auth/signin' },
        { method: 'POST', path: '/api/auth/signup' },
        { method: 'DELETE', path: '/api/auth/signout' },
      ]

      for (const test of tests) {
        const req = new Request(`http://localhost${test.path}`, {
          method: test.method,
        })
        const res = await app.fetch(req)
        const data = await res.json()

        expect(data.method).toBe(test.method)
        expect(data.path).toBe(test.path)
      }
    })

    it('should handle catch-all wildcard parameter', async () => {
      const app = new Norte()

      app.raw('GET', '/:catchAll', () => {
        return () => new Response('Caught by wildcard', { status: 200 })
      })

      const req1 = new Request('http://localhost/anything', { method: 'GET' })
      const res1 = await app.fetch(req1)
      expect(res1.status).toBe(200)

      // Note: Only catches single-level paths
      const req2 = new Request('http://localhost/single', {
        method: 'GET',
      })
      const res2 = await app.fetch(req2)
      expect(res2.status).toBe(200)
    })
  })

  describe('Integration with Libraries', () => {
    it('should simulate Better-Auth integration', async () => {
      const app = new Norte()

      // Simulate Better-Auth handler
      const authHandler = () => {
        return ({ request }: { request: Request }) => {
          const url = new URL(request.url)
          const path = url.pathname

          if (path === '/api/auth/signin' && request.method === 'POST') {
            return new Response(JSON.stringify({ token: 'abc123' }), {
              headers: { 'content-type': 'application/json' },
            })
          }

          if (path === '/api/auth/signout' && request.method === 'POST') {
            return new Response(null, { status: 204 })
          }

          return new Response('Not Found', { status: 404 })
        }
      }

      app.raw('*', '/api/auth/:action', authHandler)

      // Test signin
      const signinReq = new Request('http://localhost/api/auth/signin', {
        method: 'POST',
      })
      const signinRes = await app.fetch(signinReq)
      expect(signinRes.status).toBe(200)
      const signinData = await signinRes.json()
      expect(signinData.token).toBe('abc123')

      // Test signout
      const signoutReq = new Request('http://localhost/api/auth/signout', {
        method: 'POST',
      })
      const signoutRes = await app.fetch(signoutReq)
      expect(signoutRes.status).toBe(204)
    })

    it('should simulate Scalar documentation', async () => {
      const app = new Norte()

      app.raw('GET', '/docs', () => {
        return () => {
          return new Response(
            `<!DOCTYPE html>
<html>
  <head><title>API Documentation</title></head>
  <body><h1>Docs</h1></body>
</html>`,
            {
              status: 200,
              headers: { 'content-type': 'text/html' },
            },
          )
        }
      })

      const req = new Request('http://localhost/docs', { method: 'GET' })
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('text/html')
      const text = await res.text()
      expect(text).toContain('API Documentation')
    })

    it('should handle real-world routing with query params', async () => {
      const app = new Norte()

      app.raw('GET', '/search', () => {
        return ({ query }) => {
          return new Response(
            JSON.stringify({ term: query.q || '', results: [] }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          )
        }
      })

      const req = new Request('http://localhost/search?q=typescript', {
        method: 'GET',
      })
      const res = await app.fetch(req)
      const data = await res.json()

      expect(data.term).toBe('typescript')
      expect(Array.isArray(data.results)).toBe(true)
    })

    it('should support proxying to external APIs (simulation)', async () => {
      const app = new Norte()

      app.raw('*', '/api/proxy/:resource/:id', () => {
        return ({ param }) => {
          return new Response(
            JSON.stringify({
              proxied: true,
              resource: param.resource,
              id: param.id,
            }),
            { headers: { 'content-type': 'application/json' } },
          )
        }
      })

      const req = new Request('http://localhost/api/proxy/users/123', {
        method: 'GET',
      })
      const res = await app.fetch(req)
      const data = await res.json()

      expect(data.proxied).toBe(true)
      expect(data.resource).toBe('users')
      expect(data.id).toBe('123')
    })
  })

  describe('Matching Priority', () => {
    it('should prioritize raw() over routers', async () => {
      const app = new Norte()

      // Register a router
      const usersRouter = new Router('users', {
        schema: t.Object({
          id: t.String(),
          name: t.String(),
        }),
      })

      usersRouter.list({}, () => {
        return [{ id: '1', name: 'From Router' }]
      })

      app.register(usersRouter)

      // Override with raw route
      app.raw('GET', '/v1/users', () => {
        return () => {
          return new Response(JSON.stringify([{ id: '2', name: 'From Raw' }]), {
            headers: { 'content-type': 'application/json' },
          })
        }
      })

      const req = new Request('http://localhost/v1/users', { method: 'GET' })
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual([{ id: '2', name: 'From Raw' }])
    })

    it('should allow raw() to coexist with routers on different paths', async () => {
      const app = new Norte()

      // Raw route
      app.raw('GET', '/health', () => {
        return () => new Response('OK')
      })

      // Router
      const usersRouter = new Router('users', {
        schema: t.Object({
          id: t.String(),
          name: t.String(),
        }),
      })

      usersRouter.list({}, () => {
        return [{ id: '1', name: 'Alice' }]
      })

      app.register(usersRouter)

      // Test raw route
      const healthReq = new Request('http://localhost/health', {
        method: 'GET',
      })
      const healthRes = await app.fetch(healthReq)
      expect(healthRes.status).toBe(200)
      expect(await healthRes.text()).toBe('OK')

      // Test router
      const usersReq = new Request('http://localhost/v1/users', {
        method: 'GET',
      })
      const usersRes = await app.fetch(usersReq)
      expect(usersRes.status).toBe(200)
      const usersData = await usersRes.json()
      expect(usersData).toEqual([{ id: '1', name: 'Alice' }])
    })
  })

  describe('Error Handling', () => {
    it('should handle errors thrown by handler', async () => {
      const app = new Norte()

      app.raw('GET', '/fail', () => {
        return () => {
          throw new Error('Something went wrong')
        }
      })

      const req = new Request('http://localhost/fail', { method: 'GET' })
      const res = await app.fetch(req)

      expect(res.status).toBe(500)
    })

    it('should handle async errors', async () => {
      const app = new Norte()

      app.raw('GET', '/async-fail', () => {
        return async () => {
          await new Promise((resolve) => setTimeout(resolve, 5))
          throw new Error('Async error')
        }
      })

      const req = new Request('http://localhost/async-fail', { method: 'GET' })
      const res = await app.fetch(req)

      expect(res.status).toBe(500)
    })
  })

  describe('Rich Context', () => {
    it('should provide full context to handler', async () => {
      const app = new Norte()

      app.raw('POST', '/context-test', () => {
        return ({ log, body, param, query, request, env }) => {
          // All context properties should be available
          expect(log).toBeDefined()
          expect(body).toBeDefined()
          expect(param).toBeDefined()
          expect(query).toBeDefined()
          expect(request).toBeDefined()
          expect(env).toBeDefined()

          return new Response(JSON.stringify({ success: true }), {
            headers: { 'content-type': 'application/json' },
          })
        }
      })

      const req = new Request('http://localhost/context-test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
      })
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
    })

    it('should allow logger usage in handler', async () => {
      const app = new Norte()

      let logged = false

      app.raw('GET', '/with-log', () => {
        return ({ log }) => {
          log.info({ data: 'test' }, 'Test log message')
          logged = true
          return new Response('OK')
        }
      })

      const req = new Request('http://localhost/with-log', { method: 'GET' })
      await app.fetch(req)

      expect(logged).toBe(true)
    })

    it('should parse params correctly', async () => {
      const app = new Norte()

      app.raw('GET', '/users/:userId', () => {
        return ({ param }) => {
          return new Response(JSON.stringify({ userId: param.userId }), {
            headers: { 'content-type': 'application/json' },
          })
        }
      })

      const req = new Request('http://localhost/users/123', { method: 'GET' })
      const res = await app.fetch(req)
      const data = await res.json()

      expect(data.userId).toBe('123')
    })

    it('should handle errors in handler with context', async () => {
      const app = new Norte()

      app.raw('POST', '/invalid-handler', () => {
        return ({ body }) => {
          // Always throw to test error handling
          throw new Error(`Invalid data: ${JSON.stringify(body)}`)
        }
      })

      const req = new Request('http://localhost/invalid-handler', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ invalid: true }),
      })
      const res = await app.fetch(req)

      expect(res.status).toBe(500)
    })

    it('should provide env to handler', async () => {
      const app = new Norte()

      app.raw('GET', '/env-check', () => {
        return ({ env }) => {
          return new Response(JSON.stringify({ hasEnv: !!env }), {
            headers: { 'content-type': 'application/json' },
          })
        }
      })

      const req = new Request('http://localhost/env-check', { method: 'GET' })
      const res = await app.fetch(req)
      const data = await res.json()

      expect(data.hasEnv).toBe(true)
    })

    it('should parse multiple params', async () => {
      const app = new Norte()

      app.raw('GET', '/stores/:storeId/products/:productId', () => {
        return ({ param }) => {
          return new Response(
            JSON.stringify({
              storeId: param.storeId,
              productId: param.productId,
            }),
            { headers: { 'content-type': 'application/json' } },
          )
        }
      })

      const req = new Request('http://localhost/stores/store1/products/prod1', {
        method: 'GET',
      })
      const res = await app.fetch(req)
      const data = await res.json()

      expect(data.storeId).toBe('store1')
      expect(data.productId).toBe('prod1')
    })
  })

  describe('Lazy Initialization', () => {
    it('should initialize handler only once (lazy)', async () => {
      const app = new Norte()
      let initCount = 0

      app.raw('GET', '/lazy-test', (env) => {
        initCount++
        expect(env).toBeDefined()

        return () => {
          return new Response(JSON.stringify({ initCount }), {
            headers: { 'content-type': 'application/json' },
          })
        }
      })

      // Multiple requests
      await app.fetch(
        new Request('http://localhost/lazy-test', { method: 'GET' }),
      )
      await app.fetch(
        new Request('http://localhost/lazy-test', { method: 'GET' }),
      )
      await app.fetch(
        new Request('http://localhost/lazy-test', { method: 'GET' }),
      )

      // Factory should be called only once
      expect(initCount).toBe(1)
    })

    it('should support async factory initialization', async () => {
      const app = new Norte()

      app.raw('GET', '/async-init', async (env) => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        const config = { initialized: true, env: !!env }

        return () => {
          return new Response(JSON.stringify(config), {
            headers: { 'content-type': 'application/json' },
          })
        }
      })

      const req = new Request('http://localhost/async-init', { method: 'GET' })
      const res = await app.fetch(req)
      const data = await res.json()

      expect(data.initialized).toBe(true)
      expect(data.env).toBe(true)
    })

    it('should provide env to factory for initialization', async () => {
      const app = new Norte()

      app.raw('GET', '/env-factory', (env) => {
        const hasProcessEnv = typeof process !== 'undefined' && !!process.env

        return () => {
          return new Response(JSON.stringify({ env: !!env, hasProcessEnv }), {
            headers: { 'content-type': 'application/json' },
          })
        }
      })

      const req = new Request('http://localhost/env-factory', { method: 'GET' })
      const res = await app.fetch(req)
      const data = await res.json()

      expect(data.env).toBe(true)
    })
  })

  describe('Advanced Use Cases', () => {
    it('should handle streaming responses', async () => {
      const app = new Norte()

      app.raw('GET', '/stream', () => {
        return () => {
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('chunk1'))
              controller.enqueue(encoder.encode('chunk2'))
              controller.close()
            },
          })

          return new Response(stream, {
            headers: { 'content-type': 'text/plain' },
          })
        }
      })

      const req = new Request('http://localhost/stream', { method: 'GET' })
      const res = await app.fetch(req)
      const text = await res.text()

      expect(text).toBe('chunk1chunk2')
    })

    it('should handle binary responses', async () => {
      const app = new Norte()

      app.raw('GET', '/binary', () => {
        return () => {
          const buffer = new Uint8Array([1, 2, 3, 4, 5])
          return new Response(buffer, {
            headers: { 'content-type': 'application/octet-stream' },
          })
        }
      })

      const req = new Request('http://localhost/binary', { method: 'GET' })
      const res = await app.fetch(req)
      const arrayBuffer = await res.arrayBuffer()
      const uint8 = new Uint8Array(arrayBuffer)

      expect(uint8).toEqual(new Uint8Array([1, 2, 3, 4, 5]))
    })
  })
})
