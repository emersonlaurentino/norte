# Norte

A zero-dependency, opinionated API framework that follows the principles of business logic separation and static compilation for maximum performance.

## ✨ Philosophy

Norte is not an HTTP framework; it's a **business logic framework** that uses HTTP as an implementation detail. Our opinionated approach focuses on eliminating boilerplate so developers can concentrate only on what adds value.

## 🚀 Core Principles

- **Opinionated Simplicity**: One correct way to do things, ensuring consistency and zero ambiguity
- **Performance by Static Compilation**: Moves maximum work (validation, routing) from runtime to initialization
- **Total Protocol Abstraction**: Pure separation - Hooks handle Protocol (HTTP), Handlers handle Business Logic (pure data)
- **Universal Portability**: Core agnostic (`app.fetch`) runs on any platform (Bun, Node.js, Cloudflare Workers, Vercel)
- **Zero Dependencies**: Minimal external dependencies with TypeBox + AJV for validation

## 📦 Installation

```bash
bun add norte
# or
npm install norte
# or
yarn add norte
# or
pnpm add norte
```

## 🎯 Quick Start

```typescript
import { Norte, Router, t, NorteError } from 'norte'

// 1. Create your main app
const app = new Norte({
  title: 'My API',
  version: '1.0.0'
})

// 2. Define schemas with TypeBox
const userSchema = t.Object({
  id: t.String(),
  name: t.String(),
  email: t.Email(),
  age: t.Number({ minimum: 18 }),
  createdAt: t.Date()
})

const createUserSchema = t.Object({
  name: t.String(),
  email: t.Email(),
  age: t.Number({ minimum: 18 })
})

// 3. Create a router with domain-driven approach
const userRouter = new Router('users', { version: 1 })
  .list(
    { 
      response: t.Array(userSchema),
      query: t.Object({
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100 }))
      })
    },
    async ({ query, log }) => {
      log.info('Fetching users', { limit: query.limit })
      return await getUsersFromDB(query.limit || 20)
    }
  )
  .create(
    { 
      body: createUserSchema,
      response: userSchema
    },
    async ({ body, log }) => {
      log.info('Creating user', { email: body.email })
      return await createUser(body)
    }
  )
  .read(
    { 
      response: userSchema,
      param: t.Object({ userId: t.String() })
    },
    async ({ param, log }) => {
      const user = await getUserById(param.userId)
      if (!user) {
        throw new NorteError('NOT_FOUND', 'User not found')
      }
      return user
    }
  )

// 4. Register the router
app.register(userRouter)

// 5. Export for your runtime (WinterCG compatible)
export default app
```

## 🏗️ Architecture: 3-Phase Compilation

Norte operates as a "compiler" in three phases:

### Phase 1: Definition (Runtime)
Stores route definitions (`new Router(...)`) and schemas.

### Phase 2: Compilation (Initialization)
- Pre-compiles schemas (via AJV)
- "Flattens" the before → handle → after chain into optimized functions
- Builds routing tree
- Generates "intelligent" OpenAPI

### Phase 3: Execution (Runtime)
Exposes a single `app.fetch` handler (WinterCG) that executes optimized functions with near-zero overhead.

## 📋 API Reference

### Norte Class

The main application class that handles setup and configuration.

```typescript
const app = new Norte({
  title: string,              // API title for documentation
  version?: string,           // API version (default: "1.0.0")
})
```

#### Methods

- `app.register(router)` - Register a Router instance
- `app.fetch` - The WinterCG-compatible fetch handler

### Router Class

Domain-driven API for creating CRUD operations with automatic OpenAPI documentation.

```typescript
// Root domain
const router = new Router(domain: string, config: {
  version?: number
})

// Nested domain
const router = new Router(parent: Router, domain: string, config: {
  version?: number
})
```

#### Domain-Driven Design

Norte uses domain names to automatically generate paths, parameters, and OpenAPI tags:

```typescript
// Domain: 'stores' -> generates /v1/stores, parameter 'storeId', and OpenAPI tag 'Stores'
const storeRouter = new Router('stores', { version: 1 })

// Domain: 'products' nested under stores -> generates /v1/stores/:storeId/products and tag 'Products'
const productsRouter = new Router(storeRouter, 'products', { version: 1 })
```

#### CRUD Methods

Each method requires schemas for input and output validation:

**List Resources**
```typescript
.list(
  config: RouteConfig<never, TResponse, TParams>,
  handler: ListHandler<TResponse, TParams>
)
```

**Create Resource**
```typescript
.create(
  config: RouteConfig<TInput, TResponse, TParams>,
  handler: CreateHandler<TInput, TResponse, TParams>
)
```

**Read Resource**
```typescript
.read(
  config: RouteConfig<never, TResponse, TParams>,
  handler: ReadHandler<TResponse, TParams>
)
```

**Update Resource**
```typescript
.update(
  config: RouteConfig<TInput, TResponse, TParams>,
  handler: UpdateHandler<TInput, TResponse, TParams>
)
```

**Delete Resource**
```typescript
.delete(
  config: RouteConfig<never, never, TParams>,
  handler: DeleteHandler<TParams>
)
```

**Custom Route**
```typescript
.custom(
  method: string,
  path: string,
  config: CustomRouteConfig<TParams>,
  handler: CustomHandler<TParams>
)
```

