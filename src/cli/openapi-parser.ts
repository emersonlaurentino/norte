import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export type OpenAPISpec = {
  openapi: string
  info: {
    title: string
    version: string
    description?: string
  }
  servers?: Array<{
    url: string
    description?: string
  }>
  paths: Record<string, Record<string, OpenAPIOperation>>
  components?: {
    schemas?: Record<string, unknown>
    securitySchemes?: Record<string, unknown>
  }
}

export type OpenAPIOperation = {
  operationId: string
  summary?: string
  description?: string
  tags?: string[]
  requestBody?: {
    required?: boolean
    content?: {
      'application/json'?: {
        schema: unknown
      }
    }
  }
  parameters?: Array<{
    name: string
    in: 'path' | 'query' | 'header'
    required?: boolean
    schema: unknown
  }>
  responses: Record<
    string,
    {
      description: string
      content?: {
        'application/json'?: {
          schema: unknown
        }
      }
    }
  >
  'x-norte-invalidates'?: string[]
  'x-norte-domain'?: string
  'x-norte-version'?: number
}

export type ParsedOpenAPI = {
  info: OpenAPISpec['info']
  servers: OpenAPISpec['servers']
  operations: ParsedOperation[]
}

export type ParsedOperation = {
  id: string
  method: string
  path: string
  summary?: string | undefined
  description?: string | undefined
  tags: string[]
  domain?: string | undefined
  version?: number | undefined
  requestBody?: unknown
  parameters: Array<{
    name: string
    in: 'path' | 'query' | 'header'
    required: boolean
    schema: unknown
  }>
  responseSchema?: unknown
  invalidates: string[]
}

export async function parseOpenAPI(input: string): Promise<ParsedOpenAPI> {
  let spec: OpenAPISpec

  // Check if input is a file path or URL
  if (input.startsWith('http://') || input.startsWith('https://')) {
    // Fetch from URL
    const response = await fetch(input)
    if (!response.ok) {
      throw new Error(
        `Failed to fetch OpenAPI spec from ${input}: ${response.statusText}`,
      )
    }
    spec = await response.json()
  } else {
    // Read from file
    const filePath = resolve(process.cwd(), input)
    if (!existsSync(filePath)) {
      throw new Error(`OpenAPI file not found: ${filePath}`)
    }
    const content = readFileSync(filePath, 'utf-8')
    spec = JSON.parse(content)
  }

  // Validate basic structure
  if (!spec.openapi || !spec.info || !spec.paths) {
    throw new Error('Invalid OpenAPI specification: missing required fields')
  }

  // Parse operations
  const operations: ParsedOperation[] = []

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (typeof operation !== 'object' || !operation.operationId) {
        continue
      }

      const op = operation as OpenAPIOperation

      // Extract response schema (200 or 201)
      const successResponse = op.responses['200'] || op.responses['201']
      const responseSchema =
        successResponse?.content?.['application/json']?.schema

      // Extract request body schema
      const requestBody = op.requestBody?.content?.['application/json']?.schema

      // Parse parameters
      const parameters = (op.parameters || []).map((param) => ({
        name: param.name,
        in: param.in,
        required: param.required ?? false,
        schema: param.schema,
      }))

      operations.push({
        id: op.operationId,
        method: method.toUpperCase(),
        path,
        summary: op.summary,
        description: op.description,
        tags: op.tags || [],
        domain: op['x-norte-domain'],
        version: op['x-norte-version'],
        requestBody,
        parameters,
        responseSchema,
        invalidates: op['x-norte-invalidates'] || [],
      })
    }
  }

  return {
    info: spec.info,
    servers: spec.servers,
    operations,
  }
}
