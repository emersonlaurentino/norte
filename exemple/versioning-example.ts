import { Norte, Router, t } from '../src'

// Exemplo de Versionamento Nativo do Norte

// Schema v1 - Versão inicial da API
const userSchemaV1 = t.Object({
  id: t.String(),
  name: t.String(),
})

// Schema v2 - Versão com campo adicional
const userSchemaV2 = t.Object({
  id: t.String(),
  name: t.String(),
  email: t.String(),
  createdAt: t.String(),
})

// Router v1 - version é OPCIONAL (padrão: 1)
const usersRouterV1 = new Router('users', {
  schema: userSchemaV1,
  // version: 1 <- OPCIONAL! Omitir = version 1
})

usersRouterV1.list({}, async () => {
  return [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' },
  ]
})

usersRouterV1.create(
  {
    body: t.Object({ name: t.String() }),
  },
  async ({ body }) => {
    return {
      id: '123',
      name: (body as { name: string }).name,
    }
  },
)

// Router v2 - Nova versão com mais campos
const usersRouterV2 = new Router('users', {
  schema: userSchemaV2,
  version: 2,
})

usersRouterV2.list({}, async () => {
  return [
    {
      id: '1',
      name: 'Alice',
      email: 'alice@example.com',
      createdAt: '2025-01-01T00:00:00Z',
    },
    {
      id: '2',
      name: 'Bob',
      email: 'bob@example.com',
      createdAt: '2025-01-02T00:00:00Z',
    },
  ]
})

usersRouterV2.create(
  {
    body: t.Object({
      name: t.String(),
      email: t.String(),
    }),
  },
  async ({ body }) => {
    const { name, email } = body as { name: string; email: string }
    return {
      id: '123',
      name,
      email,
      createdAt: new Date().toISOString(),
    }
  },
)

// Registrar ambas as versões no app
const app = new Norte()
app.register(usersRouterV1)
app.register(usersRouterV2)

// Agora o app suporta:
// - GET /v1/users -> Lista usuários com schema v1 (id, name)
// - POST /v1/users -> Cria usuário com schema v1 (apenas name)
// - GET /v2/users -> Lista usuários com schema v2 (id, name, email, createdAt)
// - POST /v2/users -> Cria usuário com schema v2 (name e email)

// Exemplo de uso:
async function main() {
  // Requisição v1
  const resV1 = await app.fetch(
    new Request('http://localhost/v1/users', { method: 'GET' }),
  )
  console.log('V1 Response:', await resV1.json())
  // Output: [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }]

  // Requisição v2
  const resV2 = await app.fetch(
    new Request('http://localhost/v2/users', { method: 'GET' }),
  )
  console.log('V2 Response:', await resV2.json())
  // Output: [{ id: '1', name: 'Alice', email: 'alice@example.com', createdAt: '...' }, ...]
}

main()
