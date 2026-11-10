'use strict';

const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const {
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENTS,
  SESSION_TTL_SECONDS,
  SESSION_COOKIE,
  SITE_ADMIN_COOKIE,
  VALID_STATUSES,
  HttpError,
  cookie,
  decrypt,
  encrypt,
  getConfig,
  parseCookie,
  readJson,
  serializeDate,
  sessionHash,
  validateApplication,
  verifySameOrigin
} = require('./domain');
const { getDatabase } = require('./database');

const MAX_JSON_BYTES = 16 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonResponse(status, value, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      ...headers
    }
  });
}

function redirect(location, status = 303) {
  return new Response(null, {
    status,
    headers: { 'Cache-Control': 'no-store', Location: location }
  });
}

function headerStream(stream) {
  if (stream instanceof ReadableStream) return stream;
  if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
    const iterator = stream[Symbol.asyncIterator]();
    return new ReadableStream({
      async pull(controller) {
        const next = await iterator.next();
        if (next.done) controller.close();
        else controller.enqueue(new Uint8Array(next.value));
      },
      cancel(reason) {
        return iterator.return?.(reason);
      }
    });
  }
  throw new Error('Blob storage returned an unsupported stream.');
}

async function streamBytes(stream, maximumBytes) {
  const reader = headerStream(stream).getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximumBytes) throw new HttpError(400, 'Each supporting document must be a valid PDF of 10 MB or less.');
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, length);
}

function validateUploadPayload(payload, pathname) {
  let data;
  try {
    data = JSON.parse(payload || '');
  } catch {
    throw new HttpError(400, 'The upload metadata is invalid.');
  }
  if (
    !data
    || !UUID_PATTERN.test(data.batchId || '')
    || !UUID_PATTERN.test(data.documentId || '')
    || typeof data.name !== 'string'
    || !data.name.trim()
    || data.name.length > 180
    || !/\.pdf$/i.test(data.name)
    || /[\\/\u0000-\u001f]/.test(data.name)
    || pathname !== `private-careers/${data.batchId}/${data.documentId}.pdf`
  ) {
    throw new HttpError(400, 'The upload metadata is invalid.');
  }
  return { batchId: data.batchId, documentId: data.documentId, name: data.name.trim() };
}

