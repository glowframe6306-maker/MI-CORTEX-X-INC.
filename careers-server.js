'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const readline = require('node:readline');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const CAREERS_CATALOGUE = require('./careers-catalogue');

const ROOT = __dirname;
const DEFAULT_PORT = 4173;
const DEFAULT_OPEN_AT = '2029-01-01T00:00:00+05:30';
const DEFAULT_RETENTION_DAYS = 90;
const MAX_BODY_BYTES = 43 * 1024 * 1024;
const MAX_SMALL_BODY_BYTES = 16 * 1024;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENTS = 3;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SITE_ADMIN_COOKIE = 'site_admin_session';
const BCRYPT_ROUNDS = 12;
const VALID_STATUSES = new Set(['new', 'reviewing', 'shortlisted', 'rejected', 'withdrawn']);
const COMPANY_BY_ID = new Map(CAREERS_CATALOGUE.companies.map((company) => [company.id, company]));
const POSITION_TITLES = new Map(CAREERS_CATALOGUE.companies.map((company) => [
  company.id,
  new Set(company.positions.map((position) => position.title))
]));

class HttpError extends Error {
  constructor(status, message, headers = {}) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

function getEncryptionKey() {
  const key = Buffer.from(process.env.CAREERS_ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32) {
    throw new Error('Set CAREERS_ENCRYPTION_KEY to a base64-encoded 32-byte key. Generate one with "node careers-server.js generate-key".');
  }
  return key;
}

function getDataDirectory() {
  return path.resolve(process.env.CAREERS_DATA_DIR || path.join(ROOT, '.careers-local'));
}

function createDatabase() {
  const dataDirectory = getDataDirectory();
  fs.mkdirSync(dataDirectory, { recursive: true });
  const database = new DatabaseSync(path.join(dataDirectory, 'careers.sqlite'));
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS admins (
      email TEXT PRIMARY KEY COLLATE NOCASE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS site_admins (
      username TEXT PRIMARY KEY COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role = 'CEO'),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      company_name TEXT NOT NULL,
      position_title TEXT NOT NULL,
      position_category TEXT NOT NULL,
      encrypted_applicant TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new'
        CHECK(status IN ('new', 'reviewing', 'shortlisted', 'rejected', 'withdrawn')),
      privacy_consent_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      encrypted_metadata TEXT NOT NULL,
      encrypted_content BLOB NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return database;
}

function hashPassword(password, salt = crypto.randomBytes(16)) {
  return {
    salt: salt.toString('hex'),
    hash: crypto.scryptSync(password, salt, 64).toString('hex')
  };
}

function encryptApplicant(applicant, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(applicant), 'utf8'),
    cipher.final()
  ]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64')).join('.');
}

function decryptApplicant(encrypted, key) {
  const [iv, authTag, ciphertext] = encrypted.split('.').map((part) => Buffer.from(part, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
}

function encryptBuffer(value, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

function decryptBuffer(value, key) {
  const encrypted = Buffer.from(value);
  const iv = encrypted.subarray(0, 12);
  const authTag = encrypted.subarray(12, 28);
  const ciphertext = encrypted.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function sendJson(response, status, value, headers = {}) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': 'application/json; charset=utf-8',
    ...headers
  });
  response.end(body);
}

function readJson(request, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const contentType = request.headers['content-type'] || '';
    if (!contentType.toLowerCase().startsWith('application/json')) {
      reject(new HttpError(415, 'Send this request as JSON.'));
      request.resume();
      return;
    }

    let size = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new HttpError(413, 'The request is too large.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'The request body is not valid JSON.'));
      }
    });
    request.on('error', reject);
  });
}

function readCookie(request, name) {
  const cookies = (request.headers.cookie || '').split(';');
  const entry = cookies.find((item) => item.trim().startsWith(`${name}=`));
  return entry ? entry.trim().slice(name.length + 1) : '';
}

