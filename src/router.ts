import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { Session, User } from 'better-auth'
import { createMiddleware } from 'hono/factory'
import { z } from 'zod'
import { NorteError } from './error'

type ZodSchema = z.ZodTypeAny

interface RouterConfig<TResponse extends ZodSchema> {
  schema: TResponse
}

interface RouteCommonConfig {
  isPublic?: boolean
}

type HandlerContext = {
  session: Session | null
  user: User | null
}

// Simplified handler types
type HandlerResult<T> = Promise<T | NorteError> | T | NorteError

type ListHandler<TResponse extends ZodSchema> = (
  c: HandlerContext & { param: Record<string, string> },
) => HandlerResult<z.infer<TResponse>[]>

type InsertHandler<TInput extends ZodSchema, TResponse extends ZodSchema> = (
  c: HandlerContext & { input: z.infer<TInput>; param: Record<string, string> },
) => HandlerResult<z.infer<TResponse>>

type UpdateHandler<TInput extends ZodSchema, TResponse extends ZodSchema> = (
  c: HandlerContext & { input: z.infer<TInput>; param: Record<string, string> },
) => HandlerResult<z.infer<TResponse>>

type ReadHandler<TResponse extends ZodSchema> = (
  c: HandlerContext & { param: Record<string, string> },
) => HandlerResult<z.infer<TResponse>>

type DeleteHandler = (
  c: HandlerContext & { param: Record<string, string> },
) => HandlerResult<undefined>

export class Router<TResponse extends ZodSchema> {
  private name: string
  private domain: string
  private path: string
  private schema: TResponse
  private router: OpenAPIHono
  private parent: Router<ZodSchema> | null = null

