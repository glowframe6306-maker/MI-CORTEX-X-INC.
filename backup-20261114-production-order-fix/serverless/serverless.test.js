'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { PGlite } = require('@electric-sql/pglite');
const test = require('node:test');
const { createServerlessHandler } = require('./handler');
const { getDatabase, getDatabaseUrlState, diagnoseDatabaseReadOnlyQuery } = require('./database');
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
  'CRON_SECRET',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID'
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

test('database diagnostic distinguishes URL, pool, connection, and query failures without leaking details', async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const neverCreatePool = () => { throw new Error('Pool must not be constructed.'); };

  try {
    delete process.env.DATABASE_URL;
    assert.equal(getDatabaseUrlState(), 'undefined');
    assert.throws(() => getDatabase(), /DATABASE_URL is required\./);
    let diagnostic = await diagnoseDatabaseReadOnlyQuery({ poolFactory: neverCreatePool });
    assert.equal(diagnostic.databaseUrlState, 'undefined');
    assert.equal(diagnostic.poolInitializationSucceeded, false);
    assert.equal(diagnostic.connectionSucceeded, false);
    assert.equal(diagnostic.readOnlyQuerySucceeded, false);

    process.env.DATABASE_URL = '';
    assert.equal(getDatabaseUrlState(), 'empty');
    assert.throws(() => getDatabase(), /DATABASE_URL is required\./);
    diagnostic = await diagnoseDatabaseReadOnlyQuery({ poolFactory: neverCreatePool });
    assert.equal(diagnostic.databaseUrlState, 'empty');
    assert.equal(diagnostic.poolInitializationSucceeded, false);
    assert.equal(diagnostic.connectionSucceeded, false);
    assert.equal(diagnostic.readOnlyQuerySucceeded, false);

    process.env.DATABASE_URL = 'postgresql://diagnostic-user:diagnostic-secret@db.invalid/diagnostic-db';
    assert.equal(getDatabaseUrlState(), 'present');

    let poolClosed = false;
    let clientReleased = false;
    let executedQuery;
    diagnostic = await diagnoseDatabaseReadOnlyQuery({
      poolFactory: () => ({
        async connect() {
          return {
            async query(query) {
              executedQuery = query;
              return { rows: [{ current_database: 'private-db', current_user: 'private-user' }] };
            },
            release() { clientReleased = true; }
          };
        },
        async end() { poolClosed = true; }
      })
    });
    assert.equal(diagnostic.databaseUrlState, 'present');
    assert.equal(diagnostic.poolInitializationSucceeded, true);
    assert.equal(diagnostic.connectionSucceeded, true);
    assert.equal(diagnostic.readOnlyQuerySucceeded, true);
    assert.equal(executedQuery, 'SELECT current_database(), current_user');
    assert.equal(clientReleased, true);
    assert.equal(poolClosed, true);
    assert.deepEqual(Object.keys(diagnostic).sort(), [
      'connectionSucceeded', 'databaseUrlState', 'poolInitializationSucceeded', 'readOnlyQuerySucceeded'
    ]);
    assert.doesNotMatch(JSON.stringify(diagnostic), /private-db|private-user|diagnostic-secret|db\.invalid/i);

    diagnostic = await diagnoseDatabaseReadOnlyQuery({
      poolFactory: () => { throw new TypeError('secret connection information'); }
    });
    assert.deepEqual(diagnostic, {
      databaseUrlState: 'present',
      poolInitializationSucceeded: false,
      connectionSucceeded: false,
      readOnlyQuerySucceeded: false,
      errorClass: 'TypeError',
      errorCategory: 'type_error'
    });

    let failedConnectPoolClosed = false;
    diagnostic = await diagnoseDatabaseReadOnlyQuery({
      poolFactory: () => ({
        async connect() { throw new Error('secret connection failure'); },
        async end() { failedConnectPoolClosed = true; }
      })
    });
    assert.equal(diagnostic.poolInitializationSucceeded, true);
    assert.equal(diagnostic.connectionSucceeded, false);
    assert.equal(diagnostic.readOnlyQuerySucceeded, false);
    assert.equal(failedConnectPoolClosed, true);
    assert.doesNotMatch(JSON.stringify(diagnostic), /secret connection failure/i);

    let failedQueryClientReleased = false;
    let failedQueryPoolClosed = false;
    diagnostic = await diagnoseDatabaseReadOnlyQuery({
      poolFactory: () => ({
        async connect() {
          return {
            async query() { throw new Error('secret query failure'); },
            release(error) {
              failedQueryClientReleased = true;
              assert.match(error.message, /secret query failure/);
            }
          };
        },
        async end() { failedQueryPoolClosed = true; }
      })
    });
    assert.equal(diagnostic.poolInitializationSucceeded, true);
    assert.equal(diagnostic.connectionSucceeded, true);
    assert.equal(diagnostic.readOnlyQuerySucceeded, false);
    assert.equal(failedQueryClientReleased, true);
    assert.equal(failedQueryPoolClosed, true);
    assert.doesNotMatch(JSON.stringify(diagnostic), /secret query failure/i);
  } finally {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

test('handler logs safe diagnostics for non-HttpError exceptions and keeps HTTP response format unchanged', async () => {
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args.join(' '));

  try {
    const handler = createServerlessHandler({
      database: () => { throw new Error('simulated init failure'); },
      blobs: { handleUpload() { throw new Error('unused'); } },
      pages: { login: '<h1>login</h1>', dashboard: '<h1>dashboard</h1>' }
    });
    const response = await handler(new Request('https://mi-cortex-test.example/api/careers/status'));
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'The Careers service encountered an error.' });
    assert.equal(logs.length, 1);
    assert.match(logs[0], /"component":"careers-serverless"/);
    assert.doesNotMatch(logs[0], /raw database error|postgres|password|token|connection/i);
  } finally {
    console.error = originalConsoleError;
  }
});

