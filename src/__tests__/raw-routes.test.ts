import { Type as t } from '@sinclair/typebox'
import { describe, expect, it } from 'vitest'
import { Norte } from '../norte'
import { Router } from '../router'

describe('Raw Routes', () => {
  describe('Basic Routes', () => {
    it('should handle simple GET route', async () => {
      const app = new Norte()

      app.raw('GET', '/health', () => {
        return new Response('OK', { status: 200 })
      })

      const req = new Request('http://localhost/health', { method: 'GET' })
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toBe('OK')
    })

    it('should handle simple POST route', async () => {
      const app = new Norte()

      app.raw('POST', '/webhook', async (req) => {
        const body = await req.json()
        return new Response(JSON.stringify({ received: body }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
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
        return new Response('<html><body>Documentation</body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        })
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
        return new Response('id,name\n1,Alice\n2,Bob', {
          status: 200,
          headers: {
            'content-type': 'text/csv',
            'content-disposition': 'attachment; filename="users.csv"',
          },
        })
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
        return new Response(null, { status: 202 })
      })

      const req = new Request('http://localhost/accepted', { method: 'POST' })
      const res = await app.fetch(req)

      expect(res.status).toBe(202)
    })
  })

  describe('Method Wildcards', () => {
    it('should handle wildcard method * with specific path', async () => {
      const app = new Norte()

      app.raw('*', '/api/echo', async (req) => {
        return new Response(JSON.stringify({ method: req.method }), {
          headers: { 'content-type': 'application/json' },
        })
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
        callCount++
        return new Response(`Called ${callCount} times`)
      })

      await app.fetch(new Request('http://localhost/counter', { method: 'GET' }))
      await app.fetch(
        new Request('http://localhost/counter', { method: 'POST' }),
      )
      await app.fetch(new Request('http://localhost/counter', { method: 'PUT' }))

      expect(callCount).toBe(3)
    })
  })

  describe('Path Wildcards', () => {
    it('should handle path wildcard with specific method', async () => {
      const app = new Norte()

      app.raw('GET', '/api/v1/:wildcard', (req) => {
        const url = new URL(req.url)
        return new Response(
          JSON.stringify({ path: url.pathname }),
          { headers: { 'content-type': 'application/json' } },
        )
      })

      const req1 = new Request('http://localhost/api/v1/users', { method: 'GET' })
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

      app.raw('*', '/api/auth/:action', (req) => {
        const url = new URL(req.url)
        return new Response(
          JSON.stringify({
            method: req.method,
            path: url.pathname,
          }),
          { headers: { 'content-type': 'application/json' } },
        )
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
        return new Response('Caught by wildcard', { status: 200 })
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
      const authHandler = (req: Request) => {
        const url = new URL(req.url)
        const path = url.pathname

        if (path === '/api/auth/signin' && req.method === 'POST') {
          return new Response(JSON.stringify({ token: 'abc123' }), {
            headers: { 'content-type': 'application/json' },
          })
        }

        if (path === '/api/auth/signout' && req.method === 'POST') {
          return new Response(null, { status: 204 })
        }

        return new Response('Not Found', { status: 404 })
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
        return new Response(
          `<!DOCTYPE html>
<html>
  <head><title>API Documentation</title></head>
  <body>
    <script id="api-reference" data-url="/openapi.json"></script>
  </body>
</html>`,
          {
            status: 200,
            headers: { 'content-type': 'text/html' },
          },
        )
      })

      const req = new Request('http://localhost/docs', { method: 'GET' })
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('text/html')
      const html = await res.text()
      expect(html).toContain('API Documentation')
      expect(html).toContain('/openapi.json')
    })

    it('should handle health check endpoint', async () => {
      const app = new Norte()

      app.raw('GET', '/health', () => {
        return new Response(
          JSON.stringify({ status: 'healthy', timestamp: Date.now() }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        )
      })

      const req = new Request('http://localhost/health', { method: 'GET' })
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.status).toBe('healthy')
      expect(typeof data.timestamp).toBe('number')
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
        return new Response(JSON.stringify([{ id: '2', name: 'From Raw' }]), {
          headers: { 'content-type': 'application/json' },
        })
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
        return new Response('OK')
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
      const healthReq = new Request('http://localhost/health', { method: 'GET' })
      const healthRes = await app.fetch(healthReq)
      expect(healthRes.status).toBe(200)
      expect(await healthRes.text()).toBe('OK')

      // Test router
      const usersReq = new Request('http://localhost/v1/users', { method: 'GET' })
      const usersRes = await app.fetch(usersReq)
      expect(usersRes.status).toBe(200)
      const usersData = await usersRes.json()
      expect(usersData).toEqual([{ id: '1', name: 'Alice' }])
    })
  })

  describe('Error Handling', () => {
    it('should handle errors thrown by handler', async () => {
      const app = new Norte()

      app.raw('GET', '/error', () => {
        throw new Error('Something went wrong')
      })

      const req = new Request('http://localhost/error', { method: 'GET' })
      const res = await app.fetch(req)

      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe('INTERNAL_SERVER_ERROR')
    })

    it('should handle Response with error status', async () => {
      const app = new Norte()

      app.raw('GET', '/forbidden', () => {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          {
            status: 403,
            headers: { 'content-type': 'application/json' },
          },
        )
      })

      const req = new Request('http://localhost/forbidden', { method: 'GET' })
      const res = await app.fetch(req)

      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error).toBe('Access denied')
    })

    it('should handle async errors', async () => {
      const app = new Norte()

      app.raw('POST', '/async-error', async () => {
        await Promise.resolve()
        throw new Error('Async error')
      })

      const req = new Request('http://localhost/async-error', { method: 'POST' })
      const res = await app.fetch(req)

      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe('INTERNAL_SERVER_ERROR')
    })
  })

  describe('Edge Cases', () => {
    it('should handle multiple raw routes on same path with different methods', async () => {
      const app = new Norte()

      app.raw('GET', '/data', () => {
        return new Response('GET response')
      })

      app.raw('POST', '/data', () => {
        return new Response('POST response')
      })

      const getReq = new Request('http://localhost/data', { method: 'GET' })
      const getRes = await app.fetch(getReq)
      expect(await getRes.text()).toBe('GET response')

      const postReq = new Request('http://localhost/data', { method: 'POST' })
      const postRes = await app.fetch(postReq)
      expect(await postRes.text()).toBe('POST response')
    })

    it('should handle path with parameters', async () => {
      const app = new Norte()

      app.raw('GET', '/users/:id', (req) => {
        const url = new URL(req.url)
        const id = url.pathname.split('/').pop()
        return new Response(JSON.stringify({ userId: id }), {
          headers: { 'content-type': 'application/json' },
        })
      })

      const req = new Request('http://localhost/users/123', { method: 'GET' })
      const res = await app.fetch(req)

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.userId).toBe('123')
    })

    it('should return 404 when no route matches', async () => {
      const app = new Norte()

      app.raw('GET', '/exists', () => {
        return new Response('OK')
      })

      const req = new Request('http://localhost/does-not-exist', {
        method: 'GET',
      })
      const res = await app.fetch(req)

      expect(res.status).toBe(404)
    })
  })
})

