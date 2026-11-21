import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CortexCore } from './core.js';
import { JsonStorage, NeonStorage } from './storage-adapter.js';

const port = Number(process.env.PORT || 3100);
const dataDir = process.env.CORTEX_DATA_DIR || path.join(process.cwd(), '.data');
const storage = process.env.CORTEX_DATABASE_URL
  ? new NeonStorage(process.env.CORTEX_DATABASE_URL)
  : new JsonStorage(path.join(dataDir, 'core.json'));
const core = new CortexCore(dataDir, storage);
await core.init();

const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

const readJson = async (req) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  if (!body) return {};
  if (body.length > 8 * 1024 * 1024) throw new Error('Payload too large.');
  return JSON.parse(body);
};

const bearerToken = (req) => {
  const value = req.headers.authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7) : null;
};

const publicProject = (project) => project ? ({ ...project, tokenHash: undefined }) : null;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let project = null;
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ready: true });
    if (req.method === 'GET' && url.pathname === '/') {
      const html = await fs.readFile(path.join(process.cwd(), 'public', 'index.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    if (req.method === 'POST' && url.pathname === '/api/projects') {
      const bootstrap = req.headers['x-cortex-bootstrap'];
      if (!process.env.CORTEX_BOOTSTRAP_TOKEN || bootstrap !== process.env.CORTEX_BOOTSTRAP_TOKEN) return send(res, 401, { error: 'Bootstrap authorization required.' });
      const body = await readJson(req);
      if (!body.name) return send(res, 400, { error: 'Project name is required.' });
      const result = await core.registerProject(body.name, { projectId: body.projectId, scopes: body.scopes, role: body.role });
      return send(res, 201, result);
    }

    project = core.authenticateProject(bearerToken(req));
    if (!project) return send(res, 401, { error: 'Connector authentication required.' });

    if (req.method === 'POST' && url.pathname === '/api/events') {
      const body = await readJson(req);
      const result = await core.publishEvent(project.id, body);
      return send(res, result.duplicate ? 200 : 202, result);
    }
    if (req.method === 'POST' && url.pathname === '/api/data') {
      const body = await readJson(req);
      const result = await core.setData(project.id, body.scope || 'global', body.entityId, body.payload, { version: body.version, idempotencyKey: body.idempotencyKey });
      return send(res, 202, result);
    }
    if (req.method === 'DELETE' && url.pathname.startsWith('/api/data/')) {
      const entityId = url.pathname.split('/').at(-1);
      await core.deleteData(project.id, url.searchParams.get('scope') || 'global', entityId);
      return send(res, 200, { deleted: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/data') {
      const scope = url.searchParams.get('scope') || 'global';
      return send(res, 200, { data: core.getData(project, scope) });
    }
    if (req.method === 'POST' && url.pathname === '/api/files') {
      const body = await readJson(req);
      const record = await core.uploadFile(project.id, body.scope || 'global', body.fileName, body.contentBase64, body.metadata);
      return send(res, 201, { file: record });
    }
    if (req.method === 'GET' && url.pathname.startsWith('/api/files/')) {
      const parts = url.pathname.split('/');
      const entityId = parts.at(-1);
      const scope = url.searchParams.get('scope') || 'global';
      const record = core.getFile(project, scope, entityId);
      if (!record) return send(res, 404, { error: 'File not found.' });
      const content = await fs.readFile(path.join(dataDir, 'files', record.storedName));
      res.writeHead(200, { 'Content-Type': record.contentType, 'Content-Disposition': `inline; filename="${record.fileName}"`, 'Cache-Control': 'no-store' });
      return res.end(content);
    }
    if (req.method === 'POST' && url.pathname.endsWith('/restore')) {
      const segments = url.pathname.split('/');
      const entityId = segments.at(-2);
      await core.restoreFile(project.id, url.searchParams.get('scope') || 'global', entityId);
      return send(res, 200, { restored: true });
    }
    if (req.method === 'DELETE' && url.pathname.startsWith('/api/files/')) {
      const entityId = url.pathname.split('/').at(-1);
      await core.deleteFile(project.id, url.searchParams.get('scope') || 'global', entityId);
      return send(res, 200, { deleted: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/events') {
      const after = Number(url.searchParams.get('after') || 0);
      return send(res, 200, { events: core.eventsSince(project.id, after) });
    }
    if (req.method === 'POST' && url.pathname === '/api/checkpoints') {
      const body = await readJson(req);
      core.setCheckpoint(project.id, body.checkpoint);
      await core.persist();
      return send(res, 200, { checkpoint: core.db.checkpoints[project.id] });
    }
    if (req.method === 'GET' && url.pathname === '/api/admin/dashboard') {
      return send(res, 200, core.dashboard(project));
    }
    const rotateMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/rotate-token$/);
    if (req.method === 'POST' && rotateMatch) {
      if (project.role !== 'admin') return send(res, 403, { error: 'Admin authorization required.' });
      const token = await core.rotateProjectToken(decodeURIComponent(rotateMatch[1]));
      return send(res, 200, { token });
    }
    const revokeMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/revoke$/);
    if (req.method === 'POST' && revokeMatch) {
      if (project.role !== 'admin') return send(res, 403, { error: 'Admin authorization required.' });
      await core.revokeProject(decodeURIComponent(revokeMatch[1]));
      return send(res, 200, { revoked: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/project') {
      return send(res, 200, { project: publicProject(project) });
    }

    return send(res, 404, { error: 'Endpoint not found.' });
  } catch (error) {
    core.audit(project?.id || null, 'api.error', { message: error.message });
    core.persist().catch(() => {});
    return send(res, error.message.includes('authorized') ? 403 : 400, { error: error.message });
  }
});

server.listen(port, () => console.log(`MI CORTEX Global Core listening on http://localhost:${port}`));
