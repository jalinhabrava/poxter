import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();

function envWithHome(home: string) {
  const env = { ...process.env, HOME: home };
  delete env.DATABASE_URL;
  delete env.POXTER_HOST;
  delete env.POXTER_PORT;
  delete env.BUFFER_API_KEY;
  return env;
}

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
    expect(loader).toContain('Optional local env file not found; using repo-local defaults.');
    expect(loader).toContain('POXTER_HOST');
    expect(loader).toContain('POXTER_PORT');
    expect(loader).not.toContain('BUFFER_API_KEY');
    expect(loader).not.toContain('SOCIAL_CONTROLLER');
    expect(loader).not.toContain('/home/david');
  });

  it('uses repo-root sqlite fallback when env file missing', () => {
    const home = mkdtempSync(join(tmpdir(), 'poxter-home-'));
    try {
      const output = execFileSync(
        'bash',
        ['-lc', 'source scripts/dev/load-poxter-env.sh && printf "%s\n%s\n%s\n" "$DATABASE_URL" "$POXTER_HOST" "$POXTER_PORT"'],
        {
          cwd: root,
          env: envWithHome(home),
          encoding: 'utf8'
        }
      );

      expect(output).toContain(`file:${root}/dev.db`);
      expect(output).toContain('0.0.0.0');
      expect(output).toContain('3000');
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('loads local env without printing secrets', () => {
    const home = mkdtempSync(join(tmpdir(), 'poxter-home-'));
    try {
      const configDir = join(home, '.config', 'poxter');
      writeFileSync(join(home, '.keep'), 'ok');
      execFileSync('mkdir', ['-p', configDir]);
      writeFileSync(
        join(configDir, 'env'),
        'DATABASE_URL="file:/tmp/custom.db"\nPOXTER_HOST="127.0.0.1"\nPOXTER_PORT="4010"\nBUFFER_API_KEY="top-secret"\n'
      );

      const output = execFileSync(
        'bash',
        ['-lc', 'source scripts/dev/load-poxter-env.sh >/tmp/poxter-loader-test.err && printf "%s\n%s\n%s\n" "$DATABASE_URL" "$POXTER_HOST" "$POXTER_PORT" && cat /tmp/poxter-loader-test.err'],
        {
          cwd: root,
          env: envWithHome(home),
          encoding: 'utf8'
        }
      );

      expect(output).toContain('file:/tmp/custom.db');
      expect(output).toContain('127.0.0.1');
      expect(output).toContain('4010');
      expect(output).not.toContain('top-secret');
      expect(output).not.toContain('BUFFER_API_KEY');
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync('/tmp/poxter-loader-test.err', { force: true });
    }
  });

  it('keeps active setup paths portable in package and docs', () => {
    const packageJson = readFileSync(`${root}/package.json`, 'utf8');
    const readme = readFileSync(`${root}/README.md`, 'utf8');
    const localDevDoc = readFileSync(`${root}/docs/local-dev-env.md`, 'utf8');

    expect(packageJson).not.toContain('/home/david');
    expect(readme).not.toContain('/home/david');
    expect(localDevDoc).not.toContain('/home/david');
  });

  it('keeps secrets and local databases ignored', () => {
    const gitignore = readFileSync(`${root}/.gitignore`, 'utf8');
    expect(gitignore).toContain('.env');
    expect(gitignore).toContain('.local/');
    expect(gitignore).toContain('dev.db');
    expect(gitignore).toContain('*.db');
  });
});
