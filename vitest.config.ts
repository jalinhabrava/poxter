import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    fileParallelism: false,
    maxWorkers: 1,
    env: {
      DATABASE_URL: `file:${resolve(process.cwd(), 'test.db')}`
    }
  }
});
