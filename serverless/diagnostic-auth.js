'use strict';

const crypto = require('node:crypto');
const { OAuth2Client } = require('google-auth-library');
const { Redis } = require('@upstash/redis');
const { diagnoseDatabaseReadOnlyQuery } = require('./database');

const DIAGNOSTIC_PATH = '/api/site-admin/database-diagnostic';
const CHALLENGE_PATH = `${DIAGNOSTIC_PATH}/challenge`;
const CHALLENGE_COOKIE = 'diagnostic_challenge';
const CHALLENGE_TTL_SECONDS = 300;
const RATE_WINDOW_SECONDS = 60;
const OPERATOR_RATE_WINDOW_SECONDS = 15 * 60;
const CHALLENGE_RATE_LIMIT = 12;
const VERIFICATION_RATE_LIMIT = 12;
const OPERATOR_RATE_LIMIT = 3;
const MAX_BODY_BYTES = 16 * 1024;
const PRODUCTION_ORIGIN = 'https://mi-cortex-x-inc.vercel.app';
const LOCAL_ORIGIN = 'http://localhost:4173';

const CONSUME_NONCE_SCRIPT = `
local value = redis.call('GET', KEYS[1])
if value and value == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

const INCREMENT_RATE_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end
return count
`;

class DiagnosticAuthError extends Error {
  constructor(status, category, details = {}) {
    super(category);
    this.status = status;
    this.category = category;
    this.authenticationSucceeded = Boolean(details.authenticationSucceeded);
    this.nonceConsumed = Boolean(details.nonceConsumed);
  }
}

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

