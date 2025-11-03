import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: {
        index: 'src/index.ts',
        'bin/norte': 'src/cli/index.ts',
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'commander',
        'ora',
        'chalk',
        'ts-morph',
        'ws',
        'ajv',
        'pino',
        'pino-pretty',
        '@sinclair/typebox',
        'node:fs',
        'node:path',
      ],
    },
    emptyOutDir: true,
  },
})