function validateSiteAdminCredentials(username, password) {
  if (!/^[a-zA-Z0-9._-]{3,64}$/.test(username)) {
    throw new Error('The username must contain 3 to 64 letters, numbers, dots, underscores, or hyphens.');
  }
  const passwordBytes = Buffer.byteLength(password, 'utf8');
  if (password.length < 14 || passwordBytes > 72) {
    throw new Error('The password must contain at least 14 characters and no more than 72 UTF-8 bytes.');
  }
}

async function createSiteAdmin(username, password) {
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';
  if (typeof password !== 'string') throw new Error('A password is required.');
  validateSiteAdminCredentials(normalizedUsername, password);
  const database = createDatabase();
  try {
    if (database.prepare('SELECT 1 FROM site_admins LIMIT 1').get()) {
      throw new Error('A CEO administrator already exists. Account setup can only be completed once.');
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    database.prepare(`
      INSERT INTO site_admins (username, password_hash, role, created_at)
      VALUES (?, ?, 'CEO', ?)
    `).run(normalizedUsername, passwordHash, new Date().toISOString());
  } finally {
    database.close();
  }
  return normalizedUsername;
}

function getOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) throw new HttpError(403, 'A same-origin request is required.');
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    throw new HttpError(403, 'A same-origin request is required.');
  }
  const host = request.headers.host;
  if (
    !host
    || parsed.host.toLowerCase() !== host.toLowerCase()
    || !['localhost', '127.0.0.1'].includes(parsed.hostname)
  ) {
    throw new HttpError(403, 'A same-origin request is required.');
  }
}

function validateApplication(input) {
  const requiredKeys = ['fullName', 'email', 'phone', 'companyId', 'positionTitle', 'statement', 'ageConfirmed', 'privacyConsent', 'documents'];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpError(400, 'Application details are required.');
  }
  if (Object.keys(input).some((key) => !requiredKeys.includes(key))) {
    throw new HttpError(400, 'The application contains unsupported fields.');
  }
  const text = (value) => typeof value === 'string' ? value.trim() : '';
  const applicant = {
    fullName: text(input.fullName),
    email: text(input.email).toLowerCase(),
    phone: text(input.phone),
    statement: text(input.statement)
  };
  if (applicant.fullName.length < 2 || applicant.fullName.length > 120) {
    throw new HttpError(400, 'Enter a name between 2 and 120 characters.');
  }
  if (applicant.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicant.email)) {
    throw new HttpError(400, 'Enter a valid email address.');
  }
  if (applicant.phone.length > 30 || (applicant.phone && !/^[+()\d.\-\s]{7,30}$/.test(applicant.phone))) {
    throw new HttpError(400, 'Enter a valid phone number or leave it blank.');
  }
  if (applicant.statement.length < 20 || applicant.statement.length > 4000) {
    throw new HttpError(400, 'The application statement must be 20 to 4,000 characters.');
  }
  const company = typeof input.companyId === 'string' ? COMPANY_BY_ID.get(input.companyId) : null;
  if (!company) {
    throw new HttpError(400, 'Choose a listed company.');
  }
  const positionTitle = text(input.positionTitle);
  if (!POSITION_TITLES.get(input.companyId).has(positionTitle)) {
    throw new HttpError(400, 'Choose an eligible position from the selected company.');
  }
  if (input.ageConfirmed !== true || input.privacyConsent !== true) {
    throw new HttpError(400, 'Confirm the age and privacy statements before submitting.');
  }
  if (!Array.isArray(input.documents) || input.documents.length > MAX_DOCUMENTS) {
    throw new HttpError(400, `Attach no more than ${MAX_DOCUMENTS} PDF documents.`);
  }
  const documents = input.documents.map((document) => {
    if (!document || typeof document !== 'object' || Array.isArray(document)) {
      throw new HttpError(400, 'A supporting document is invalid.');
    }
    if (Object.keys(document).some((key) => !['name', 'mimeType', 'contentBase64'].includes(key))) {
      throw new HttpError(400, 'A supporting document contains unsupported fields.');
    }
    const name = text(document.name);
    const mimeType = text(document.mimeType).toLowerCase();
    const contentBase64 = typeof document.contentBase64 === 'string' ? document.contentBase64 : '';
    if (
      !name
      || name.length > 180
      || !/\.pdf$/i.test(name)
      || mimeType !== 'application/pdf'
      || !contentBase64
      || contentBase64.length > Math.ceil(MAX_DOCUMENT_BYTES * 4 / 3) + 4
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(contentBase64)
    ) {
      throw new HttpError(400, 'Each supporting document must be a valid PDF of 10 MB or less.');
    }
    const content = Buffer.from(contentBase64, 'base64');
    if (
      content.length === 0
      || content.length > MAX_DOCUMENT_BYTES
      || content.toString('base64') !== contentBase64
      || content.subarray(0, 5).toString('ascii') !== '%PDF-'
    ) {
      throw new HttpError(400, 'Each supporting document must be a valid PDF of 10 MB or less.');
    }
    return { id: crypto.randomUUID(), name, size: content.length, content };
  });
  return {
    applicant,
    companyId: input.companyId,
    companyName: company.name,
    positionTitle,
    positionCategory: company.positions.find((position) => position.title === positionTitle).category,
    documents
  };
}

