import { Norte, Router, t } from '../src'

// 1. Extend Store para adicionar tipagem (igual ao Bindings!)
declare module '../src/types' {
  interface Store {
    user?: {
      id: string
      name: string
      role: string
    }
    token?: string
    sessionId?: string
  }

  interface Bindings {
    DATABASE_URL?: string
    API_KEY?: string
  }
}

// 2. Criar aplicação Norte - SEM GENERICS!
const app = new Norte()

// 3. Criar router - SEM GENERICS!
const postsRouter = new Router('posts', {
  schema: t.Object({
    id: t.String(),
    title: t.String(),
    authorId: t.String(),
  }),
})

// 4. BeforeHandler com store tipado automaticamente
postsRouter.list(
  {
    beforeHandler: [
      async (ctx) => {
        // Simular autenticação
        const token = ctx.request.headers.get('authorization')

        if (!token) {
          throw ctx.error('UNAUTHORIZED', 'Token required')
        }

        // Store é automaticamente tipado!
        return {
          user: {
            id: '123',
            name: 'John Doe',
            role: 'admin',
          },
          token,
          sessionId: crypto.randomUUID(),
        }
      },
    ],
  },
  async (ctx) => {
    // Acessa store tipado automaticamente
    const userId = ctx.store.user?.id
    const userName = ctx.store.user?.name

    ctx.log.info({ userId, userName }, 'User fetching posts')

    return [
      { id: '1', title: 'First Post', authorId: userId || 'unknown' },
      { id: '2', title: 'Second Post', authorId: userId || 'unknown' },
    ]
  },
)

postsRouter.create(
  {
    body: t.Object({
      title: t.String(),
    }),
    beforeHandler: [
      async (ctx) => {
        // Verifica permissão
        const apiKey = ctx.env.API_KEY

        if (!apiKey) {
          throw ctx.error('FORBIDDEN', 'API Key missing')
        }

        return {
          user: {
            id: '456',
            name: 'Jane Doe',
            role: 'editor',
          },
          token: 'dummy-token',
        }
      },
    ],
  },
  async (ctx) => {
    // Store e env são automaticamente tipados!
    const authorId = ctx.store.user?.id || 'unknown'
    const dbUrl = ctx.env.DATABASE_URL

    ctx.log.info({ authorId, dbUrl }, 'Creating post')

    return {
      id: crypto.randomUUID(),
      title: (ctx.body as { title: string }).title,
      authorId,
    }
  },
)

// 5. Registrar router
app.register(postsRouter)

// 6. Export para qualquer plataforma
export default app

/*
 * Benefícios:
 * 
 * 1. Sem generics <Store>!
 * 2. Tipagem automática via module augmentation
 * 3. API mais limpa e simples
 * 4. Igual ao Hono
 * 
 * Antes:
 * const router = new Router<MyStore>('posts', {...})
 * const app = new Norte<MyStore>()
 * 
 * Agora:
 * declare module 'norte' { interface Store { ... } }
 * const router = new Router('posts', {...})
 * const app = new Norte()
 */

