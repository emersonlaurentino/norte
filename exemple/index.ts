import { Norte, Router } from '../src'

type UserStore = { userId: string }

const app = new Norte<UserStore>()

const router = new Router<UserStore>('users', {
  beforeHandler: [
    async ({ req }) => {
      const userId = req.headers.get('user-id') || ''
      return { userId }
    },
  ],
})

router.read({}, async ({ store }) => {
  return { id: store.userId, name: 'John Doe' }
})

const nestedRouter = new Router<UserStore>(router, 'products')

nestedRouter.read({}, async () => {
  return { id: '1', name: 'Product 1' }
})

app.register(router)
app.register(nestedRouter)

export default app
