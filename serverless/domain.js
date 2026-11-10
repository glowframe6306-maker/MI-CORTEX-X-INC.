'use strict';

const crypto = require('node:crypto');
const catalogue = require('../careers-catalogue');

const DEFAULT_OPEN_AT = '2029-01-01T00:00:00+05:30';
const DEFAULT_RETENTION_DAYS = 90;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENTS = 3;
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const SESSION_COOKIE = 'careers_admin';
const SITE_ADMIN_COOKIE = 'site_admin_session';
const VALID_STATUSES = new Set(['new', 'reviewing', 'shortlisted', 'rejected', 'withdrawn']);
const companies = new Map(catalogue.companies.map((company) => [company.id, company]));
const positions = new Map(catalogue.companies.map((company) => [
  company.id,
  new Map(company.positions.map((position) => [position.title, position.category]))
]));

class HttpError extends Error {
  constructor(status, message, headers = {}) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

function getConfig() {
  const encryptionKey = Buffer.from(process.env.CAREERS_ENCRYPTION_KEY || '', 'base64');
  if (encryptionKey.length !== 32) throw new Error('CAREERS_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  const sessionSecret = Buffer.from(process.env.SESSION_SECRET || '', 'base64');
  if (sessionSecret.length !== 32) throw new Error('SESSION_SECRET must be a base64-encoded 32-byte key.');
  const openAt = new Date(process.env.CAREERS_OPEN_AT || DEFAULT_OPEN_AT);
  if (Number.isNaN(openAt.getTime())) throw new Error('CAREERS_OPEN_AT must be a valid ISO-8601 date.');
  const retentionDays = Number(process.env.CAREERS_RETENTION_DAYS || DEFAULT_RETENTION_DAYS);
  if (!Number.isInteger(retentionDays) || retentionDays < 30 || retentionDays > 365) {
    throw new Error('CAREERS_RETENTION_DAYS must be a whole number between 30 and 365.');
  }
  return {
    encryptionKey,
    sessionSecret,
    openAt,
    retentionDays,
    recruitmentApproved: process.env.CAREERS_RECRUITMENT_APPROVED === 'true'
  };
}

function encrypt(value, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

function decrypt(value, key) {
  const encrypted = Buffer.from(value, 'base64');
  if (encrypted.length < 29) throw new Error('Encrypted record is malformed.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, encrypted.subarray(0, 12));
  decipher.setAuthTag(encrypted.subarray(12, 28));
  return JSON.parse(Buffer.concat([
    decipher.update(encrypted.subarray(28)),
    decipher.final()
  ]).toString('utf8'));
}

function parseCookie(request, name) {
  const cookie = request.headers.get('cookie') || '';
  for (const part of cookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return '';
    }
  }
  return '';
}

function sessionHash(token, secret) {
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
}

function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function verifySameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) throw new HttpError(403, 'A same-origin request is required.');
  let originUrl;
  let requestUrl;
  try {
    originUrl = new URL(origin);
    requestUrl = new URL(request.url);
  } catch {
    throw new HttpError(403, 'A same-origin request is required.');
  }
  if (originUrl.origin !== requestUrl.origin) throw new HttpError(403, 'A same-origin request is required.');
}

function parseCookiesAndInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpError(400, 'Request details are required.');
  }
  return input;
}

async function readJson(request, maxBytes = 16 * 1024) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > maxBytes) throw new HttpError(413, 'The request is too large.');
  let body;
  try {
    body = await request.text();
  } catch {
    throw new HttpError(400, 'The request body could not be read.');
  }
  if (Buffer.byteLength(body) > maxBytes) throw new HttpError(413, 'The request is too large.');
  try {
    return parseCookiesAndInput(JSON.parse(body));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'A valid JSON request body is required.');
  }
}

function validateApplication(input) {
  const requiredKeys = ['fullName', 'email', 'phone', 'companyId', 'positionTitle', 'statement', 'ageConfirmed', 'privacyConsent', 'documents'];
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
  const company = typeof input.companyId === 'string' ? companies.get(input.companyId) : null;
  if (!company) throw new HttpError(400, 'Choose a listed company.');
  const positionTitle = text(input.positionTitle);
  const category = positions.get(input.companyId).get(positionTitle);
  if (!category) throw new HttpError(400, 'Choose an eligible position from the selected company.');
  if (input.ageConfirmed !== true || input.privacyConsent !== true) {
    throw new HttpError(400, 'Confirm the age and privacy statements before submitting.');
  }
  if (!Array.isArray(input.documents) || input.documents.length > MAX_DOCUMENTS) {
    throw new HttpError(400, `Attach no more than ${MAX_DOCUMENTS} PDF documents.`);
  }
  const documentIds = input.documents.map((document) => {
    if (!document || typeof document !== 'object' || Array.isArray(document)
      || Object.keys(document).some((key) => key !== 'id')
      || typeof document.id !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(document.id)) {
      throw new HttpError(400, 'A supporting document reference is invalid.');
    }
    return document.id;
  });
  if (new Set(documentIds).size !== documentIds.length) throw new HttpError(400, 'A supporting document was attached more than once.');
  return {
    applicant,
    companyId: input.companyId,
    companyName: company.name,
    positionTitle,
    positionCategory: category,
    documentIds
  };
}

function serializeDate(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

module.exports = {
  DEFAULT_OPEN_AT,
  DEFAULT_RETENTION_DAYS,
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
};