function createAppServer() {
  const encryptionKey = getEncryptionKey();
  const database = createDatabase();
  const sessions = new Map();
  const siteAdminSessions = new Map();
  const loginAttempts = new Map();
  const siteAdminLoginAttempts = new Map();
  const invalidSiteAdminHash = bcrypt.hashSync('invalid-site-admin-password-placeholder', BCRYPT_ROUNDS);
  const openAt = new Date(process.env.CAREERS_OPEN_AT || DEFAULT_OPEN_AT);
  if (Number.isNaN(openAt.getTime())) throw new Error('CAREERS_OPEN_AT must be a valid ISO-8601 date.');
  const retentionDays = Number(process.env.CAREERS_RETENTION_DAYS || DEFAULT_RETENTION_DAYS);
  if (!Number.isInteger(retentionDays) || retentionDays < 30 || retentionDays > 365) {
    throw new Error('CAREERS_RETENTION_DAYS must be a whole number between 30 and 365.');
  }
  const recruitmentApproved = process.env.CAREERS_RECRUITMENT_APPROVED === 'true';
  const isRecruitmentOpen = () => recruitmentApproved && Date.now() >= openAt.getTime();
  const deleteExpiredApplications = () => {
    database.prepare("DELETE FROM applications WHERE julianday(created_at) <= julianday('now', ?)")
      .run(`-${retentionDays} days`);
  };
  deleteExpiredApplications();
  const retentionTimer = setInterval(deleteExpiredApplications, 6 * 60 * 60 * 1000);
  retentionTimer.unref();

  const checkRateLimit = (map, key, limit, windowMs) => {
    const now = Date.now();
    const current = map.get(key);
    if (!current || now - current.startedAt >= windowMs) {
      map.set(key, { count: 1, startedAt: now });
      return;
    }
    if (current.count >= limit) {
      const retryAfter = Math.max(1, Math.ceil((windowMs - (now - current.startedAt)) / 1000));
      throw new HttpError(429, 'Too many attempts. Try again later.', { 'Retry-After': String(retryAfter) });
    }
    current.count += 1;
  };

  const requireAdmin = (request) => {
    const token = readCookie(request, 'careers_admin');
    const session = sessions.get(token);
    if (!token || !session || session.expiresAt <= Date.now()) {
      sessions.delete(token);
      throw new HttpError(401, 'Sign in to manage applications.');
    }
    session.expiresAt = Date.now() + SESSION_TTL_MS;
    return session.email;
  };

  const getSiteAdminSession = (request) => {
    const token = readCookie(request, SITE_ADMIN_COOKIE);
    const session = siteAdminSessions.get(token);
    if (!token || !session || session.expiresAt <= Date.now()) {
      siteAdminSessions.delete(token);
      return null;
    }
    session.expiresAt = Date.now() + SESSION_TTL_MS;
    return session;
  };

  const requireSiteAdmin = (request) => {
    const session = getSiteAdminSession(request);
    if (!session) throw new HttpError(401, 'Sign in to access the administrator dashboard.');
    return session;
  };

  const siteAdminCookie = (value, maxAge) => (
    `${SITE_ADMIN_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=${maxAge}`
  );

  const handleApi = async (request, response, url) => {
    if (url.pathname === '/api/site-admin/login' && request.method === 'POST') {
      getOrigin(request);
      checkRateLimit(siteAdminLoginAttempts, request.socket.remoteAddress, 5, 15 * 60 * 1000);
      const input = await readJson(request, MAX_SMALL_BODY_BYTES);
      if (!input || typeof input !== 'object' || Array.isArray(input)
        || Object.keys(input).some((key) => !['username', 'password'].includes(key))) {
        throw new HttpError(400, 'Enter a username and password.');
      }
      const username = typeof input.username === 'string' ? input.username.trim() : '';
      const password = typeof input.password === 'string' ? input.password : '';
      if (!username || !password) throw new HttpError(400, 'Enter a username and password.');
      const validUsername = /^[a-zA-Z0-9._-]{3,64}$/.test(username);
      const admin = validUsername
        ? database.prepare('SELECT username, password_hash, role FROM site_admins WHERE username = ? COLLATE NOCASE').get(username)
        : null;
      const passwordMatches = await bcrypt.compare(password, admin?.password_hash || invalidSiteAdminHash);
      if (!admin || !passwordMatches || Buffer.byteLength(password, 'utf8') > 72) {
        throw new HttpError(401, 'Username or password is incorrect.');
      }
      siteAdminLoginAttempts.delete(request.socket.remoteAddress);
      const token = crypto.randomBytes(32).toString('base64url');
      siteAdminSessions.set(token, {
        username: admin.username,
        role: admin.role,
        expiresAt: Date.now() + SESSION_TTL_MS
      });
      sendJson(response, 200, { username: admin.username, role: admin.role }, {
        'Set-Cookie': siteAdminCookie(token, SESSION_TTL_MS / 1000)
      });
      return;
    }

    if (url.pathname === '/api/site-admin/session' && request.method === 'GET') {
      const session = requireSiteAdmin(request);
      sendJson(response, 200, { username: session.username, role: session.role });
      return;
    }

    if (url.pathname === '/api/site-admin/logout' && request.method === 'POST') {
      getOrigin(request);
      siteAdminSessions.delete(readCookie(request, SITE_ADMIN_COOKIE));
      sendJson(response, 200, { signedOut: true }, {
        'Set-Cookie': siteAdminCookie('', 0)
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/careers/status') {
      sendJson(response, 200, {
        enabled: isRecruitmentOpen(),
        opensAt: openAt.toISOString(),
        serverTime: new Date().toISOString(),
        retentionDays,
        uploadsEnabled: isRecruitmentOpen(),
        maxDocuments: MAX_DOCUMENTS,
        maxDocumentBytes: MAX_DOCUMENT_BYTES,
        localPrototype: true
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/careers/applications') {
      getOrigin(request);
      if (!isRecruitmentOpen()) throw new HttpError(403, 'Applications are not open.');
      const application = validateApplication(await readJson(request));
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const encryptedApplicant = encryptApplicant({
        ...application.applicant,
        documents: application.documents.map(({ id: documentId, name, size }) => ({
          id: documentId,
          name,
          size
        }))
      }, encryptionKey);
      database.exec('BEGIN IMMEDIATE');
      try {
      database.prepare(`
        INSERT INTO applications (
          id, company_id, company_name, position_title, position_category,
          encrypted_applicant, privacy_consent_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        application.companyId,
        application.companyName,
        application.positionTitle,
        application.positionCategory,
        encryptedApplicant,
        now,
        now,
        now
      );
        const insertDocument = database.prepare(`
          INSERT INTO documents (id, application_id, encrypted_metadata, encrypted_content, created_at)
          VALUES (?, ?, ?, ?, ?)
        `);
        application.documents.forEach((document) => {
          insertDocument.run(
            document.id,
            id,
            encryptApplicant({ name: document.name, size: document.size }, encryptionKey),
            encryptBuffer(document.content, encryptionKey),
            now
          );
        });
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
      sendJson(response, 201, { id, received: true, message: 'Your application was received.' });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/admin/login') {
      getOrigin(request);
      checkRateLimit(loginAttempts, request.socket.remoteAddress, 5, 15 * 60 * 1000);
      const input = await readJson(request, MAX_SMALL_BODY_BYTES);
      const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
      const password = typeof input.password === 'string' ? input.password : '';
      const admin = database.prepare('SELECT email, password_salt, password_hash FROM admins WHERE email = ? COLLATE NOCASE').get(email);
      const salt = admin ? Buffer.from(admin.password_salt, 'hex') : Buffer.alloc(16);
      const expected = admin ? Buffer.from(admin.password_hash, 'hex') : crypto.scryptSync('invalid-password', salt, 64);
      const actual = crypto.scryptSync(password, salt, 64);
      if (!admin || actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
        throw new HttpError(401, 'Email or password is incorrect.');
      }
      loginAttempts.delete(request.socket.remoteAddress);
      const token = crypto.randomBytes(32).toString('base64url');
      sessions.set(token, { email: admin.email, expiresAt: Date.now() + SESSION_TTL_MS });
      sendJson(response, 200, { email: admin.email }, {
        'Set-Cookie': `careers_admin=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}`
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/admin/logout') {
      getOrigin(request);
      sessions.delete(readCookie(request, 'careers_admin'));
      sendJson(response, 200, { signedOut: true }, {
        'Set-Cookie': 'careers_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
      });
      return;
    }

    if (url.pathname === '/api/admin/applications' && request.method === 'GET') {
      requireAdmin(request);
      const rows = database.prepare(`
        SELECT id, company_id AS companyId, company_name AS companyName,
          position_title AS positionTitle, position_category AS positionCategory,
          encrypted_applicant AS encryptedApplicant, status, created_at AS createdAt,
          updated_at AS updatedAt
        FROM applications ORDER BY created_at DESC, id
      `).all();
      const applications = rows.map((row) => ({
        id: row.id,
        companyId: row.companyId,
        companyName: row.companyName,
        positionTitle: row.positionTitle,
        positionCategory: row.positionCategory,
        applicant: decryptApplicant(row.encryptedApplicant, encryptionKey),
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
      sendJson(response, 200, { applications });
      return;
    }

    const documentRoute = url.pathname.match(/^\/api\/admin\/applications\/([0-9a-f-]{36})\/documents\/([0-9a-f-]{36})$/i);
    if (documentRoute && request.method === 'GET') {
      requireAdmin(request);
      const application = database.prepare(`
        SELECT encrypted_applicant AS encryptedApplicant FROM applications WHERE id = ?
      `).get(documentRoute[1]);
      if (!application) throw new HttpError(404, 'Application not found.');
      const applicant = decryptApplicant(application.encryptedApplicant, encryptionKey);
      const metadata = applicant.documents.find((document) => document.id === documentRoute[2]);
      const storedDocument = database.prepare(`
        SELECT encrypted_content AS encryptedContent FROM documents
        WHERE id = ? AND application_id = ?
      `).get(documentRoute[2], documentRoute[1]);
      if (!metadata || !storedDocument) throw new HttpError(404, 'Document not found.');
      const content = decryptBuffer(storedDocument.encryptedContent, encryptionKey);
      const safeName = metadata.name.replace(/[\r\n"]/g, '_');
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        'Content-Length': content.length,
        'Content-Type': 'application/pdf',
        'X-Content-Type-Options': 'nosniff'
      });
      response.end(content);
      return;
    }

    const applicationRoute = url.pathname.match(/^\/api\/admin\/applications\/([0-9a-f-]{36})$/i);
    if (applicationRoute && request.method === 'PATCH') {
      requireAdmin(request);
      getOrigin(request);
      const input = await readJson(request, MAX_SMALL_BODY_BYTES);
      if (!VALID_STATUSES.has(input.status)) throw new HttpError(400, 'Choose a valid application status.');
      const result = database.prepare(`
        UPDATE applications SET status = ?, updated_at = ? WHERE id = ?
      `).run(input.status, new Date().toISOString(), applicationRoute[1]);
      if (!result.changes) throw new HttpError(404, 'Application not found.');
      sendJson(response, 200, { updated: true });
      return;
    }

    if (applicationRoute && request.method === 'DELETE') {
      requireAdmin(request);
      getOrigin(request);
      const result = database.prepare('DELETE FROM applications WHERE id = ?').run(applicationRoute[1]);
      if (!result.changes) throw new HttpError(404, 'Application not found.');
      sendJson(response, 200, { deleted: true });
      return;
    }

    throw new HttpError(404, 'API endpoint not found.');
  };

  const server = http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");

    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)) {
      sendJson(response, 403, { error: 'This prototype only accepts local connections.' });
      return;
    }

    let url;
    try {
      url = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`);
      if (url.pathname.startsWith('/api/')) {
        await handleApi(request, response, url);
        return;
      }
      if (!['GET', 'HEAD'].includes(request.method)) {
        throw new HttpError(405, 'Method not allowed.', { Allow: 'GET, HEAD' });
      }
      let decodedRequestPath;
      try {
        decodedRequestPath = decodeURIComponent(url.pathname);
      } catch {
        throw new HttpError(400, 'Invalid URL path.');
      }
      const normalizedPath = decodedRequestPath.replace(/\\/g, '/').replace(/\/+$/, '') || '/';
      const normalizedAdminPath = normalizedPath.toLowerCase();
      const requestedFile = path.posix.basename(normalizedPath).toLowerCase();
      let staticPath = url.pathname;
      if (normalizedAdminPath === '/admin') {
        if (getSiteAdminSession(request)) {
          response.writeHead(303, {
            'Cache-Control': 'no-store',
            Location: '/admin/dashboard'
          });
          response.end();
          return;
        }
        staticPath = '/admin-login.html';
      } else if (normalizedAdminPath === '/admin/dashboard') {
        try {
          requireSiteAdmin(request);
        } catch (error) {
          if (!(error instanceof HttpError) || error.status !== 401) throw error;
          response.writeHead(303, {
            'Cache-Control': 'no-store',
            Location: '/admin'
          });
          response.end();
          return;
        }
        staticPath = '/admin.html';
      } else if (normalizedAdminPath === '/admin.html') {
        response.writeHead(303, {
          'Cache-Control': 'no-store',
          Location: getSiteAdminSession(request) ? '/admin/dashboard' : '/admin'
        });
        response.end();
        return;
      } else if (requestedFile === 'admin.html' || requestedFile.startsWith('admin.html:')) {
        response.writeHead(303, {
          'Cache-Control': 'no-store',
          Location: getSiteAdminSession(request) ? '/admin/dashboard' : '/admin'
        });
        response.end();
        return;
      } else if (normalizedAdminPath === '/admin-login.html') {
        response.writeHead(303, {
          'Cache-Control': 'no-store',
          Location: '/admin'
        });
        response.end();
        return;
      }
      await serveStatic(request, response, staticPath);
    } catch (error) {
      if (response.headersSent || response.destroyed) return;
      if (error instanceof HttpError) {
        sendJson(response, error.status, { error: error.message }, error.headers);
        return;
      }
      console.error(`Careers server error: ${error.message}`);
      sendJson(response, 500, { error: 'The local Careers service encountered an error.' });
    }
  });

  server.on('close', () => {
    clearInterval(retentionTimer);
    database.close();
  });
  return server;
}

async function serveStatic(request, response, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    throw new HttpError(400, 'Invalid URL path.');
  }
  const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^[/\\]+/, '');
  const filePath = path.resolve(ROOT, relativePath);
  if (
    filePath !== ROOT
    && !filePath.startsWith(`${ROOT}${path.sep}`)
  ) {
    throw new HttpError(404, 'File not found.');
  }
  if (relativePath.split(/[\\/]/).some((part) => part.startsWith('.'))) {
    throw new HttpError(404, 'File not found.');
  }

  let stats;
  try {
    stats = await fs.promises.stat(filePath);
  } catch {
    throw new HttpError(404, 'File not found.');
  }
  if (!stats.isFile()) throw new HttpError(404, 'File not found.');

  const contentTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.webp': 'image/webp'
  };
  response.writeHead(200, {
    'Cache-Control': ['admin.html', 'admin-login.html'].includes(path.basename(filePath))
      ? 'no-store'
      : 'no-cache',
    'Content-Length': stats.size,
    'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  const stream = fs.createReadStream(filePath);
  stream.on('error', (error) => {
    console.error(`Static file read error: ${error.message}`);
    if (!response.headersSent) sendJson(response, 500, { error: 'Could not read the requested file.' });
    else response.destroy(error);
  });
  stream.pipe(response);
}

function initializeAdmin() {
  const email = (process.env.CAREERS_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.CAREERS_ADMIN_PASSWORD || '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Set CAREERS_ADMIN_EMAIL to a valid local administrator email.');
  }
  if (password.length < 14 || password.length > 1024) {
    throw new Error('Set CAREERS_ADMIN_PASSWORD to a password between 14 and 1,024 characters.');
  }
  getEncryptionKey();
  const database = createDatabase();
  try {
    if (database.prepare('SELECT 1 FROM admins LIMIT 1').get()) {
      throw new Error('An administrator already exists. The local prototype supports one administrator account.');
    }
    const passwordRecord = hashPassword(password);
    database.prepare(`
      INSERT INTO admins (email, password_salt, password_hash, created_at)
      VALUES (?, ?, ?, ?)
    `).run(email, passwordRecord.salt, passwordRecord.hash, new Date().toISOString());
  } finally {
    database.close();
  }
  console.log(`Local Careers administrator initialized for ${email}.`);
}

function promptSecret(label) {
  const input = process.stdin;
  readline.emitKeypressEvents(input);
  return new Promise((resolve, reject) => {
    let value = '';
    let settled = false;
    const cleanup = () => {
      input.off('keypress', onKeypress);
      input.off('error', onError);
      input.off('close', onClose);
    };
    const finish = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        input.setRawMode(false);
      } catch (resetError) {
        if (!error) error = resetError;
      }
      input.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onKeypress = (character, key) => {
      if (key?.ctrl && key.name === 'c') {
        finish(new Error('Administrator setup cancelled.'));
      } else if (key?.name === 'return' || key?.name === 'enter') {
        finish();
      } else if (key?.name === 'backspace') {
        value = Array.from(value).slice(0, -1).join('');
        process.stdout.write('\b \b');
      } else if (typeof character === 'string' && character && !key?.ctrl && !key?.meta) {
        value += character;
        process.stdout.write('*');
      }
    };
    const onError = (error) => finish(new Error(`Terminal input failed: ${error.message}`));
    const onClose = () => finish(new Error('Terminal input closed during administrator setup.'));
    input.on('keypress', onKeypress);
    input.once('error', onError);
    input.once('close', onClose);
    try {
      input.setRawMode(true);
      input.resume();
      process.stdout.write(label);
    } catch (error) {
      finish(new Error(`Could not enable hidden password input: ${error.message}`));
    }
  });
}

