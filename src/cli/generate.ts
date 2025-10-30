import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import chalk from 'chalk'
import ora from 'ora'
import { generateFetchClient } from './client-base'
import { parseOpenAPI } from './openapi-parser'
import { generateTanStackQuery } from './tanstack-query'

export type GenerateOptions = {
  input: string
  output: string
  adapter: 'fetch' | 'tanstack-query'
}

export async function generateCommand(options: GenerateOptions) {
  const spinner = ora('Parsing OpenAPI specification...').start()

  try {
    // 1. Parse OpenAPI
    const openapi = await parseOpenAPI(options.input)
    spinner.succeed('OpenAPI specification parsed successfully')

    // 2. Generate client based on adapter
    spinner.start(`Generating ${options.adapter} client...`)

    let files: Record<string, string> = {}

    switch (options.adapter) {
      case 'fetch':
        files = generateFetchClient(openapi)
        break
      case 'tanstack-query':
        files = generateTanStackQuery(openapi)
        break
      default:
        spinner.fail(`Unknown adapter: ${options.adapter}`)
        process.exit(1)
    }

    spinner.succeed(`Client generated with ${options.adapter} adapter`)

    // 3. Write files to output directory
    spinner.start('Writing files...')
    const outputDir = resolve(process.cwd(), options.output)

    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true })
    }

    let fileCount = 0
    for (const [filename, content] of Object.entries(files)) {
      const filePath = resolve(outputDir, filename)
      const fileDir = dirname(filePath)

      if (!existsSync(fileDir)) {
        mkdirSync(fileDir, { recursive: true })
      }

      writeFileSync(filePath, content, 'utf-8')
      fileCount++
    }

    spinner.succeed(
      `${fileCount} files written to ${chalk.cyan(options.output)}`,
    )

    console.log(chalk.green('\n✓ Client generated successfully!\n'))
    console.log(chalk.dim('Files created:'))
    for (const filename of Object.keys(files)) {
      console.log(chalk.dim(`  - ${filename}`))
    }
  } catch (error) {
    spinner.fail('Failed to generate client')
    console.error(
      chalk.red('\nError:'),
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }
}
