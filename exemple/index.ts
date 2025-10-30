import { Norte, Router, t } from '../src'

type UserStore = { userId: string }

const app = new Norte<UserStore>()

// Define o schema do domínio User - será usado automaticamente em todos os métodos
const UserSchema = t.Object({
  id: t.String(),
  name: t.String(),
  email: t.Optional(t.String()),
})

// Router com schema de response - todas as rotas retornam User ou User[]
const userRouter = new Router<UserStore>('users', {
  schema: UserSchema, // Schema de response do domínio
  beforeHandler: [
    async ({ req }) => {
      const userId = req.headers.get('user-id') || ''
      return { userId }
    },
  ],
})

// GET /users - retorna User[] (validado automaticamente como array)
userRouter.list({}, async () => {
  return [
    { id: '1', name: 'John Doe', email: 'john@example.com' },
    { id: '2', name: 'Jane Doe', email: 'jane@example.com' },
  ]
})

// GET /users/:userId - retorna User (validado automaticamente)
userRouter.read({}, async ({ store }) => {
  return { id: store.userId, name: 'John Doe', email: 'john@example.com' }
})

// POST /users - retorna User (validado automaticamente)
userRouter.create({}, async ({ body }) => {
  return {
    id: '123',
    name: (body as { name: string }).name,
    email: (body as { email?: string }).email,
  }
})

// PATCH /users/:userId - retorna User (validado automaticamente)
userRouter.update({}, async ({ store, body }) => {
  return {
    id: store.userId,
    name: (body as { name: string }).name,
    email: (body as { email?: string }).email,
  }
})

// Nested router com seu próprio schema
const ProductSchema = t.Object({
  id: t.String(),
  name: t.String(),
  price: t.Number(),
})

const productRouter = new Router<UserStore>(userRouter, 'products', {
  schema: ProductSchema,
})

// GET /users/:userId/products/:productId - retorna Product
productRouter.read({}, async () => {
  return { id: '1', name: 'Product 1', price: 99.99 }
})

// GET /users/:userId/products - retorna Product[]
productRouter.list({}, async ({ pagination }) => {
  console.log(pagination)
  return [
    { id: '1', name: 'Product 1', price: 99.99 },
    { id: '2', name: 'Product 2', price: 149.99 },
  ]
})

app.register(userRouter)
app.register(productRouter)

export default app
