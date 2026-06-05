import { resolve } from 'node:path';
import { beforeEach, vi } from 'vitest';

process.env.POXTER_BRANDS_FILE = resolve(process.cwd(), 'tests/fixtures/brands.test.json');
process.env.DATABASE_URL = `file:${resolve(process.cwd(), 'test.db')}`;

beforeEach(() => {
  process.env.POXTER_BRANDS_FILE = resolve(process.cwd(), 'tests/fixtures/brands.test.json');
  process.env.DATABASE_URL = `file:${resolve(process.cwd(), 'test.db')}`;
  vi.unstubAllEnvs();
});
