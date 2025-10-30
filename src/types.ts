export type NorteStore = Record<string, unknown>

export interface NorteLogger {
  info(obj: object, msg?: string): void
  warn(obj: object, msg?: string): void
  error(obj: object, msg?: string): void
  debug(obj: object, msg?: string): void
  child(bindings: object): NorteLogger
  bindings(): Record<string, unknown>
  level: string
}

export type LoggerOptions =
  | boolean // false = disabled
  | {
      level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent'
      name?: string
      [key: string]: unknown
    }

export type TelemetryOptions = {
  enabled: boolean
  serviceName?: string
}
