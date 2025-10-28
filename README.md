# Norte

A modern, type-safe API framework that simplifies building production-ready REST APIs with automatic OpenAPI documentation and CRUD operations.

## ✨ Features

- 🚀 **Fast Development** - Build APIs with minimal boilerplate
- 📚 **Auto Documentation** - Automatic OpenAPI/Swagger generation with Scalar UI
- 🛡️ **Type Safety** - Full TypeScript support with Zod validation
- 🔧 **CRUD Made Easy** - Chainable methods for common operations
- ⚡ **High Performance** - Built on top of Hono for maximum speed
- 🎯 **Opinionated** - Sensible defaults that just work
- 🔄 **Error Handling** - Built-in NorteError system with proper HTTP status codes

## 🚀 Quick Start

### Installation

```bash
bun add norte
# or
npm install norte
# or
yarn add norte
# or
pnpm add norte
```

### Basic Usage

```typescript
import { Norte, Router, z, NorteError } from 'norte'

// 1. Create your main app
const app = new Norte({
  title: 'My API',
  version: '1.0.0'
})

// 2. Define your response schema
const selectSchema = z.object({
  id: z.string().cuid2(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().min(18),
  createdAt: z.date()
})

const insertSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().min(18)
})

// 3. Create a router with CRUD operations using domain-driven approach
const userRouter = new Router('users', { schema: selectSchema })
  .list(async () => {
    return await getUsersFromDB()
  })
  .create({ input: insertSchema }, async ({ input }) => {
    return await createUser(input)
  })
  .read(async ({ param }) => {
    const foundUser = await getUserById(param.userId)
    if (!foundUser) {
      return new NorteError('NOT_FOUND', 'User not found')
    }
    return foundUser
  })
  .update(
    { input: insertSchema.partial() },
    async ({ input, param }) => {
      const updatedUser = await updateUser(param.userId, input)
      if (!updatedUser) {
        return new NorteError('NOT_FOUND', 'User not found')
      }
      return updatedUser
    }
  )
  .delete(async ({ param }) => {
    const deleted = await deleteUser(param.userId)
    if (!deleted) {
      return new NorteError('NOT_FOUND', 'User not found')
    }
  })

// 4. Register the router
app.register(userRouter)

// 5. Export for your runtime
export default app
```

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

- `app.middleware(...middlewares)` - Add Hono middleware
- `app.register(router)` - Register a Router instance
- `app.fetch` - The fetch handler for your runtime (with proxy support)

### Router Class

Domain-driven API for creating CRUD operations with automatic OpenAPI documentation.

```typescript
// Root domain
const router = new Router(domain: string, config: {
  schema: ZodSchema    // Response data schema
})

// Nested domain
const router = new Router(parent: Router, domain: string, config: {
  schema: ZodSchema
})
```

#### Domain-Driven Design

Norte uses domain names to automatically generate paths, parameters, and OpenAPI tags:

```typescript
// Domain: 'stores' -> generates /stores, parameter 'storeId', and OpenAPI tag 'Stores'
const storeRouter = new Router('stores', {
  schema: storeSchema
})

// Domain: 'products' nested under stores -> generates /stores/:storeId/products and tag 'Products'
const productsRouter = new Router(storeRouter, 'products', {
  schema: productSchema
})

// Domain: 'variants' nested under products -> generates /stores/:storeId/products/:productId/variants and tag 'Variants'
const variantsRouter = new Router(productsRouter, 'variants', {
  schema: variantSchema
})
```

#### Auto-Generated Routes

Each domain automatically generates RESTful routes and OpenAPI tags:

| Domain | Generated Routes | OpenAPI Tag |
|--------|------------------|-------------|
| `stores` | `GET /stores`, `POST /stores`, `GET /stores/:id`, `PUT /stores/:id`, `DELETE /stores/:id` | `Stores` |
| `products` (nested) | `GET /stores/:storeId/products`, `POST /stores/:storeId/products`, etc. | `Products` |
| `variants` (nested) | `GET /stores/:storeId/products/:productId/variants`, etc. | `Variants` |

#### Parameter Auto-Generation

Parameters and OpenAPI tags are automatically generated from domain names:

```typescript
// Domain transformations:
'stores' -> 'storeId' (parameter) + 'Stores' (OpenAPI tag)
'products' -> 'productId' (parameter) + 'Products' (OpenAPI tag)
'categories' -> 'categoryId' (parameter) + 'Categories' (OpenAPI tag)
'variants' -> 'variantId' (parameter) + 'Variants' (OpenAPI tag)

// Handlers automatically receive all parent parameters + current domain parameter
variantsRouter.read(async ({ param }) => {
  // param contains: { storeId, productId, variantId }
  const variant = await getVariant(param.variantId, param.productId, param.storeId)
  return variant
})
```

