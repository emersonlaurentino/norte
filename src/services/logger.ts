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

    return this.#baseLogger.child(bindings) as NorteLogger
  }
}
