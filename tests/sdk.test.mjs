import test from 'node:test';
import assert from 'node:assert/strict';
import { CortexConnector } from '../sdk/cortex-connector.js';
import { ThreeAConnector } from '../connectors/3a.js';

test('SDK queues failed requests and exposes retry state', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
  const connector = new CortexConnector({ baseUrl: 'http://localhost:3100', projectId: 'A', token: 'test-token' });
  await assert.rejects(() => connector.publish({ eventId: 'e1' }), /Core request failed/);
  assert.equal(connector.queue.length, 1);
  globalThis.fetch = originalFetch;
});

test('3A connector remains blocked until owner enrollment exists', () => {
  const connector = new ThreeAConnector({ coreUrl: 'http://localhost:3100', projectToken: 'test', projectId: '3a-mission' });
  assert.throws(() => connector.pollSync(), /blocked until trusted owner enrollment/);
  assert.throws(() => connector.publish(), /blocked until trusted owner enrollment/);
});

test('SDK sends bearer authentication and serializes data updates', async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return { ok: true, status: 200, json: async () => ({ ready: true }) };
  };
  const connector = new CortexConnector({ baseUrl: 'http://localhost:3100/', projectId: 'A', token: 'secret-token' });
  await connector.setData('global', 'item-1', { value: 42 }, { idempotencyKey: 'id-1' });
  assert.equal(captured.url, 'http://localhost:3100/api/data');
  assert.equal(captured.options.headers.Authorization, 'Bearer secret-token');
  assert.match(captured.options.body, /item-1/);
  globalThis.fetch = originalFetch;
});
