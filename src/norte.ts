import { Router } from './router'
import { ErrorHandler } from './services/error-handler'
import { Logger } from './services/logger'
import { OpenAPIGenerator } from './services/openapi-generator'
import { PathBuilder } from './services/path-builder'
import { type CompiledRoute, RouteCompiler } from './services/route-compiler'
import { RouteMatcher } from './services/route-matcher'
import { Validator } from './services/validator'
import type { LoggerOptions, NorteStore, TelemetryOptions } from './types'

export type NorteOptions = {
  logger?: LoggerOptions
  telemetry?: TelemetryOptions
  openapi?: {
    title?: string
    version?: string
    description?: string
    servers?: Array<{ url: string; description?: string }>
  }
}

export class Norte<TStore extends NorteStore = NorteStore> {
  #compiledRoutes: Map<string, CompiledRoute[]> = new Map()

  #logger: Logger
  #validator: Validator
  #routeMatcher: RouteMatcher
  #pathBuilder: PathBuilder
  #openApiGenerator: OpenAPIGenerator
  #errorHandler: ErrorHandler
  #routeCompiler: RouteCompiler

  constructor(options: NorteOptions = {}) {
    this.#logger = new Logger(options.logger, options.telemetry)
    this.#validator = new Validator()
    this.#routeMatcher = new RouteMatcher()
    this.#pathBuilder = new PathBuilder()
    this.#openApiGenerator = new OpenAPIGenerator(options.openapi)
    this.#errorHandler = new ErrorHandler()

    this.#routeCompiler = new RouteCompiler(
      this.#validator,
      this.#pathBuilder,
      this.#routeMatcher,
      this.#logger,
      this.#errorHandler,
    )
  }

  public register(router: Router<TStore>) {
    const { definitions } = Router.getInternals(router)

    for (const definition of definitions) {
      const compiledRoute = this.#routeCompiler.compile(definition)
      const method = definition.method.toUpperCase()

      if (!this.#compiledRoutes.has(method)) {
        this.#compiledRoutes.set(method, [])
      }
      const routes = this.#compiledRoutes.get(method)
      if (routes) {
        routes.push(compiledRoute)
      }

      this.#openApiGenerator.addRouteMetadata(
        definition,
        compiledRoute.pathPattern,
      )
    }
  }

  public fetch = async (req: Request): Promise<Response> => {
    const method = req.method.toUpperCase()
    const url = new URL(req.url)
    const pathname = url.pathname

    if (method === 'GET' && pathname === '/openapi.json') {
      const openApiDoc = this.#openApiGenerator.generateDocument()
      return new Response(JSON.stringify(openApiDoc, null, 2), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'public, max-age=3600',
        },
      })
    }

    const routes = this.#compiledRoutes.get(method)
    if (!routes) {
      return this.#errorHandler.createNotFoundResponse()
    }

    const pathParts = this.#routeMatcher.splitPathname(pathname)

    for (const route of routes) {
      const params = this.#routeMatcher.match(
        route.routeParts,
        pathParts,
        route.paramNames,
      )
      if (params !== null) {
        return await route.execute(req, params)
      }
    }

    return this.#errorHandler.createNotFoundResponse()
  }
}
