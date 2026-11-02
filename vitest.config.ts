import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { mkdirSync } from 'node:fs'

/*
 * Keep every scratch write inside the project.
 *
 * On this machine `%TEMP%` is not reliably writable. When a cache write fails
 * with EPERM, Vitest reports an "unhandled error" and silently drops the affected
 * test FILE from the run — which is why totals jumped between 177 / 207 / 208
 * while `vitest list` always showed all files.
 *
 * `cacheDir` alone was not enough: Vite still creates a per-run directory under
 * the OS temp path. Pointing TEMP/TMP at a project-local folder as well removes
 * that shared path. Workers inherit process.env from this config process.
 */
const LOCAL_TMP = resolve(process.cwd(), '.vitest-cache/tmp')
mkdirSync(LOCAL_TMP, { recursive: true })
process.env.TEMP = LOCAL_TMP
process.env.TMP = LOCAL_TMP

export default defineConfig({
  plugins: [react()],
  cacheDir: '.vitest-cache',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // e2e/ is Playwright's territory, not Vitest's.
    exclude: ['node_modules', '.next', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['lib/**/*.ts', 'components/**/*.tsx'],
      exclude: ['**/*.d.ts', 'lib/supabase/**'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
})
