import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/integration',
  testMatch: /.*\.spec\.ts$/,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    stdout: 'pipe',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
