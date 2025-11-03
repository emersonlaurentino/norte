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

    it('should handle simple POST route with body in context', async () => {
      const app = new Norte()

      app.raw('POST', '/webhook', async ({ body }) => {
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

      app.raw('*', '/api/echo', async ({ request }) => {
        return new Response(JSON.stringify({ method: request.method }), {
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

  describe('Multiple Methods Array', () => {
    it('should handle array of methods for same path', async () => {
      const app = new Norte()

      app.raw(['PUT', 'DELETE'], '/post', ({ request }) => {
        return new Response(`${request.method} /post`, { status: 200 })
      })

      const putReq = new Request('http://localhost/post', { method: 'PUT' })
      const putRes = await app.fetch(putReq)
      expect(putRes.status).toBe(200)
      expect(await putRes.text()).toBe('PUT /post')

      const deleteReq = new Request('http://localhost/post', { method: 'DELETE' })
      const deleteRes = await app.fetch(deleteReq)
      expect(deleteRes.status).toBe(200)
      expect(await deleteRes.text()).toBe('DELETE /post')
    })

    it('should not match methods not in array', async () => {
      const app = new Norte()

      app.raw(['PUT', 'DELETE'], '/post', ({ request }) => {
        return new Response(`${request.method} /post`, { status: 200 })
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

      app.raw(['GET', 'POST', 'PUT'], '/api/resource', async ({ request }) => {
        const data = { method: request.method, timestamp: Date.now() }
        return new Response(JSON.stringify(data), {
          headers: { 'content-type': 'application/json' },
        })
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
        return new Response('Updated', { status: 200 })
      })

      const patchReq = new Request('http://localhost/update', { method: 'PATCH' })
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
        return new Response('Read/Write operations')
      })

      app.raw(['PUT', 'DELETE'], '/data', () => {
        return new Response('Update/Delete operations')
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

      app.raw(['PUT', 'PATCH'], '/users/:id', ({ request, param }) => {
        return new Response(
          JSON.stringify({ action: 'update', method: request.method, id: param.id }),
          { headers: { 'content-type': 'application/json' } },
        )
      })

      const putReq = new Request('http://localhost/users/123', { method: 'PUT' })
      const putRes = await app.fetch(putReq)
      const putData = await putRes.json()
      expect(putData).toEqual({ action: 'update', method: 'PUT', id: '123' })

      const patchReq = new Request('http://localhost/users/456', {
        method: 'PATCH',
      })
      const patchRes = await app.fetch(patchReq)
      const patchData = await patchRes.json()
      expect(patchData).toEqual({ action: 'update', method: 'PATCH', id: '456' })
    })

    it('should handle array of methods with async handler', async () => {
      const app = new Norte()

      app.raw(['POST', 'PUT'], '/async-resource', async ({ request }) => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return new Response(
          JSON.stringify({ processed: true, method: request.method }),
          { headers: { 'content-type': 'application/json' } },
        )
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
        throw new Error('Handler error')
      })

      const getReq = new Request('http://localhost/error-route', { method: 'GET' })
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
    it('should handle path wildcard with specific method', async () => {
      const app = new Norte()

      app.raw('GET', '/api/v1/:wildcard', ({ request }) => {
        const url = new URL(request.url)
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

      app.raw('*', '/api/auth/:action', ({ request }) => {
        const url = new URL(request.url)
        return new Response(
          JSON.stringify({
            method: request.method,
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
      const authHandler = ({ request }: { request: Request }) => {
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

      app.raw('GET', '/users/:id', ({ param }) => {
        return new Response(JSON.stringify({ userId: param.id }), {
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

  describe('Rich Context', () => {
    it('should provide body in context for JSON requests', async () => {
      const app = new Norte()

      app.raw('POST', '/api/users', async ({ body }) => {
        return new Response(
          JSON.stringify({
            created: true,
            user: body,
          }),
          {
            status: 201,
            headers: { 'content-type': 'application/json' },
          },
        )
      })

      const req = new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Alice', email: 'alice@example.com' }),
      })

      const res = await app.fetch(req)
      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data).toEqual({
        created: true,
        user: { name: 'Alice', email: 'alice@example.com' },
      })
    })

    it('should provide param in context for URL parameters', async () => {
      const app = new Norte()

      app.raw('GET', '/api/posts/:postId/comments/:commentId', ({ param }) => {
        return new Response(
          JSON.stringify({
            postId: param.postId,
            commentId: param.commentId,
          }),
          {
            headers: { 'content-type': 'application/json' },
          },
        )
      })

      const req = new Request(
        'http://localhost/api/posts/42/comments/99',
        { method: 'GET' },
      )

      const res = await app.fetch(req)
      const data = await res.json()
      expect(data).toEqual({
        postId: '42',
        commentId: '99',
      })
    })

    it('should provide query in context for query strings', async () => {
      const app = new Norte()

      app.raw('GET', '/api/search', ({ query }) => {
        return new Response(
          JSON.stringify({
            term: query.q,
            page: query.page,
            limit: query.limit,
          }),
          {
            headers: { 'content-type': 'application/json' },
          },
        )
      })

      const req = new Request(
        'http://localhost/api/search?q=test&page=2&limit=10',
        { method: 'GET' },
      )

      const res = await app.fetch(req)
      const data = await res.json()
      expect(data).toEqual({
        term: 'test',
        page: '2',
        limit: '10',
      })
    })

    it('should provide log in context', async () => {
      const app = new Norte()

      let loggerUsed = false

      app.raw('POST', '/api/log-test', ({ log, body }) => {
        loggerUsed = true
        expect(log).toBeDefined()
        expect(typeof log.info).toBe('function')
        expect(typeof log.error).toBe('function')
        expect(typeof log.debug).toBe('function')
        expect(typeof log.warn).toBe('function')

        log.info({ data: body }, 'Test log message')

        return new Response(JSON.stringify({ logged: true }), {
          headers: { 'content-type': 'application/json' },
        })
      })

      const req = new Request('http://localhost/api/log-test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
      })

      const res = await app.fetch(req)
      expect(res.status).toBe(200)
      expect(loggerUsed).toBe(true)
    })

    it('should provide request in context when needed', async () => {
      const app = new Norte()

      app.raw('GET', '/api/headers', ({ request }) => {
        const userAgent = request.headers.get('user-agent') || 'unknown'
        const authorization = request.headers.get('authorization') || 'none'

        return new Response(
          JSON.stringify({
            userAgent,
            authorization,
          }),
          {
            headers: { 'content-type': 'application/json' },
          },
        )
      })

      const req = new Request('http://localhost/api/headers', {
        method: 'GET',
        headers: {
          'user-agent': 'TestAgent/1.0',
          'authorization': 'Bearer token123',
        },
      })

      const res = await app.fetch(req)
      const data = await res.json()
      expect(data).toEqual({
        userAgent: 'TestAgent/1.0',
        authorization: 'Bearer token123',
      })
    })

    it('should handle body being null for non-JSON requests', async () => {
      const app = new Norte()

      app.raw('GET', '/api/test', ({ body }) => {
        return new Response(
          JSON.stringify({
            bodyIsNull: body === null,
          }),
          {
            headers: { 'content-type': 'application/json' },
          },
        )
      })

      const req = new Request('http://localhost/api/test', { method: 'GET' })

      const res = await app.fetch(req)
      const data = await res.json()
      expect(data.bodyIsNull).toBe(true)
    })

    it('should combine all context properties', async () => {
      const app = new Norte()

      app.raw('POST', '/api/users/:userId', ({ body, param, query, log }) => {
        expect(body).toEqual({ name: 'Updated Name' })
        expect(param.userId).toBe('123')
        expect(query.notify).toBe('true')
        expect(log).toBeDefined()

        log.info({ userId: param.userId }, 'User update')

        return new Response(
          JSON.stringify({
            userId: param.userId,
            updates: body,
            notify: query.notify === 'true',
          }),
          {
            headers: { 'content-type': 'application/json' },
          },
        )
      })

      const req = new Request('http://localhost/api/users/123?notify=true', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Name' }),
      })

      const res = await app.fetch(req)
      const data = await res.json()
      expect(data).toEqual({
        userId: '123',
        updates: { name: 'Updated Name' },
        notify: true,
      })
    })

    it('should handle errors in handler with context', async () => {
      const app = new Norte()

      app.raw('POST', '/api/error', ({ body }) => {
        throw new Error(`Invalid data: ${JSON.stringify(body)}`)
      })

      const req = new Request('http://localhost/api/error', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ invalid: true }),
      })

      const res = await app.fetch(req)
      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.error).toBe('INTERNAL_SERVER_ERROR')
    })

    it('should work with async handlers using context', async () => {
      const app = new Norte()

      app.raw('POST', '/api/async', async ({ body, param, query }) => {
        await new Promise((resolve) => setTimeout(resolve, 10))

        return new Response(
          JSON.stringify({
            body,
            param,
            query,
            async: true,
          }),
          {
            headers: { 'content-type': 'application/json' },
          },
        )
      })

      const req = new Request('http://localhost/api/async?key=value', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ test: 'async' }),
      })

      const res = await app.fetch(req)
      const data = await res.json()
      expect(data).toEqual({
        body: { test: 'async' },
        param: {},
        query: { key: 'value' },
        async: true,
      })
    })

    it('should handle multiple path parameters', async () => {
      const app = new Norte()

      app.raw(
        'GET',
        '/api/users/:userId/posts/:postId/comments/:commentId',
        ({ param }) => {
          return new Response(JSON.stringify(param), {
            headers: { 'content-type': 'application/json' },
          })
        },
      )

      const req = new Request(
        'http://localhost/api/users/u1/posts/p2/comments/c3',
        { method: 'GET' },
      )

      const res = await app.fetch(req)
      const data = await res.json()
      expect(data).toEqual({
        userId: 'u1',
        postId: 'p2',
        commentId: 'c3',
      })
    })

    it('should handle empty query strings', async () => {
      const app = new Norte()

      app.raw('GET', '/api/test', ({ query }) => {
        return new Response(
          JSON.stringify({
            queryIsEmpty: Object.keys(query).length === 0,
          }),
          {
            headers: { 'content-type': 'application/json' },
          },
        )
      })

      const req = new Request('http://localhost/api/test', { method: 'GET' })

      const res = await app.fetch(req)
      const data = await res.json()
      expect(data.queryIsEmpty).toBe(true)
    })

    it('should work with wildcard methods and context', async () => {
      const app = new Norte()

      app.raw('*', '/api/echo', ({ body, param, query, request }) => {
        return new Response(
          JSON.stringify({
            method: request.method,
            body,
            param,
            query,
          }),
          {
            headers: { 'content-type': 'application/json' },
          },
        )
      })

      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

      for (const method of methods) {
        const req = new Request('http://localhost/api/echo?test=1', {
          method,
          ...(method !== 'GET' && {
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ data: method }),
          }),
        })

        const res = await app.fetch(req)
        const data = await res.json()
        expect(data.method).toBe(method)
        expect(data.query).toEqual({ test: '1' })

        if (method !== 'GET') {
          expect(data.body).toEqual({ data: method })
        }
      }
    })
  })
})

