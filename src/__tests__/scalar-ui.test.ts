import { describe, expect, it } from 'vitest'
import { t } from '../index'
import { Norte } from '../norte'
import { Router } from '../router'

describe('Scalar UI', () => {
  it('should serve Scalar UI at route / by default', async () => {
    const app = new Norte()

    const req = new Request('http://localhost/')
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')

    const html = await res.text()
    expect(html).toContain('scalar')
  })

  it('should serve Scalar UI when openapi.ui is undefined', async () => {
    const app = new Norte({
      openapi: {
        title: 'Test API',
      },
    })

    const req = new Request('http://localhost/')
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
  })

  it('should serve Scalar UI when openapi.ui is true', async () => {
    const app = new Norte({
      openapi: {
        title: 'Test API',
        ui: true,
      },
    })

    const req = new Request('http://localhost/')
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
  })

  it('should NOT serve Scalar UI when openapi.ui is false', async () => {
    const app = new Norte({
      openapi: {
        title: 'Test API',
        ui: false,
      },
    })

    const req = new Request('http://localhost/')
    const res = await app.fetch(req)

    expect(res.status).toBe(404)
  })

  it('should allow raw route at / when openapi.ui is false', async () => {
    const app = new Norte({
      openapi: {
        ui: false,
      },
    })

    app.raw('GET', '/', () => {
      return () => new Response('Custom Root')
    })

    const req = new Request('http://localhost/')
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('Custom Root')
  })

  it('should NOT allow overriding route / with app.raw()', async () => {
    const app = new Norte()

    app.raw('GET', '/', () => {
      return () => new Response('Custom Root')
    })

    const req = new Request('http://localhost/')
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')

    const html = await res.text()
    expect(html).not.toBe('Custom Root')
    expect(html).toContain('scalar')
  })

  it('should allow raw routes on other paths', async () => {
    const app = new Norte()

    app.raw('GET', '/custom', () => {
      return () => new Response('Custom Route')
    })

    const req = new Request('http://localhost/custom')
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('Custom Route')
  })

  it('should serve Scalar UI and still work with normal routers', async () => {
    const app = new Norte()

    const userRouter = new Router('users', {
      schema: t.Object({
        id: t.String(),
        name: t.String(),
      }),
    })

    userRouter.list({}, () => {
      return [{ id: '1', name: 'John' }]
    })

    app.register(userRouter)

    const rootReq = new Request('http://localhost/')
    const rootRes = await app.fetch(rootReq)
    expect(rootRes.status).toBe(200)
    expect(rootRes.headers.get('content-type')).toContain('text/html')

    const usersReq = new Request('http://localhost/v1/users', { method: 'GET' })
    const usersRes = await app.fetch(usersReq)
    expect(usersRes.status).toBe(200)
    const users = await usersRes.json()
    expect(users).toEqual([{ id: '1', name: 'John' }])
  })

  it('should keep /openapi.json working regardless of Scalar', async () => {
    const app = new Norte({
      openapi: {
        title: 'Test API',
        ui: false,
      },
    })

    const req = new Request('http://localhost/openapi.json')
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/json')

    const doc = await res.json()
    expect(doc.openapi).toBeDefined()
    expect(doc.info.title).toBe('Test API')
  })

  it('should configure Scalar to use /openapi.json', async () => {
    const app = new Norte()

    const req = new Request('http://localhost/')
    const res = await app.fetch(req)

    const html = await res.text()
    expect(html).toContain('/openapi.json')
  })

  it('should add Norte openapi automatically to sources', async () => {
    const app = new Norte()

    const req = new Request('http://localhost/')
    const res = await app.fetch(req)

    const html = await res.text()
    expect(html).toContain('"sources":[{"url":"/openapi.json"}]')
  })

  it('should extend Norte source with custom sources', async () => {
    const app = new Norte({
      openapi: {
        title: 'Test API',
        sources: [
          { url: '/auth/open-api/generate-schema', title: 'Auth API' },
          {
            url: 'https://api.external.com/openapi.json',
            title: 'External API',
          },
        ],
      },
    })

    const req = new Request('http://localhost/')
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const html = await res.text()

    expect(html).toContain('/openapi.json')
    expect(html).toContain('/auth/open-api/generate-schema')
    expect(html).toContain('https://api.external.com/openapi.json')
    expect(html).toContain('"title":"Auth API"')
    expect(html).toContain('"title":"External API"')
  })
})
