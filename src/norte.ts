import { Router } from './router'
import { ErrorHandler } from './services/error-handler'
import { Logger } from './services/logger'
import { OpenAPIGenerator } from './services/openapi-generator'
import { PathBuilder } from './services/path-builder'
import { RouteCompiler } from './services/route-compiler'
import { RouteMatcher } from './services/route-matcher'
import { Validator } from './services/validator'
import type {
  CompiledRoute,
  HttpMethod,
  NorteOptions,
  NorteStore,
} from './types'

export class Norte<TStore extends NorteStore = NorteStore> {
  #compiledRoutes: Map<string, CompiledRoute[]> = new Map()
  #rawRoutes: Map<string, CompiledRoute[]> = new Map()

  #logger: Logger
  #validator: Validator
  #routeMatcher: RouteMatcher
  #pathBuilder: PathBuilder
  #openApiGenerator: OpenAPIGenerator
  #errorHandler: ErrorHandler
  #routeCompiler: RouteCompiler
  #scalarEnabled: boolean

  constructor(options: NorteOptions = {}) {
    this.#logger = new Logger(options.logger, options.telemetry)
    this.#validator = new Validator()
    this.#routeMatcher = new RouteMatcher()
    this.#pathBuilder = new PathBuilder()
    this.#openApiGenerator = new OpenAPIGenerator(options.openapi)
    this.#errorHandler = new ErrorHandler()
    this.#scalarEnabled = options.openapi?.ui !== false

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

  public raw(
    method: HttpMethod | '*',
    path: string | '*',
    handler: (req: Request) => Response | Promise<Response>,
  ): this {
    const normalizedPath = path === '*' ? '/*' : path
    const { routeParts, paramNames } =
      this.#routeMatcher.splitPath(normalizedPath)

    const compiledRoute: CompiledRoute = {
      pathPattern: normalizedPath,
      routeParts,
      paramNames,
      defaultStatus: 200,
      execute: async (req: Request, _params: Record<string, string>) => {
        try {
          const log = this.#logger.createLogger(req)
          log.debug({ method, path: normalizedPath }, 'Raw route executed')

          return await handler(req)
        } catch (err) {
          return this.#errorHandler.handle(err)
        }
      },
    }

    const methods =
      method === '*'
        ? ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
        : [method]

    for (const m of methods) {
      const upperMethod = m.toUpperCase()
      if (!this.#rawRoutes.has(upperMethod)) {
        this.#rawRoutes.set(upperMethod, [])
      }
      this.#rawRoutes.get(upperMethod)?.push(compiledRoute)
    }

    return this
  }

  public fetch = async (req: Request): Promise<Response> => {
    const method = req.method.toUpperCase()
    const url = new URL(req.url)
    const pathname = url.pathname

    if (method === 'GET' && pathname === '/openapi.json') {
      const openApiDoc = this.#openApiGenerator.generateDocument(req)
      const hasCustomServers = this.#openApiGenerator.hasCustomServers()
      const cacheControl = hasCustomServers
        ? 'public, max-age=3600'
        : 'no-store, no-cache, must-revalidate'

      return new Response(JSON.stringify(openApiDoc, null, 2), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'cache-control': cacheControl,
        },
      })
    }

    if (method === 'GET' && pathname === '/' && this.#scalarEnabled) {
      const html = `<!DOCTYPE html>
<html>
  <head>
    <title>API Reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script
      id="api-reference"
      data-url="/openapi.json"
    ></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`

      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      })
    }

    const pathParts = this.#routeMatcher.splitPathname(pathname)

    const rawRoutes = this.#rawRoutes.get(method)
    if (rawRoutes) {
      for (const route of rawRoutes) {
        const params = this.#routeMatcher.match(
          route.routeParts,
          pathParts,
          route.paramNames,
        )
        if (params !== null) {
          return await route.execute(req, params)
        }
      }
    }

    const routes = this.#compiledRoutes.get(method)
    if (routes) {
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
    }

    return this.#errorHandler.createNotFoundResponse()
  }
}
