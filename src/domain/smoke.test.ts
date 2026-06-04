import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const root = process.cwd();

describe('bootstrap smoke', () => {
  it('has an app shell', async () => {
    const page = await import('../../app/page');
    expect(page.default).toBeTypeOf('function');
  });

  it('documents persistent env loader', () => {
    expect(existsSync(`${root}/scripts/dev/load-social-controller-env.sh`)).toBe(true);
    const loader = readFileSync(`${root}/scripts/dev/load-social-controller-env.sh`, 'utf8');
    expect(loader).toContain('~/.config/social-controller/env'.replace('~', '$HOME'));
    expect(loader).not.toContain('BUFFER_API_KEY');
  });

  it('keeps secrets and local databases ignored', () => {
    const gitignore = readFileSync(`${root}/.gitignore`, 'utf8');
    expect(gitignore).toContain('.env');
    expect(gitignore).toContain('.local/');
    expect(gitignore).toContain('dev.db');
    expect(gitignore).toContain('*.db');
  });
});
