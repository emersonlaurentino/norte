import { createRoute, OpenAPIHono, type RouteConfig } from '@hono/zod-openapi'
import type { Session, User } from 'better-auth'
import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { z } from 'zod'
import { NorteError } from './error'
import { commonResponses } from './utils'

// Converts 'stores' -> 'store' | 'categories' -> 'category'
type Singular<T extends string> = T extends `${infer P}ies`
  ? `${P}y`
  : T extends `${infer P}s`
    ? P
    : T

type DomainToParamName<D extends string> = `${Singular<D>}Id`

type DomainToParam<D extends string> = {
  [K in DomainToParamName<D>]: string
}

type ZodSchema = z.ZodTypeAny

interface RouterConfig<TResponse extends ZodSchema> {
  schema: TResponse
}

interface RouteCommonConfig {
  isPublic?: boolean
}

type HandlerContext<
  TParams extends Record<string, string> = Record<string, never>,
> = {
  session: Session | null
  user: User | null
  param: TParams
}

// Simplified handler types
type HandlerResult<T> = Promise<T | NorteError> | T | NorteError

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

type UpdateHandler<
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

type DeleteHandler<TParams extends Record<string, string>> = (
  c: HandlerContext<TParams>,
) => HandlerResult<undefined>

export class Router<
  TResponse extends ZodSchema,
  TDomain extends string,
  TCollectionParams extends Record<string, string> = Record<string, never>,
  TItemParams extends Record<string, string> = TCollectionParams &
    DomainToParam<TDomain>,
