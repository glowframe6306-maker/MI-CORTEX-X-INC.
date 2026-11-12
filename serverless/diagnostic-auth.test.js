'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const {
  CHALLENGE_PATH,
  CHALLENGE_TTL_SECONDS,
  CONSUME_NONCE_SCRIPT,
  DIAGNOSTIC_PATH,
  INCREMENT_RATE_SCRIPT
} = require('./diagnostic-auth');
const { diagnoseDatabaseReadOnlyQuery } = require('./database');
const { createServerlessHandler } = require('./handler');

const origin = 'https://diagnostic-test.example';
const clientId = 'diagnostic-client.apps.googleusercontent.com';
const operatorEmail = 'ceo@example.test';
const testCredential = 'opaque-test-id-token';
const privateCredentialError = 'private id token and verifier failure detail';

class MemoryRedis {
  constructor() {
    this.values = new Map();
    this.fail = false;
    this.failKeyPrefix = '';
    this.rateTtlByKey = new Map();
  }

  async set(key, value, { ex, nx } = {}) {
    if (this.fail) throw new Error('private Redis credential failure');
    const current = this.values.get(key);
    if (nx && current && current.expiresAt > Date.now()) return null;
    this.values.set(key, { value, expiresAt: Date.now() + ex * 1000 });
    return 'OK';
  }

  async eval(script, keys, args) {
    const [key] = keys;
    if (this.fail || (this.failKeyPrefix && key.startsWith(this.failKeyPrefix))) {
      throw new Error('private Redis credential failure');
    }
    if (script === INCREMENT_RATE_SCRIPT) {
      this.rateTtlByKey.set(key, Number(args[0]));
      const current = this.values.get(key);
      const alive = current && current.expiresAt > Date.now();
      const count = alive ? Number(current.value) + 1 : 1;
      this.values.set(key, {
        value: String(count),
        expiresAt: alive ? current.expiresAt : Date.now() + Number(args[0]) * 1000
      });
      return count;
    }
    if (script === CONSUME_NONCE_SCRIPT) {
      const current = this.values.get(key);
      if (!current || current.expiresAt <= Date.now() || current.value !== args[0]) {
        if (current && current.expiresAt <= Date.now()) this.values.delete(key);
        return 0;
      }
      this.values.delete(key);
      return 1;
    }
    throw new Error('Unexpected Redis script.');
  }

  expireAll() {
    for (const entry of this.values.values()) entry.expiresAt = Date.now() - 1;
  }
}

function createFixture({
  redis = new MemoryRedis(),
  env = {},
  diagnosticResult = {
    databaseUrlState: 'present',
    poolInitializationSucceeded: true,
    connectionSucceeded: true,
    readOnlyQuerySucceeded: true,
    databaseName: 'must-not-leak',
    databaseUser: 'must-not-leak'
  },
  onDatabaseDiagnostic = null
} = {}) {
  let tokenPayload = {
    iss: 'https://accounts.google.com',
    aud: clientId,
    exp: Math.floor(Date.now() / 1000) + 300,
    nonce: undefined,
    email: operatorEmail,
    email_verified: true
  };
  let verificationError = null;
  let verificationCount = 0;
  let databaseCalls = 0;
  let probeCalls = 0;
  const logs = [];

  const googleClient = {
    async verifyIdToken({ idToken, audience }) {
      verificationCount += 1;
      assert.equal(audience, clientId);
      if (idToken !== testCredential) throw new Error(privateCredentialError);
      if (verificationError) throw verificationError;
      return { getPayload: () => ({ ...tokenPayload }) };
    }
  };
  const configuration = {
    GOOGLE_CLIENT_ID: clientId,
    DIAGNOSTIC_OPERATOR_EMAIL: operatorEmail,
    UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
    UPSTASH_REDIS_REST_TOKEN: 'mock-configured',
    ...env
  };
  const handler = createServerlessHandler({
    database: () => {
      databaseCalls += 1;
      throw new Error('Neon must not be used by diagnostic authorization.');
    },
    blobs: { handleUpload() { throw new Error('Unused test Blob handler.'); } },
    dummyPasswordHash: 'unused-test-hash',
    diagnosticEnv: configuration,
    diagnosticExpectedOrigin: origin,
    googleClient,
    diagnosticAuthFailureLogger: (reasonCode) => logs.push(reasonCode),
    redisFactory: () => redis,
    runDatabaseDiagnostic: async () => {
      probeCalls += 1;
      if (onDatabaseDiagnostic) return onDatabaseDiagnostic();
      return { ...diagnosticResult };
    }
  });

  return {
    handler,
    redis,
    logs,
    get databaseCalls() { return databaseCalls; },
    get probeCalls() { return probeCalls; },
    get verificationCount() { return verificationCount; },
    restore() { logs.length = 0; },
    setPayload(value) { tokenPayload = { ...tokenPayload, ...value }; },
    setVerificationError(error) { verificationError = error; }
  };
}