function createServerlessHandler(options = {}) {
  const database = options.database || getDatabase;
  const blobs = options.blobs || require('@vercel/blob');
  const pages = options.pages || {};
  const dummyPasswordHash = options.dummyPasswordHash
    ? Promise.resolve(options.dummyPasswordHash)
    : bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);

  const getDb = () => typeof database === 'function' ? database() : database;

  async function checkRateLimit(db, scope, request, config, limit = 5, windowMs = 15 * 60 * 1000) {
    const address = request.headers.get('x-real-ip') || 'unknown';
    const keyHash = sessionHash(`${scope}:${address}`, config.sessionSecret);
    const result = await db.query(`
      INSERT INTO rate_limits (scope, key_hash, count, window_started_at)
      VALUES ($1, $2, 1, NOW())
      ON CONFLICT (scope, key_hash) DO UPDATE SET
        count = CASE
          WHEN rate_limits.window_started_at <= NOW() - ($3 * INTERVAL '1 millisecond') THEN 1
          ELSE rate_limits.count + 1
        END,
        window_started_at = CASE
          WHEN rate_limits.window_started_at <= NOW() - ($3 * INTERVAL '1 millisecond') THEN NOW()
          ELSE rate_limits.window_started_at
        END
      RETURNING count, window_started_at
    `, [scope, keyHash, windowMs]);
    const attempt = result.rows[0];
    if (Number(attempt.count) > limit) {
      const start = new Date(attempt.window_started_at).getTime();
      const retryAfter = Math.max(1, Math.ceil((start + windowMs - Date.now()) / 1000));
      throw new HttpError(429, 'Too many attempts. Try again later.', { 'Retry-After': String(retryAfter) });
    }
  }

  async function createSession(db, audience, principal, config) {
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
    await db.query(
      'INSERT INTO sessions (token_hash, audience, principal, expires_at) VALUES ($1, $2, $3, $4)',
      [sessionHash(token, config.sessionSecret), audience, principal, expiresAt]
    );
    return token;
  }

  async function getSession(db, request, audience, cookieName, config) {
    const token = parseCookie(request, cookieName);
    if (!token) return null;
    const tokenHash = sessionHash(token, config.sessionSecret);
    const result = await db.query(`
      UPDATE sessions SET expires_at = NOW() + ($3 * INTERVAL '1 second')
      WHERE token_hash = $1 AND audience = $2 AND expires_at > NOW()
      RETURNING principal, expires_at
    `, [tokenHash, audience, SESSION_TTL_SECONDS]);
    if (result.rows.length) return result.rows[0];
    await db.query('DELETE FROM sessions WHERE token_hash = $1 AND expires_at <= NOW()', [tokenHash]);
    return null;
  }

  async function requireSession(db, request, audience, cookieName, config) {
    const session = await getSession(db, request, audience, cookieName, config);
    if (!session) {
      throw new HttpError(401, audience === 'site_admin'
        ? 'Sign in to access the administrator dashboard.'
        : 'Sign in to manage applications.');
    }
    return session;
  }

  async function deleteSession(db, request, cookieName, config) {
    const token = parseCookie(request, cookieName);
    if (token) {
      await db.query('DELETE FROM sessions WHERE token_hash = $1', [sessionHash(token, config.sessionSecret)]);
    }
  }

  async function withTransaction(db, callback) {
    const client = typeof db.connect === 'function' ? await db.connect() : db;
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      if (client !== db && typeof client.release === 'function') client.release();
    }
  }

  async function isRecruitmentOpen(config) {
    return config.recruitmentApproved && Date.now() >= config.openAt.getTime();
  }

  async function handleUpload(request, db, config) {
    const body = await readJson(request, MAX_JSON_BYTES);
    const isTokenRequest = body.type === 'blob.generate-client-token';
    if (isTokenRequest) verifySameOrigin(request);
    return blobs.handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!await isRecruitmentOpen(config)) throw new HttpError(403, 'Applications are not open.');
        const upload = validateUploadPayload(clientPayload, pathname);
        const safePayload = JSON.stringify(upload);
        if (Buffer.byteLength(safePayload) > 512) throw new HttpError(400, 'The upload metadata is invalid.');
        const inserted = await db.query(`
          INSERT INTO documents (
            id, upload_batch_id, blob_pathname, encrypted_metadata,
            size_bytes, upload_complete, created_at, expires_at
          ) VALUES ($1, $2, $3, $4, 1, FALSE, NOW(), NOW() + INTERVAL '24 hours')
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        `, [
          upload.documentId,
          upload.batchId,
          pathname,
          encrypt({ name: upload.name }, config.encryptionKey)
        ]);
        if (!inserted.rows.length) {
          const existing = await db.query(`
            SELECT upload_batch_id, blob_pathname, upload_complete
            FROM documents WHERE id = $1
          `, [upload.documentId]);
          const row = existing.rows[0];
          if (!row || row.upload_batch_id !== upload.batchId || row.blob_pathname !== pathname || row.upload_complete) {
            throw new HttpError(409, 'This document upload has already been used.');
          }
        }
        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: MAX_DOCUMENT_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
          tokenPayload: safePayload
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const upload = validateUploadPayload(tokenPayload, blob.pathname);
        if (!Number.isSafeInteger(blob.size) || blob.size < 1 || blob.size > MAX_DOCUMENT_BYTES) {
          await blobs.del(blob.pathname, { access: 'private' });
          throw new HttpError(400, 'Each supporting document must be a valid PDF of 10 MB or less.');
        }
        const stored = await blobs.get(blob.pathname, { access: 'private' });
        if (!stored) throw new Error('The completed private upload could not be read.');
        const content = await streamBytes(stored.stream, MAX_DOCUMENT_BYTES);
        if (content.length !== blob.size || content.subarray(0, 5).toString('ascii') !== '%PDF-') {
          await blobs.del(blob.pathname, { access: 'private' });
          throw new HttpError(400, 'Each supporting document must be a valid PDF of 10 MB or less.');
        }
        const completed = await db.query(`
          UPDATE documents SET size_bytes = $1, upload_complete = TRUE
          WHERE id = $2 AND upload_batch_id = $3 AND blob_pathname = $4
            AND application_id IS NULL AND upload_complete = FALSE
          RETURNING id
        `, [
          blob.size,
          upload.documentId,
          upload.batchId,
          blob.pathname
        ]);
        if (!completed.rows.length) {
          const existing = await db.query(
            'SELECT blob_pathname, upload_complete, size_bytes FROM documents WHERE id = $1',
            [upload.documentId]
          );
          if (
            existing.rows[0]?.blob_pathname !== blob.pathname
            || !existing.rows[0]?.upload_complete
            || Number(existing.rows[0]?.size_bytes) !== blob.size
          ) {
            await blobs.del(blob.pathname, { access: 'private' });
            throw new Error('The completed upload does not match its pending record.');
          }
        }
      }
    });
  }

  async function saveApplication(request, db, config) {
    verifySameOrigin(request);
    if (!await isRecruitmentOpen(config)) throw new HttpError(403, 'Applications are not open.');
    const application = validateApplication(await readJson(request));
    const now = new Date();
    const id = crypto.randomUUID();
    const documents = application.documentIds.length
      ? await db.query(`
        SELECT id, upload_batch_id, blob_pathname, encrypted_metadata, size_bytes
        FROM documents
        WHERE id = ANY($1::uuid[]) AND application_id IS NULL
          AND upload_complete = TRUE AND expires_at > NOW()
      `, [application.documentIds])
      : { rows: [] };
    if (documents.rows.length !== application.documentIds.length) {
      throw new HttpError(400, 'One or more uploaded documents are invalid or expired. Upload them again.');
    }
    const metadata = documents.rows.map((document) => ({
      id: document.id,
      name: decrypt(document.encrypted_metadata, config.encryptionKey).name,
      size: Number(document.size_bytes)
    }));
    const encryptedApplicant = encrypt({ ...application.applicant, documents: metadata }, config.encryptionKey);
    await withTransaction(db, async (transaction) => {
      await transaction.query(`
        INSERT INTO applications (
          id, company_id, company_name, position_title, position_category,
          encrypted_applicant, privacy_consent_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $7)
      `, [
        id,
        application.companyId,
        application.companyName,
        application.positionTitle,
        application.positionCategory,
        encryptedApplicant,
        now
      ]);
      if (application.documentIds.length) {
        const updated = await transaction.query(`
          UPDATE documents SET application_id = $1, upload_batch_id = NULL,
            expires_at = $2
          WHERE id = ANY($3::uuid[]) AND application_id IS NULL
          RETURNING id
        `, [
          id,
          new Date(now.getTime() + config.retentionDays * 24 * 60 * 60 * 1000),
          application.documentIds
        ]);
        if (updated.rows.length !== application.documentIds.length) {
          throw new HttpError(409, 'One or more uploaded documents have already been submitted.');
        }
      }
    });
    return jsonResponse(201, {
      id,
      received: true,
      message: 'Your application was received.'
    });
  }

  async function listApplications(db, request, config) {
    await requireSession(db, request, 'careers_admin', SESSION_COOKIE, config);
    const rows = await db.query(`
      SELECT id, company_id, company_name, position_title, position_category,
        encrypted_applicant, status, created_at, updated_at
      FROM applications ORDER BY created_at DESC, id
    `);
    return jsonResponse(200, {
      applications: rows.rows.map((row) => ({
        id: row.id,
        companyId: row.company_id,
        companyName: row.company_name,
        positionTitle: row.position_title,
        positionCategory: row.position_category,
        applicant: decrypt(row.encrypted_applicant, config.encryptionKey),
        status: row.status,
        createdAt: serializeDate(row.created_at),
        updatedAt: serializeDate(row.updated_at)
      }))
    });
  }

  async function downloadDocument(db, request, url, config) {
    await requireSession(db, request, 'careers_admin', SESSION_COOKIE, config);
    const match = url.pathname.match(/^\/api\/admin\/applications\/([0-9a-f-]{36})\/documents\/([0-9a-f-]{36})$/i);
    if (!match) throw new HttpError(404, 'Document not found.');
    const result = await db.query(`
      SELECT a.encrypted_applicant, d.blob_pathname
      FROM applications a JOIN documents d ON d.application_id = a.id
      WHERE a.id = $1 AND d.id = $2
    `, [match[1], match[2]]);
    if (!result.rows.length) throw new HttpError(404, 'Document not found.');
    const applicant = decrypt(result.rows[0].encrypted_applicant, config.encryptionKey);
    const metadata = applicant.documents.find((document) => document.id === match[2]);
    if (!metadata) throw new HttpError(404, 'Document not found.');
    const stored = await blobs.get(result.rows[0].blob_pathname, { access: 'private' });
    if (!stored) throw new HttpError(404, 'Document not found.');
    const name = metadata.name.replace(/[\r\n"]/g, '_');
    return new Response(headerStream(stored.stream), {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Content-Length': String(metadata.size),
        'Content-Type': 'application/pdf',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  }

  async function deleteApplication(db, request, applicationId, config) {
    await requireSession(db, request, 'careers_admin', SESSION_COOKIE, config);
    verifySameOrigin(request);
    const result = await db.query('SELECT blob_pathname FROM documents WHERE application_id = $1', [applicationId]);
    for (const document of result.rows) await blobs.del(document.blob_pathname, { access: 'private' });
    const deleted = await db.query('DELETE FROM applications WHERE id = $1 RETURNING id', [applicationId]);
    if (!deleted.rows.length) throw new HttpError(404, 'Application not found.');
    return jsonResponse(200, { deleted: true });
  }

  async function cleanup(db, config) {
    const expiredApplications = await db.query(`
      SELECT id
      FROM applications
      WHERE created_at <= NOW() - ($1 * INTERVAL '1 day')
      ORDER BY created_at LIMIT 100
    `, [config.retentionDays]);
    const expiredIds = expiredApplications.rows.map((row) => row.id);
    if (expiredIds.length) {
      const documents = await db.query(
        'SELECT blob_pathname FROM documents WHERE application_id = ANY($1::uuid[])',
        [expiredIds]
      );
      for (const document of documents.rows) await blobs.del(document.blob_pathname, { access: 'private' });
      await db.query('DELETE FROM applications WHERE id = ANY($1::uuid[])', [expiredIds]);
    }
    const staged = await db.query(`
      SELECT id, blob_pathname FROM documents
      WHERE application_id IS NULL AND expires_at <= NOW()
      ORDER BY expires_at LIMIT 500
    `);
    for (const document of staged.rows) await blobs.del(document.blob_pathname, { access: 'private' });
    if (staged.rows.length) {
      await db.query('DELETE FROM documents WHERE id = ANY($1::uuid[])', [staged.rows.map((row) => row.id)]);
    }
    await db.query('DELETE FROM sessions WHERE expires_at <= NOW()');
    await db.query("DELETE FROM rate_limits WHERE window_started_at < NOW() - INTERVAL '1 day'");
    return { applications: expiredIds.length, stagedDocuments: staged.rows.length };
  }

  async function handle(request) {
    try {
      const url = new URL(request.url);
      const pathname = url.searchParams.get('route') || url.pathname;
      if (!pathname.startsWith('/') || pathname.includes('..')) throw new HttpError(400, 'Invalid route.');
      const routeUrl = new URL(pathname + url.search, url.origin);
      const path = routeUrl.pathname;
      const config = getConfig();
      const db = await getDb();

      if (path === '/admin' && request.method === 'GET') {
        const session = await getSession(db, request, 'site_admin', SITE_ADMIN_COOKIE, config);
        if (session) return redirect('/admin/dashboard');
        if (!pages.login) throw new Error('The private administrator login page is unavailable.');
        return new Response(pages.login, {
          headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff' }
        });
      }
      if (path === '/admin/dashboard' && request.method === 'GET') {
        const session = await getSession(db, request, 'site_admin', SITE_ADMIN_COOKIE, config);
        if (!session) return redirect('/admin');
        if (!pages.dashboard) throw new Error('The private administrator dashboard is unavailable.');
        return new Response(pages.dashboard, {
          headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff' }
        });
      }
      if (path === '/admin.html' || path === '/admin-login.html') {
        return redirect(request.method === 'GET' ? '/admin' : '/admin', 303);
      }

      if (path === '/api/site-admin/login' && request.method === 'POST') {
        verifySameOrigin(request);
        await checkRateLimit(db, 'site_admin_login', request, config);
        const input = await readJson(request, MAX_JSON_BYTES);
        const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
        const password = typeof input.password === 'string' ? input.password : '';
        if (!username || username.length > 64 || !password || password.length > 1024) {
          throw new HttpError(401, 'Username or password is incorrect.');
        }
        const result = await db.query('SELECT username, password_hash, role FROM site_admins WHERE username = $1', [username]);
        const hash = result.rows[0]?.password_hash || await dummyPasswordHash;
        const valid = await bcrypt.compare(password, hash);
        if (!result.rows.length || !valid) throw new HttpError(401, 'Username or password is incorrect.');
        await db.query('DELETE FROM rate_limits WHERE scope = $1 AND key_hash = $2', [
          'site_admin_login',
          sessionHash(`site_admin_login:${request.headers.get('x-real-ip') || 'unknown'}`, config.sessionSecret)
        ]);
        const token = await createSession(db, 'site_admin', result.rows[0].username, config);
        return jsonResponse(200, { username: result.rows[0].username, role: result.rows[0].role }, {
          'Set-Cookie': cookie(SITE_ADMIN_COOKIE, token, SESSION_TTL_SECONDS)
        });
      }
      if (path === '/api/site-admin/session' && request.method === 'GET') {
        const session = await requireSession(db, request, 'site_admin', SITE_ADMIN_COOKIE, config);
        return jsonResponse(200, { username: session.principal, role: 'CEO' });
      }
      if (path === '/api/site-admin/logout' && request.method === 'POST') {
        verifySameOrigin(request);
        await deleteSession(db, request, SITE_ADMIN_COOKIE, config);
        return jsonResponse(200, { signedOut: true }, { 'Set-Cookie': cookie(SITE_ADMIN_COOKIE, '', 0) });
      }
      if (path === '/api/careers/status' && request.method === 'GET') {
        const open = await isRecruitmentOpen(config);
        return jsonResponse(200, {
          enabled: open,
          opensAt: config.openAt.toISOString(),
          serverTime: new Date().toISOString(),
          retentionDays: config.retentionDays,
          uploadsEnabled: open,
          maxDocuments: MAX_DOCUMENTS,
          maxDocumentBytes: MAX_DOCUMENT_BYTES,
          localPrototype: false,
          directUploads: true
        });
      }
      if (path === '/api/careers/uploads' && request.method === 'POST') {
        const result = await handleUpload(request, db, config);
        return jsonResponse(200, result);
      }
      if (path === '/api/careers/applications' && request.method === 'POST') {
        return await saveApplication(request, db, config);
      }

      if (path === '/api/admin/login' && request.method === 'POST') {
        verifySameOrigin(request);
        await checkRateLimit(db, 'careers_admin_login', request, config);
        const input = await readJson(request, MAX_JSON_BYTES);
        const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
        const password = typeof input.password === 'string' ? input.password : '';
        const result = email && EMAIL_PATTERN.test(email) && email.length <= 254
          ? await db.query('SELECT email, password_salt, password_hash FROM admins WHERE email = $1', [email])
          : { rows: [] };
        const admin = result.rows[0];
        const salt = admin ? Buffer.from(admin.password_salt, 'hex') : Buffer.alloc(16);
        const expected = admin ? Buffer.from(admin.password_hash, 'hex') : crypto.scryptSync('invalid-password', salt, 64);
        const actual = crypto.scryptSync(password.length <= 1024 ? password : '', salt, 64);
        if (!admin || password.length > 1024 || actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
          throw new HttpError(401, 'Email or password is incorrect.');
        }
        await db.query('DELETE FROM rate_limits WHERE scope = $1 AND key_hash = $2', [
          'careers_admin_login',
          sessionHash(`careers_admin_login:${request.headers.get('x-real-ip') || 'unknown'}`, config.sessionSecret)
        ]);
        const token = await createSession(db, 'careers_admin', admin.email, config);
        return jsonResponse(200, { email: admin.email }, {
          'Set-Cookie': cookie(SESSION_COOKIE, token, SESSION_TTL_SECONDS)
        });
      }
      if (path === '/api/admin/logout' && request.method === 'POST') {
        verifySameOrigin(request);
        await deleteSession(db, request, SESSION_COOKIE, config);
        return jsonResponse(200, { signedOut: true }, { 'Set-Cookie': cookie(SESSION_COOKIE, '', 0) });
      }
      if (path === '/api/admin/applications' && request.method === 'GET') {
        return await listApplications(db, request, config);
      }
      if (path === '/api/admin/applications' && request.method === 'POST') {
        throw new HttpError(405, 'Method not allowed.');
      }
      const documentMatch = path.match(/^\/api\/admin\/applications\/([0-9a-f-]{36})\/documents\/([0-9a-f-]{36})$/i);
      if (documentMatch && request.method === 'GET') return await downloadDocument(db, request, routeUrl, config);
      const applicationMatch = path.match(/^\/api\/admin\/applications\/([0-9a-f-]{36})$/i);
      if (applicationMatch && request.method === 'PATCH') {
        await requireSession(db, request, 'careers_admin', SESSION_COOKIE, config);
        verifySameOrigin(request);
        const input = await readJson(request, MAX_JSON_BYTES);
        if (!VALID_STATUSES.has(input.status)) throw new HttpError(400, 'Choose a valid application status.');
        const result = await db.query(
          'UPDATE applications SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
          [input.status, applicationMatch[1]]
        );
        if (!result.rows.length) throw new HttpError(404, 'Application not found.');
        return jsonResponse(200, { updated: true });
      }
      if (applicationMatch && request.method === 'DELETE') {
        return await deleteApplication(db, request, applicationMatch[1], config);
      }
      if (path === '/api/cron/cleanup' && request.method === 'GET') {
        const secret = process.env.CRON_SECRET;
        if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
          throw new HttpError(401, 'Unauthorized.');
        }
        return jsonResponse(200, await cleanup(db, config));
      }
      throw new HttpError(404, 'Not found.');
    } catch (error) {
      if (error instanceof HttpError) return jsonResponse(error.status, { error: error.message }, error.headers);
      console.error(`Serverless Careers request failed (${error.name || 'Error'}).`);
      return jsonResponse(500, { error: 'The Careers service encountered an error.' });
    }
  }

  return handle;
}

module.exports = { createServerlessHandler };