> {
  private name: string
  private domain: TDomain
  private path: string
  private schema: TResponse
  private router: OpenAPIHono
  // biome-ignore lint/suspicious/noExplicitAny: Needed for complex nested router types
  private parent: Router<any, string, any, any> | null = null

  // Constructor overloads
  constructor(domain: TDomain, config: RouterConfig<TResponse>)
  constructor(
    // biome-ignore lint/suspicious/noExplicitAny: Needed for complex nested router types
    parent: Router<any, string, any, TCollectionParams>,
    domain: TDomain,
    config: RouterConfig<TResponse>,
  )
  constructor(
    // biome-ignore lint/suspicious/noExplicitAny: Needed for complex nested router types
    domainOrParent: TDomain | Router<any, string, any, TCollectionParams>,
    domainOrConfig?: string | RouterConfig<TResponse>,
    config?: RouterConfig<TResponse>,
  ) {
    if (typeof domainOrParent === 'string') {
      // Root router: new Router('stores', config)
      this.domain = domainOrParent
      this.schema = (domainOrConfig as RouterConfig<TResponse>).schema
    } else {
      // Nested router: new Router(parent, 'products', config)
      // biome-ignore lint/suspicious/noExplicitAny: Needed for complex nested router types
      this.parent = domainOrParent as any
      this.domain = domainOrConfig as TDomain
      this.schema = config?.schema as TResponse
    }

    // Generate name from domain (capitalize first letter)
    this.name = this.domain.charAt(0).toUpperCase() + this.domain.slice(1)
    this.path = this.getFullPath()
    this.router = new OpenAPIHono()
  }

  /**
   * Generate path from domain
   * 'stores' -> '/stores'
   */
  private getDomainPath(): string {
    return `/${this.domain}`
  }

  /**
   * Generate parameter name from domain
   * 'stores' -> 'storeId'
   * 'products' -> 'productId'
   * 'categories' -> 'categoryId'
   */
  private getDomainParam(): string {
    // Handle plural to singular conversion
    const singular = this.domain.endsWith('ies')
      ? `${this.domain.slice(0, -3)}y` // categories -> category
      : this.domain.endsWith('s')
        ? this.domain.slice(0, -1) // stores -> store
        : this.domain // product -> product
    return `${singular}Id`
  }

  /**
   * Get full path including parent paths and auto-generated params
   * stores -> /stores
   * stores/products -> /stores/:storeId/products
   * stores/products/variants -> /stores/:storeId/products/:productId/variants
   */
  private getFullPath(): string {
    if (!this.parent) return this.getDomainPath()
    const parentPath = this.parent.getFullPath()
    const parentParam = this.parent.getDomainParam()
    return `${parentPath}/:${parentParam}${this.getDomainPath()}`
  }

  /**
   * Get all parameter names from parent chain
   */
  private getParentParams(): string[] {
    const params: string[] = []
    let current = this.parent
    while (current) {
      params.unshift(current.getDomainParam())
      current = current.parent
    }
    return params
  }

  /**
   * Get parameter schema including parent parameters
   */
  private getParameterSchema() {
    const parentParams = this.getParentParams()
    return z.object(
      parentParams.reduce(
        (acc, param) => {
          acc[param] = z.string()
          return acc
        },
        {} as Record<string, z.ZodString>,
      ),
    )
  }

  /**
   * Get parameter schema for routes that include current domain ID
   * Used for read, update, delete operations
   */
  private getParamSchema() {
    const allParams = [...this.getParentParams(), this.getDomainParam()]
    return z.object(
      Object.fromEntries(allParams.map((k) => [k, z.string()])) as Record<
        (typeof allParams)[number],
        z.ZodString
      >,
    )
  }

  // Internal method - only accessible by Route class
  private getRouter() {
    return this.router
  }

  // Friend access method for Route class
  public static getRouterForRoute<
    TResponse extends ZodSchema,
    TDomain extends string,
    TCollectionParams extends Record<string, string>,
  >(router: Router<TResponse, TDomain, TCollectionParams>) {
    return router.getRouter()
  }

  private privateMiddleware() {
    return createMiddleware(async (c, next) => {
      const session = c.get('session')
      if (!session) return c.json({ error: 'UNAUTHORIZED' }, 401)
      return next()
    })
  }

  private getSingularName() {
    const lowercaseName = this.name.toLowerCase()
    if (lowercaseName.endsWith('s') && lowercaseName.length > 1) {
      return lowercaseName.slice(0, -1)
    }
    return lowercaseName
  }

  // Helper methods to reduce duplication
  private resolveHandlerArgs<T>(
    configOrHandler: RouteCommonConfig | T,
    handler?: T,
  ): { config: RouteCommonConfig; actualHandler: T } {
    if (typeof configOrHandler === 'function') {
      return { config: {}, actualHandler: configOrHandler as T }
    }
    return {
      config: configOrHandler as RouteCommonConfig,
      actualHandler: handler as T,
    }
  }

  private createErrorResponse(c: Context, error: NorteError) {
    return c.json(
      { error: error.code, message: error.message, details: error.details },
      error.statusCode,
    )
  }

  private handleError(c: Context, error: unknown) {
    if (error instanceof NorteError) return this.createErrorResponse(c, error)
    if (error instanceof Error) {
      return c.json(
        { error: 'INTERNAL_SERVER_ERROR', details: error.message },
        500,
      )
    }
    return c.json({ error: 'INTERNAL_SERVER_ERROR' }, 500)
  }

  /**
   * Safely validate data with the schema, providing better error handling
   * for drizzle-zod schemas
   */
  private validateSchema(
    data: unknown,
  ):
    | { success: true; data: z.infer<TResponse> }
    | { success: false; error: z.ZodError } {
    try {
      // First try to parse with the schema
      const result = this.schema.safeParse(data)
      if (result.success) {
        return { success: true, data: result.data }
      }
      return { success: false, error: result.error }
    } catch {
      // Fallback for schemas that might not have safeParse method correctly implemented
      try {
        const parsedData = this.schema.parse(data)
        return { success: true, data: parsedData }
      } catch (parseError) {
        if (parseError instanceof z.ZodError) {
          return { success: false, error: parseError }
        }
        // Create a generic ZodError if it's not a ZodError
        return {
          success: false,
          error: new z.ZodError([
            {
              code: 'custom',
              message: 'Schema validation failed',
              path: [],
              input: data,
            },
          ]),
        }
      }
    }
  }

  private createDefinition(
    operation: 'list' | 'create' | 'read' | 'update' | 'delete',
    config: RouteCommonConfig & { input?: ZodSchema },
  ) {
    // Map operations to HTTP methods and configurations
    const operationConfig = {
      list: {
        method: 'get' as const,
        includeId: false,
        successStatus: 200 as const,
        includeDataResponse: true,
        includeCommonErrors: true,
      },
      create: {
        method: 'post' as const,
        includeId: false,
        successStatus: 201 as const,
        includeDataResponse: true,
        includeCommonErrors: true,
      },
      read: {
        method: 'get' as const,
        includeId: true,
        successStatus: 200 as const,
        includeDataResponse: true,
        includeCommonErrors: false, // Only 404 for read
      },
      update: {
        method: 'patch' as const,
        includeId: true,
        successStatus: 200 as const,
        includeDataResponse: true,
        includeCommonErrors: true,
      },
      delete: {
        method: 'delete' as const,
        includeId: true,
        successStatus: 204 as const,
        includeDataResponse: false,
        includeCommonErrors: false, // Only 404 for delete
      },
    }
    const {
      method,
      includeId,
      successStatus,
      includeDataResponse,
      includeCommonErrors,
    } = operationConfig[operation]
    const path = includeId
      ? `${this.path}/:${this.getDomainParam()}`
      : this.path
    const parentParams = this.getParentParams()
    const hasParentParams = parentParams.length > 0
    // Build request object
    // biome-ignore lint/suspicious/noExplicitAny: Required for Hono route configuration
    const request: any = {}
    // Add params if needed
    if (includeId || hasParentParams) {
      request.params = includeId
        ? this.getParamSchema()
        : this.getParameterSchema()
    }
    // Add body for methods that need input
    if (config.input && (method === 'post' || method === 'patch')) {
      request.body = {
        content: {
          'application/json': { schema: config.input },
        },
      }
    }
    // Build responses
    // biome-ignore lint/suspicious/noExplicitAny: Required for Hono route configuration
    const responses: any = {}
    // Success response
    if (successStatus === 204) {
      responses[204] = {
        description: `${this.getSingularName()} deleted successfully`,
      }
    } else {
      const description =
        operation === 'list'
          ? `List of ${this.name.toLowerCase()}`
          : operation === 'read'
            ? `${this.getSingularName()} details`
            : operation === 'create'
              ? `${this.getSingularName()} created successfully`
              : operation === 'update'
                ? `${this.getSingularName()} updated successfully`
                : 'Operation completed successfully'
      if (includeDataResponse) {
        const dataSchema =
          operation === 'list'
            ? z.object({ data: z.array(this.schema) })
            : z.object({ data: this.schema })
        responses[successStatus] = {
          description,
          content: {
            'application/json': { schema: dataSchema },
          },
        }
      }
    }
    // Add common error responses
    if (includeCommonErrors) {
      if (operation === 'create' || operation === 'update') {
        responses[400] = commonResponses[400]
        responses[403] = commonResponses[403]
        responses[409] = commonResponses[409]
      }
    }
    // Always add 404 for routes that might not find resources
    if (includeId || includeCommonErrors) {
      responses[404] = commonResponses[404]
    }
    // Build summary
    const summary =
      operation === 'list'
        ? `Get all ${this.name.toLowerCase()}`
        : operation === 'read'
          ? `Get a ${this.getSingularName()} by ID`
          : operation === 'create'
            ? `Create a new ${this.getSingularName()}`
            : operation === 'update'
              ? `Update a ${this.getSingularName()}`
              : operation === 'delete'
                ? `Delete a ${this.getSingularName()}`
                : 'Operation'
    const routeConfig: RouteConfig = {
      // biome-ignore lint/suspicious/noExplicitAny: Required for Hono method type compatibility
      method: method as any,
      path,
      summary,
      request: Object.keys(request).length > 0 ? request : undefined,
      responses,
    }
    return createRoute({
      ...routeConfig,
      ...(config.isPublic ? {} : { middleware: [this.privateMiddleware()] }),
      tags: [this.name],
      responses: {
        ...responses,
        401: commonResponses[401],
        500: commonResponses[500],
      },
    })
  }

  public list(
    handler: ListHandler<TResponse, TCollectionParams & DomainToParam<TDomain>>,
  ): this
  public list(
    config: RouteCommonConfig,
    handler: ListHandler<TResponse, TCollectionParams & DomainToParam<TDomain>>,
  ): this
  public list(
    configOrHandler:
      | RouteCommonConfig
      | ListHandler<TResponse, TCollectionParams & DomainToParam<TDomain>>,
    handler?: ListHandler<
      TResponse,
      TCollectionParams & DomainToParam<TDomain>
    >,
  ): this {
    const { config, actualHandler } = this.resolveHandlerArgs(
      configOrHandler,
      handler,
    )
    const definition = this.createDefinition('list', config)
    // biome-ignore lint/suspicious/noExplicitAny: Bypass complex Hono typing
    this.router.openapi(definition, async (c: any) => {
      try {
        const result = await actualHandler({
          session: c.get('session'),
          user: c.get('user'),
          param: c.req.valid('param') as TCollectionParams &
            DomainToParam<TDomain>,
        })
        if (result instanceof NorteError) {
          return this.createErrorResponse(c, result)
        }
        const validatedData = z.array(this.schema).safeParse(result)
        if (!validatedData.success) {
          return c.json(
            { error: 'INVALID_DATA', details: validatedData.error },
            400,
          )
        }
        return c.json({ data: validatedData.data }, 200)
      } catch (error) {
        return this.handleError(c, error)
      }
    })
    return this
  }

  public create<TInput extends ZodSchema>(
    config: RouteCommonConfig & { input: TInput },
    handler: InsertHandler<
      TInput,
      TResponse,
      TCollectionParams & DomainToParam<TDomain>
    >,
  ) {
    const definition = this.createDefinition('create', config)
    // biome-ignore lint/suspicious/noExplicitAny: Bypass complex Hono typing
    this.router.openapi(definition, async (c: any) => {
      try {
        const input = c.req.valid('json')
        const validatedInput = config.input.safeParse(input)
        if (!validatedInput.success) {
          return c.json(
            { error: 'INVALID_INPUT', details: validatedInput.error },
            400,
          )
        }
        const result = await handler({
          session: c.get('session'),
          user: c.get('user'),
          input: validatedInput.data,
          param: c.req.valid('param'),
        })
        if (result instanceof NorteError) {
          return this.createErrorResponse(c, result)
        }
        const validatedData = this.validateSchema(result)
        if (!validatedData.success) {
          return c.json(
            { error: 'INVALID_DATA', details: validatedData.error },
            400,
          )
        }
        return c.json({ data: validatedData.data }, 201)
      } catch (error) {
        return this.handleError(c, error)
      }
    })
    return this
  }

  public update<TInput extends ZodSchema>(
    config: RouteCommonConfig & { input: TInput },
    handler: UpdateHandler<TInput, TResponse, TItemParams>,
  ) {
    const definition = this.createDefinition('update', config)
    // biome-ignore lint/suspicious/noExplicitAny: Bypass complex Hono typing
    this.router.openapi(definition, async (c: any) => {
      try {
        const input = c.req.valid('json')
        const validatedInput = config.input.safeParse(input)
        if (!validatedInput.success) {
          return c.json(
            { error: 'INVALID_INPUT', details: validatedInput.error },
            400,
          )
        }
        const result = await handler({
          session: c.get('session'),
          user: c.get('user'),
          input: validatedInput.data,
          param: c.req.valid('param') as TItemParams,
        })
        if (result instanceof NorteError) {
          return this.createErrorResponse(c, result)
        }
        const validatedData = this.validateSchema(result)
        if (!validatedData.success) {
          return c.json(
            { error: 'INVALID_DATA', details: validatedData.error },
            400,
          )
        }
        return c.json({ data: validatedData.data }, 200)
      } catch (error) {
        return this.handleError(c, error)
      }
    })
    return this
  }

  public read(handler: ReadHandler<TResponse, TItemParams>): this
  public read(
    config: RouteCommonConfig,
    handler: ReadHandler<TResponse, TItemParams>,
  ): this
  public read(
    configOrHandler: RouteCommonConfig | ReadHandler<TResponse, TItemParams>,
    handler?: ReadHandler<TResponse, TItemParams>,
  ): this {
    const { config, actualHandler } = this.resolveHandlerArgs(
      configOrHandler,
      handler,
    )
    const definition = this.createDefinition('read', config)
    // biome-ignore lint/suspicious/noExplicitAny: Bypass complex Hono typing
    this.router.openapi(definition, async (c: any) => {
      try {
        const result = await actualHandler({
          session: c.get('session'),
          user: c.get('user'),
          param: c.req.valid('param') as TItemParams,
        })
        if (result instanceof NorteError) {
          return this.createErrorResponse(c, result)
        }
        const validatedData = this.validateSchema(result)
        if (!validatedData.success) {
          return c.json(
            { error: 'INVALID_DATA', details: validatedData.error },
            400,
          )
        }
        return c.json({ data: validatedData.data }, 200)
      } catch (error) {
        return this.handleError(c, error)
      }
    })
    return this
  }

  public delete(handler: DeleteHandler<TItemParams>): this
  public delete(
    config: RouteCommonConfig,
    handler: DeleteHandler<TItemParams>,
  ): this
  public delete(
    configOrHandler: RouteCommonConfig | DeleteHandler<TItemParams>,
    handler?: DeleteHandler<TItemParams>,
  ): this {
    const { config, actualHandler } = this.resolveHandlerArgs(
      configOrHandler,
      handler,
    )
    const definition = this.createDefinition('delete', config)
    // biome-ignore lint/suspicious/noExplicitAny: Bypass complex Hono typing
    this.router.openapi(definition, async (c: any) => {
      try {
        const result = await actualHandler({
          session: c.get('session'),
          user: c.get('user'),
          param: c.req.valid('param') as TItemParams,
        })
        if (result instanceof NorteError) {
          return this.createErrorResponse(c, result)
        }
        return c.body(null, 204)
      } catch (error) {
        return this.handleError(c, error)
      }
    })
    return this
  }
}
