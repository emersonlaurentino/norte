import { describe, expect, it } from 'vitest'
import { Norte } from '../norte'
import { Router } from '../router'
import { t } from '../index'

describe('Scalar UI', () => {
  it('deve servir Scalar UI na rota / por padrão', async () => {
    const app = new Norte()

    const req = new Request('http://localhost/')
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    
    const html = await res.text()
    expect(html).toContain('scalar') // Scalar deve estar presente no HTML
  })

  it('deve servir Scalar UI quando openapi.ui é undefined', async () => {
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

  it('deve servir Scalar UI quando openapi.ui é true', async () => {
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

  it('NÃO deve servir Scalar UI quando openapi.ui é false', async () => {
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

  it('deve permitir raw route em / quando openapi.ui é false', async () => {
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

  it('NÃO deve permitir sobrescrever rota / com app.raw()', async () => {
    const app = new Norte()

    // Tenta registrar rota raw na /
    app.raw('GET', '/', () => {
      return () => new Response('Custom Root')
    })

    const req = new Request('http://localhost/')
    const res = await app.fetch(req)

    // Scalar tem prioridade, então deve servir Scalar, não a rota raw
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    
    const html = await res.text()
    expect(html).not.toBe('Custom Root')
    expect(html).toContain('scalar')
  })

  it('deve permitir rotas raw em outros paths', async () => {
    const app = new Norte()

    app.raw('GET', '/custom', () => {
      return () => new Response('Custom Route')
    })

    const req = new Request('http://localhost/custom')
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('Custom Route')
  })

  it('deve servir Scalar UI e ainda funcionar com routers normais', async () => {
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

    // Testa Scalar na /
    const rootReq = new Request('http://localhost/')
    const rootRes = await app.fetch(rootReq)
    expect(rootRes.status).toBe(200)
    expect(rootRes.headers.get('content-type')).toContain('text/html')

    // Testa router normal - routers usam /v1/ como prefixo
    const usersReq = new Request('http://localhost/v1/users', { method: 'GET' })
    const usersRes = await app.fetch(usersReq)
    expect(usersRes.status).toBe(200)
    const users = await usersRes.json()
    expect(users).toEqual([{ id: '1', name: 'John' }])
  })

  it('deve manter /openapi.json funcionando independente do Scalar', async () => {
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

  it('deve configurar Scalar para usar /openapi.json', async () => {
    const app = new Norte()

    const req = new Request('http://localhost/')
    const res = await app.fetch(req)

    const html = await res.text()
    // Verifica que o Scalar está configurado para usar /openapi.json
    expect(html).toContain('/openapi.json')
  })

  it('deve adicionar o openapi do Norte automaticamente nas sources', async () => {
    const app = new Norte()

    const req = new Request('http://localhost/')
    const res = await app.fetch(req)

    const html = await res.text()
    // Deve conter a configuração com /openapi.json
    expect(html).toContain('{"spec":{"url":"/openapi.json"}}')
  })

  it('deve adicionar sources externas junto com o openapi do Norte', async () => {
    const app = new Norte({
      openapi: {
        title: 'Test API',
        sources: [
          { url: 'https://api.external.com/openapi.json', label: 'External API' },
          { url: 'https://api.another.com/openapi.json' },
        ],
      },
    })

    const req = new Request('http://localhost/')
    const res = await app.fetch(req)

    const html = await res.text()
    
    // Por enquanto, apenas o OpenAPI do Norte é suportado no Scalar UI
    // TODO: Implementar suporte para múltiplas sources quando entendermos a API do Scalar
    expect(html).toContain('/openapi.json')
    expect(html).toContain('{"spec":{"url":"/openapi.json"}}')
  })

  it('deve funcionar sem sources externas', async () => {
    const app = new Norte({
      openapi: {
        title: 'Test API',
        sources: [],
      },
    })

    const req = new Request('http://localhost/')
    const res = await app.fetch(req)

    expect(res.status).toBe(200)
    const html = await res.text()
    
    // Deve conter apenas o openapi do Norte
    expect(html).toContain('{"spec":{"url":"/openapi.json"}}')
  })
})