  // Constructor overloads
  constructor(domain: string, config: RouterConfig<TResponse>)
  constructor(
    parent: Router<ZodSchema>,
    domain: string,
    config: RouterConfig<TResponse>,
  )
  constructor(
    domainOrParent: string | Router<ZodSchema>,
    domainOrConfig: string | RouterConfig<TResponse>,
    config?: RouterConfig<TResponse>,
  ) {
    if (typeof domainOrParent === 'string') {
      // Root router: new Router('stores', config)
      this.domain = domainOrParent
      this.schema = (domainOrConfig as RouterConfig<TResponse>).schema
    } else {
      // Nested router: new Router(parent, 'products', config)
      this.parent = domainOrParent
      this.domain = domainOrConfig as string
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
    if (!this.parent) {
      return this.getDomainPath()
    }

    const parentPath = this.parent.getFullPath()
    const parentParam = this.parent.getDomainParam()
    return `${parentPath}/:${parentParam}${this.getDomainPath()}`
  }

  /**
   * Get all parameter names from parent chain
   */
  private getParentParams(): string[] {
    const params: string[] = []

    let current: Router<ZodSchema> | null = this.parent
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
          acc[param] = z.string().cuid2()
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
  private getParameterSchemaWithId() {
    const parentParams = this.getParentParams()
    const currentParam = this.getDomainParam()
    const allParams = [...parentParams, currentParam]

    return z.object(
      allParams.reduce(
        (acc, param) => {
          acc[param] = z.string().cuid2()
          return acc
        },
        {} as Record<string, z.ZodString>,
      ),
    )
  }

  // Internal method - only accessible by Route class
  private getRouter() {
    return this.router
  }

  // Friend access method for Route class
  public static getRouterForRoute<TResponse extends ZodSchema>(
    router: Router<TResponse>,
  ) {
    return router.getRouter()
  }

  private privateFields() {
    return {
      middleware: [this.privateMiddleware()],
    }
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

  private extractParameters(
    // biome-ignore lint/suspicious/noExplicitAny: Hono context typing
    c: any,
    includeCurrentId = false,
  ): Record<string, string> {
    const parentParams = this.getParentParams()
    const allParamNames = includeCurrentId
      ? [...parentParams, this.getDomainParam()]
      : parentParams

    const param: Record<string, string> = {}
    for (const paramName of allParamNames) {
      const value = c.req.param(paramName)
      if (value) {
        param[paramName] = value
      }
    }
    return param
  }

  private createErrorResponse(error: NorteError) {
    const response: { error: string; message: string; details?: unknown } = {
      error: error.code,
      message: error.message,
    }
    if (error.details) {
      response.details = error.details
    }
    return response
  }

  // biome-ignore lint/suspicious/noExplicitAny: Hono context typing
  private handleError(c: any, error: unknown) {
    if (error instanceof NorteError) {
      return c.json(this.createErrorResponse(error), error.statusCode)
    }
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

  private listDefinition(config: RouteCommonConfig) {
    const parentParams = this.getParentParams()
    const hasParentParams = parentParams.length > 0

    return createRoute({
      method: 'get',
      path: this.path,
      tags: [this.name],
      summary: `Get all ${this.name.toLowerCase()}`,
      ...(config.isPublic ? {} : this.privateFields()),
      ...(hasParentParams
        ? {
            request: {
              params: this.getParameterSchema(),
            },
          }
        : {}),
      responses: {
        200: {
          description: `List of ${this.name.toLowerCase()}`,
          content: {
            'application/json': {
              schema: z.object({
                data: z.array(this.schema),
              }),
            },
          },
        },
        400: commonResponses[400],
        401: commonResponses[401],
        403: commonResponses[403],
        404: commonResponses[404],
        409: commonResponses[409],
        500: commonResponses[500],
      },
    })
  }

  private createDefinition(config: RouteCommonConfig & { input: ZodSchema }) {
    const parentParams = this.getParentParams()
    const hasParentParams = parentParams.length > 0

    return createRoute({
      method: 'post',
      path: this.path,
      tags: [this.name],
      summary: `Create a new ${this.getSingularName()}`,
      ...(config.isPublic ? {} : this.privateFields()),
      request: {
        ...(hasParentParams
          ? {
              params: this.getParameterSchema(),
            }
          : {}),
        body: {
          content: {
            'application/json': { schema: config.input },
          },
        },
      },
      responses: {
        201: {
          description: `${this.getSingularName()} created successfully`,
          content: {
            'application/json': {
              schema: z.object({
                data: this.schema,
              }),
            },
          },
        },
        400: commonResponses[400],
        401: commonResponses[401],
        403: commonResponses[403],
        404: commonResponses[404],
        409: commonResponses[409],
        500: commonResponses[500],
      },
    })
  }

  private getUpdateRoute(config: RouteCommonConfig & { input: ZodSchema }) {
    return createRoute({
      method: 'patch',
      path: `${this.path}/:${this.getDomainParam()}`,
      tags: [this.name],
      summary: `Update a ${this.getSingularName()}`,
      ...(config.isPublic ? {} : this.privateFields()),
      request: {
        params: this.getParameterSchemaWithId(),
        body: {
          content: {
            'application/json': {
              schema: config.input,
            },
          },
        },
      },
      responses: {
        200: {
          description: `${this.getSingularName()} updated successfully`,
          content: {
            'application/json': {
              schema: z.object({
                data: this.schema,
              }),
            },
          },
        },
        400: commonResponses[400],
        401: commonResponses[401],
        403: commonResponses[403],
        404: commonResponses[404],
        409: commonResponses[409],
        500: commonResponses[500],
      },
    })
  }

  private getReadRoute(config: RouteCommonConfig) {
    return createRoute({
      method: 'get',
      path: `${this.path}/:${this.getDomainParam()}`,
      tags: [this.name],
      summary: `Get a ${this.getSingularName()} by ID`,
      ...(config.isPublic ? {} : this.privateFields()),
      request: {
        params: this.getParameterSchemaWithId(),
      },
      responses: {
        200: {
          description: `${this.getSingularName()} details`,
          content: {
            'application/json': {
              schema: z.object({
                data: this.schema,
              }),
            },
          },
        },
        401: commonResponses[401],
        404: commonResponses[404],
        500: commonResponses[500],
      },
    })
  }

  private getDeleteRoute(config: RouteCommonConfig) {
    return createRoute({
      method: 'delete',
      path: `${this.path}/:${this.getDomainParam()}`,
      tags: [this.name],
      summary: `Delete a ${this.getSingularName()}`,
      ...(config.isPublic ? {} : this.privateFields()),
      request: {
        params: this.getParameterSchemaWithId(),
      },
      responses: {
        204: {
          description: `${this.getSingularName()} deleted successfully`,
        },
        401: commonResponses[401],
        404: commonResponses[404],
        500: commonResponses[500],
      },
    })
  }

  public list(handler: ListHandler<TResponse>): this
  public list(config: RouteCommonConfig, handler: ListHandler<TResponse>): this
  public list(
    configOrHandler: RouteCommonConfig | ListHandler<TResponse>,
    handler?: ListHandler<TResponse>,
  ): this {
    const { config, actualHandler } = this.resolveHandlerArgs(
      configOrHandler,
      handler,
    )
    const definition = this.listDefinition(config)

    this.router.openapi(definition, async (c) => {
      try {
        const param = this.extractParameters(c)
        const result = await actualHandler({
          session: c.get('session'),
          user: c.get('user'),
          param,
        })

        if (result instanceof NorteError) {
          return c.json(this.createErrorResponse(result), result.statusCode)
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
    handler: InsertHandler<TInput, TResponse>,
  ) {
    const definition = this.createDefinition(config)

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

        const param = this.extractParameters(c)
        const result = await handler({
          session: c.get('session'),
          user: c.get('user'),
          input: validatedInput.data,
          param,
        })

        if (result instanceof NorteError) {
          return c.json(this.createErrorResponse(result), result.statusCode)
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
    handler: UpdateHandler<TInput, TResponse>,
  ) {
    const definition = this.getUpdateRoute(config)

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

        const param = this.extractParameters(c, true)
        const result = await handler({
          session: c.get('session'),
          user: c.get('user'),
          input: validatedInput.data,
          param,
        })

        if (result instanceof NorteError) {
          return c.json(this.createErrorResponse(result), result.statusCode)
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

  public read(handler: ReadHandler<TResponse>): this
  public read(config: RouteCommonConfig, handler: ReadHandler<TResponse>): this
  public read(
    configOrHandler: RouteCommonConfig | ReadHandler<TResponse>,
    handler?: ReadHandler<TResponse>,
  ): this {
    const { config, actualHandler } = this.resolveHandlerArgs(
      configOrHandler,
      handler,
    )
    const definition = this.getReadRoute(config)

    // biome-ignore lint/suspicious/noExplicitAny: Bypass complex Hono typing
    this.router.openapi(definition, async (c: any) => {
      try {
        const param = this.extractParameters(c, true)
        const result = await actualHandler({
          session: c.get('session'),
          user: c.get('user'),
          param,
        })

        if (result instanceof NorteError) {
          return c.json(this.createErrorResponse(result), result.statusCode)
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

  public delete(handler: DeleteHandler): this
  public delete(config: RouteCommonConfig, handler: DeleteHandler): this
  public delete(
    configOrHandler: RouteCommonConfig | DeleteHandler,
    handler?: DeleteHandler,
  ): this {
    const { config, actualHandler } = this.resolveHandlerArgs(
      configOrHandler,
      handler,
    )
    const definition = this.getDeleteRoute(config)

    // biome-ignore lint/suspicious/noExplicitAny: Bypass complex Hono typing
    this.router.openapi(definition, async (c: any) => {
      try {
        const param = this.extractParameters(c, true)
        const result = await actualHandler({
          session: c.get('session'),
          user: c.get('user'),
          param,
        })

        if (result instanceof NorteError) {
          return c.json(this.createErrorResponse(result), result.statusCode)
        }

        return c.body(null, 204)
      } catch (error) {
        return this.handleError(c, error)
      }
    })
    return this
  }
}

const errorSchema = z.object({ error: z.string() })

const commonResponses = {
  400: {
    description: 'Bad Request',
    content: {
      'application/json': { schema: errorSchema },
    },
  },
  401: {
    description: 'Unauthorized',
    content: {
      'application/json': { schema: errorSchema },
    },
  },
  403: {
    description: 'Forbidden',
    content: {
      'application/json': { schema: errorSchema },
    },
  },
  404: {
    description: 'Not Found',
    content: {
      'application/json': { schema: errorSchema },
    },
  },
  409: {
    description: 'Conflict',
    content: {
      'application/json': { schema: errorSchema },
    },
  },
  500: {
    description: 'Internal Server Error',
    content: {
      'application/json': { schema: errorSchema },
    },
  },
}
