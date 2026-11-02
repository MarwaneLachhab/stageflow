import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration.
 *
 * ⚠️ These tests have NOT been executed in this environment: the sandbox does
 * not permit binding a network port, so no dev server could be reached. They are
 * committed ready to run on a normal machine.
 *
 * The assertion that matters most is in `auth-boundaries.spec.ts`: a stagiaire
 * must be unable to reach `/admin/*`. That is a security boundary, and it is
 * worth an end-to-end test even though the real enforcement lives in RLS.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Never keep credentials or session cookies in a trace artifact.
    video: 'off',
  },

  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'tablet-chromium', use: { ...devices['iPad (gen 7)'] } },
    { name: 'mobile-chromium', use: { ...devices['iPhone 13'] } },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