test('database initialization failure reports false init flag without a query', async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  try {
    delete process.env.DATABASE_URL;
    const diagnostic = await diagnoseDatabaseReadOnlyQuery();
    assert.equal(diagnostic.databaseUrlState, 'undefined');
    assert.equal(diagnostic.poolInitializationSucceeded, false);
    assert.equal(diagnostic.connectionSucceeded, false);
    assert.equal(diagnostic.readOnlyQuerySucceeded, false);
  } finally {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

async function createContext(options = {}) {
  const database = new PGlite();
  await database.exec(schema);
  let transactionQueue = Promise.resolve();
  const handlerDatabase = options.serializeTransactions ? {
    async query(...args) {
      let release;
      const previous = transactionQueue;
      transactionQueue = new Promise((resolve) => { release = resolve; });
      await previous;
      try {
        return await database.query(...args);
      } finally {
        release();
      }
    },
    async connect() {
      let release;
      const previous = transactionQueue;
      transactionQueue = new Promise((resolve) => { release = resolve; });
      await previous;
      return {
        query: database.query.bind(database),
        release
      };
    }
  } : database;
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
    database: handlerDatabase,
    blobs,
    pages: { login: '<h1>login page</h1>', dashboard: '<h1>protected dashboard</h1>' },
    dummyPasswordHash: dummyCEOHash,
    telegramFetch: options.telegramFetch
  });
  const createAnotherHandler = () => createServerlessHandler({
    database: handlerDatabase,
    blobs,
    pages: { login: '<h1>login page</h1>', dashboard: '<h1>protected dashboard</h1>' },
    dummyPasswordHash: dummyCEOHash,
    telegramFetch: options.telegramFetch
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

test('serverless order API validates, persists idempotently, notifies once, and enforces CEO authorization', async () => {
  const previousTelegramEnvironment = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID
  };
  process.env.TELEGRAM_BOT_TOKEN = 'isolated-test-bot-token';
  process.env.TELEGRAM_CHAT_ID = 'isolated-test-chat-id';
  const telegramRequests = [];
  const telegramFetch = async (url, options) => {
    telegramRequests.push({ url, body: JSON.parse(options.body) });
    const failed = telegramRequests.length === 4;
    return new Response(JSON.stringify({ ok: !failed }), {
      status: failed ? 503 : 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };
  const context = await createContext({ telegramFetch, serializeTransactions: true });

  try {
    const order = {
      itemType: 'product',
      itemName: 'Isolated Serverless Test Product',
      itemCategory: 'test',
      customerName: 'Test Customer',
      customerEmail: 'serverless-order@example.test',
      customerPhone: '+1 555 123 4567',
      companyName: 'Test Company',
      quantity: 1,
      urgency: 'standard',
      preferredTimeline: '',
      budget: '',
      notes: 'Isolated serverless order test'
    };
    const countOrders = async () => (
      await context.database.query('SELECT COUNT(*)::integer AS count FROM orders')
    ).rows[0].count;
    const countKeys = async (key) => (
      await context.database.query(
        'SELECT COUNT(*)::integer AS count FROM order_idempotency_keys WHERE idempotency_key = $1',
        [key]
      )
    ).rows[0].count;

    let response = await context.call('/api/orders', { method: 'POST', body: order });
    assert.equal(response.status, 400, 'a missing idempotency key is rejected');
    assert.equal(await countOrders(), 0);

    response = await context.call('/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: { ...order, quantity: 0 }
    });
    assert.equal(response.status, 400, 'invalid order payloads are rejected');
    assert.equal(await countOrders(), 0);

    const firstKey = crypto.randomUUID();
    response = await context.call('/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': firstKey },
      body: order
    });
    assert.equal(response.status, 201);
    const firstResult = await response.json();
    assert.equal(firstResult.status, 'new');
    assert.equal(await countOrders(), 1);
    assert.equal(await countKeys(firstKey), 1);
    assert.equal(telegramRequests.length, 1, 'a successfully persisted new order notifies Telegram once');
    assert.match(telegramRequests[0].url, /\/botisolated-test-bot-token\/sendMessage$/);
    assert.equal(telegramRequests[0].body.chat_id, 'isolated-test-chat-id');
    assert.match(telegramRequests[0].body.text, /Isolated Serverless Test Product/);

    const restartedHandler = context.createAnotherHandler();
    response = await restartedHandler(context.request('/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': firstKey },
      body: { ...order, itemName: 'Modified retry payload' }
    }));
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), firstResult, 'a new handler invocation returns the original result');
    assert.equal(await countOrders(), 1, 'a same-key retry with changed payload preserves the stored order');
    assert.equal(telegramRequests.length, 1, 'a persisted retry does not repeat the notification');
    const storedFirstOrder = await context.database.query(
      'SELECT item_name FROM orders WHERE id = $1',
      [firstResult.id]
    );
    assert.equal(storedFirstOrder.rows[0].item_name, order.itemName);

    const concurrentKey = crypto.randomUUID();
    const concurrentResponses = await Promise.all([
      context.call('/api/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': concurrentKey },
        body: order
      }),
      context.call('/api/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': concurrentKey },
        body: order
      })
    ]);
    assert.deepEqual(concurrentResponses.map((result) => result.status), [201, 201]);
    const concurrentResults = await Promise.all(concurrentResponses.map((result) => result.json()));
    assert.equal(concurrentResults[0].id, concurrentResults[1].id);
    assert.equal(await countOrders(), 2, 'concurrent same-key requests create one order');
    assert.equal(await countKeys(concurrentKey), 1);
    assert.equal(telegramRequests.length, 2, 'concurrent same-key requests notify only once');

    const repeatKey = crypto.randomUUID();
    response = await context.call('/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': repeatKey },
      body: order
    });
    assert.equal(response.status, 201, 'a new key allows a legitimate repeat purchase');
    assert.notEqual((await response.json()).id, firstResult.id);
    assert.equal(await countOrders(), 3);

    const failedNotificationKey = crypto.randomUUID();
    response = await context.call('/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': failedNotificationKey },
      body: order
    });
    assert.equal(response.status, 201, 'Telegram failure does not invalidate a saved order');
    const failedNotificationResult = await response.json();
    assert.equal(await countOrders(), 4);
    assert.equal(await countKeys(failedNotificationKey), 1);
    response = await context.call('/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': failedNotificationKey },
      body: order
    });
    assert.deepEqual(await response.json(), failedNotificationResult);
    assert.equal(await countOrders(), 4, 'retry after Telegram failure does not duplicate or delete the order');
    assert.equal(telegramRequests.length, 4, 'Telegram failure is not retried for the same key');

    response = await context.call('/api/site-admin/orders');
    assert.equal(response.status, 401, 'unauthenticated users cannot list customer orders');
    response = await context.call(`/api/site-admin/orders/${firstResult.id}`, {
      method: 'PATCH',
      body: { status: 'confirmed' }
    });
    assert.equal(response.status, 401, 'unauthenticated users cannot update order status');

    await context.createAdmin();
    const login = await signIn(context, '/api/site-admin/login', {
      username: 'ceo.test',
      password: siteAdminPassword
    });
    assert.equal(login.response.status, 200);
    response = await context.call('/api/site-admin/orders', {
      headers: { cookie: login.cookie }
    });
    assert.equal(response.status, 200);
    const listed = await response.json();
    assert.equal(listed.orders.length, 4);
    assert.equal(new Set(listed.orders.map((savedOrder) => savedOrder.id)).size, 4);

    response = await context.call('/api/site-admin/orders/not-a-uuid', {
      method: 'PATCH',
      headers: { cookie: login.cookie },
      body: { status: 'confirmed' }
    });
    assert.equal(response.status, 400, 'malformed order IDs are rejected');
    response = await context.call(`/api/site-admin/orders/${firstResult.id}`, {
      method: 'PATCH',
      headers: { cookie: login.cookie },
      body: { status: 'unknown' }
    });
    assert.equal(response.status, 400, 'unsupported order statuses are rejected');
    response = await context.call(`/api/site-admin/orders/${firstResult.id}`, {
      method: 'PATCH',
      headers: { cookie: login.cookie },
      body: { status: 'confirmed' }
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { updated: true, status: 'confirmed' });
    response = await context.call('/api/site-admin/orders', {
      headers: { cookie: login.cookie }
    });
    const updatedList = await response.json();
    assert.equal(updatedList.orders.find((savedOrder) => savedOrder.id === firstResult.id).status, 'confirmed');
    assert.equal(await countOrders(), 4, 'status updates preserve the number of saved orders');
  } finally {
    await closeContext(context);
    for (const [name, value] of Object.entries(previousTelegramEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
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
