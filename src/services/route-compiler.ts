import type { ValidateFunction } from 'ajv'
import type { RouteDefinition } from '../router'
import { NorteError, Router } from '../router'
import type {
  AfterHook,
  BeforeHook,
  CompiledRoute,
  Handler,
  NorteLogger,
  NorteSchema,
  NorteStore,
} from '../types'
import type { ErrorHandler } from './error-handler'
import type { Logger } from './logger'
import type { PathBuilder } from './path-builder'
import type { RouteMatcher } from './route-matcher'
import type { Validator } from './validator'

export class RouteCompiler {
  #validator: Validator
  #pathBuilder: PathBuilder
  #routeMatcher: RouteMatcher
  #logger: Logger
  #errorHandler: ErrorHandler

  constructor(
    validator: Validator,
    pathBuilder: PathBuilder,
    routeMatcher: RouteMatcher,
    logger: Logger,
    errorHandler: ErrorHandler,
  ) {
    this.#validator = validator
    this.#pathBuilder = pathBuilder
    this.#routeMatcher = routeMatcher
    this.#logger = logger
    this.#errorHandler = errorHandler
  }

  public compile<TStore extends NorteStore>(
    definition: RouteDefinition<TStore>,
  ): CompiledRoute {
    const { method, path, handler, options, router } = definition

    const fullPath = this.#pathBuilder.buildFullPath(router, path)

    const { routeParts, paramNames } = this.#routeMatcher.splitPath(fullPath)

    const validators = this.#compileSchemas(options)

    const routerOptions = Router.getInternals(router).options
    const responseValidator = this.#compileResponseSchema(
      method,
      routerOptions.schema,
    )

    const beforeHooks = this.#mergeHooks(
      routerOptions.beforeHandler,
      options.beforeHandler,
    )
    const afterHooks = this.#mergeHooks(
      routerOptions.afterHandler,
      options.afterHandler,
    )

    const defaultStatus = this.#getDefaultStatus(method)

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

  #compileSchemas<TStore extends NorteStore>(
    options: RouteDefinition<TStore>['options'],
  ): {
    body?: ValidateFunction | undefined
    query?: ValidateFunction | undefined
    param?: ValidateFunction | undefined
  } {
    return {
      body: options.body ? this.#validator.compile(options.body) : undefined,
      query: options.query ? this.#validator.compile(options.query) : undefined,
      param: options.param ? this.#validator.compile(options.param) : undefined,
    }
  }

  #compileResponseSchema(
    _method: string,
    schema: NorteSchema,
  ): ValidateFunction {
    return this.#validator.compile(schema)
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

  #createSuperFunction<TStore extends NorteStore>(config: {
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

    const isListMethod = method.toUpperCase() === 'GET' && path === ''

    return async (
      req: Request,
      params: Record<string, string>,
    ): Promise<Response> => {
      try {
        const log: NorteLogger = this.#logger.createLogger(req)

        const url = new URL(req.url)

        const param = params

        const query: Record<string, string> = {}
        for (const [key, value] of url.searchParams.entries()) {
          query[key] = value
        }

        let bodyData: unknown
        const contentType = req.headers.get('content-type')
        if (contentType?.includes('application/json')) {
          try {
            bodyData = await req.json()
          } catch {
            throw new NorteError('INVALID_INPUT', 'Invalid JSON body')
          }
        }

        let store = {} as TStore

        const error = (code: string, msg: string) => new NorteError(code, msg)

        for (const hook of beforeHooks) {
          store = await hook({
            request: req,
            headers: req.headers,
            param,
            query,
            store,
            log,
            error,
          })
        }

        if (validators.body && bodyData !== undefined) {
          if (!validators.body(bodyData)) {
            throw new NorteError(
              'INVALID_INPUT',
              `Body validation failed: ${this.#validator.getErrorText(validators.body)}`,
            )
          }
        }

        if (validators.query) {
          if (!validators.query(query)) {
            throw new NorteError(
              'INVALID_INPUT',
              `Query validation failed: ${this.#validator.getErrorText(validators.query)}`,
            )
          }
        }

        if (validators.param) {
          if (!validators.param(param)) {
            throw new NorteError(
              'INVALID_INPUT',
              `Param validation failed: ${this.#validator.getErrorText(validators.param)}`,
            )
          }
        }

        let handlerContext: any = {
          body: bodyData,
          param,
          query,
          store,
          log,
          request: req,
        }

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

        if (!(result instanceof Response)) {
          if (isListMethod) {
            if (!Array.isArray(result)) {
              throw new NorteError(
                'INVALID_OUTPUT',
                'List method must return an array',
              )
            }
            for (let i = 0; i < result.length; i++) {
              const item = result[i]
              if (!responseValidator(item)) {
                throw new NorteError(
                  'INVALID_OUTPUT',
                  `Response validation failed for item ${i}: ${this.#validator.getErrorText(responseValidator)}`,
                )
              }
            }
          } else {
            if (!responseValidator(result)) {
              throw new NorteError(
                'INVALID_OUTPUT',
                `Response validation failed: ${this.#validator.getErrorText(responseValidator)}`,
              )
            }
          }
        }

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

        if (result instanceof Response) {
          return result
        }

        if (defaultStatus === 204) {
          return new Response(null, {
            status: responseState.status || 204,
            headers: responseHeaders,
          })
        }

        responseHeaders.set('content-type', 'application/json')
        return new Response(JSON.stringify(result), {
          status: responseState.status || defaultStatus,
          headers: responseHeaders,
        })
      } catch (err) {
        return this.#errorHandler.handle(err)
      }
    }
  }
}
