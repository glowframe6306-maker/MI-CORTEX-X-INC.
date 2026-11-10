'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { PGlite } = require('@electric-sql/pglite');
const test = require('node:test');
const { createServerlessHandler } = require('./handler');
const { provisionCareersAdmin, provisionSiteAdmin } = require('../scripts/provision-serverless-admin');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
const encryptionKey = crypto.randomBytes(32).toString('base64');
const sessionSecret = crypto.randomBytes(32).toString('base64');
const origin = 'https://mi-cortex-test.example';
const adminPassword = `Careers-Test-${crypto.randomBytes(24).toString('base64url')}!`;
const siteAdminPassword = `CEO-Test-${crypto.randomBytes(24).toString('base64url')}!`;
const previousEnvironment = {};

for (const name of [
  'CAREERS_ENCRYPTION_KEY',
  'SESSION_SECRET',
  'CAREERS_OPEN_AT',
  'CAREERS_RETENTION_DAYS',
  'CAREERS_RECRUITMENT_APPROVED',
  'CRON_SECRET'
]) {
  previousEnvironment[name] = process.env[name];
}
Object.assign(process.env, {
  CAREERS_ENCRYPTION_KEY: encryptionKey,
  SESSION_SECRET: sessionSecret,
  CAREERS_OPEN_AT: '2020-01-01T00:00:00.000Z',
  CAREERS_RETENTION_DAYS: '90',
  CAREERS_RECRUITMENT_APPROVED: 'true',
  CRON_SECRET: 'serverless-test-cron-secret'
});

