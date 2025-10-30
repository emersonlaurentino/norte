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

app.register(router)

export default app
