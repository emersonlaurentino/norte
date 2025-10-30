import type { NorteStore } from '../src'
import { Norte, NorteError, Router, t } from '../src'

// Exemplo de Observabilidade com Pino e OpenTelemetry

// Tipos
type UserStore = NorteStore & {
  user: {
    id: string
    name: string
    email: string
  }
}

// Schema de usuário
const userSchema = t.Object({
  id: t.String(),
  name: t.String(),
  email: t.String(),
})

// 1. Criar app com logging estruturado e telemetria
const app = new Norte<UserStore>({
  logger: {
    level: 'info',
    name: 'user-api',
  },
  telemetry: {
    enabled: true,
    serviceName: 'user-service',
  },
})

// 2. Hook de autenticação com logging
const authHook = async ({ log, headers, error, store }) => {
  log.info({ action: 'auth-check' }, 'Validating authentication')

  const token = headers.get('authorization')?.replace('Bearer ', '')

  if (!token) {
    log.warn({ reason: 'missing-token' }, 'Authentication failed')
    throw error('UNAUTHORIZED', 'Missing authorization token')
  }

  // Simular validação de token
  const user = { id: '123', name: 'Alice', email: 'alice@example.com' }

  log.info({ userId: user.id }, 'Authentication successful')

  return { ...store, user } as UserStore
}

// 3. Router com logging em todas as operações
const usersRouter = new Router<UserStore>('users', {
  schema: userSchema,
  beforeHandler: [authHook],
})

// List users - com child logger
usersRouter.list({}, async ({ log, store, pagination }) => {
  // Child logger com contexto adicional
  const childLog = log.child({
    operation: 'list',
    userId: store.user.id,
  })

  childLog.info(
    {
      page: pagination.page,
      limit: pagination.limit,
    },
    'Fetching users list',
  )

  // Simular busca no banco
  const users = [
    { id: '1', name: 'Alice', email: 'alice@example.com' },
    { id: '2', name: 'Bob', email: 'bob@example.com' },
  ]

  childLog.info({ count: users.length }, 'Users fetched successfully')

  return users
})

// Read user - com logging detalhado
usersRouter.read({}, async ({ param, log, store }) => {
  const userId = (param as { userId: string }).userId

  const childLog = log.child({
    operation: 'read',
    targetUserId: userId,
    requestorId: store.user.id,
  })

  childLog.info({ action: 'fetch-user' }, 'Fetching user details')

  // Simular busca
  const user = { id: userId, name: 'Alice', email: 'alice@example.com' }

  if (!user) {
    childLog.warn({ userId }, 'User not found')
    throw new NorteError('NOT_FOUND', 'User not found')
  }

  childLog.info({ found: true }, 'User fetched successfully')

  return user
})

// Create user - com logging de criação
usersRouter.create(
  {
    body: t.Object({
      name: t.String(),
      email: t.String(),
    }),
  },
  async ({ body, log, store }) => {
    const data = body as { name: string; email: string }

    const childLog = log.child({
      operation: 'create',
      creatorId: store.user.id,
    })

    childLog.info({ email: data.email }, 'Creating new user')

    // Simular criação
    const newUser = {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
    }

    childLog.info(
      {
        userId: newUser.id,
        email: newUser.email,
      },
      'User created successfully',
    )

    return newUser
  },
)

// Registrar router
app.register(usersRouter)

// Exemplo de uso:
async function main() {
  // Requisição com traceparent para distributed tracing
  const res = await app.fetch(
    new Request('http://localhost/v1/users', {
      method: 'GET',
      headers: {
        authorization: 'Bearer fake-token',
        // W3C Trace Context - será extraído e incluído nos logs
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      },
    }),
  )

  console.log('Status:', res.status)
  console.log('Response:', await res.json())

  // Logs gerados terão:
  // {
  //   "requestId": "auto-generated-uuid",
  //   "trace_id": "0af7651916cd43dd8448eb211c80319c",
  //   "service": "user-service",
  //   "userId": "123",
  //   "operation": "list",
  //   "msg": "Fetching users list"
  // }
}

main()

// Descomentar para testar com X-Request-ID customizado
// async function withCustomRequestId() {
//   const res = await app.fetch(
//     new Request('http://localhost/v1/users/123', {
//       method: 'GET',
//       headers: {
//         authorization: 'Bearer fake-token',
//         'X-Request-ID': 'my-custom-request-id',
//       },
//     }),
//   )
//   console.log('Response:', await res.json())
// }
// withCustomRequestId()
