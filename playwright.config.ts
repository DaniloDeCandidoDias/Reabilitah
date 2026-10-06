import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/web',
  workers: 1,
  fullyParallel: false,
  use: { baseURL: 'http://localhost:3001', browserName: 'chromium', screenshot: 'only-on-failure' },
  webServer: {
    command: 'npm run dev -- --port 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      DATABASE_URL: 'postgresql://reabilitah_app_test@127.0.0.1:55439/reabilitah',
      APP_ORIGIN: 'http://localhost:3001',
      SUPPORT_EMAIL: '',
      NEXT_DIST_DIR: '.next-test',
    },
  },
});
