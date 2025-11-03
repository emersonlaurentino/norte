import { Norte, Router, t } from '../src'

// Exemplo de como usar múltiplas fontes no Scalar UI
const app = new Norte({
  openapi: {
    title: 'My API',
    version: '1.0.0',
    description: 'API principal com referências a outras APIs',
    sources: [
      {
        url: 'https://api.github.com/openapi.json',
        label: 'GitHub API',
      },
      {
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
        label: 'Pet Store API',
      },
    ],
  },
})

// Cria um router de usuários
const userRouter = new Router('users', {
  schema: t.Object({
    id: t.String(),
    name: t.String(),
    email: t.String(),
  }),
})

userRouter.list({}, async () => {
  return [
    { id: '1', name: 'John Doe', email: 'john@example.com' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
  ]
})

userRouter.read({}, async ({ param }) => {
  return { id: param.id, name: 'John Doe', email: 'john@example.com' }
})

app.register(userRouter)

// O Scalar UI na rota / agora mostrará:
// - A API do Norte (/openapi.json) - adicionado automaticamente
// - GitHub API - como fonte externa
// - Pet Store API - como fonte externa

export default app