async function postJson(fixture, pathname, value, { cookie = '', requestOrigin = origin } = {}) {
  return fixture.handler(new Request(`${origin}${pathname}`, {
    method: 'POST',
    headers: {
      ...(requestOrigin === null ? {} : { origin: requestOrigin }),
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {})
    },
    body: JSON.stringify(value)
  }));
}

async function issueChallenge(fixture) {
  const response = await postJson(fixture, CHALLENGE_PATH, {});
  const body = await response.json();
  const setCookie = response.headers.get('set-cookie') || '';
  return {
    response,
    body,
    cookie: setCookie.split(';', 1)[0]
  };
}

async function submitCredential(fixture, cookie, credentialValue = testCredential) {
  return postJson(fixture, DIAGNOSTIC_PATH, { credential: credentialValue }, { cookie });
}

test('diagnostic page initializes GIS with the public client ID; challenge returns only a nonce', async () => {
  const fixture = createFixture();
  try {
    const page = await fixture.handler(new Request(`${origin}${DIAGNOSTIC_PATH}`));
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.match(html, /client_id/);
    assert.match(html, new RegExp(clientId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(html, /mock-configured|SESSION_SECRET|opaque-test-id-token/i);

    const challenge = await issueChallenge(fixture);
    assert.equal(challenge.response.status, 200);
    assert.deepEqual(Object.keys(challenge.body), ['nonce']);
    assert.equal(typeof challenge.body.nonce, 'string');
    assert.equal(challenge.body.nonce.length, 43);
    assert.match(challenge.response.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Strict/);
    assert.match(challenge.response.headers.get('set-cookie'), new RegExp(`Max-Age=${CHALLENGE_TTL_SECONDS}`));
    assert.match(challenge.response.headers.get('set-cookie'), new RegExp(`Path=${DIAGNOSTIC_PATH}`));
    assert.equal(fixture.databaseCalls, 0);
  } finally {
    fixture.restore();
  }
});

test('missing Google and Upstash configuration fails closed before Neon', async () => {
  const noGoogle = createFixture({ env: { GOOGLE_CLIENT_ID: '' } });
  const noRedis = createFixture({ env: { UPSTASH_REDIS_REST_TOKEN: '' } });
  try {
    const googleResponse = await noGoogle.handler(new Request(`${origin}${DIAGNOSTIC_PATH}`));
    assert.equal(googleResponse.status, 503);
    assert.equal(noGoogle.databaseCalls, 0);
    const redisResponse = await postJson(noRedis, CHALLENGE_PATH, {});
    assert.equal(redisResponse.status, 503);
    assert.equal(noRedis.databaseCalls, 0);
  } finally {
    noGoogle.restore();
    noRedis.restore();
  }
});

test('wrong Origin, wrong method, missing credential, and malformed credential are rejected before the probe', async () => {
  const fixture = createFixture();
  try {
    const wrongOrigin = await postJson(fixture, CHALLENGE_PATH, {}, { requestOrigin: 'https://attacker.example' });
    assert.equal(wrongOrigin.status, 403);
    assert.equal(fixture.redis.values.size, 0);
    const challengeWithInput = await postJson(fixture, CHALLENGE_PATH, { role: 'CEO' });
    assert.equal(challengeWithInput.status, 400);
    assert.equal(fixture.redis.values.size, 0);
    const wrongMethod = await fixture.handler(new Request(`${origin}${DIAGNOSTIC_PATH}`, { method: 'PUT' }));
    assert.equal(wrongMethod.status, 405);
    const missingOrigin = await postJson(fixture, DIAGNOSTIC_PATH, { credential: testCredential }, { requestOrigin: null });
    assert.equal(missingOrigin.status, 403);
    const missingCookie = await postJson(fixture, DIAGNOSTIC_PATH, { credential: testCredential });
    assert.equal(missingCookie.status, 401);

    const challenge = await issueChallenge(fixture);
    const storedNonce = [...fixture.redis.values.entries()]
      .find(([key]) => key.startsWith('diagnostic:nonce:'))?.[1].value;
    assert.equal(storedNonce, crypto.createHash('sha256').update(challenge.body.nonce).digest('hex'));
    assert.notEqual(storedNonce, challenge.body.nonce);
    const missing = await postJson(fixture, DIAGNOSTIC_PATH, {}, { cookie: challenge.cookie });
    assert.equal(missing.status, 401);
    assert.equal(fixture.verificationCount, 0);
    assert.equal(fixture.probeCalls, 0);
    assert.equal(fixture.databaseCalls, 0);

    const malformed = await postJson(fixture, DIAGNOSTIC_PATH, {
      credential: testCredential,
      role: 'CEO'
    }, { cookie: challenge.cookie });
    assert.equal(malformed.status, 401);
    assert.equal(fixture.verificationCount, 0);
    assert.equal(fixture.probeCalls, 0);
  } finally {
    fixture.restore();
  }
});

test('authorization failures log fixed internal codes without exposing them publicly', async () => {
  const cases = [
    {
      reason: 'ORIGIN_REJECTED',
      status: 403,
      request: (fixture) => postJson(fixture, DIAGNOSTIC_PATH, { credential: testCredential }, {
        requestOrigin: 'https://attacker.example'
      })
    },
    {
      reason: 'CHALLENGE_COOKIE_MISSING',
      status: 401,
      request: (fixture) => submitCredential(fixture, '')
    },
    {
      reason: 'CHALLENGE_INVALID',
      status: 401,
      request: (fixture) => submitCredential(fixture, 'diagnostic_challenge=invalid')
    },
    {
      reason: 'CHALLENGE_INVALID',
      status: 401,
      request: (fixture) => submitCredential(fixture, 'diagnostic_challenge=%E0%A4%A')
    },
    {
      reason: 'UNCLASSIFIED_AUTH_FAILURE',
      status: 400,
      challenge: true,
      request: (fixture, challenge) => fixture.handler(new Request(`${origin}${DIAGNOSTIC_PATH}`, {
        method: 'POST',
        headers: {
          origin,
          'content-type': 'application/json',
          cookie: challenge.cookie
        },
        body: '{'
      }))
    },
    {
      reason: 'REDIS_VALIDATION_FAILED',
      status: 503,
      publicCategory: 'authorization_unavailable',
      request: (fixture) => {
        fixture.redis.fail = true;
        return postJson(fixture, CHALLENGE_PATH, {});
      }
    },
    {
      reason: 'REDIS_VALIDATION_FAILED',
      status: 503,
      publicCategory: 'authorization_unavailable',
      challenge: true,
      prepare: (fixture, challenge) => {
        fixture.setPayload({ nonce: challenge.body.nonce });
        fixture.redis.failKeyPrefix = 'diagnostic:nonce:';
      },
      request: (fixture, challenge) => submitCredential(fixture, challenge.cookie)
    }
  ];

  for (const item of cases) {
    const fixture = createFixture();
    try {
      const challenge = item.challenge ? await issueChallenge(fixture) : null;
      if (item.prepare) item.prepare(fixture, challenge);
      const response = await item.request(fixture, challenge);
      const body = await response.json();
      const publicBody = JSON.stringify(body);

      assert.equal(response.status, item.status, item.reason);
      assert.equal(body.errorCategory, item.publicCategory || 'authorization_failed', item.reason);
      assert.equal(body.authenticationSucceeded, false, item.reason);
      assert.equal(body.nonceConsumed, false, item.reason);
      assert.equal('internalReasonCode' in body, false, item.reason);
      assert.equal(publicBody.includes(item.reason), false, item.reason);
      assert.deepEqual(fixture.logs, [item.reason], item.reason);

      const log = fixture.logs.join(' ');
      for (const sensitive of [
        testCredential,
        privateCredentialError,
        operatorEmail,
        'mock-configured',
        ...(challenge ? [challenge.body.nonce, challenge.cookie] : [])
      ]) {
        assert.equal(log.includes(sensitive), false, item.reason);
      }
    } finally {
      fixture.restore();
    }
  }
});

test('Google signature, issuer, audience, expiry, nonce, email verification, and operator allowlist are enforced', async () => {
  const cases = [
    { name: 'invalid signature', internalReasonCode: 'TOKEN_VERIFICATION_FAILED', verifierError: new Error(privateCredentialError) },
    { name: 'wrong issuer', internalReasonCode: 'TOKEN_VERIFICATION_FAILED', payload: { iss: 'https://attacker.example' } },
    { name: 'wrong audience', internalReasonCode: 'TOKEN_AUDIENCE_REJECTED', payload: { aud: 'another-client.apps.googleusercontent.com' } },
    { name: 'expired token', internalReasonCode: 'TOKEN_EXPIRED', payload: { exp: Math.floor(Date.now() / 1000) - 1 } },
    { name: 'missing nonce', internalReasonCode: 'NONCE_REJECTED', payload: { nonce: undefined } },
    { name: 'wrong nonce', internalReasonCode: 'NONCE_REJECTED', payload: { nonce: 'another-challenge-nonce' } },
    { name: 'unverified email', internalReasonCode: 'EMAIL_NOT_VERIFIED', payload: { email_verified: false } },
    { name: 'wrong operator email', internalReasonCode: 'OPERATOR_NOT_AUTHORIZED', payload: { email: 'other@example.test' } }
  ];

  for (const item of cases) {
    const fixture = createFixture();
    try {
      const challenge = await issueChallenge(fixture);
      fixture.setPayload({ nonce: challenge.body.nonce, ...(item.payload || {}) });
      if (item.verifierError) fixture.setVerificationError(item.verifierError);
      const response = await submitCredential(fixture, challenge.cookie);
      const body = await response.json();
      assert.equal(response.status, 401, item.name);
      assert.equal(body.authenticationSucceeded, false, item.name);
      assert.equal(fixture.probeCalls, 0, item.name);
      assert.equal(fixture.databaseCalls, 0, item.name);
      assert.equal(JSON.stringify(body).includes(privateCredentialError), false, item.name);
      assert.equal(JSON.stringify(body).includes(testCredential), false, item.name);
      assert.deepEqual(fixture.logs, [item.internalReasonCode], item.name);
      assert.equal(JSON.stringify(body).includes(item.internalReasonCode), false, item.name);
    } finally {
      fixture.restore();
    }
  }
});

test('wrong nonce leaves the challenge available for the correct nonce', async () => {
  const fixture = createFixture();
  try {
    const challenge = await issueChallenge(fixture);
    fixture.setPayload({ nonce: 'incorrect-nonce' });
    const denied = await submitCredential(fixture, challenge.cookie);
    assert.equal(denied.status, 401);
    assert.equal(fixture.probeCalls, 0);

    fixture.setPayload({ nonce: challenge.body.nonce });
    const accepted = await submitCredential(fixture, challenge.cookie);
    assert.equal(accepted.status, 200);
    assert.equal(fixture.probeCalls, 1);
  } finally {
    fixture.restore();
  }
});

test('expired, consumed, and replayed challenges fail; concurrent consume succeeds once', async () => {
  const expiredFixture = createFixture();
  try {
    const challenge = await issueChallenge(expiredFixture);
    expiredFixture.setPayload({ nonce: challenge.body.nonce });
    expiredFixture.redis.expireAll();
    const response = await submitCredential(expiredFixture, challenge.cookie);
    assert.equal(response.status, 401);
    assert.equal(expiredFixture.probeCalls, 0);
  } finally {
    expiredFixture.restore();
  }

  const replayFixture = createFixture();
  try {
    const challenge = await issueChallenge(replayFixture);
    replayFixture.setPayload({ nonce: challenge.body.nonce });
    const first = await submitCredential(replayFixture, challenge.cookie);
    assert.equal(first.status, 200);
    const replay = await submitCredential(replayFixture, challenge.cookie);
    assert.equal(replay.status, 401);
    const replayBody = await replay.json();
    assert.equal(replayBody.authenticationSucceeded, false);
    assert.equal(JSON.stringify(replayBody).includes(testCredential), false);
    assert.equal(replayFixture.probeCalls, 1);
  } finally {
    replayFixture.restore();
  }

  const concurrentFixture = createFixture();
  try {
    const challenge = await issueChallenge(concurrentFixture);
    concurrentFixture.setPayload({ nonce: challenge.body.nonce });
    const responses = await Promise.all([
      submitCredential(concurrentFixture, challenge.cookie),
      submitCredential(concurrentFixture, challenge.cookie)
    ]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 401]);
    assert.equal(concurrentFixture.probeCalls, 1);
  } finally {
    concurrentFixture.restore();
  }
});

test('Redis unavailable or timed out fails closed without Neon access', async () => {
  const fixture = createFixture();
  try {
    fixture.redis.fail = true;
    const response = await postJson(fixture, CHALLENGE_PATH, {});
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.errorCategory, 'authorization_unavailable');
    assert.equal(JSON.stringify(body).includes('private-test-redis-token'), false);
    assert.equal(JSON.stringify(body).includes('private Redis credential failure'), false);
    assert.equal(fixture.databaseCalls, 0);
    assert.equal(fixture.probeCalls, 0);
    assert.deepEqual(fixture.logs, ['REDIS_VALIDATION_FAILED']);
  } finally {
    fixture.restore();
  }

  const verificationFixture = createFixture();
  try {
    const challenge = await issueChallenge(verificationFixture);
    verificationFixture.setPayload({ nonce: challenge.body.nonce });
    verificationFixture.redis.fail = true;
    const response = await submitCredential(verificationFixture, challenge.cookie);
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.authenticationSucceeded, false);
    assert.equal(body.nonceConsumed, false);
    assert.equal(body.errorCategory, 'authorization_unavailable');
    assert.equal(verificationFixture.probeCalls, 0);
    assert.equal(verificationFixture.databaseCalls, 0);
    assert.deepEqual(verificationFixture.logs, ['REDIS_VALIDATION_FAILED']);
  } finally {
    verificationFixture.restore();
  }

  const postConsumeFixture = createFixture();
  try {
    const challenge = await issueChallenge(postConsumeFixture);
    postConsumeFixture.setPayload({ nonce: challenge.body.nonce });
    postConsumeFixture.redis.failKeyPrefix = 'diagnostic:rate:operator:';
    const response = await submitCredential(postConsumeFixture, challenge.cookie);
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.authenticationSucceeded, true);
    assert.equal(body.nonceConsumed, true);
    assert.equal(body.errorCategory, 'authorization_unavailable');
    assert.equal(postConsumeFixture.probeCalls, 0);
    assert.equal(postConsumeFixture.databaseCalls, 0);
  } finally {
    postConsumeFixture.restore();
  }
});