test.after(() => {
  for (const [name, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

async function createContext() {
  const database = new PGlite();
  await database.exec(schema);
  const storedBlobs = new Map();
  const deletedBlobs = [];
  let tokenOptions;
  let failNextBlobDelete = false;
  const dummyCEOHash = await bcrypt.hash('unmatchable-test-password', 4);
  const blobs = {
    async handleUpload({ body, onBeforeGenerateToken, onUploadCompleted }) {
      if (body.type === 'blob.generate-client-token') {
        const { pathname, clientPayload } = body.payload;
        tokenOptions = await onBeforeGenerateToken(pathname, clientPayload, false);
        return { type: body.type, clientToken: 'test-client-token' };
      }
      if (body.type === 'blob.upload-completed') {
        await onUploadCompleted(body.payload);
        return { type: body.type, response: 'ok' };
      }
      throw new Error('Unexpected mocked upload request.');
    },
    async get(pathname) {
      const file = storedBlobs.get(pathname);
      if (!file) return null;
      return {
        stream: new Response(file.content).body,
        headers: new Headers({ 'Content-Type': 'application/pdf' }),
        blob: { pathname, size: file.content.length }
      };
    },
    async del(pathnames) {
      if (failNextBlobDelete) {
        failNextBlobDelete = false;
        throw new Error('Mock Blob deletion failed.');
      }
      for (const pathname of Array.isArray(pathnames) ? pathnames : [pathnames]) {
        deletedBlobs.push(pathname);
        storedBlobs.delete(pathname);
      }
    }
  };
  const handler = createServerlessHandler({
    database,
    blobs,
    pages: { login: '<h1>login page</h1>', dashboard: '<h1>protected dashboard</h1>' },
    dummyPasswordHash: dummyCEOHash
  });
  const createAnotherHandler = () => createServerlessHandler({
    database,
    blobs,
    pages: { login: '<h1>login page</h1>', dashboard: '<h1>protected dashboard</h1>' },
    dummyPasswordHash: dummyCEOHash
  });
  const request = (pathname, { method = 'GET', body, headers = {}, ip = '192.0.2.1' } = {}) => {
    const requestHeaders = new Headers(headers);
    requestHeaders.set('x-real-ip', ip);
    if (['POST', 'PATCH', 'DELETE'].includes(method)) requestHeaders.set('origin', origin);
    if (body !== undefined) requestHeaders.set('content-type', 'application/json');
    return new Request(`${origin}${pathname}`, {
      method,
      headers: requestHeaders,
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
  };
  const call = async (pathname, options) => handler(request(pathname, options));
  const createAdmin = async () => {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(adminPassword, salt, 64);
    await database.query(
      'INSERT INTO admins (email, password_salt, password_hash) VALUES ($1, $2, $3)',
      ['admin@example.test', salt.toString('hex'), hash.toString('hex')]
    );
    await database.query(
      "INSERT INTO site_admins (username, password_hash, role) VALUES ($1, $2, 'CEO')",
      ['ceo.test', await bcrypt.hash(siteAdminPassword, 4)]
    );
  };
  return {
    database,
    storedBlobs,
    deletedBlobs,
    getTokenOptions: () => tokenOptions,
    failNextBlobDelete: () => { failNextBlobDelete = true; },
    handler,
    createAnotherHandler,
    call,
    createAdmin,
    request
  };
}

async function closeContext(context) {
  await context.database.close();
}

async function signIn(context, pathname, credentials, ip) {
  const response = await context.call(pathname, {
    method: 'POST',
    body: credentials,
    ip
  });
  const cookie = response.headers.get('set-cookie');
  if (response.ok && !cookie) throw new Error('A successful sign-in did not issue a session cookie.');
  return { response, cookie: cookie ? cookie.split(';', 1)[0] : '' };
}

test('CEO dashboard pages and APIs require the independent CEO session', async () => {
  const context = await createContext();
  try {
    const loginPage = await context.call('/admin');
    assert.equal(loginPage.status, 200);
    assert.match(await loginPage.text(), /login page/);
    const protectedPage = await context.call('/admin/dashboard');
    assert.equal(protectedPage.status, 303);
    assert.equal(protectedPage.headers.get('location'), '/admin');
    assert.equal((await context.call('/admin.html')).headers.get('location'), '/admin');
    assert.equal((await context.call('/api/site-admin/session')).status, 401);

    await context.createAdmin();
    const denied = await signIn(context, '/api/site-admin/login', { username: 'wrong', password: 'wrong' });
    assert.equal(denied.response.status, 401);
    assert.equal((await denied.response.json()).error, 'Username or password is incorrect.');

    const login = await signIn(context, '/api/site-admin/login', {
      username: 'ceo.test',
      password: siteAdminPassword
    });
    assert.equal(login.response.status, 200);
    const session = await context.call('/api/site-admin/session', { headers: { cookie: login.cookie } });
    assert.deepEqual(await session.json(), { username: 'ceo.test', role: 'CEO' });
    const restartedHandler = context.createAnotherHandler();
    const persistedSession = await restartedHandler(context.request('/api/site-admin/session', {
      headers: { cookie: login.cookie }
    }));
    assert.deepEqual(await persistedSession.json(), { username: 'ceo.test', role: 'CEO' });
    const dashboard = await context.call('/admin/dashboard', { headers: { cookie: login.cookie } });
    assert.equal(dashboard.status, 200);
    assert.match(await dashboard.text(), /protected dashboard/);
    assert.match(login.response.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Strict/);

    const logout = await context.call('/api/site-admin/logout', {
      method: 'POST',
      headers: { cookie: login.cookie }
    });
    assert.equal(logout.status, 200);
    assert.equal((await context.call('/admin/dashboard', { headers: { cookie: login.cookie } })).status, 303);
  } finally {
    await closeContext(context);
  }
});

test('Careers administrator authentication is separate and rate-limited persistently', async () => {
  const context = await createContext();
  try {
    await context.createAdmin();
    assert.equal((await context.call('/api/admin/applications')).status, 401);
    const bad = await signIn(context, '/api/admin/login', { email: 'admin@example.test', password: 'wrong' });
    assert.equal(bad.response.status, 401);
    assert.equal((await context.call('/api/admin/applications', {
      headers: { cookie: bad.cookie }
    })).status, 401);

    const login = await signIn(context, '/api/admin/login', {
      email: 'ADMIN@example.test',
      password: adminPassword
    }, '198.51.100.40');
    assert.equal(login.response.status, 200);
    const applications = await context.call('/api/admin/applications', { headers: { cookie: login.cookie } });
    assert.deepEqual(await applications.json(), { applications: [] });
    const CEO = await signIn(context, '/api/site-admin/login', {
      username: 'ceo.test',
      password: siteAdminPassword
    });
    assert.equal((await context.call('/api/admin/applications', { headers: { cookie: CEO.cookie } })).status, 401);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = await context.call('/api/admin/login', {
        method: 'POST',
        body: { email: 'missing@example.test', password: 'invalid' },
        ip: '198.51.100.41'
      });
      assert.equal(failed.status, 401);
    }
    const anotherInstance = context.createAnotherHandler();
    const limited = await anotherInstance(context.request('/api/admin/login', {
      method: 'POST',
      body: { email: 'missing@example.test', password: 'invalid' },
      ip: '198.51.100.41'
    }));
    assert.equal(limited.status, 429);
    assert.ok(limited.headers.get('retry-after'));

    const logout = await context.call('/api/admin/logout', { method: 'POST', headers: { cookie: login.cookie } });
    assert.equal(logout.status, 200);
    assert.equal((await context.call('/api/admin/applications', { headers: { cookie: login.cookie } })).status, 401);
  } finally {
    await closeContext(context);
  }
});

test('private direct PDF uploads, application records, downloads, updates and deletion are authorized', async () => {
  const context = await createContext();
  try {
    await context.createAdmin();
    const batchId = crypto.randomUUID();
    const documentId = crypto.randomUUID();
    const pathname = `private-careers/${batchId}/${documentId}.pdf`;
    const pdf = Buffer.from('%PDF-1.7\nprivate test document');
    const payload = JSON.stringify({ batchId, documentId, name: 'resume.pdf' });
    const uploadToken = await context.call('/api/careers/uploads', {
      method: 'POST',
      body: {
        type: 'blob.generate-client-token',
        payload: { pathname, clientPayload: payload, multipart: false }
      }
    });
    assert.equal(uploadToken.status, 200);
    assert.equal(context.getTokenOptions().maximumSizeInBytes, 10 * 1024 * 1024);
    assert.deepEqual(context.getTokenOptions().allowedContentTypes, ['application/pdf']);
    context.storedBlobs.set(pathname, { content: pdf });
    const completion = await context.call('/api/careers/uploads', {
      method: 'POST',
      body: {
        type: 'blob.upload-completed',
        payload: { blob: { pathname, size: pdf.length }, tokenPayload: payload }
      }
    });
    assert.equal(completion.status, 200);
    assert.equal((await context.database.query('SELECT COUNT(*)::integer AS count FROM documents')).rows[0].count, 1);

    const applicationResponse = await context.call('/api/careers/applications', {
      method: 'POST',
      body: {
        fullName: 'Test Applicant',
        email: 'applicant@example.test',
        phone: '+94750000000',
        companyId: 'parent',
        positionTitle: 'Chief Technology Officer',
        statement: 'A sufficiently long application statement for testing.',
        ageConfirmed: true,
        privacyConsent: true,
        documents: [{ id: documentId }]
      }
    });
    assert.equal(applicationResponse.status, 201);
    const created = await applicationResponse.json();
    const encrypted = (await context.database.query(
      'SELECT encrypted_applicant FROM applications WHERE id = $1',
      [created.id]
    )).rows[0].encrypted_applicant;
    assert.equal(encrypted.includes('applicant@example.test'), false);

    const ceoLogin = await signIn(context, '/api/site-admin/login', {
      username: 'ceo.test',
      password: siteAdminPassword
    });
    const unauthorizedDownload = await context.call(
      `/api/admin/applications/${created.id}/documents/${documentId}`,
      { headers: { cookie: ceoLogin.cookie } }
    );
    assert.equal(unauthorizedDownload.status, 401);

    const adminLogin = await signIn(context, '/api/admin/login', {
      email: 'admin@example.test',
      password: adminPassword
    });
    const listed = await context.call('/api/admin/applications', { headers: { cookie: adminLogin.cookie } });
    const application = (await listed.json()).applications[0];
    assert.equal(application.applicant.documents[0].name, 'resume.pdf');
    const download = await context.call(
      `/api/admin/applications/${created.id}/documents/${documentId}`,
      { headers: { cookie: adminLogin.cookie } }
    );
    assert.equal(download.status, 200);
    assert.equal(download.headers.get('content-type'), 'application/pdf');
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), pdf);

    const updated = await context.call(`/api/admin/applications/${created.id}`, {
      method: 'PATCH',
      headers: { cookie: adminLogin.cookie },
      body: { status: 'reviewing' }
    });
    assert.equal(updated.status, 200);
    const deleted = await context.call(`/api/admin/applications/${created.id}`, {
      method: 'DELETE',
      headers: { cookie: adminLogin.cookie }
    });
    assert.equal(deleted.status, 200);
    assert.deepEqual(context.deletedBlobs, [pathname]);
    assert.equal((await context.database.query('SELECT COUNT(*)::integer AS count FROM applications')).rows[0].count, 0);
    assert.equal((await context.database.query('SELECT COUNT(*)::integer AS count FROM documents')).rows[0].count, 0);
  } finally {
    await closeContext(context);
  }
});

test('application gate, origin validation, malformed uploads and protected cleanup fail closed', async () => {
  const context = await createContext();
  try {
    const closedDate = process.env.CAREERS_OPEN_AT;
    process.env.CAREERS_OPEN_AT = '2999-01-01T00:00:00.000Z';
    const status = await context.call('/api/careers/status');
    assert.equal((await status.json()).enabled, false);
    const closedUpload = await context.call('/api/careers/uploads', {
      method: 'POST',
      body: {
        type: 'blob.generate-client-token',
        payload: { pathname: `private-careers/${crypto.randomUUID()}/${crypto.randomUUID()}.pdf`, clientPayload: '{}', multipart: false }
      }
    });

    test('one-time provisioning stores password hashes and refuses replacement accounts', async () => {
      const database = new PGlite();
      await database.exec(schema);
      const CEOSecret = `One-Time-CEO-${crypto.randomBytes(24).toString('base64url')}!`;
      const careersSecret = `One-Time-Careers-${crypto.randomBytes(24).toString('base64url')}!`;
      try {
        await provisionSiteAdmin(database, 'ceo.initial', CEOSecret);
        const siteAdmin = (await database.query(
          'SELECT username, password_hash, role FROM site_admins'
        )).rows[0];
        assert.equal(siteAdmin.username, 'ceo.initial');
        assert.equal(siteAdmin.role, 'CEO');
        assert.notEqual(siteAdmin.password_hash, CEOSecret);
        assert.equal(await bcrypt.compare(CEOSecret, siteAdmin.password_hash), true);
        await assert.rejects(provisionSiteAdmin(database, 'ceo.replacement', CEOSecret), /already exists/);
        assert.equal((await database.query('SELECT COUNT(*)::integer AS count FROM site_admins')).rows[0].count, 1);

        await provisionCareersAdmin(database, 'admin@example.test', careersSecret);
        const careersAdmin = (await database.query(
          'SELECT email, password_salt, password_hash FROM admins'
        )).rows[0];
        const storedHash = Buffer.from(careersAdmin.password_hash, 'hex');
        const actualHash = crypto.scryptSync(careersSecret, Buffer.from(careersAdmin.password_salt, 'hex'), 64);
        assert.equal(careersAdmin.email, 'admin@example.test');
        assert.notEqual(careersAdmin.password_hash, careersSecret);
        assert.equal(crypto.timingSafeEqual(storedHash, actualHash), true);
        await assert.rejects(provisionCareersAdmin(database, 'replacement@example.test', careersSecret), /already exists/);
        assert.equal((await database.query('SELECT COUNT(*)::integer AS count FROM admins')).rows[0].count, 1);
      } finally {
        await database.close();
      }
    });
    assert.equal(closedUpload.status, 403);
    process.env.CAREERS_OPEN_AT = closedDate;

    const invalidOrigin = new Request(`${origin}/api/careers/applications`, {
      method: 'POST',
      headers: { origin: 'https://attacker.example', 'content-type': 'application/json' },
      body: '{}'
    });
    assert.equal((await context.handler(invalidOrigin)).status, 403);

    const invalidUpload = await context.call('/api/careers/uploads', {
      method: 'POST',
      body: {
        type: 'blob.generate-client-token',
        payload: {
          pathname: `private-careers/${crypto.randomUUID()}/../resume.pdf`,
          clientPayload: '{}',
          multipart: false
        }
      }
    });
    assert.equal(invalidUpload.status, 400);
    assert.equal((await context.call('/api/cron/cleanup')).status, 401);
    const cleanup = await context.call('/api/cron/cleanup', {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }
    });
    assert.equal(cleanup.status, 200);
    await context.database.query(`
      INSERT INTO applications (
        id, company_id, company_name, position_title, position_category,
        encrypted_applicant, privacy_consent_at, created_at, updated_at
      ) VALUES ($1, 'parent', 'MI CORTEX X INC.', 'Chief Technology Officer',
        'Executive', 'encrypted-test-value', NOW(), NOW() - INTERVAL '91 days',
        NOW() - INTERVAL '91 days')
    `, [crypto.randomUUID()]);
    const expiredPath = `private-careers/${crypto.randomUUID()}/${crypto.randomUUID()}.pdf`;
    const expiredDocumentId = crypto.randomUUID();
    await context.database.query(`
      INSERT INTO documents (
        id, application_id, blob_pathname, encrypted_metadata, size_bytes,
        upload_complete, created_at, expires_at
      ) SELECT $1, id, $2, 'encrypted-test-metadata', 1, TRUE,
        NOW() - INTERVAL '91 days', NOW() - INTERVAL '1 day'
      FROM applications WHERE created_at <= NOW() - INTERVAL '90 days'
    `, [expiredDocumentId, expiredPath]);
    context.storedBlobs.set(expiredPath, { content: Buffer.from('%PDF-expired') });
    const retainedCleanup = await context.call('/api/cron/cleanup', {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }
    });
    assert.deepEqual(await retainedCleanup.json(), { applications: 1, stagedDocuments: 0 });
    assert.equal((await context.database.query('SELECT COUNT(*)::integer AS count FROM applications')).rows[0].count, 0);
    assert.ok(context.deletedBlobs.includes(expiredPath));
  } finally {
    process.env.CAREERS_OPEN_AT = '2020-01-01T00:00:00.000Z';
    await closeContext(context);
  }
});

test('cleanup drains expired application and staged-document batches', async () => {
  const context = await createContext();
  try {
    const applicationIds = Array.from({ length: 501 }, () => crypto.randomUUID());
    const applicationValues = applicationIds.map((_, index) => {
      const parameter = index + 1;
      return `($${parameter}, 'parent', 'MI CORTEX X INC.', 'Chief Technology Officer',
        'Executive', 'encrypted-test-value', NOW(), NOW() - INTERVAL '91 days',
        NOW() - INTERVAL '91 days')`;
    });
    await context.database.query(`
      INSERT INTO applications (
        id, company_id, company_name, position_title, position_category,
        encrypted_applicant, privacy_consent_at, created_at, updated_at
      ) VALUES ${applicationValues.join(',')}
    `, applicationIds);
    await context.database.query(
      "UPDATE applications SET created_at = NOW() - INTERVAL '92 days' WHERE id = $1",
      [applicationIds[0]]
    );
    const expiredApplicationDocumentId = crypto.randomUUID();
    const expiredApplicationPath = `private-careers/expired/${expiredApplicationDocumentId}.pdf`;
    await context.database.query(`
      INSERT INTO documents (
        id, application_id, blob_pathname, encrypted_metadata, size_bytes,
        upload_complete, created_at, expires_at
      ) VALUES ($1, $2, $3, 'encrypted-expired-metadata', 1, TRUE,
        NOW() - INTERVAL '92 days', NOW() - INTERVAL '1 day')
    `, [expiredApplicationDocumentId, applicationIds[0], expiredApplicationPath]);
    context.storedBlobs.set(expiredApplicationPath, { content: Buffer.from('%PDF-expired') });

    const stagedDocumentIds = Array.from({ length: 2501 }, () => crypto.randomUUID());
    const stagedPathnames = stagedDocumentIds.map((id) => `private-careers/expired/${id}.pdf`);
    const stagedValues = stagedDocumentIds.map((_, index) => {
      const idParameter = index * 2 + 1;
      const pathnameParameter = idParameter + 1;
      return `($${idParameter}, NULL, NULL, $${pathnameParameter}, 'encrypted-test-metadata',
        1, TRUE, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day')`;
    });
    const stagedParameters = stagedDocumentIds.flatMap((id, index) => [id, stagedPathnames[index]]);
    await context.database.query(`
      INSERT INTO documents (
        id, application_id, upload_batch_id, blob_pathname, encrypted_metadata,
        size_bytes, upload_complete, created_at, expires_at
      ) VALUES ${stagedValues.join(',')}
    `, stagedParameters);

    const activeApplicationId = crypto.randomUUID();
    const activeDocumentId = crypto.randomUUID();
    const activePathname = `private-careers/active/${activeDocumentId}.pdf`;
    await context.database.query(`
      INSERT INTO applications (
        id, company_id, company_name, position_title, position_category,
        encrypted_applicant, privacy_consent_at, created_at, updated_at
      ) VALUES ($1, 'parent', 'MI CORTEX X INC.', 'Chief Technology Officer',
        'Executive', 'encrypted-active-value', NOW(), NOW(), NOW())
    `, [activeApplicationId]);
    await context.database.query(`
      INSERT INTO documents (
        id, application_id, blob_pathname, encrypted_metadata, size_bytes,
        upload_complete, created_at, expires_at
      ) VALUES ($1, $2, $3, 'encrypted-active-metadata', 1, TRUE, NOW(), NOW() + INTERVAL '1 day')
    `, [activeDocumentId, activeApplicationId, activePathname]);
    context.storedBlobs.set(activePathname, { content: Buffer.from('%PDF-active') });

    context.failNextBlobDelete();
    const failed = await context.call('/api/cron/cleanup', {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }
    });
    assert.equal(failed.status, 500);
    assert.equal((await context.database.query('SELECT COUNT(*)::integer AS count FROM applications')).rows[0].count, 502);
    assert.equal((await context.database.query('SELECT COUNT(*)::integer AS count FROM documents')).rows[0].count, 2503);
    assert.ok(context.storedBlobs.has(expiredApplicationPath));

    const response = await context.call('/api/cron/cleanup', {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { applications: 500, stagedDocuments: 2500 });
    assert.equal((await context.database.query('SELECT COUNT(*)::integer AS count FROM applications')).rows[0].count, 2);
    assert.equal((await context.database.query('SELECT COUNT(*)::integer AS count FROM documents')).rows[0].count, 2);
    assert.equal(context.deletedBlobs.length, 2501);
    assert.ok(context.storedBlobs.has(activePathname));
    assert.ok(!context.storedBlobs.has(expiredApplicationPath));

    const finalBatch = await context.call('/api/cron/cleanup', {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }
    });
    assert.deepEqual(await finalBatch.json(), { applications: 1, stagedDocuments: 1 });
    assert.equal((await context.database.query('SELECT COUNT(*)::integer AS count FROM applications')).rows[0].count, 1);
    assert.equal((await context.database.query('SELECT COUNT(*)::integer AS count FROM documents')).rows[0].count, 1);
    assert.equal(context.deletedBlobs.length, 2502);
    assert.ok(context.storedBlobs.has(activePathname));
  } finally {
    await closeContext(context);
  }
});
