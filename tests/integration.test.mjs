import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CortexConnector } from '../sdk/cortex-connector.js';

async function waitForHealth(baseUrl) {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Core server did not become healthy.');
}

test('HTTP connector-to-Core-to-connector A/B/C synchronization', async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-http-'));
  const port = 3199;
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: {
      ...process.env,
      PORT: String(port),
      CORTEX_DATA_DIR: dataDir,
      CORTEX_BOOTSTRAP_TOKEN: 'integration-bootstrap'
    },
    stdio: 'ignore'
  });
  t.after(() => child.kill());

  await waitForHealth(baseUrl);

  const register = async (name) => {
    const response = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Cortex-Bootstrap': 'integration-bootstrap' },
      body: JSON.stringify({ name, projectId: name, scopes: ['global'] })
    });
    assert.equal(response.status, 201);
    return response.json();
  };

  const a = await register('A');
  const b = await register('B');
  const c = await register('C');
  const connectorA = new CortexConnector({ baseUrl, projectId: 'A', token: a.token });
  const connectorB = new CortexConnector({ baseUrl, projectId: 'B', token: b.token });
  const connectorC = new CortexConnector({ baseUrl, projectId: 'C', token: c.token });

  await connectorA.setData('global', 'from-a', { title: 'A update' }, { idempotencyKey: 'http-integration-a' });
  const bEvents = await connectorB.getEvents();
  const cEvents = await connectorC.getEvents();
  assert.equal(bEvents.events.length, 1);
  assert.equal(cEvents.events.length, 1);
  assert.equal(bEvents.events[0].payload.title, 'A update');
  assert.equal(cEvents.events[0].payload.title, 'A update');

  await connectorB.setData('global', 'from-b', { title: 'B update' }, { idempotencyKey: 'http-integration-b' });
  const aEvents = await connectorA.getEvents();
  assert.equal(aEvents.events.some((event) => event.entityId === 'from-b'), true);

  await fs.rm(dataDir, { recursive: true, force: true });
});
