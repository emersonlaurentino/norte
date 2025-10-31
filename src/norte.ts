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

  /**
   * Adiciona uma rota HTTP raw (sem validação, sem domínio)
   *
   * Use para casos onde você precisa controle total do Request/Response:
   * - Documentação (Scalar, Swagger)
   * - Health checks e métricas
   * - Webhooks externos
   * - Integrações com libs externas (Better-Auth, etc)
   *
   * Suporta wildcards:
   * - "*" como método = todos os métodos HTTP
   * - "*" no path = captura qualquer path
   *
   * @example
   * // Rota simples
   * app.raw("GET", "/docs", () => Scalar({ url: "/openapi.json" }))
   *
   * // Wildcard de método (todos os métodos HTTP)
   * app.raw("*", "/webhooks/stripe", handleStripe)
   *
   * // Wildcard de path (sub-aplicação)
   * app.raw("*", "/api/auth/*", (req) => betterAuth.handler(req))
   *
   * // Wildcard total (captura tudo)
   * app.raw("*", "*", customFallback)
   */
  public raw(
    method: HttpMethod | '*',
    path: string | '*',
    handler: (req: Request) => Response | Promise<Response>,
  ): this {
    // Normaliza path: "*" vira "/*" para o matcher
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

    // Determina quais métodos HTTP registrar
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

    // OpenAPI endpoint tem prioridade máxima
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

    // Scalar UI na raiz (não pode ser sobrescrito)
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

    // Prioridade 1: Tentar raw routes primeiro
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

    // Prioridade 2: Tentar routers (rotas de domínio)
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
