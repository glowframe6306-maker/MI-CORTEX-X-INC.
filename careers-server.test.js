'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { DatabaseSync } = require('node:sqlite');
const { createAppServer, createSiteAdmin } = require('./careers-server');
const catalogue = require('./careers-catalogue');

const serverPath = path.join(__dirname, 'careers-server.js');
const adminEmail = 'local-admin@example.test';
const adminPassword = `Local-Prototype-${crypto.randomBytes(24).toString('base64url')}!`;
const siteAdminPassword = `CEO-Test-${crypto.randomBytes(24).toString('base64url')}!`;
const invalidSiteAdminPassword = `Invalid-${crypto.randomBytes(24).toString('base64url')}!`;

function runSiteAdminSetup(dataDirectory, answers) {
  const shimPath = path.join(dataDirectory, 'interactive-terminal-shim.js');
  fs.writeFileSync(shimPath, [
    "Object.defineProperty(process.stdin, 'isTTY', { value: true });",
    'process.stdin.setRawMode = () => {};',
    "Object.defineProperty(process.stdout, 'isTTY', { value: true });"
  ].join('\n'));

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-r', shimPath, serverPath, 'site-admin:create'], {
      cwd: __dirname,
      env: {
        ...process.env,
        CAREERS_DATA_DIR: dataDirectory,
        CAREERS_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64')
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const prompts = ['CEO username: ', 'CEO password (hidden): ', 'Confirm password (hidden): '];
    let output = '';
    let answerIndex = 0;
    let timeout;
    const advance = () => {
      while (answerIndex < answers.length && output.includes(prompts[answerIndex])) {
        const answer = answers[answerIndex++];
        child.stdin.write(`${answer}\r\n`);
        if (answerIndex === answers.length) child.stdin.end();
      }
    };
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      advance();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('close', (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal, output });
    });
    timeout = setTimeout(() => {
      child.kill();
      reject(new Error('The CEO setup CLI did not finish its interactive test.'));
    }, 15000);
  });
}

test('master catalogue retains legacy roles and excludes only the four reserved titles', () => {
  assert.deepEqual(catalogue.excludedTitles, ['CEO', 'OWNER', 'CHAIRMAN', 'FOUNDER']);
  const expectedCompanies = ['parent', 'aerotech', 'aitech', 'autotech', 'codex', 'cybertech', 'digitech', 'edutech', 'electrotech', 'hardtech', 'innovation', 'robotech'];
  assert.deepEqual(catalogue.companies.map((company) => company.id), expectedCompanies);
  catalogue.companies.forEach((company) => {
    const titles = company.positions.map((position) => position.title.toLocaleUpperCase('en'));
    assert.equal(new Set(titles).size, titles.length, `${company.name} has duplicate position titles`);
    assert.equal(titles.some((title) => catalogue.excludedTitles.includes(title)), false, `${company.name} contains a reserved title`);
    assert.ok(company.positions.length > 100, `${company.name} is missing the complete catalogue`);
  });
  const allTitles = new Set(catalogue.companies.flatMap((company) => company.positions.map((position) => position.title)));
  [
    'Chief Operating Officer (COO)',
    'Chief Technology Officer (CTO)',
    'Chief Financial Officer (CFO)',
    'Chief Information Officer (CIO)',
    'Chief Marketing Officer (CMO)',
    'Chief Human Resources Officer (CHRO)',
    'Chief Product Officer (CPO)',
    'Chief Strategy Officer (CSO)',
    'Chief Security Officer (CSO / Security)',
    'Senior Software Engineer',
    'Frontend Developer',
    'Backend Developer',
    'Full-Stack Developer',
    'Cybersecurity Analyst',
    'Aerospace Engineer',
    'Automotive Engineer',
    'Research Assistants',
    'Project Assistants',
    'Operations Assistants'
  ].forEach((title) => assert.ok(allTitles.has(title), `Missing expected eligible position: ${title}`));
});