#### CRUD Methods

Each method is chainable and generates the appropriate OpenAPI route:

**List Resources**
```typescript
// Simple usage
.list(handler: ListHandler)

// With configuration
.list(config: RouteCommonConfig, handler: ListHandler)
```

**Create Resource**
```typescript
.create(
  config: RouteCommonConfig & { input: ZodSchema },
  handler: InsertHandler
)
```

**Read Resource**
```typescript
// Simple usage
.read(handler: ReadHandler)

// With configuration
.read(config: RouteCommonConfig, handler: ReadHandler)
```

**Update Resource**
```typescript
.update(
  config: RouteCommonConfig & { input: ZodSchema },
  handler: UpdateHandler
)
```

**Delete Resource**
```typescript
// Simple usage
.delete(handler: DeleteHandler)

// With configuration
.delete(config: RouteCommonConfig, handler: DeleteHandler)
```

#### Handler Types

```typescript
type HandlerResult<T> = Promise<T | NorteError> | T | NorteError

type HandlerContext<
  TParams extends Record<string, string> = Record<string, never>,
> = {
  param: TParams
  request: NorteRequest
}

type ListHandler<
  TResponse extends ZodSchema,
  TParams extends Record<string, string>,
> = (c: HandlerContext<TParams>) => HandlerResult<z.infer<TResponse>[]>

type InsertHandler<
  TInput extends ZodSchema,
  TResponse extends ZodSchema,
  TParams extends Record<string, string>,
> = (
  c: HandlerContext<TParams> & { input: z.infer<TInput> },
) => HandlerResult<z.infer<TResponse>>

type ReadHandler<
  TResponse extends ZodSchema,
  TParams extends Record<string, string>,
> = (c: HandlerContext<TParams>) => HandlerResult<z.infer<TResponse>>

type UpdateHandler<
  TInput extends ZodSchema,
  TResponse extends ZodSchema,
  TParams extends Record<string, string>,
> = (
  c: HandlerContext<TParams> & { input: z.infer<TInput> },
) => HandlerResult<z.infer<TResponse>>

type DeleteHandler<TParams extends Record<string, string>> = (
  c: HandlerContext<TParams>,
) => HandlerResult<undefined>
```

#### Configuration Options

Routes can be configured with input schemas for validation.

## 🏗️ Nested Domains

Create nested resource hierarchies using domain-driven design:

### Basic Nested Domains

```typescript
import { Router, z, NorteError } from 'norte'

// Root domain
const storeRouter = new Router('stores', {
  schema: storeSchema
})
  .list(async () => {
    const stores = await getStores()
    return stores
  })

// Nested domain - parent as first argument
const productsRouter = new Router(storeRouter, 'products', {
  schema: productSchema
})
  .list(async ({ param }) => {
    // param.storeId is automatically available from parent domain
    const products = await getProductsByStore(param.storeId)
    return products
  })
  .read(async ({ param }) => {
    // param contains both storeId and productId
    const product = await getProductById(param.productId, param.storeId)
    return product || new NorteError('NOT_FOUND', 'Product not found')
  })

// Register both routers
app.register(storeRouter)
app.register(productsRouter)
```

### Deep Domain Nesting

```typescript
// Four-level domain hierarchy
const storeRouter = new Router('stores', { 
  schema: storeSchema 
})

const productsRouter = new Router(storeRouter, 'products', { 
  schema: productSchema 
})

const variantsRouter = new Router(productsRouter, 'variants', { 
  schema: variantSchema 
})

const optionsRouter = new Router(variantsRouter, 'options', { 
  schema: optionSchema 
})

// Final routes: /stores/:storeId/products/:productId/variants/:variantId/options
// Handler receives: { storeId, productId, variantId, id }
```



### Domain Constructor Patterns

```typescript
// Root domain
new Router(domain: string, config: RouterConfig)

// Nested domain  
new Router(parent: Router, domain: string, config: RouterConfig)
```

**Note**: The `name` attribute is no longer needed in the config. OpenAPI tags and route names are automatically generated from the domain name (e.g., `'stores'` becomes `'Stores'`).

### Parameter Inheritance

Nested routers automatically inherit all parameters from their parent chain:

```typescript
// For nested domain: pharmacies -> categories -> products -> variants
interface NestedParams {
  pharmacyId: string    // From parent 'pharmacies' domain
  categoryId: string    // From parent 'categories' domain  
  productId: string     // From parent 'products' domain
  variantId: string     // From current 'variants' domain
}

// All parameters are automatically validated as CUID2 strings
const paramSchema = z.object({
  pharmacyId: z.string().cuid2(),
  categoryId: z.string().cuid2(),
  productId: z.string().cuid2(),
  variantId: z.string().cuid2()
})
```