### Handler Context

Handlers receive only validated data and business context:

```typescript
type HandlerContext<TParams = Record<string, string>> = {
  param: TParams           // Validated path parameters
  body?: unknown          // Validated request body
  query?: Record<string, string>  // Validated query parameters
  store: Store           // Shared state between hooks and handlers
  log: Logger            // Structured logging with request ID
}
```

### Hook Context

Hooks handle HTTP protocol concerns:

```typescript
type HookContext = {
  request: Request        // Raw HTTP request
  response?: Response     // HTTP response (in afterHandle)
  headers: Headers        // Request headers
  store: Store           // Shared state
  log: Logger            // Structured logging
  error: (code: string, message: string, details?: unknown) => NorteError
}
```

## 🔧 TypeBox Validation

Norte uses TypeBox for schema definition with AJV for compilation:

```typescript
import { t } from 'norte'

// Primitives
const schema = t.Object({
  id: t.String(),
  count: t.Number({ minimum: 0 }),
  active: t.Boolean(),
  tags: t.Array(t.String()),
  metadata: t.Optional(t.Object({
    created: t.Date(),
    updated: t.Date()
  }))
})

// Common patterns
const userSchema = t.Object({
  id: t.String(),
  email: t.Email(),
  uuid: t.Uuid(),
  createdAt: t.Date()
})
```

## 🎣 Lifecycle Hooks

### Before Handle Hooks

Execute before the handler, handle protocol concerns:

```typescript
const authHook: BeforeHandleHook = async ({ request, headers, store, error }) => {
  const token = headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    throw error('UNAUTHORIZED', 'Missing authorization token')
  }
  
  // Validate token and set user in store
  const user = await validateToken(token)
  store.user = user
}

const userRouter = new Router('users', { version: 1 })
  .hooks({ beforeHandle: [authHook] })
  .read(config, handler)
```

### After Handle Hooks

Execute after the handler, handle response concerns:

```typescript
const loggingHook: AfterHandleHook = async ({ request, result, log }) => {
  log.info('Request completed', {
    method: request.method,
    url: request.url,
    status: result instanceof NorteError ? result.statusCode : 200
  })
}
```

## 🚨 Error Handling

Norte includes a comprehensive error system:

```typescript
import { NorteError } from 'norte'

// Available error codes
type ErrorCode = 
  | 'NOT_FOUND'           // 404
  | 'INVALID_INPUT'       // 400
  | 'UNAUTHORIZED'        // 401
  | 'FORBIDDEN'           // 403
  | 'CONFLICT'            // 409
  | 'INTERNAL_SERVER_ERROR' // 500

// Usage in handlers
router.read(config, async ({ param }) => {
  const user = await getUserById(param.userId)
  if (!user) {
    throw new NorteError('NOT_FOUND', 'User not found', { userId: param.userId })
  }
  return user
})
```

## 📚 OpenAPI Documentation

Norte automatically generates OpenAPI 3.1 specifications:

```typescript
import { generateOpenAPISpec } from 'norte'

const spec = generateOpenAPISpec(app.getRoutes(), {
  title: 'My API',
  version: '1.0.0'
})

// Serve OpenAPI spec
app.custom('GET', '/docs', {}, async () => {
  return new Response(JSON.stringify(spec), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

## 🎯 Examples

### Multi-Tenant Store Example

```typescript
// Store domain for multi-tenant architecture
const storeRouter = new Router('stores', { version: 1 })
  .list(
    { response: t.Array(storeSchema) },
    async ({ store, log }) => {
      const stores = await db.stores.findMany({
        where: { tenantId: store.user.tenantId }
      })
      return stores
    }
  )

// Orders nested under stores - generates /v1/stores/:storeId/orders
const ordersRouter = new Router(storeRouter, 'orders', { version: 1 })
  .list(
    { 
      response: t.Array(orderSchema),
      param: t.Object({ storeId: t.String() })
    },
    async ({ param, store }) => {
      const orders = await db.orders.findMany({
        where: {
          storeId: param.storeId,
          tenantId: store.user.tenantId // Multi-tenant security
        }
      })
      return orders
    }
  )
```

### Authentication Hook

```typescript
const authHook: BeforeHandleHook = async ({ request, headers, store, error }) => {
  const authHeader = headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw error('UNAUTHORIZED', 'Missing or invalid authorization header')
  }

  const token = authHeader.slice(7)
  const user = await validateJWT(token)
  
  if (!user) {
    throw error('UNAUTHORIZED', 'Invalid token')
  }
  
  store.user = user
}

const protectedRouter = new Router('admin', { version: 1 })
  .hooks({ beforeHandle: [authHook] })
  .list(config, handler)
```

## 🌐 Platform Support

Norte's WinterCG-compatible `app.fetch` runs on:

- **Bun**: `Bun.serve({ fetch: app.fetch })`
- **Node.js**: With `@cloudflare/workers-types`
- **Cloudflare Workers**: Direct deployment
- **Vercel**: Edge functions
- **Deno**: With compatibility layer

## 🤝 Contributing

We welcome contributions! Please see our contributing guide for details.

## 📄 License

MIT © Emerson Laurentino

## 🔗 Links

- [TypeBox](https://github.com/sinclairzx81/typebox)
- [AJV](https://ajv.js.org/)
- [WinterCG](https://wintercg.org/)