function nonceCookie(value, maxAge) {
  return `${CHALLENGE_COOKIE}=${encodeURIComponent(value)}; Path=${DIAGNOSTIC_PATH}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

function parseCookie(request, name) {
  for (const part of (request.headers.get('cookie') || '').split(';')) {
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

function getPath(request) {
  let url;
  try {
    url = new URL(request.url);
    const route = url.searchParams.get('route');
    return route ? new URL(route, url.origin).pathname : url.pathname;
  } catch {
    return '';
  }
}

async function readJsonBody(request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES || !request.body) {
    throw new DiagnosticAuthError(413, 'authorization_failed');
  }

  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new DiagnosticAuthError(413, 'authorization_failed');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  try {
    return JSON.parse(Buffer.concat(chunks, length).toString('utf8'));
  } catch {
    throw new DiagnosticAuthError(400, 'authorization_failed');
  }
}

function makeDiagnosticPage(clientId, noncePath) {
  const cspNonce = crypto.randomBytes(18).toString('base64');
  const safeClientId = JSON.stringify(clientId).replace(/</g, '\\u003c');
  const safeNoncePath = JSON.stringify(noncePath).replace(/</g, '\\u003c');
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Database Connectivity Diagnostic</title>
    <script src="https://accounts.google.com/gsi/client" async defer></script>
  </head>
  <body>
    <main>
      <h1>Database Connectivity Diagnostic</h1>
      <p>Sign in with the authorized operator account to run the read-only check.</p>
      <div id="google-sign-in"></div>
      <pre id="diagnostic-result" aria-live="polite"></pre>
    </main>
    <script nonce="${cspNonce}">
      const clientId = ${safeClientId};
      const noncePath = ${safeNoncePath};
      const resultView = document.getElementById('diagnostic-result');
      const showResult = (value) => { resultView.textContent = JSON.stringify(value, null, 2); };

      async function startDiagnostic() {
        try {
          const challengeResponse = await fetch(noncePath, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
          });
          const challenge = await challengeResponse.json();
          if (!challengeResponse.ok || typeof challenge.nonce !== 'string') {
            showResult(challenge);
            return;
          }

          google.accounts.id.initialize({
            client_id: clientId,
            nonce: challenge.nonce,
            callback: async ({ credential }) => {
              try {
                const response = await fetch(${JSON.stringify(DIAGNOSTIC_PATH)}, {
                  method: 'POST',
                  credentials: 'same-origin',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ credential })
                });
                showResult(await response.json());
              } catch {
                showResult({ errorCategory: 'diagnostic_unavailable' });
              }
            }
          });
          google.accounts.id.renderButton(document.getElementById('google-sign-in'), {
            theme: 'outline',
            size: 'large'
          });
        } catch {
          showResult({ errorCategory: 'diagnostic_unavailable' });
        }
      }

      window.addEventListener('load', startDiagnostic, { once: true });
    </script>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${cspNonce}' https://accounts.google.com/gsi/client; frame-src https://accounts.google.com/gsi/; style-src 'unsafe-inline' https://accounts.google.com/gsi/style; connect-src 'self' https://accounts.google.com/gsi/; base-uri 'none'; frame-ancestors 'none'`,
      'Content-Type': 'text/html; charset=utf-8',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function createDiagnosticAuthHandler(options = {}) {
  const env = options.env || process.env;
  const expectedOrigin = options.expectedOrigin
    || (env.NODE_ENV === 'production' ? PRODUCTION_ORIGIN : LOCAL_ORIGIN);
  const googleClient = options.googleClient || new OAuth2Client();
  const redisFactory = options.redisFactory || ((url, token) => new Redis({ url, token }));
  const runDatabaseDiagnostic = options.runDatabaseDiagnostic || (() => diagnoseDatabaseReadOnlyQuery());
  let redisClient;

  function getRedis() {
    if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
      throw new DiagnosticAuthError(503, 'authorization_unavailable');
    }
    if (!redisClient) redisClient = redisFactory(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN);
    return redisClient;
  }

  function requireOrigin(request) {
    if (request.headers.get('origin') !== expectedOrigin) {
      throw new DiagnosticAuthError(403, 'authorization_failed');
    }
  }

  function getConfiguration() {
    const clientId = env.GOOGLE_CLIENT_ID;
    const operatorEmail = env.DIAGNOSTIC_OPERATOR_EMAIL;
    if (!clientId || !operatorEmail || !env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
      throw new DiagnosticAuthError(503, 'authorization_unavailable');
    }
    return { clientId, operatorEmail };
  }

  async function enforceRateLimit(redis, key, limit, windowSeconds = RATE_WINDOW_SECONDS) {
    const count = Number(await redis.eval(INCREMENT_RATE_SCRIPT, [key], [String(windowSeconds)]));
    if (!Number.isSafeInteger(count) || count > limit) {
      throw new DiagnosticAuthError(429, 'rate_limited');
    }
  }

  async function createChallenge(request) {
    try {
      requireOrigin(request);
      getConfiguration();
      const contentType = request.headers.get('content-type') || '';
      if (!contentType.toLowerCase().startsWith('application/json')) {
        throw new DiagnosticAuthError(400, 'authorization_failed');
      }
      const body = await readJsonBody(request);
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 0) {
        throw new DiagnosticAuthError(400, 'authorization_failed');
      }
      const redis = getRedis();
      const minute = Math.floor(Date.now() / (RATE_WINDOW_SECONDS * 1000));
      await enforceRateLimit(redis, `diagnostic:rate:challenge:${minute}`, CHALLENGE_RATE_LIMIT);

      const nonce = crypto.randomBytes(32).toString('base64url');
      const challengeId = crypto.randomBytes(32).toString('base64url');
      const nonceHash = crypto.createHash('sha256').update(nonce).digest('hex');
      const result = await redis.set(
        `diagnostic:nonce:${challengeId}`,
        nonceHash,
        { ex: CHALLENGE_TTL_SECONDS, nx: true }
      );
      if (result !== 'OK') throw new DiagnosticAuthError(503, 'authorization_unavailable');

      return jsonResponse(200, { nonce }, {
        'Set-Cookie': nonceCookie(challengeId, CHALLENGE_TTL_SECONDS)
      });
    } catch (error) {
      const authError = error instanceof DiagnosticAuthError
        ? error
        : new DiagnosticAuthError(503, 'authorization_unavailable');
      return jsonResponse(authError.status, { authenticationSucceeded: false, nonceConsumed: false, errorCategory: authError.category }, {
        'Set-Cookie': nonceCookie('', 0)
      });
    }
  }

  async function verifyCredential(credential, challengeId) {
    const { clientId, operatorEmail } = getConfiguration();
    const redis = getRedis();
    const minute = Math.floor(Date.now() / (RATE_WINDOW_SECONDS * 1000));
    await enforceRateLimit(redis, `diagnostic:rate:verify:${minute}`, VERIFICATION_RATE_LIMIT);

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId });
      payload = ticket && ticket.getPayload();
    } catch {
      throw new DiagnosticAuthError(401, 'authorization_failed');
    }

    if (
      !payload
      || !['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)
      || payload.aud !== clientId
      || typeof payload.exp !== 'number'
      || payload.exp * 1000 <= Date.now()
      || typeof payload.nonce !== 'string'
      || payload.email_verified !== true
      || payload.email !== operatorEmail
    ) {
      throw new DiagnosticAuthError(401, 'authorization_failed');
    }

    const nonceHash = crypto.createHash('sha256').update(payload.nonce).digest('hex');
    const consumed = Number(await redis.eval(
      CONSUME_NONCE_SCRIPT,
      [`diagnostic:nonce:${challengeId}`],
      [nonceHash]
    ));
    if (consumed !== 1) throw new DiagnosticAuthError(401, 'authorization_failed');

    const operatorKey = crypto.createHash('sha256').update(operatorEmail).digest('hex');
    const operatorWindow = Math.floor(Date.now() / (OPERATOR_RATE_WINDOW_SECONDS * 1000));
    try {
      await enforceRateLimit(
        redis,
        `diagnostic:rate:operator:${operatorKey}:${operatorWindow}`,
        OPERATOR_RATE_LIMIT,
        OPERATOR_RATE_WINDOW_SECONDS
      );
    } catch (error) {
      const authError = error instanceof DiagnosticAuthError
        ? error
        : new DiagnosticAuthError(503, 'authorization_unavailable');
      authError.authenticationSucceeded = true;
      authError.nonceConsumed = true;
      throw authError;
    }
    return { authenticationSucceeded: true, nonceConsumed: true };
  }

  async function runDiagnostic(request) {
    const clearCookie = nonceCookie('', 0);
    try {
      requireOrigin(request);
      const challengeId = parseCookie(request, CHALLENGE_COOKIE);
      if (!/^[A-Za-z0-9_-]{43}$/.test(challengeId)) {
        throw new DiagnosticAuthError(401, 'authorization_failed');
      }
      const contentType = request.headers.get('content-type') || '';
      if (!contentType.toLowerCase().startsWith('application/json')) {
        throw new DiagnosticAuthError(400, 'authorization_failed');
      }
      const body = await readJsonBody(request);
      if (
        !body
        || typeof body !== 'object'
        || Array.isArray(body)
        || Object.keys(body).length !== 1
        || Object.keys(body)[0] !== 'credential'
        || typeof body.credential !== 'string'
        || body.credential.length < 1
        || body.credential.length > 8192
      ) {
        throw new DiagnosticAuthError(401, 'authorization_failed');
      }

      const authorization = await verifyCredential(body.credential, challengeId);
      let database;
      try {
        database = await runDatabaseDiagnostic();
      } catch {
        database = {
          databaseUrlState: env.DATABASE_URL ? 'present' : 'undefined',
          poolInitializationSucceeded: false,
          connectionSucceeded: false,
          readOnlyQuerySucceeded: false,
          errorCategory: 'generic_error'
        };
      }
      const result = {
        ...authorization,
        databaseUrlState: database.databaseUrlState,
        poolInitializationSucceeded: database.poolInitializationSucceeded,
        connectionSucceeded: database.connectionSucceeded,
        readOnlyQuerySucceeded: database.readOnlyQuerySucceeded
      };
      if (database.errorCategory) result.sanitizedErrorCategory = database.errorCategory;
      return jsonResponse(200, result, { 'Set-Cookie': clearCookie });
    } catch (error) {
      const authError = error instanceof DiagnosticAuthError
        ? error
        : new DiagnosticAuthError(503, 'authorization_unavailable');
      return jsonResponse(authError.status, {
        authenticationSucceeded: authError.authenticationSucceeded,
        nonceConsumed: authError.nonceConsumed,
        errorCategory: authError.category
      }, { 'Set-Cookie': clearCookie });
    }
  }

  return async function handleDiagnosticRequest(request) {
    const path = getPath(request);
    if (path === DIAGNOSTIC_PATH && request.method === 'GET') {
      try {
        const { clientId } = getConfiguration();
        return makeDiagnosticPage(clientId, CHALLENGE_PATH);
      } catch (error) {
        const authError = error instanceof DiagnosticAuthError
          ? error
          : new DiagnosticAuthError(503, 'authorization_unavailable');
        return jsonResponse(authError.status, { authenticationSucceeded: false, errorCategory: authError.category });
      }
    }
    if (path === CHALLENGE_PATH) {
      if (request.method !== 'POST') return jsonResponse(405, { errorCategory: 'method_not_allowed' });
      return createChallenge(request);
    }
    if (path === DIAGNOSTIC_PATH) {
      if (request.method !== 'POST') return jsonResponse(405, { errorCategory: 'method_not_allowed' });
      return runDiagnostic(request);
    }
    if (path.startsWith(`${DIAGNOSTIC_PATH}/`)) {
      return jsonResponse(404, { errorCategory: 'not_found' });
    }
    return null;
  };
}

module.exports = {
  CHALLENGE_COOKIE,
  CHALLENGE_PATH,
  CHALLENGE_TTL_SECONDS,
  CONSUME_NONCE_SCRIPT,
  DIAGNOSTIC_PATH,
  INCREMENT_RATE_SCRIPT,
  createDiagnosticAuthHandler
};