test('CEO setup CLI safely handles interactive PowerShell input and creates only one hashed account', async () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-cortex-site-admin-cli-'));
  const validPassword = `CLI-CEO-${crypto.randomBytes(24).toString('base64url')}!`;
  const secondPassword = `Second-CEO-${crypto.randomBytes(24).toString('base64url')}!`;
  try {
    const initialized = await runSiteAdminSetup(dataDirectory, ['  ceo.cli  ', validPassword, validPassword]);
    assert.equal(initialized.code, 0, initialized.output);
    assert.match(initialized.output, /CEO administrator initialized for ceo\.cli\./);
    assert.equal(initialized.output.includes(validPassword), false, 'the CLI must never print the password');

    const database = new DatabaseSync(path.join(dataDirectory, 'careers.sqlite'));
    const storedAdmin = database.prepare('SELECT username, password_hash, role FROM site_admins').get();
    assert.equal(storedAdmin.username, 'ceo.cli');
    assert.match(storedAdmin.password_hash, /^\$2[aby]\$12\$/);
    assert.equal(storedAdmin.password_hash.includes(validPassword), false);
    assert.equal(storedAdmin.role, 'CEO');
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM site_admins').get().count, 1);
    database.close();

    const secondAccount = await runSiteAdminSetup(dataDirectory, ['ceo.second', secondPassword, secondPassword]);
    assert.equal(secondAccount.code, 1);
    assert.match(secondAccount.output, /A CEO administrator already exists/);
    assert.equal(secondAccount.output.includes(secondPassword), false);

    const emptyUsernameDirectory = path.join(dataDirectory, 'empty-username');
    fs.mkdirSync(emptyUsernameDirectory);
    const emptyUsername = await runSiteAdminSetup(emptyUsernameDirectory, ['   ']);
    assert.equal(emptyUsername.code, 1);
    assert.match(emptyUsername.output, /A CEO username is required/);

    const emptyPasswordDirectory = path.join(dataDirectory, 'empty-password');
    fs.mkdirSync(emptyPasswordDirectory);
    const emptyPassword = await runSiteAdminSetup(emptyPasswordDirectory, ['ceo.empty', '']);
    assert.equal(emptyPassword.code, 1);
    assert.match(emptyPassword.output, /A CEO password is required/);

    const invalidUsernameDirectory = path.join(dataDirectory, 'invalid-username');
    fs.mkdirSync(invalidUsernameDirectory);
    const invalidUsername = await runSiteAdminSetup(invalidUsernameDirectory, ['invalid username', validPassword, validPassword]);
    assert.equal(invalidUsername.code, 1);
    assert.match(invalidUsername.output, /username must contain 3 to 64/);

    const shortPasswordDirectory = path.join(dataDirectory, 'short-password');
    fs.mkdirSync(shortPasswordDirectory);
    const shortPassword = await runSiteAdminSetup(shortPasswordDirectory, ['ceo.short', 'short', 'short']);
    assert.equal(shortPassword.code, 1);
    assert.match(shortPassword.output, /password must contain at least 14 characters/);

    const emptyConfirmationDirectory = path.join(dataDirectory, 'empty-confirmation');
    fs.mkdirSync(emptyConfirmationDirectory);
    const emptyConfirmation = await runSiteAdminSetup(emptyConfirmationDirectory, ['ceo.confirm', validPassword, '']);
    assert.equal(emptyConfirmation.code, 1);
    assert.match(emptyConfirmation.output, /Password confirmation is required/);

    const mismatchDirectory = path.join(dataDirectory, 'mismatched-passwords');
    fs.mkdirSync(mismatchDirectory);
    const mismatch = await runSiteAdminSetup(mismatchDirectory, ['ceo.mismatch', validPassword, secondPassword]);
    assert.equal(mismatch.code, 1);
    assert.match(mismatch.output, /The passwords do not match/);
    assert.equal(mismatch.output.includes(validPassword), false);
    assert.equal(mismatch.output.includes(secondPassword), false);

    const cancelledUsernameDirectory = path.join(dataDirectory, 'cancelled-username');
    fs.mkdirSync(cancelledUsernameDirectory);
    const cancelledUsername = await runSiteAdminSetup(cancelledUsernameDirectory, ['\u0003']);
    assert.equal(cancelledUsername.code, 1);
    assert.match(cancelledUsername.output, /Administrator setup cancelled/);

    const cancelledPasswordDirectory = path.join(dataDirectory, 'cancelled-password');
    fs.mkdirSync(cancelledPasswordDirectory);
    const cancelledPassword = await runSiteAdminSetup(cancelledPasswordDirectory, ['ceo.cancelled', '\u0003']);
    assert.equal(cancelledPassword.code, 1);
    assert.match(cancelledPassword.output, /Administrator setup cancelled/);
  } finally {
    fs.rmSync(dataDirectory, { recursive: true, force: true });
  }
});