function promptLine(terminal, label) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      terminal.off('SIGINT', onInterrupt);
      terminal.off('close', onClose);
      terminal.input.off('error', onError);
    };
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(value);
    };
    const onInterrupt = () => finish(new Error('Administrator setup cancelled.'));
    const onClose = () => finish(new Error('Terminal input closed during administrator setup.'));
    const onError = (error) => finish(new Error(`Terminal input failed: ${error.message}`));
    terminal.once('SIGINT', onInterrupt);
    terminal.once('close', onClose);
    terminal.input.once('error', onError);
    try {
      terminal.question(label, (answer) => finish(null, answer));
    } catch (error) {
      finish(new Error(`Could not read terminal input: ${error.message}`));
    }
  });
}

async function initializeSiteAdminFromTerminal() {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error('Run site-admin:create in an interactive PowerShell or terminal so the password can be entered without echo.');
  }
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  let usernameInput;
  try {
    usernameInput = await promptLine(terminal, 'CEO username: ');
  } finally {
    terminal.close();
  }
  if (typeof usernameInput !== 'string') throw new Error('A CEO username is required.');
  const username = usernameInput.trim();
  if (!username) throw new Error('A CEO username is required.');
  const password = await promptSecret('CEO password (hidden): ');
  if (typeof password !== 'string' || password.length === 0) throw new Error('A CEO password is required.');
  const confirmation = await promptSecret('Confirm password (hidden): ');
  if (typeof confirmation !== 'string' || confirmation.length === 0) {
    throw new Error('Password confirmation is required.');
  }
  if (password !== confirmation) throw new Error('The passwords do not match.');
  const createdUsername = await createSiteAdmin(username, password);
  console.log(`CEO administrator initialized for ${createdUsername}.`);
}