## 🚨 Error Handling

Norte includes a comprehensive error system with the `NorteError` class:

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
router.read(async ({ param }) => {
  const user = await getUserById(param.userId)
  if (!user) {
    return new NorteError('NOT_FOUND', 'User not found', { userId: param.userId })
  }
  return user
})
```

## 📚 Documentation

Norte automatically generates interactive API documentation using Scalar:

- **Main docs**: Visit `/` for multi-source Scalar documentation
- **API docs**: Available at `/docs` (OpenAPI 3.1)
- **Health check**: Available at `/healthcheck`

The documentation includes:
- Automatic schema generation from Zod schemas
- Request/response examples
- Interactive API testing
- Error response formats

## 🛠️ Advanced Usage

### Custom Middleware

Norte comes with `logger` and `prettyJSON` middlewares configured by default. You can add any additional Hono middleware through the `middleware()` method:

```typescript
import { cors } from 'hono/cors'
import { compress } from 'hono/compress'

// Add CORS middleware
app.middleware(cors({
  origin: ['https://yourdomain.com'],
  credentials: true
}))

// Add compression middleware
app.middleware(compress())

// Custom middleware
app.middleware(async (c, next) => {
  console.log('Custom middleware executed')
  await next()
})
```

### Parameter Validation

All ID parameters are automatically validated as CUID2 strings:

```typescript
// Automatically validates param.userId as z.cuid2()
userRouter.read(async ({ param }) => {
  const { userId } = param // userId is guaranteed to be a valid CUID2
  // ...
})
```

### Response Format

All successful responses follow a consistent format:

```typescript
// List responses
{ "data": [...] }

// Single resource responses  
{ "data": {...} }

// Error responses
{ 
  "error": "ERROR_CODE",
  "message": "Human readable message",
  "details": {...} // Optional additional details
}
```

## 🎯 Examples

### Database Integration (Drizzle) with Domains

```typescript
import { eq } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'

const userResponseSchema = createSelectSchema(userTable)
const insertSchema = createInsertSchema(userTable).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
})

// Domain-driven router instead of path-based
const userRouter = new Router('users', {
  schema: userResponseSchema
})
  .list(async ({ user }) => {
    const users = await db.select().from(userTable).where(eq(userTable.tenantId, user.tenantId))
    return users
  })
  .create(
    { input: insertSchema },
    async ({ input, user }) => {
      const [newUser] = await db
        .insert(userTable)
        .values({ ...input, tenantId: user.tenantId })
        .returning()
      return newUser
    }
  )
  .read(async ({ param }) => {
    const [user] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, param.userId))
    
    if (!user) {
      return new NorteError('NOT_FOUND', 'User not found')
    }
    
    return user
  })
```

### Multi-Tenant Store Example

```typescript
// Store domain for multi-tenant architecture
const storeRouter = new Router('stores', {
  schema: storeSchema
})
  .list(async ({ user }) => {
    // Get stores for current tenant
    const stores = await db
      .select()
      .from(storeTable)
      .where(eq(storeTable.tenantId, user.tenantId))
    return stores
  })

// Orders nested under stores - generates /stores/:storeId/orders
const ordersRouter = new Router(storeRouter, 'orders', {
  schema: orderSchema
})
  .list(async ({ param, user }) => {
    // param.storeId automatically available with validation
    const orders = await db
      .select()
      .from(orderTable)
      .where(
        and(
          eq(orderTable.storeId, param.storeId),
          eq(orderTable.tenantId, user.tenantId) // Multi-tenant security
        )
      )
    return orders
  })

// Items nested under orders - generates /stores/:storeId/orders/:orderId/items
const orderItemsRouter = new Router(ordersRouter, 'items', {
  schema: orderItemSchema
})
  .list(async ({ param }) => {
    // param contains: { storeId, orderId }
    const items = await db
      .select()
      .from(orderItemTable)
      .where(eq(orderItemTable.orderId, param.orderId))
    return items
  })
```

### Validation with Custom Error Messages

```typescript
const createPostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
  published: z.boolean().default(false)
})

const postRouter = new Router('posts', {
  schema: postResponseSchema
})
  .create(
    { input: createPostSchema },
    async ({ input, user }) => {
      // Input is automatically validated against createPostSchema
      const post = await createPost({ ...input, authorId: user.id })
      return post
    }
  )
```

## 🤝 Contributing

We welcome contributions! Please see our contributing guide for details.

## 📄 License

MIT © Emerson Laurentino

## 🔗 Links

- [Hono](https://hono.dev)
- [Zod](https://zod.dev)
- [Scalar](https://scalar.com)