test('authorized OIDC request reaches only the read-only probe before Neon handler initialization', async () => {
  let query;
  let clientReleased = false;
  let poolClosed = false;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const fixture = createFixture({
    onDatabaseDiagnostic: () => diagnoseDatabaseReadOnlyQuery({
      poolFactory: () => ({
        async connect() {
          return {
            async query(statement) {
              query = statement;
              return { rows: [{ current_database: 'private-db', current_user: 'private-user' }] };
            },
            release() { clientReleased = true; }
          };
        },
        async end() { poolClosed = true; }
      })
    })
  });

  try {
    process.env.DATABASE_URL = 'postgresql://test-user:test-password@db.invalid/testdb';
    const challenge = await issueChallenge(fixture);
    fixture.setPayload({ nonce: challenge.body.nonce });
    const response = await submitCredential(fixture, challenge.cookie);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.authenticationSucceeded, true);
    assert.equal(body.nonceConsumed, true);
    assert.equal(body.readOnlyQuerySucceeded, true);
    assert.equal(query, 'SELECT current_database(), current_user');
    assert.equal(clientReleased, true);
    assert.equal(poolClosed, true);
    assert.equal(fixture.databaseCalls, 0);
    assert.doesNotMatch(JSON.stringify(body), /private-db|private-user|test-password|db\.invalid|test-user/i);
  } finally {
    fixture.restore();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

test('authorized identity remains authenticated when the database probe reports Neon unavailable', async () => {
  const fixture = createFixture({
    diagnosticResult: {
      databaseUrlState: 'present',
      poolInitializationSucceeded: true,
      connectionSucceeded: false,
      readOnlyQuerySucceeded: false,
      errorCategory: 'timeout_error',
      databaseName: 'must-not-leak',
      databaseUser: 'must-not-leak'
    }
  });
  try {
    const challenge = await issueChallenge(fixture);
    fixture.setPayload({ nonce: challenge.body.nonce });
    const response = await submitCredential(fixture, challenge.cookie);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.authenticationSucceeded, true);
    assert.equal(body.nonceConsumed, true);
    assert.equal(body.connectionSucceeded, false);
    assert.equal(body.readOnlyQuerySucceeded, false);
    assert.equal(body.sanitizedErrorCategory, 'timeout_error');
    assert.equal('databaseName' in body, false);
    assert.equal('databaseUser' in body, false);
    assert.equal(fixture.databaseCalls, 0);
  } finally {
    fixture.restore();
  }
});

test('unexpected probe failure preserves authenticated and consumed status without leaking the error', async () => {
  const fixture = createFixture({
    onDatabaseDiagnostic: async () => { throw new Error(privateCredentialError); }
  });
  try {
    const challenge = await issueChallenge(fixture);
    fixture.setPayload({ nonce: challenge.body.nonce });
    const response = await submitCredential(fixture, challenge.cookie);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.authenticationSucceeded, true);
    assert.equal(body.nonceConsumed, true);
    assert.equal(body.poolInitializationSucceeded, false);
    assert.equal(body.connectionSucceeded, false);
    assert.equal(body.readOnlyQuerySucceeded, false);
    assert.equal(body.sanitizedErrorCategory, 'generic_error');
    assert.equal(JSON.stringify(body).includes(privateCredentialError), false);
    assert.equal(JSON.stringify(body).includes(testCredential), false);
    assert.equal(fixture.logs.length, 0);
  } finally {
    fixture.restore();
  }
});

