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
    this.router = new OpenAPIHono()
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
  private createPath(includeId = false): string {
    const domainPath = `/${this.domain}${includeId ? `/:${this.getDomainParam()}` : ''}`
    if (this.parent) {
      const parentPath = this.parent.createPath()
      const parentParam = this.parent.getDomainParam()
      return `${parentPath}/:${parentParam}${domainPath}`
    }
    return domainPath
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
   * Get parameter schema based on whether the route includes the current domain ID
   * @param includeCurrentId - Whether to include the current domain's ID parameter
   */
  private getParameterSchema(includeCurrentId = false) {
    const parentParams = this.getParentParams()
    const allParams = includeCurrentId
      ? [...parentParams, this.getDomainParam()]
      : parentParams

    if (allParams.length === 0) {
      return undefined
    }

    return z.object(
      Object.fromEntries(
        allParams.map((param) => [param, z.string()]),
      ) as Record<(typeof allParams)[number], z.ZodString>,
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

  private getOperationConfig(
    operation: 'list' | 'create' | 'read' | 'update' | 'delete',
  ) {
    const configs = {
      list: {
        method: 'get',
        includeId: false,
        status: 200,
        hasData: true,
        hasCommonErrors: true,
      },
      create: {
        method: 'post',
        includeId: false,
        status: 201,
        hasData: true,
        hasCommonErrors: true,
      },
      read: {
        method: 'get',
        includeId: true,
        status: 200,
        hasData: true,
        hasCommonErrors: false,
      },
      update: {
        method: 'patch',
        includeId: true,
        status: 200,
        hasData: true,
        hasCommonErrors: true,
      },
      delete: {
        method: 'delete',
        includeId: true,
        status: 204,
        hasData: false,
        hasCommonErrors: false,
      },
    }
    return configs[operation]
  }

  private buildRequestObject(
    includeId: boolean,
    hasInput: boolean,
    config: RouteCommonConfig & { input?: ZodSchema },
  ) {
    // biome-ignore lint/suspicious/noExplicitAny: Required for Hono route configuration
    const request: any = {}

    // Always include parameters if there are any (parent params or current id)
    const paramSchema = this.getParameterSchema(includeId)
    if (paramSchema) {
      request.params = paramSchema
    }

    if (hasInput && config.input) {
      request.body = {
        content: { 'application/json': { schema: config.input } },
      }
    }

    return Object.keys(request).length > 0 ? request : undefined
  }

  private buildSuccessResponse(
    operation: 'list' | 'create' | 'read' | 'update' | 'delete',
    status: number,
    hasData: boolean,
  ) {
    const descriptions: Record<typeof operation, string> = {
      list: `List of ${this.name.toLowerCase()}`,
      read: `${this.getSingularName()} details`,
      create: `${this.getSingularName()} created successfully`,
      update: `${this.getSingularName()} updated successfully`,
      delete: `${this.getSingularName()} deleted successfully`,
    }

    if (status === 204) {
      return { [status]: { description: descriptions[operation] } }
    }

    if (!hasData) return {}

    const dataSchema =
      operation === 'list'
        ? z.object({ data: z.array(this.schema) })
        : z.object({ data: this.schema })

    return {
      [status]: {
        description: descriptions[operation],
        content: { 'application/json': { schema: dataSchema } },
      },
    }
  }

  private buildErrorResponses(
    operation: 'list' | 'create' | 'read' | 'update' | 'delete',
    includeId: boolean,
    hasCommonErrors: boolean,
  ) {
    // biome-ignore lint/suspicious/noExplicitAny: Required for Hono route configuration
    const responses: any = {}

    if (hasCommonErrors && (operation === 'create' || operation === 'update')) {
      responses[400] = commonResponses[400]
      responses[403] = commonResponses[403]
      responses[409] = commonResponses[409]
    }

    if (includeId || hasCommonErrors) {
      responses[404] = commonResponses[404]
    }

    return responses
  }

  private createDefinition(
    operation: 'list' | 'create' | 'read' | 'update' | 'delete',
    config: RouteCommonConfig & { input?: ZodSchema },
  ) {
    const opConfig = this.getOperationConfig(operation)
    const hasInput = Boolean(
      config.input &&
        (opConfig.method === 'post' || opConfig.method === 'patch'),
    )

    const request = this.buildRequestObject(
      opConfig.includeId,
      hasInput,
      config,
    )
    const successResponse = this.buildSuccessResponse(
      operation,
      opConfig.status,
      opConfig.hasData,
    )
    const errorResponses = this.buildErrorResponses(
      operation,
      opConfig.includeId,
      opConfig.hasCommonErrors,
    )

    const summaries = {
      list: `Get all ${this.name.toLowerCase()}`,
      read: `Get a ${this.getSingularName()} by ID`,
      create: `Create a new ${this.getSingularName()}`,
      update: `Update a ${this.getSingularName()}`,
      delete: `Delete a ${this.getSingularName()}`,
    }

    const routeConfig: RouteConfig = {
      // biome-ignore lint/suspicious/noExplicitAny: Required for Hono method type compatibility
      method: opConfig.method as any,
      path: this.createPath(opConfig.includeId),
      summary: summaries[operation],
      request,
      responses: {
        ...successResponse,
        ...errorResponses,
        401: commonResponses[401],
        500: commonResponses[500],
      },
    }

    return createRoute({
      ...routeConfig,
      ...(config.isPublic ? {} : { middleware: [this.privateMiddleware()] }),
      tags: [this.name],
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
