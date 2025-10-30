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

// 1. Create your main app with observability
const app = new Norte({
  logger: {
    level: 'info',
    name: 'my-api'
  },
  telemetry: {
    enabled: true,
    serviceName: 'my-api'
  }
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

## 🔢 Native Versioning

Norte includes native API versioning that automatically prefixes all routes:

```typescript
// Version 1 (default) - version é OPCIONAL
const usersV1 = new Router('users', { 
  schema: t.Object({
    id: t.String(),
    name: t.String()
  })
  // version: 1 <- OPCIONAL! Se omitido, usa version 1
})
usersV1.list({}, async () => [{ id: '1', name: 'Alice' }])
// Generates: GET /v1/users

// Version 2 with additional fields
const usersV2 = new Router('users', { 
  schema: t.Object({
    id: t.String(),
    name: t.String(),
    email: t.String(),
    createdAt: t.String()
  }),
  version: 2
})
usersV2.list({}, async () => [
  { id: '1', name: 'Alice', email: 'alice@example.com', createdAt: '2025-01-01' }
])
// Generates: GET /v2/users

// Register both versions
app.register(usersV1)
app.register(usersV2)
```

### Version Features

- **Optional Field**: `version` is optional - defaults to `1` when not specified
- **Automatic Prefixing**: All routes get `/v{number}/` prefix
- **Multiple Versions**: Support multiple versions of the same domain simultaneously
- **Nested Routers**: Child routers inherit parent's version
- **Consistent**: Version is applied to all CRUD operations (.list, .create, .read, .update, .delete, .custom)

### Common Usage

Most APIs start without specifying version (defaults to v1):

```typescript
// Simple API - version defaults to 1
const users = new Router('users', { schema: userSchema })
const products = new Router('products', { schema: productSchema })

// These generate: /v1/users and /v1/products
app.register(users)
app.register(products)
```

### Version Strategy

```typescript
// Gradual migration strategy
const productsV1 = new Router('products', { schema: schemaV1, version: 1 })
const productsV2 = new Router('products', { schema: schemaV2, version: 2 })
const productsV3 = new Router('products', { schema: schemaV3, version: 3 })

// All versions coexist
app.register(productsV1)  // /v1/products
app.register(productsV2)  // /v2/products
app.register(productsV3)  // /v3/products
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

## 📊 Observability & Logging

Norte includes built-in structured logging with Pino and optional OpenTelemetry integration.

### Structured Logging

Every request automatically gets a unique `requestId` that is injected into all logs:

```typescript
const app = new Norte({
  logger: {
    level: 'info',
    name: 'my-api'
  }
})

const usersRouter = new Router('users', { schema: userSchema })
usersRouter.list({}, async ({ log }) => {
  // Logger has requestId automatically
  log.info({ action: 'list-users' }, 'Fetching users')
  // Output: {"requestId":"abc-123","action":"list-users","msg":"Fetching users"}
  
  const users = await db.users.findMany()
  return users
})
```

### Logger Features

- **Automatic requestId**: Generated for each request or extracted from `X-Request-ID` header
- **Child Loggers**: Create contextual loggers with additional bindings
- **Pino-based**: High-performance JSON logging
- **Pretty Print**: Automatic in development mode

```typescript
// Child logger with additional context
const usersRouter = new Router('users', { schema: userSchema })
usersRouter.read({}, async ({ param, log }) => {
  const childLog = log.child({ userId: param.userId })
  childLog.info({ action: 'fetch' }, 'Fetching user details')
  
  const user = await db.users.findUnique({ id: param.userId })
  childLog.info({ found: !!user }, 'User fetch completed')
  
  return user
})
```

### Custom Logger Configuration

```typescript
// Custom log level and name
const app = new Norte({
  logger: {
    level: 'debug',
    name: 'my-service',
    // Any Pino options
    redact: ['password', 'token']
  }
})

// Disable logging
const app = new Norte({
  logger: false
})
```

### OpenTelemetry Integration

Enable distributed tracing with OpenTelemetry-compatible systems:

```typescript
const app = new Norte({
  telemetry: {
    enabled: true,
    serviceName: 'api-gateway'
  }
})
```

**When telemetry is enabled:**

- Logs include `trace_id` automatically
- Extracts trace context from `traceparent` header (W3C Trace Context)
- Generates new trace IDs for incoming requests without parent
- All logs are correlated with traces

```typescript
// With telemetry enabled, logs include trace_id:
// {"requestId":"abc-123","trace_id":"0af7651916cd43dd8448eb211c80319c","msg":"..."}
```

**Trace Context Propagation:**

```bash
# Client sends traceparent header
curl -H "traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" \
  https://api.example.com/v1/users
```

The `trace_id` is automatically extracted and included in all logs for that request, enabling full distributed tracing across services.

### Logger in Hooks

The logger is available in all hooks with the same requestId:

```typescript
const authHook = async ({ log, headers, error }) => {
  log.debug({ hasAuth: !!headers.get('authorization') }, 'Checking auth')
  
  const token = headers.get('authorization')
  if (!token) {
    log.warn('Missing authorization header')
    throw error('UNAUTHORIZED', 'Missing token')
  }
  
  return { user: await validateToken(token) }
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

Norte automatically generates "intelligent" OpenAPI 3.0 specifications with cache invalidation hints:

```typescript
const app = new Norte({
  openapi: {
    title: 'My API',
    version: '1.0.0',
    description: 'My API description',
    servers: [
      { url: 'http://localhost:3000', description: 'Development' },
      { url: 'https://api.example.com', description: 'Production' }
    ]
  }
})

// OpenAPI is automatically available at:
// GET http://localhost:3000/openapi.json
```

### Smart Cache Invalidation

Norte adds intelligent hints to the OpenAPI spec for automatic cache invalidation:

```typescript
// POST /v1/users includes:
{
  "x-norte-invalidates": ["GET /v1/users"],  // Invalidate user list
  "x-norte-domain": "users",
  "x-norte-version": 1
}
```

These hints will be used by the future Norte CLI to generate type-safe clients with automatic cache invalidation.

**📖 Full OpenAPI documentation: [OPENAPI.md](./OPENAPI.md)**

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