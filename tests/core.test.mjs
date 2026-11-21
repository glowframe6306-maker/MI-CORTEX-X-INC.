import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CortexCore } from '../core.js';

async function createCore() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-core-'));
  const core = new CortexCore(dir);
  await core.init();
  return { core, dir };
}

async function register(core, name, scopes = ['global']) {
  return core.registerProject(name, { scopes, role: name === 'Admin' ? 'admin' : 'connector' });
}

test('A publishes bidirectionally and B/C receive the event', async () => {
  const { core } = await createCore();
  const a = await register(core, 'A');
  const b = await register(core, 'B');
  const c = await register(core, 'C');
  await core.setData(a.project.id, 'global', 'shared-1', { title: 'from A' }, { idempotencyKey: 'evt-a-1' });
  assert.equal(core.eventsSince(b.project.id).length, 1);
  assert.equal(core.eventsSince(c.project.id).length, 1);
  assert.equal(core.getData(b.project, 'global')[0].value.title, 'from A');
});

test('B and C publish updates and no event re-enters its origin', async () => {
  const { core } = await createCore();
  const a = await register(core, 'A');
  const b = await register(core, 'B');
  const c = await register(core, 'C');
  await core.setData(b.project.id, 'global', 'shared-b', { title: 'from B' }, { idempotencyKey: 'evt-b-1' });
  await core.setData(c.project.id, 'global', 'shared-c', { title: 'from C' }, { idempotencyKey: 'evt-c-1' });
  assert.equal(core.eventsSince(a.project.id).length, 2);
  assert.equal(core.eventsSince(b.project.id).length, 1);
  assert.equal(core.eventsSince(c.project.id).length, 1);
});

test('duplicate event ID and idempotency key are deduplicated', async () => {
  const { core } = await createCore();
  const a = await register(core, 'A');
  await core.setData(a.project.id, 'global', 'duplicate', { value: 1 }, { idempotencyKey: 'same-key' });
  const event = core.db.events[0];
  const result = await core.publishEvent(a.project.id, event);
  assert.equal(result.duplicate, true);
  assert.equal(core.db.events.length, 1);
});

test('stale updates create conflicts instead of overwriting newer data', async () => {
  const { core } = await createCore();
  const a = await register(core, 'A');
  await core.setData(a.project.id, 'global', 'conflict', { value: 'new' }, { version: 5, idempotencyKey: 'new-1' });
  await core.publishEvent(a.project.id, {
    eventId: 'stale-event', idempotencyKey: 'stale-key', entityId: 'conflict', entityType: 'record',
    operation: 'upsert', version: 4, timestamp: new Date().toISOString(), scope: 'global', payload: { value: 'old' }
  });
  assert.equal(core.db.conflicts.length, 1);
  assert.equal(core.db.data['global:record:conflict'].value.value, 'new');
});

test('unauthorized project scope is blocked', async () => {
  const { core } = await createCore();
  const a = await register(core, 'A', ['private-a']);
  await assert.rejects(() => core.setData(a.project.id, 'global', 'blocked', { value: 1 }), /Scope not authorized/);
});

test('file upload creates version history, integrity, delete, and recovery metadata', async () => {
  const { core } = await createCore();
  const a = await register(core, 'A');
  const first = await core.uploadFile(a.project.id, 'global', 'brief.txt', Buffer.from('first').toString('base64'), { entityId: 'brief', contentType: 'text/plain' });
  const second = await core.uploadFile(a.project.id, 'global', 'brief.txt', Buffer.from('second').toString('base64'), { entityId: 'brief', contentType: 'text/plain' });
  assert.equal(second.version, 2);
  assert.equal(second.history.length, 1);
  assert.equal(second.integrity.length, 64);
  await core.deleteFile(a.project.id, 'global', 'brief');
  assert.equal(core.db.files['global:file:brief'].deleted, true);
  assert.equal(core.db.files['global:file:brief'].history.length, 1);
});

test('shared record deletion propagates and file restore remains recoverable', async () => {
  const { core } = await createCore();
  const a = await register(core, 'A');
  await core.setData(a.project.id, 'global', 'delete-me', { value: 1 }, { idempotencyKey: 'keep-delete-1' });
  await core.deleteData(a.project.id, 'global', 'delete-me', { idempotencyKey: 'keep-delete-2' });
  assert.equal(core.db.data['global:record:delete-me'].deleted, true);

  await core.uploadFile(a.project.id, 'global', 'recover.txt', Buffer.from('recover').toString('base64'), { entityId: 'recover', contentType: 'text/plain' });
  await core.deleteFile(a.project.id, 'global', 'recover');
  await core.restoreFile(a.project.id, 'global', 'recover');
  assert.equal(core.db.files['global:file:recover'].deleted, false);
});

test('offline checkpoint and event replay remain explicit', async () => {
  const { core } = await createCore();
  const a = await register(core, 'A');
  const b = await register(core, 'B');
  await core.setData(a.project.id, 'global', 'offline-1', { value: 1 }, { idempotencyKey: 'offline-key' });
  const replay = core.eventsSince(b.project.id, 0);
  core.setCheckpoint(b.project.id, 1);
  assert.equal(replay.length, 1);
  assert.equal(core.db.checkpoints[b.project.id].checkpoint, 1);
});

test('project token rotation and revocation invalidate old credentials', async () => {
  const { core } = await createCore();
  const result = await register(core, 'A');
  const oldToken = result.token;
  const newToken = await core.rotateProjectToken(result.project.id);
  assert.equal(core.authenticateProject(oldToken), null);
  assert.equal(core.authenticateProject(newToken).id, result.project.id);
  await core.revokeProject(result.project.id);
  assert.equal(core.authenticateProject(newToken), null);
});

test('connector authentication uses a bearer token and stores only its hash', async () => {
  const { core } = await createCore();
  const result = await register(core, 'A');
  assert.equal(result.project.tokenHash, undefined);
  assert.equal(core.db.projects[result.project.id].tokenHash.length, 64);
  assert.equal(core.authenticateProject(result.token).id, result.project.id);
  assert.equal(core.authenticateProject('wrong-token'), null);
});