function printHelp() {
  console.log([
    'Local-only MI CORTEX service',
    '',
    'Commands:',
    '  node careers-server.js generate-key  Print a new 32-byte encryption key',
    '  node careers-server.js admin:create  Initialize the single local admin account',
    '  node careers-server.js site-admin:create  Set up the CEO dashboard account',
    '  node careers-server.js              Start the local server',
    '',
    'Before starting, set CAREERS_ENCRYPTION_KEY in the process environment.',
    'For admin:create, also set CAREERS_ADMIN_EMAIL and CAREERS_ADMIN_PASSWORD.',
    'Run site-admin:create once in an interactive terminal to create the CEO dashboard account.',
    'The server binds to 127.0.0.1 only; it is not suitable for public deployment.'
  ].join('\n'));
}

if (require.main === module) {
  const command = process.argv[2] || 'start';
  try {
    if (command === 'generate-key') {
      console.log(crypto.randomBytes(32).toString('base64'));
    } else if (command === 'admin:create') {
      initializeAdmin();
    } else if (command === 'site-admin:create') {
      initializeSiteAdminFromTerminal().catch((error) => {
        console.error(`CEO administrator setup failed: ${error.message}`);
        process.exitCode = 1;
      });
    } else if (command === '--help' || command === 'help') {
      printHelp();
    } else if (command === 'start') {
      const port = Number(process.env.PORT || DEFAULT_PORT);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
      const server = createAppServer();
      server.listen(port, '127.0.0.1', () => {
        console.log(`Local MI CORTEX service listening at http://127.0.0.1:${port}`);
        console.log(`Applications are ${process.env.CAREERS_RECRUITMENT_APPROVED === 'true' ? 'approval-gated' : 'disabled pending official approval'}.`);
      });
    } else {
      printHelp();
      process.exitCode = 2;
    }
  } catch (error) {
    console.error(`Careers server startup failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  CAREERS_CATALOGUE,
  DEFAULT_OPEN_AT,
  createSiteAdmin,
  createAppServer,
  decryptApplicant,
  decryptBuffer,
  encryptApplicant,
  encryptBuffer,
  hashPassword,
  validateApplication
};