test('shared Redis limits challenge issuance, verification, and successful operator probes', async () => {
  const challengeFixture = createFixture();
  try {
    const responses = [];
    for (let attempt = 0; attempt < 13; attempt += 1) {
      responses.push(await postJson(challengeFixture, CHALLENGE_PATH, {}));
    }
    assert.equal(responses.at(-1).status, 429);
    assert.equal(challengeFixture.databaseCalls, 0);
  } finally {
    challengeFixture.restore();
  }

  const operatorFixture = createFixture();
  try {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const challenge = await issueChallenge(operatorFixture);
      operatorFixture.setPayload({ nonce: challenge.body.nonce });
      const response = await submitCredential(operatorFixture, challenge.cookie);
      assert.equal(response.status, attempt < 3 ? 200 : 429);
    }
    assert.equal(operatorFixture.probeCalls, 3);
    assert.equal(operatorFixture.databaseCalls, 0);
    const operatorRateEntry = [...operatorFixture.redis.rateTtlByKey.entries()]
      .find(([key]) => key.startsWith('diagnostic:rate:operator:'));
    assert.equal(operatorRateEntry?.[1], 15 * 60);
  } finally {
    operatorFixture.restore();
  }
});

test('atomic Lua compare-and-delete is exact-match-only and increments are atomic', () => {
  assert.match(CONSUME_NONCE_SCRIPT, /GET/);
  assert.match(CONSUME_NONCE_SCRIPT, /value == ARGV\[1\]/);
  assert.match(CONSUME_NONCE_SCRIPT, /DEL/);
  assert.ok(CONSUME_NONCE_SCRIPT.indexOf('value == ARGV[1]') < CONSUME_NONCE_SCRIPT.indexOf('redis.call(\'DEL\''));
  assert.match(INCREMENT_RATE_SCRIPT, /INCR/);
  assert.match(INCREMENT_RATE_SCRIPT, /EXPIRE/);
});