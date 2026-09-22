import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createApp } from '../dist/app.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../', import.meta.url));

async function startApp(app) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, 'object');
  return {
    server,
    origin: `http://127.0.0.1:${address.port}`,
  };
}

async function stopServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => error === undefined ? resolve() : reject(error));
  });
}

test('production serving returns static files, preserves API priority, and uses SPA fallback', async () => {
  const clientDistPath = await mkdtemp(join(tmpdir(), 'fitness-rpg-client-dist-'));
  await mkdir(join(clientDistPath, 'assets'));
  await writeFile(join(clientDistPath, 'index.html'), '<!doctype html><title>Fitness RPG</title>');
  await writeFile(join(clientDistPath, 'assets', 'app.js'), 'window.fitnessRpg = true;');

  const { server, origin } = await startApp(createApp(undefined, undefined, undefined, {
    serveClientStatic: true,
    clientDistPath,
  }));

  try {
    const root = await fetch(`${origin}/`);
    assert.equal(root.status, 200);
    assert.match(await root.text(), /Fitness RPG/);

    const asset = await fetch(`${origin}/assets/app.js`);
    assert.equal(asset.status, 200);
    assert.equal(await asset.text(), 'window.fitnessRpg = true;');

    const health = await fetch(`${origin}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });

    const missingApi = await fetch(`${origin}/api/unknown`);
    assert.equal(missingApi.status, 404);
    assert.deepEqual(await missingApi.json(), { error: { code: 'NOT_FOUND' } });

    const spaRoute = await fetch(`${origin}/adventure`);
    assert.equal(spaRoute.status, 200);
    assert.match(await spaRoute.text(), /Fitness RPG/);
  } finally {
    await stopServer(server);
    await rm(clientDistPath, { recursive: true, force: true });
  }
});

test('development mode does not enable Express static serving', async () => {
  const clientDistPath = await mkdtemp(join(tmpdir(), 'fitness-rpg-client-dist-'));
  await writeFile(join(clientDistPath, 'index.html'), '<!doctype html><title>Production only</title>');

  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  const app = createApp(undefined, undefined, undefined, { clientDistPath });
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }

  const { server, origin } = await startApp(app);
  try {
    const root = await fetch(`${origin}/`);
    assert.equal(root.status, 404);
  } finally {
    await stopServer(server);
    await rm(clientDistPath, { recursive: true, force: true });
  }
});

test('production startup honors PORT without an OpenAI request', async () => {
  const child = spawn(process.execPath, ['dist/productionStartup.js'], {
    cwd: join(REPOSITORY_ROOT, 'server'),
    env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  const port = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Production server did not start.')), 5_000);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/Fitness RPG server listening on http:\/\/localhost:(\d+)/);
      if (match !== null) {
        clearTimeout(timeout);
        resolve(Number.parseInt(match[1], 10));
      }
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Production server exited before listening (${code}).`));
    });
  });

  try {
    assert.ok(port > 0);
    const health = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await once(child, 'exit');
    }
  }

  assert.equal(stderr, '');
});