test('local Careers service enforces gates, protects stored data, and supports admin review', async () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-cortex-careers-'));
  const originalEnvironment = {
    CAREERS_DATA_DIR: process.env.CAREERS_DATA_DIR,
    CAREERS_ENCRYPTION_KEY: process.env.CAREERS_ENCRYPTION_KEY,
    CAREERS_ADMIN_EMAIL: process.env.CAREERS_ADMIN_EMAIL,
    CAREERS_ADMIN_PASSWORD: process.env.CAREERS_ADMIN_PASSWORD,
    CAREERS_OPEN_AT: process.env.CAREERS_OPEN_AT,
    CAREERS_RECRUITMENT_APPROVED: process.env.CAREERS_RECRUITMENT_APPROVED
  };
  process.env.CAREERS_DATA_DIR = dataDirectory;
  process.env.CAREERS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  process.env.CAREERS_ADMIN_EMAIL = adminEmail;
  process.env.CAREERS_ADMIN_PASSWORD = adminPassword;
  process.env.CAREERS_OPEN_AT = '2020-01-01T00:00:00Z';
  process.env.CAREERS_RECRUITMENT_APPROVED = 'false';

  let server;
  let database;
  let baseUrl;
  try {
    const initialized = spawnSync(process.execPath, [serverPath, 'admin:create'], {
      encoding: 'utf8',
      env: process.env
    });
    assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout);
    await createSiteAdmin('ceo.local', siteAdminPassword);

    const request = async (route, options = {}, cookie = '') => {
      const headers = new Headers(options.headers || {});
      if (options.method && options.method !== 'GET') headers.set('Origin', baseUrl);
      if (cookie) headers.set('Cookie', cookie);
      const response = await fetch(`${baseUrl}${route}`, { ...options, headers });
      return { response, body: await response.json() };
    };

    server = createAppServer();
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    let result;
    let protectedPage = await fetch(`${baseUrl}/admin`, { redirect: 'manual' });
    assert.equal(protectedPage.status, 200, 'the official /admin route serves the login page');
    let loginHtml = await protectedPage.text();
    assert.match(loginHtml, /ADMINISTRATOR LOGIN/);
    assert.equal(loginHtml.includes(siteAdminPassword), false);
    protectedPage = await fetch(`${baseUrl}/admin/dashboard`, { redirect: 'manual' });
    assert.equal(protectedPage.status, 303, 'the dashboard route must redirect unauthenticated visitors');
    assert.equal(protectedPage.headers.get('location'), '/admin');
    protectedPage = await fetch(`${baseUrl}/admin.html`, { redirect: 'manual' });
    assert.equal(protectedPage.status, 303, 'the legacy dashboard URL must not bypass authentication');
    assert.equal(protectedPage.headers.get('location'), '/admin');
    for (const route of ['/ADMIN/dashboard', '/%61dmin/dashboard', '/backup-20261105/ADMIN.html']) {
      protectedPage = await fetch(`${baseUrl}${route}`, { redirect: 'manual' });
      assert.equal(protectedPage.status, 303, `${route} must not bypass the dashboard gate`);
    }
    protectedPage = await fetch(`${baseUrl}/admin-login.html`, { redirect: 'manual' });
    assert.equal(protectedPage.status, 303, 'the old login URL redirects to the official login route');
    assert.equal(protectedPage.headers.get('location'), '/admin');
    assert.equal((await fetch(`${baseUrl}/careers-admin.html`)).status, 200, 'Careers Admin remains an independent route');

    result = await request('/api/site-admin/session');
    assert.equal(result.response.status, 401, 'the CEO session endpoint must reject unauthenticated requests');
    result = await request('/api/site-admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '', password: '' })
    });
    assert.equal(result.response.status, 400, 'both login fields must be required');
    result = await request('/api/site-admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'unknown.user', password: siteAdminPassword })
    });
    assert.equal(result.response.status, 401);
    assert.equal(result.body.error, 'Username or password is incorrect.');
    result = await request('/api/site-admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ceo.local', password: invalidSiteAdminPassword })
    });
    assert.equal(result.response.status, 401);
    assert.equal(result.body.error, 'Username or password is incorrect.');

    database = new DatabaseSync(path.join(dataDirectory, 'careers.sqlite'));
    const storedSiteAdmin = database.prepare('SELECT password_hash, role FROM site_admins WHERE username = ?').get('ceo.local');
    assert.match(storedSiteAdmin.password_hash, /^\$2[aby]\$12\$/);
    assert.notEqual(storedSiteAdmin.password_hash, siteAdminPassword);
    assert.equal(storedSiteAdmin.role, 'CEO', 'the initial account retains the highest CEO role');
    database.close();
    database = null;

    result = await request('/api/site-admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ceo.local', password: siteAdminPassword })
    });
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body, { username: 'ceo.local', role: 'CEO' });
    const siteAdminCookieHeader = result.response.headers.get('set-cookie');
    assert.match(siteAdminCookieHeader, /HttpOnly/);
    assert.match(siteAdminCookieHeader, /SameSite=Strict/);
    assert.match(siteAdminCookieHeader, /Secure/);
    assert.match(siteAdminCookieHeader, /Max-Age=28800/);
    const siteAdminCookie = siteAdminCookieHeader.split(';', 1)[0];

    protectedPage = await fetch(`${baseUrl}/admin.html`, {
      headers: { Cookie: siteAdminCookie },
      redirect: 'manual'
    });
    assert.equal(protectedPage.status, 303, 'the legacy dashboard URL redirects to the official dashboard route');
    assert.equal(protectedPage.headers.get('location'), '/admin/dashboard');
    protectedPage = await fetch(`${baseUrl}/admin/dashboard`, {
      headers: { Cookie: siteAdminCookie },
      redirect: 'manual'
    });
    assert.equal(protectedPage.status, 200, 'the CEO session grants dashboard access');
    assert.match(await protectedPage.text(), /Admin Dashboard/);
    result = await request('/api/site-admin/session', {}, siteAdminCookie);
    assert.equal(result.response.status, 200, 'the session survives a separate request');
    assert.equal(result.body.role, 'CEO');
    const authenticatedLogin = await fetch(`${baseUrl}/admin`, {
      headers: { Cookie: siteAdminCookie },
      redirect: 'manual'
    });
    assert.equal(authenticatedLogin.status, 303, 'an authenticated user is redirected away from login');
    assert.equal(authenticatedLogin.headers.get('location'), '/admin/dashboard');

    result = await request('/api/site-admin/logout', { method: 'POST' }, siteAdminCookie);
    assert.equal(result.response.status, 200);
    result = await request('/api/site-admin/session', {}, siteAdminCookie);
    assert.equal(result.response.status, 401, 'logout invalidates the server-side session');
    protectedPage = await fetch(`${baseUrl}/admin/dashboard`, { redirect: 'manual' });
    assert.equal(protectedPage.status, 303, 'the dashboard is protected after logout');
    assert.equal(protectedPage.headers.get('location'), '/admin');
    for (let attempt = 0; attempt < 5; attempt++) {
      result = await request('/api/site-admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'ceo.local', password: invalidSiteAdminPassword })
      });
      assert.equal(result.response.status, 401);
    }
    result = await request('/api/site-admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ceo.local', password: invalidSiteAdminPassword })
    });
    assert.equal(result.response.status, 429, 'login attempts are rate limited');

    result = await request('/api/careers/status');
    assert.equal(result.body.enabled, false, 'official approval is required even after the date gate');
    assert.equal(result.body.uploadsEnabled, false);

    const application = {
      fullName: 'Test Applicant',
      email: 'applicant@example.test',
      phone: '+1 555 123 4567',
      companyId: 'aitech',
      positionTitle: 'Machine Learning Engineer',
      statement: 'I am interested in this proposed role and its research focus.',
      ageConfirmed: true,
      privacyConsent: true,
      documents: [{
        name: 'test-cv.pdf',
        mimeType: 'application/pdf',
        contentBase64: Buffer.from('%PDF-1.4\nlocal prototype test\n%%EOF', 'ascii').toString('base64')
      }]
    };
    result = await request('/api/careers/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(application)
    });
    assert.equal(result.response.status, 403, 'the server must block submissions until enabled');
    database = new DatabaseSync(path.join(dataDirectory, 'careers.sqlite'));
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM applications').get().count, 0);
    database.close();
    database = null;

    await new Promise((resolve) => server.close(resolve));
    server = null;
    process.env.CAREERS_RECRUITMENT_APPROVED = 'true';
    server = createAppServer();
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    result = await request('/api/careers/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...application, ageConfirmed: false })
    });
    assert.equal(result.response.status, 400, 'required applicant confirmations must be validated');
    result = await request('/api/careers/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...application, positionTitle: 'CEO' })
    });
    assert.equal(result.response.status, 400, 'reserved titles must not be accepted by the API');
    result = await request('/api/careers/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...application,
        documents: [{ name: 'resume.txt', mimeType: 'text/plain', contentBase64: 'aGVsbG8=' }]
      })
    });
    assert.equal(result.response.status, 400, 'unsupported document types must be rejected');

    result = await request('/api/careers/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(application)
    });
    assert.equal(result.response.status, 201);
    const applicationId = result.body.id;
    assert.match(applicationId, /^[0-9a-f-]{36}$/i);

    database = new DatabaseSync(path.join(dataDirectory, 'careers.sqlite'));
    const stored = database.prepare('SELECT encrypted_applicant FROM applications WHERE id = ?').get(applicationId);
    assert.ok(stored.encrypted_applicant);
    assert.equal(stored.encrypted_applicant.includes(application.fullName), false);
    assert.equal(stored.encrypted_applicant.includes(application.email), false);
    assert.equal(stored.encrypted_applicant.includes('test-cv.pdf'), false);
    const storedDocument = database.prepare('SELECT encrypted_metadata, encrypted_content FROM documents WHERE application_id = ?').get(applicationId);
    assert.ok(storedDocument.encrypted_metadata);
    assert.equal(storedDocument.encrypted_metadata.includes('test-cv.pdf'), false);
    assert.equal(Buffer.from(storedDocument.encrypted_content).includes(Buffer.from('%PDF-', 'ascii')), false);

    const applicationIds = [applicationId];
    for (let index = 2; index <= 15; index += 1) {
      const anotherApplicant = {
        ...application,
        fullName: `Test Applicant ${index}`,
        email: `applicant-${index}@example.test`,
        documents: []
      };
      result = await request('/api/careers/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(anotherApplicant)
      });
      assert.equal(result.response.status, 201, `applicant ${index} must be able to apply for the same role`);
      applicationIds.push(result.body.id);
    }
    assert.equal(new Set(applicationIds).size, 15, 'each applicant must receive a unique reference');
    assert.ok(
      catalogue.companies.find((company) => company.id === 'aitech').positions.some((position) => position.title === application.positionTitle),
      'applying must not remove or lock a position'
    );

    result = await request('/api/admin/applications');
    assert.equal(result.response.status, 401, 'application records must require an admin session');

    result = await request('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword })
    });
    assert.equal(result.response.status, 200);
    const cookie = result.response.headers.get('set-cookie').split(';', 1)[0];
    assert.match(result.response.headers.get('set-cookie'), /HttpOnly/);
    assert.match(result.response.headers.get('set-cookie'), /SameSite=Strict/);

    result = await request('/api/admin/applications');
    assert.equal(result.response.status, 401, 'admin records must not be readable without the session cookie');

    result = await request('/api/admin/applications', {}, cookie);
    assert.equal(result.response.status, 200);
    assert.equal(result.body.applications.length, 15);
    assert.equal(new Set(result.body.applications.map((item) => item.applicant.email)).size, 15);
    assert.equal(result.body.applications.every((item) => item.positionTitle === application.positionTitle), true);
    assert.equal(result.body.applications.every((item) => item.companyName === 'MI CORTEX AITECH'), true);
    assert.equal(result.body.applications.find((item) => item.id === applicationId).positionCategory, 'Engineers and Technical Professionals');
    const document = result.body.applications.find((item) => item.id === applicationId).applicant.documents[0];
    assert.equal(document.name, 'test-cv.pdf');

    const downloaded = await fetch(`${baseUrl}/api/admin/applications/${applicationId}/documents/${document.id}`, {
      headers: { Cookie: cookie }
    });
    assert.equal(downloaded.status, 200);
    assert.match(downloaded.headers.get('content-disposition'), /attachment/);
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), Buffer.from('%PDF-1.4\nlocal prototype test\n%%EOF', 'ascii'));

    result = await request(`/api/admin/applications/${applicationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'reviewing' })
    }, cookie);
    assert.equal(result.response.status, 200);
    result = await request('/api/admin/applications', {}, cookie);
    assert.equal(result.body.applications.find((item) => item.id === applicationId).status, 'reviewing');

    result = await request(`/api/admin/applications/${applicationId}`, {
      method: 'DELETE'
    }, cookie);
    assert.equal(result.response.status, 200);
    result = await request('/api/admin/applications', {}, cookie);
    assert.equal(result.body.applications.length, 14, 'deleting one record must preserve the other applicants');
    assert.equal(result.body.applications.some((item) => item.id === applicationId), false);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM documents WHERE application_id = ?').get(applicationId).count, 0);
    database.close();
    database = null;

    result = await request('/.careers-local/careers.sqlite');
    assert.equal(result.response.status, 404, 'private database files must not be served');

    result = await request('/api/admin/logout', { method: 'POST' }, cookie);
    assert.equal(result.response.status, 200);
    result = await request('/api/admin/applications', {}, cookie);
    assert.equal(result.response.status, 401, 'logout must invalidate the session');
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (database) database.close();
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    fs.rmSync(dataDirectory, { recursive: true, force: true });
  }
});

test('order submissions are idempotent under retries and concurrency while preserving admin workflows', async () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-cortex-orders-'));
  const environmentNames = [
    'CAREERS_DATA_DIR',
    'CAREERS_ENCRYPTION_KEY',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID'
  ];
  const originalEnvironment = Object.fromEntries(
    environmentNames.map((name) => [name, process.env[name]])
  );
  const originalFetch = global.fetch;
  const telegramRequests = [];
  process.env.CAREERS_DATA_DIR = dataDirectory;
  process.env.CAREERS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  process.env.TELEGRAM_BOT_TOKEN = 'local-test-token';
  process.env.TELEGRAM_CHAT_ID = 'local-test-chat';

  let server;
  let database;
  try {
    await createSiteAdmin('ceo.orders', siteAdminPassword);
    global.fetch = async (input, options) => {
      if (String(input).startsWith('https://api.telegram.org/')) {
        telegramRequests.push({ input: String(input), options });
        return {
          ok: false,
          status: 503,
          json: async () => ({ ok: false })
        };
      }
      return originalFetch(input, options);
    };

    server = createAppServer();
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const request = async (route, options = {}, cookie = '') => {
      const headers = new Headers(options.headers || {});
      if (options.method && options.method !== 'GET') headers.set('Origin', baseUrl);
      if (cookie) headers.set('Cookie', cookie);
      const response = await fetch(`${baseUrl}${route}`, { ...options, headers });
      return { response, body: await response.json() };
    };
    const order = {
      itemType: 'product',
      itemName: 'Isolated Idempotency Test Item',
      itemCategory: 'test',
      customerName: 'Test Customer',
      customerEmail: 'idempotency@example.test',
      customerPhone: '+1 555 123 4567',
      companyName: 'Test Company',
      quantity: 1,
      urgency: 'standard',
      preferredTimeline: '',
      budget: '',
      notes: 'Isolated idempotency test only'
    };
    const countOrders = () => database.prepare('SELECT COUNT(*) AS count FROM orders').get().count;
    const submit = (key, payload = order) => request('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify(payload)
    });

    database = new DatabaseSync(path.join(dataDirectory, 'careers.sqlite'));
    const missingKey = await request('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });
    assert.equal(missingKey.response.status, 400, 'order creation requires an idempotency key');
    assert.equal(countOrders(), 0, 'a request without a key creates no order');

    const firstKey = crypto.randomUUID();
    const first = await submit(firstKey);
    assert.equal(first.response.status, 201);
    assert.equal(countOrders(), 1, 'the first submission creates exactly one database order');

    const retry = await submit(firstKey, { ...order, itemName: 'Changed retry payload' });
    assert.equal(retry.response.status, 201);
    assert.deepEqual(retry.body, first.body, 'a repeated key returns the original order result');
    assert.equal(countOrders(), 1, 'the repeated key does not create another database order');
    assert.equal(
      database.prepare('SELECT item_name FROM orders WHERE id = ?').get(first.body.id).item_name,
      order.itemName,
      'a retry preserves the original order data'
    );
    assert.equal(telegramRequests.length, 1, 'a duplicate retry does not repeat the Telegram notification');

    const concurrentKey = crypto.randomUUID();
    const concurrent = await Promise.all([submit(concurrentKey), submit(concurrentKey)]);
    assert.deepEqual(concurrent.map(({ response }) => response.status), [201, 201]);
    assert.equal(concurrent[0].body.id, concurrent[1].body.id, 'concurrent requests resolve to one order ID');
    assert.equal(countOrders(), 2, 'two concurrent requests create exactly one additional order');
    assert.equal(
      database.prepare('SELECT COUNT(*) AS count FROM order_idempotency_keys WHERE idempotency_key = ?').get(concurrentKey).count,
      1
    );

    const repeatOrder = await submit(crypto.randomUUID());
    assert.equal(repeatOrder.response.status, 201);
    assert.notEqual(repeatOrder.body.id, first.body.id, 'a new key allows a legitimate repeat order');
    assert.equal(countOrders(), 3, 'a new key creates one new database order');

    const failedTelegramKey = crypto.randomUUID();
    const failedTelegramOrder = await submit(failedTelegramKey);
    assert.equal(failedTelegramOrder.response.status, 201);
    assert.equal(countOrders(), 4, 'Telegram failure leaves the newly saved order intact');
    const failedTelegramRetry = await submit(failedTelegramKey);
    assert.deepEqual(failedTelegramRetry.body, failedTelegramOrder.body);
    assert.equal(countOrders(), 4, 'retry after Telegram failure neither deletes nor duplicates the order');
    assert.equal(telegramRequests.length, 4, 'Telegram was attempted once per new order, not per retry');

    const login = await request('/api/site-admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ceo.orders', password: siteAdminPassword })
    });
    assert.equal(login.response.status, 200);
    const cookie = login.response.headers.get('set-cookie').split(';', 1)[0];
    const listed = await request('/api/site-admin/orders', {}, cookie);
    assert.equal(listed.response.status, 200);
    assert.equal(listed.body.orders.length, 4, 'the admin dashboard API lists each unique saved order');
    assert.equal(new Set(listed.body.orders.map((savedOrder) => savedOrder.id)).size, 4);

    const update = await request(`/api/site-admin/orders/${first.body.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' })
    }, cookie);
    assert.equal(update.response.status, 200);
    assert.deepEqual(update.body, { updated: true, status: 'confirmed' });
    const updatedList = await request('/api/site-admin/orders', {}, cookie);
    assert.equal(updatedList.body.orders.find((savedOrder) => savedOrder.id === first.body.id).status, 'confirmed');
    assert.equal(countOrders(), 4, 'status updates do not alter the order count');
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (database) database.close();
    global.fetch = originalFetch;
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    fs.rmSync(dataDirectory, { recursive: true, force: true });
  }
});
