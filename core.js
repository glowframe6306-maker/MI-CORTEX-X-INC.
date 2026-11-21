import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { JsonStorage } from './storage-adapter.js';

const now = () => new Date().toISOString();

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export class CortexCore {
  constructor(dataDir, storage = null) {
    this.dataDir = dataDir;
    this.dbFile = path.join(dataDir, 'core.json');
    this.storage = storage || new JsonStorage(this.dbFile);
    this.filesDir = path.join(dataDir, 'files');
    this.db = {
      projects: {},
      data: {},
      files: {},
      events: [],
      processedEvents: {},
      outbox: {},
      checkpoints: {},
      conflicts: [],
      audit: []
    };
  }

  async init() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(this.filesDir, { recursive: true });
    this.db = await this.storage.load(this.db);
    await this.persist();
  }

  async persist() {
    await this.storage.save(this.db);
  }

  audit(projectId, action, details = {}) {
    this.db.audit.push({ id: crypto.randomUUID(), projectId: projectId || null, action, details, timestamp: now() });
  }

  async registerProject(name, options = {}) {
    const projectId = options.projectId || crypto.randomUUID();
    if (this.db.projects[projectId]) throw new Error('Project already exists.');
    const token = crypto.randomBytes(32).toString('hex');
    this.db.projects[projectId] = {
      id: projectId,
      name,
      scopes: options.scopes || ['global'],
      role: options.role || 'connector',
      tokenHash: sha256(token),
      status: 'connected',
      createdAt: now(),
      lastSyncAt: null
    };
    this.audit(projectId, 'project.registered', { name });
    await this.persist();
    return { project: { ...this.db.projects[projectId], tokenHash: undefined }, token };
  }

  authenticateProject(token) {
    if (!token) return null;
    const tokenHash = sha256(token);
    return Object.values(this.db.projects).find((project) => project.status === 'connected' && project.tokenHash === tokenHash) || null;
  }

  async rotateProjectToken(projectId) {
    const project = this.db.projects[projectId];
    if (!project) throw new Error('Unknown project.');
    const token = crypto.randomBytes(32).toString('hex');
    project.tokenHash = sha256(token);
    project.rotatedAt = now();
    this.audit(projectId, 'project.token_rotated', {});
    await this.persist();
    return token;
  }

  async revokeProject(projectId) {
    const project = this.db.projects[projectId];
    if (!project) throw new Error('Unknown project.');
    project.status = 'revoked';
    project.revokedAt = now();
    this.audit(projectId, 'project.revoked', {});
    await this.persist();
  }

  allowedScope(project, scope) {
    return project.scopes.includes('global') || project.scopes.includes(scope);
  }

  async publishEvent(projectId, event) {
    const project = this.db.projects[projectId];
    if (!project) throw new Error('Unknown project.');
    const required = ['eventId', 'entityId', 'entityType', 'operation', 'version', 'timestamp', 'scope', 'idempotencyKey'];
    if (required.some((key) => event[key] === undefined || event[key] === null)) throw new Error('Invalid event payload.');

    const duplicate = this.db.events.find((item) => item.eventId === event.eventId || item.idempotencyKey === event.idempotencyKey);
    if (duplicate) {
      return { duplicate: true, event: duplicate };
    }

    const normalized = {
      ...event,
      eventId: event.eventId,
      projectId,
      originProjectId: event.originProjectId || projectId,
      operation: event.operation.toLowerCase()
    };

    this.db.events.push(normalized);
    this.db.processedEvents[normalized.eventId] = {
      projectId,
      processedAt: now()
    };

    const eventKey = `${normalized.scope}:${normalized.entityType}:${normalized.entityId}`;
    if (normalized.operation === 'delete') {
      const existing = this.db.data[eventKey];
      if (existing && existing.version > normalized.version) {
        this.db.conflicts.push({ eventKey, reason: 'stale-delete', local: existing, incoming: normalized, timestamp: now() });
      } else {
        this.db.data[eventKey] = {
          scope: normalized.scope,
          entityType: normalized.entityType,
          entityId: normalized.entityId,
          value: null,
          deleted: true,
          version: normalized.version,
          updatedAt: normalized.timestamp,
          originProjectId: normalized.projectId,
          history: [...(existing?.history || []), existing].filter(Boolean)
        };
      }
    } else {
      const existing = this.db.data[eventKey];
      if (existing && existing.deleted === false && existing.version === normalized.version && existing.value !== normalized.payload) {
        this.db.conflicts.push({ eventKey, reason: 'same-version-conflict', local: existing, incoming: normalized, timestamp: now() });
      } else if (existing && existing.version > normalized.version) {
        this.db.conflicts.push({ eventKey, reason: 'stale-update', local: existing, incoming: normalized, timestamp: now() });
      } else {
        this.db.data[eventKey] = {
          scope: normalized.scope,
          entityType: normalized.entityType,
          entityId: normalized.entityId,
          value: normalized.payload,
          deleted: false,
          version: normalized.version,
          updatedAt: normalized.timestamp,
          originProjectId: normalized.projectId,
          history: [...(existing?.history || []), existing].filter(Boolean)
        };
      }
    }

    for (const targetId of Object.keys(this.db.projects)) {
      if (targetId !== projectId) this.db.outbox[targetId] = [...(this.db.outbox[targetId] || []), normalized.eventId];
    }
    project.lastSyncAt = now();
    this.audit(projectId, 'event.published', { eventId: normalized.eventId, entityId: normalized.entityId, operation: normalized.operation });
    await this.persist();
    return { duplicate: false, event: normalized };
  }

  async setData(projectId, scope, entityId, payload, options = {}) {
    const project = this.db.projects[projectId];
    if (!project || !this.allowedScope(project, scope)) throw new Error('Scope not authorized.');
    const eventKey = `${scope}:record:${entityId}`;
    const existing = this.db.data[eventKey];
    const version = options.version || ((existing?.version || 0) + 1);
    return this.publishEvent(projectId, {
      eventId: crypto.randomUUID(),
      idempotencyKey: options.idempotencyKey || crypto.randomUUID(),
      entityId,
      entityType: 'record',
      operation: 'upsert',
      version,
      timestamp: now(),
      scope,
      payload
    });
  }

  async deleteData(projectId, scope, entityId, options = {}) {
    const project = this.db.projects[projectId];
    if (!project || !this.allowedScope(project, scope)) throw new Error('Scope not authorized.');
    const eventKey = `${scope}:record:${entityId}`;
    const existing = this.db.data[eventKey];
    if (!existing) throw new Error('Record not found.');
    const version = options.version || existing.version + 1;
    return this.publishEvent(projectId, {
      eventId: crypto.randomUUID(),
      idempotencyKey: options.idempotencyKey || sha256(`record-delete:${entityId}:${version}`),
      entityId,
      entityType: 'record',
      operation: 'delete',
      version,
      timestamp: now(),
      scope,
      payload: null
    });
  }

  getData(project, scope) {
    if (!this.allowedScope(project, scope)) throw new Error('Scope not authorized.');
    return Object.values(this.db.data).filter((item) => item.scope === scope && item.deleted === false);
  }

  async uploadFile(projectId, scope, fileName, contentBase64, metadata = {}) {
    const project = this.db.projects[projectId];
    if (!project || !this.allowedScope(project, scope)) throw new Error('Scope not authorized.');
    const content = Buffer.from(contentBase64 || '', 'base64');
    if (!content.length) throw new Error('File content required.');
    const integrity = sha256(content);
    const entityId = metadata.entityId || crypto.randomUUID();
    const key = `${scope}:file:${entityId}`;
    const existing = this.db.files[key];
    const version = (existing?.version || 0) + 1;
    const safeName = path.basename(fileName || 'file');
    const storedName = `${entityId}-${version}-${integrity.slice(0,12)}${path.extname(safeName)}`;
    await fs.writeFile(path.join(this.filesDir, storedName), content);

    const record = {
      entityId,
      scope,
      fileName: safeName,
      size: content.length,
      integrity,
      contentType: metadata.contentType || 'application/octet-stream',
      deleted: false,
      version,
      updatedAt: now(),
      originProjectId: projectId,
      storedName,
      history: [...(existing?.history || [])]
    };
    if (existing) record.history.push({ ...existing, history: undefined });
    this.db.files[key] = record;

    await this.publishEvent(projectId, {
      eventId: crypto.randomUUID(),
      idempotencyKey: sha256(`file:${entityId}:${version}:${integrity}`),
      entityId,
      entityType: 'file',
      operation: 'upsert',
      version,
      timestamp: record.updatedAt,
      scope,
      payload: { fileName: safeName, integrity, size: content.length, contentType: record.contentType }
    });
    this.audit(projectId, 'file.uploaded', { entityId, version, integrity });
    await this.persist();
    return record;
  }

  getFile(project, scope, entityId) {
    if (!this.allowedScope(project, scope)) throw new Error('Scope not authorized.');
    const record = this.db.files[`${scope}:file:${entityId}`];
    if (!record || record.deleted) return null;
    return record;
  }

  async restoreFile(projectId, scope, entityId) {
    const project = this.db.projects[projectId];
    if (!project || !this.allowedScope(project, scope)) throw new Error('Scope not authorized.');
    const key = `${scope}:file:${entityId}`;
    const existing = this.db.files[key];
    if (!existing) throw new Error('File not found.');
    existing.deleted = false;
    existing.version += 1;
    existing.updatedAt = now();
    await this.publishEvent(projectId, {
      eventId: crypto.randomUUID(),
      idempotencyKey: sha256(`file-restore:${entityId}:${existing.version}`),
      entityId,
      entityType: 'file',
      operation: 'upsert',
      version: existing.version,
      timestamp: existing.updatedAt,
      scope,
      payload: { fileName: existing.fileName, integrity: existing.integrity, size: existing.size, contentType: existing.contentType }
    });
    await this.persist();
  }

  async deleteFile(projectId, scope, entityId) {
    const project = this.db.projects[projectId];
    if (!project || !this.allowedScope(project, scope)) throw new Error('Scope not authorized.');
    const key = `${scope}:file:${entityId}`;
    const existing = this.db.files[key];
    if (!existing) throw new Error('File not found.');
    existing.deleted = true;
    existing.version += 1;
    existing.updatedAt = now();
    await this.publishEvent(projectId, {
      eventId: crypto.randomUUID(),
      idempotencyKey: sha256(`file-delete:${entityId}:${existing.version}`),
      entityId,
      entityType: 'file',
      operation: 'delete',
      version: existing.version,
      timestamp: existing.updatedAt,
      scope,
      payload: null
    });
    await this.persist();
  }

  eventsSince(projectId, after = 0) {
    const project = this.db.projects[projectId];
    if (!project) throw new Error('Unknown project.');
    return this.db.events.filter((event, index) => index >= after
      && event.originProjectId !== projectId
      && this.allowedScope(project, event.scope));
  }

  setCheckpoint(projectId, checkpoint) {
    if (!this.db.projects[projectId]) throw new Error('Unknown project.');
    this.db.checkpoints[projectId] = { checkpoint, timestamp: now() };
  }

  dashboard(project) {
    if (!project || project.role !== 'admin') throw new Error('Admin authorization required.');
    return {
      projects: Object.values(this.db.projects).map((item) => ({ ...item, tokenHash: undefined })),
      fileCount: Object.values(this.db.files).filter((item) => !item.deleted).length,
      recordCount: Object.values(this.db.data).filter((item) => !item.deleted).length,
      eventCount: this.db.events.length,
      conflictCount: this.db.conflicts.length,
      conflicts: this.db.conflicts,
      audit: this.db.audit.slice(-100),
      checkpoints: this.db.checkpoints
    };
  }
}
