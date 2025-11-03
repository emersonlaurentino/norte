#!/usr/bin/env node

import { program } from 'commander'
import { generateCommand } from './generate'

program
  .name('norte')
  .description('Norte Framework CLI - Generate type-safe clients from OpenAPI')
  .version('0.2.0')

program
  .command('generate')
  .description('Generate type-safe client from OpenAPI specification')
  .option(
    '-i, --input <url>',
    'OpenAPI URL or file path',
    'http://localhost:3000/openapi.json',
  )
  .option('-o, --output <dir>', 'Output directory', './src/api')
  .option(
    '-a, --adapter <name>',
    'Adapter type (fetch, tanstack-query)',
    'tanstack-query',
  )
  .action(generateCommand)

program.parse()
