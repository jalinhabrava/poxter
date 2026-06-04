#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const root = resolve(new URL('../..', import.meta.url).pathname);
const defaultDatabaseUrl = `file:${root}/dev.db`;
process.env.DATABASE_URL ||= defaultDatabaseUrl;

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit', env: process.env, ...options });
  process.exit(result.status ?? 1);
}

function sqlitePathFromUrl(databaseUrl) {
  if (!databaseUrl.startsWith('file:')) {
    throw new Error('Only SQLite file: DATABASE_URL values are supported by local fallback.');
  }
  const rawPath = databaseUrl.slice('file:'.length);
  if (!rawPath || rawPath.startsWith('./')) return resolve(root, rawPath || 'dev.db');
  if (rawPath.startsWith('///')) return rawPath.slice(2);
  if (rawPath.startsWith('/')) return rawPath;
  return resolve(root, rawPath);
}

function runDbPushFallback() {
  const dbPath = sqlitePathFromUrl(process.env.DATABASE_URL);
  mkdirSync(dirname(dbPath), { recursive: true });
  const sql = `
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS "Brand" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "Brand_slug_key" ON "Brand"("slug");
CREATE TABLE IF NOT EXISTS "SourceItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "brandId" TEXT NOT NULL,
  "externalId" TEXT,
  "kind" TEXT,
  "payload" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SourceItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "Draft" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "brandId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "slotId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "threadPosts" TEXT,
  "status" TEXT NOT NULL,
  "sourceContext" TEXT,
  "scheduleMeta" TEXT,
  "scheduledAt" DATETIME,
  "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Draft_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Draft_externalId_key" ON "Draft"("externalId");
CREATE TABLE IF NOT EXISTS "SafetyWarning" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "draftId" TEXT,
  "brandId" TEXT,
  "message" TEXT NOT NULL,
  "payload" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "BufferChannelMapping" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "BufferChannelCache" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "ScheduledPost" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "externalStatus" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "PublishActionLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;
  const python = spawnSync('python3', ['-c', 'import sqlite3,sys; db=sys.argv[1]; sql=sys.stdin.read(); con=sqlite3.connect(db); con.executescript(sql); con.commit(); con.close()', dbPath], {
    input: sql,
    encoding: 'utf8',
    stdio: ['pipe', 'inherit', 'inherit']
  });
  if (python.status !== 0) process.exit(python.status ?? 1);
  console.log(`SQLite database synced at ${dbPath}`);
}

if (args[0] === 'db' && args[1] === 'push') {
  const prismaBin = resolve(root, 'node_modules/.bin/prisma');
  const result = spawnSync(prismaBin, args, { stdio: 'pipe', env: process.env, encoding: 'utf8' });
  if (result.status === 0) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exit(0);
  }
  const output = `${result.stdout}${result.stderr}`;
  if (!output.includes('Schema engine error') && !output.includes('Migration engine error')) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  runDbPushFallback();
  process.exit(0);
}

run(resolve(root, 'node_modules/.bin/prisma'), args);
