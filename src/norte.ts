import type { ValidateFunction } from 'ajv'
import Ajv from 'ajv'
import type {
  AfterHook,
  BeforeHook,
  Handler,
  NorteSchema,
  RouteDefinition,
} from './router'
import { NorteError, Router } from './router'
import type { NorteLogger, NorteStore } from './types'

// Compiled route structure - optimized for runtime execution
type CompiledRoute = {
  pathPattern: string // e.g., "/users/:userId"
  routeParts: string[] // Pre-split path parts for fast matching
  paramNames: string[] // e.g., ["userId"]
  defaultStatus: number // 200, 201, 204, etc
  execute: (req: Request, params: Record<string, string>) => Promise<Response> // The "super function"
}

export class Norte<TStore extends NorteStore = NorteStore> {
  #compiledRoutes: Map<string, CompiledRoute[]> = new Map() // Key: HTTP method
  #ajv: Ajv

  constructor() {
    this.#ajv = new Ajv({
      coerceTypes: true,
      useDefaults: true,
      removeAdditional: true,
    })
  }

  public register(router: Router<TStore>) {
    const { definitions } = Router.getInternals(router)

    // Compile each route definition
    for (const definition of definitions) {
      const compiledRoute = this.#compileRoute(definition)
      const method = definition.method.toUpperCase()

      if (!this.#compiledRoutes.has(method)) {
        this.#compiledRoutes.set(method, [])
      }
      const routes = this.#compiledRoutes.get(method)
      if (routes) {
        routes.push(compiledRoute)
      }
    }
  }

  #compileRoute(definition: RouteDefinition<TStore>): CompiledRoute {
    const { method, path, handler, options, router } = definition

    // 1. Build full path by walking parent chain
    const fullPath = this.#buildFullPath(router, path)

    // 2. Split path into parts and extract parameter names
    const { routeParts, paramNames } = this.#splitPath(fullPath)

    // 3. Pre-compile schemas
    const validators = this.#compileSchemas(options)

    // 4. Compile response schema from router (if defined)
    const routerOptions = Router.getInternals(router).options
    const responseValidator = this.#compileResponseSchema(
      method,
      routerOptions.schema,
    )

    // 5. Merge hooks from router and route level
    const beforeHooks = this.#mergeHooks(
      routerOptions.beforeHandler,
      options.beforeHandler,
    )
    const afterHooks = this.#mergeHooks(
      routerOptions.afterHandler,
      options.afterHandler,
    )

    // 6. Determine default status based on method
    const defaultStatus = this.#getDefaultStatus(method)

    // 7. Create the "super function" - inlines entire lifecycle
    const execute = this.#createSuperFunction({
      method,
      path,
      paramNames,
      validators,
      responseValidator,
      beforeHooks,
      handler,
      afterHooks,
      defaultStatus,
    })

    return {
      pathPattern: fullPath,
      routeParts,
      paramNames,
      defaultStatus,
      execute,
    }
  }

  #buildFullPath(router: Router<TStore>, path: string): string {
    const parts: string[] = []

    // Walk up the parent chain to build the full path
    let currentRouter: Router<TStore> | null = router
    let version: number | undefined

    while (currentRouter) {
      const internals = Router.getInternals(currentRouter)
      const { domain, parent, options } = internals

      // Capture version from the root router (top-level)
      if (!parent && options.version !== undefined) {
        version = options.version
      }

      // Add the domain to the path
      parts.unshift(domain)

      // If there's a parent, add the PARENT's domain ID parameter
      if (parent) {
        const parentDomain = Router.getInternals(parent).domain
        const parentDomainId = parentDomain.endsWith('s')
          ? `${parentDomain.slice(0, -1)}Id`
          : `${parentDomain}Id`
        parts.unshift(`:${parentDomainId}`)
      }

      currentRouter = parent as Router<TStore> | null
    }

    // Add version prefix (default to 1 if not specified)
    const versionPrefix = `v${version ?? 1}`
    parts.unshift(versionPrefix)

    // Build the path: /v{version}/domain or /v{version}/parent/:parentId/domain
    let fullPath = `/${parts.join('/')}`

    // Append the route-specific path
    if (path) {
      fullPath += path
    }

    return fullPath
  }

  #splitPath(path: string): {
    routeParts: string[]
    paramNames: string[]
  } {
    const paramNames: string[] = []
    const routeParts = path.split('/').filter(Boolean)

    // Extract parameter names
    for (const part of routeParts) {
      if (part.charCodeAt(0) === 58) {
        // 58 = ':'
        paramNames.push(part.slice(1))
      }
    }

    return { routeParts, paramNames }
  }

  #match(
    routeParts: string[],
    pathParts: string[],
    paramNames: string[],
  ): Record<string, string> | null {
    // Route and path must have same number of parts
    if (routeParts.length !== pathParts.length) {
      return null
    }

    const params: Record<string, string> = {}
    let paramIdx = 0

    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i]
      const pathPart = pathParts[i]

      if (!routePart || !pathPart) {
        return null
      }

      if (routePart.charCodeAt(0) === 58) {
        // 58 = ':'
        // É um parâmetro, capturar
        const paramName = paramNames[paramIdx++]
        if (paramName) {
          params[paramName] = pathPart
        }
      } else if (routePart !== pathPart) {
        // Parte estática não bateu
        return null
      }
    }

    return params
  }

  #compileSchemas(options: RouteDefinition<TStore>['options']): {
    body?: ValidateFunction | undefined
    query?: ValidateFunction | undefined
    param?: ValidateFunction | undefined
  } {
    return {
      body: options.body ? this.#ajv.compile(options.body) : undefined,
      query: options.query ? this.#ajv.compile(options.query) : undefined,
      param: options.param ? this.#ajv.compile(options.param) : undefined,
    }
  }

  #compileResponseSchema(
    method: string,
    schema: NorteSchema,
  ): ValidateFunction {
    // Para GET / (list), valida como array do schema
    if (method.toUpperCase() === 'GET') {
      // Se o path termina com um parâmetro (e.g., /:userId), é um .read()
      // Caso contrário, é um .list() e precisa ser array
      // Vamos verificar isso no createSuperFunction baseado no path
      // Por enquanto, vamos retornar o schema compilado direto
      return this.#ajv.compile(schema)
    }

    // Para outros métodos (POST/PATCH), valida o schema direto
    return this.#ajv.compile(schema)
  }

  #mergeHooks<T>(routerHooks?: T[], routeHooks?: T[]): T[] {
    return [...(routerHooks || []), ...(routeHooks || [])]
  }

  #getDefaultStatus(method: string): number {
    switch (method.toUpperCase()) {
      case 'POST':
        return 201
      case 'DELETE':
        return 204
      default:
        return 200
    }
  }

  #createSuperFunction(config: {
    method: string
    path: string
    paramNames: string[]
    validators: {
      body?: ValidateFunction | undefined
      query?: ValidateFunction | undefined
      param?: ValidateFunction | undefined
    }
    responseValidator: ValidateFunction
    beforeHooks: BeforeHook<TStore>[]
    handler: Handler<TStore>
    afterHooks: AfterHook<TStore>[]
    defaultStatus: number
  }): (req: Request, params: Record<string, string>) => Promise<Response> {
    const {
      method,
      path,
      validators,
      responseValidator,
      beforeHooks,
      handler,
      afterHooks,
      defaultStatus,
    } = config

    // Determina se é um .list() - GET sem parâmetro na rota
    const isListMethod = method.toUpperCase() === 'GET' && path === ''

    // This is the "super function" - handles everything for this route
    return async (
      req: Request,
      params: Record<string, string>,
    ): Promise<Response> => {
      try {
        // Create logger (simple console logger for now)
        const log: NorteLogger = this.#createLogger()

        // Parse URL
        const url = new URL(req.url)

        // Params are passed in from the route match
        const param = params

        // Extract query
        const query: Record<string, string> = {}
        for (const [key, value] of url.searchParams.entries()) {
          query[key] = value
        }

        // Parse body if present
        let bodyData: unknown
        const contentType = req.headers.get('content-type')
        if (contentType?.includes('application/json')) {
          try {
            bodyData = await req.json()
          } catch {
            throw new NorteError('INVALID_INPUT', 'Invalid JSON body')
          }
        }

        // Initialize store
        let store = {} as TStore

        // Helper to create NorteError
        const error = (code: string, msg: string) => new NorteError(code, msg)

        // 1. Execute beforeHandler hooks
        for (const hook of beforeHooks) {
          store = await hook({
            req,
            headers: req.headers,
            param,
            query,
            store,
            log,
            error,
          })
        }

        // 2. Validate body, query, param
        if (validators.body && bodyData !== undefined) {
          if (!validators.body(bodyData)) {
            throw new NorteError(
              'INVALID_INPUT',
              `Body validation failed: ${this.#ajv.errorsText(validators.body.errors)}`,
            )
          }
        }

        if (validators.query) {
          if (!validators.query(query)) {
            throw new NorteError(
              'INVALID_INPUT',
              `Query validation failed: ${this.#ajv.errorsText(validators.query.errors)}`,
            )
          }
        }

        if (validators.param) {
          if (!validators.param(param)) {
            throw new NorteError(
              'INVALID_INPUT',
              `Param validation failed: ${this.#ajv.errorsText(validators.param.errors)}`,
            )
          }
        }

        // 3. Execute handler
        let handlerContext: any = {
          body: bodyData,
          param,
          query,
          store,
          log,
        }

        // Para .list(), adicionar contexto de paginação
        if (isListMethod) {
          const page = Number((query as any).page) || 1
          const limit = Number((query as any).limit) || 10
          const offset = (page - 1) * limit

          handlerContext = {
            ...handlerContext,
            pagination: {
              page,
              limit,
              offset,
            },
          }
        }

        const result = await handler(handlerContext)

        // 3.1. Validate response
        if (!(result instanceof Response)) {
          // Para .list(), valida cada item do array
          if (isListMethod) {
            if (!Array.isArray(result)) {
              throw new NorteError(
                'INVALID_OUTPUT',
                'List method must return an array',
              )
            }
            // Valida cada item do array
            for (let i = 0; i < result.length; i++) {
              const item = result[i]
              if (!responseValidator(item)) {
                throw new NorteError(
                  'INVALID_OUTPUT',
                  `Response validation failed for item ${i}: ${this.#ajv.errorsText(responseValidator.errors)}`,
                )
              }
            }
          } else {
            // Para outros métodos, valida o objeto direto
            if (!responseValidator(result)) {
              throw new NorteError(
                'INVALID_OUTPUT',
                `Response validation failed: ${this.#ajv.errorsText(responseValidator.errors)}`,
              )
            }
          }
        }

        // 4. Execute afterHandler hooks
        const responseHeaders = new Headers()
        const responseState = { status: defaultStatus }

        for (const hook of afterHooks) {
          await hook({
            result,
            response: responseState,
            headers: responseHeaders,
            store,
            log,
          })
        }

        // 5. Format response
        // If handler returned a Response object, use it directly
        if (result instanceof Response) {
          return result
        }

        // For DELETE with 204, no body
        if (defaultStatus === 204) {
          return new Response(null, {
            status: responseState.status || 204,
            headers: responseHeaders,
          })
        }

        // Otherwise, serialize as JSON
        responseHeaders.set('content-type', 'application/json')
        return new Response(JSON.stringify(result), {
          status: responseState.status || defaultStatus,
          headers: responseHeaders,
        })
      } catch (err) {
        // Handle errors
        return this.#handleError(err)
      }
    }
  }

  #createLogger(): NorteLogger {
    const createLogFn = (level: string) => (obj: object, msg?: string) => {
      console[level as 'log'](msg || '', obj)
    }

    return {
      info: createLogFn('log'),
      warn: createLogFn('warn'),
      error: createLogFn('error'),
      debug: createLogFn('log'),
      child: (_bindings: object) => this.#createLogger(), // Simplified for now
    }
  }

  #handleError(err: unknown): Response {
    if (err instanceof NorteError) {
      const statusCode = this.#errorCodeToStatus(err.code)
      return new Response(
        JSON.stringify({
          error: err.code,
          message: err.message,
        }),
        {
          status: statusCode,
          headers: { 'content-type': 'application/json' },
        },
      )
    }

    // Unexpected error
    console.error('Unexpected error:', err)
    return new Response(
      JSON.stringify({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      },
    )
  }

  #errorCodeToStatus(code: string): number {
    const statusMap: Record<string, number> = {
      INVALID_INPUT: 400,
      INVALID_OUTPUT: 500, // Erro interno - response não conforme com schema
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      CONFLICT: 409,
      INTERNAL_SERVER_ERROR: 500,
    }
    return statusMap[code] || 500
  }

  public fetch = async (req: Request): Promise<Response> => {
    const method = req.method.toUpperCase()
    const url = new URL(req.url)
    const pathname = url.pathname

    // Get routes for this HTTP method
    const routes = this.#compiledRoutes.get(method)
    if (!routes) {
      return new Response(
        JSON.stringify({
          error: 'NOT_FOUND',
          message: 'Route not found',
        }),
        {
          status: 404,
          headers: { 'content-type': 'application/json' },
        },
      )
    }

    // Split pathname into parts
    const pathParts = pathname.split('/').filter(Boolean)

    // Fast matching through routes for this method
    for (const route of routes) {
      const params = this.#match(route.routeParts, pathParts, route.paramNames)
      if (params !== null) {
        // Match found! Execute
        return await route.execute(req, params)
      }
    }

    // No route matched
    return new Response(
      JSON.stringify({
        error: 'NOT_FOUND',
        message: 'Route not found',
      }),
      {
        status: 404,
        headers: { 'content-type': 'application/json' },
      },
    )
  }
}
