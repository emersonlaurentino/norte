import pino from 'pino'
import type { LoggerOptions, NorteLogger, TelemetryOptions } from '../types'

export class Logger {
  #baseLogger: pino.Logger
  #telemetryEnabled: boolean
  #telemetryServiceName: string

  constructor(
    loggerOptions?: LoggerOptions,
    telemetryOptions?: TelemetryOptions,
  ) {
    this.#baseLogger = this.#initializeLogger(loggerOptions)
    this.#telemetryEnabled = telemetryOptions?.enabled ?? false
    this.#telemetryServiceName = telemetryOptions?.serviceName ?? 'norte-api'
  }

  #initializeLogger(loggerOptions?: LoggerOptions): pino.Logger {
    if (loggerOptions === false) {
      return pino({ level: 'silent' })
    }

    if (typeof loggerOptions === 'object') {
      return pino(loggerOptions)
    }

    const baseConfig: Record<string, unknown> = {
      level: 'info',
    }

    return pino(baseConfig)
  }

  #generateRequestId(req: Request): string {
    const headerRequestId = req.headers.get('X-Request-ID')
    if (headerRequestId) {
      return headerRequestId
    }

    return crypto.randomUUID()
  }

  #extractTraceId(req: Request): string | undefined {
    if (!this.#telemetryEnabled) {
      return undefined
    }

    const traceparent = req.headers.get('traceparent')
    if (traceparent) {
      const parts = traceparent.split('-')
      if (parts.length >= 2) {
        return parts[1]
      }
    }

    return crypto.randomUUID().replace(/-/g, '')
  }

  public createLogger(req: Request): NorteLogger {
    const requestId = this.#generateRequestId(req)
    const bindings: Record<string, unknown> = { requestId }

    if (this.#telemetryEnabled) {
      const trace_id = this.#extractTraceId(req)
      if (trace_id) {
        bindings.trace_id = trace_id
      }
      bindings.service = this.#telemetryServiceName
    }

    return this.#createWrappedLogger(bindings)
  }

  #createWrappedLogger(bindings: Record<string, unknown>): NorteLogger {
    const createLogMethod =
      (level: 'info' | 'warn' | 'error' | 'debug') =>
      (obj: object, msg?: string) => {
        const mergedObj = { ...bindings, ...obj }
        if (msg) {
          this.#baseLogger[level](mergedObj, msg)
        } else {
          this.#baseLogger[level](mergedObj)
        }
      }

    return {
      requestId: bindings.requestId as string | undefined,
      info: createLogMethod('info'),
      warn: createLogMethod('warn'),
      error: createLogMethod('error'),
      debug: createLogMethod('debug'),
      child: (newBindings: object) => {
        const allBindings = { ...bindings, ...newBindings }
        return this.#createWrappedLogger(allBindings)
      },
      bindings: () => bindings,
      level: this.#baseLogger.level,
    } as NorteLogger
  }

  public static getRequestId(
    log: NorteLogger | undefined,
    req: Request,
  ): string {
    if (log?.requestId) {
      return log.requestId
    }

    if (log) {
      try {
        if (typeof log.bindings === 'function') {
          const bindings = log.bindings()
          if (bindings && typeof bindings.requestId === 'string') {
            return bindings.requestId
          }
        }
      } catch {
        // no-op
      }
    }

    const headerRequestId = req.headers.get('X-Request-ID')
    if (headerRequestId) {
      return headerRequestId
    }
    return crypto.randomUUID()
  }
}
