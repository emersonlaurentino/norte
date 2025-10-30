import { Norte, Router } from '../src'
import type { BeforeHookContext } from '../src/router'

// Definindo um store tipado com campos específicos
type UserStore = { 
  userId: string
  userRole: 'admin' | 'user'
  permissions: string[]
}

const app = new Norte<UserStore>()

// Este beforeHandler DEVE retornar exatamente os campos definidos em UserStore
function authenticateUser({ req }: BeforeHookContext<UserStore>): UserStore {
  const userId = req.headers.get('user-id') || 'anonymous'
  const userRole = req.headers.get('user-role') as 'admin' | 'user' || 'user'
  const permissions = req.headers.get('permissions')?.split(',') || []
  
  // TypeScript irá garantir que retornamos exatamente os campos de UserStore
  return {
    userId,
    userRole,
    permissions
  }
}

// Este beforeHandler também DEVE retornar UserStore
function addTimestamp({ store }: BeforeHookContext<UserStore>): UserStore {
  // Podemos acessar os campos existentes do store
  console.log(`User ${store.userId} with role ${store.userRole}`)
  
  // Mas devemos retornar apenas os campos definidos em UserStore
  return {
    userId: store.userId,
    userRole: store.userRole,
    permissions: store.permissions
  }
}

const router = new Router<UserStore>('users', {
  beforeHandler: [authenticateUser, addTimestamp],
})

router.read({}, async ({ store, log }) => {
  // O store aqui é tipado como UserStore
  log.info({ userId: store.userId, role: store.userRole }, 'User accessed')
  
  if (store.userRole === 'admin') {
    return { 
      id: store.userId, 
      name: 'Admin User',
      canDelete: true 
    }
  }
  
  return { 
    id: store.userId, 
    name: 'Regular User',
    canDelete: false 
  }
})

app.register(router)

export default app
