import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const root = process.cwd();

describe('bootstrap smoke', () => {
  it('has an app shell', async () => {
    const page = await import('../../app/page');
    expect(page.default).toBeTypeOf('function');
  });

  it('documents persistent env loader', () => {
    expect(existsSync(`${root}/scripts/dev/load-poxter-env.sh`)).toBe(true);
    expect(existsSync(`${root}/scripts/dev/load-social-controller-env.sh`)).toBe(false);
    const loader = readFileSync(`${root}/scripts/dev/load-poxter-env.sh`, 'utf8');
    expect(loader).toContain('~/.config/poxter/env'.replace('~', '$HOME'));
    expect(loader).toContain('PoXter env file missing');
    expect(loader).toContain('POXTER_HOST');
    expect(loader).toContain('POXTER_PORT');
    expect(loader).not.toContain('BUFFER_API_KEY');
    expect(loader).not.toContain('SOCIAL_CONTROLLER');
  });

  it('keeps secrets and local databases ignored', () => {
    const gitignore = readFileSync(`${root}/.gitignore`, 'utf8');
    expect(gitignore).toContain('.env');
    expect(gitignore).toContain('.local/');
    expect(gitignore).toContain('dev.db');
    expect(gitignore).toContain('*.db');
  });
});
