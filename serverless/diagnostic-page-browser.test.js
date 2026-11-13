'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const { CookieJar, JSDOM, VirtualConsole, requestInterceptor } = require('jsdom');
const { DIAGNOSTIC_PATH, CHALLENGE_PATH } = require('./diagnostic-auth');
const { createServerlessHandler } = require('./handler');

const TEST_ORIGIN = 'https://diagnostic.test';
const TEST_PAGE_URL = `${TEST_ORIGIN}${DIAGNOSTIC_PATH}`;
const GOOGLE_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const PRODUCTION_ORIGIN = 'https://mi-cortex-x-inc.vercel.app';
const TEST_CLIENT_ID = 'offline-browser-test.apps.googleusercontent.com';
const TEST_NONCE = 'synthetic-offline-browser-nonce-00000000000';
const TEST_CHALLENGE_ID = 'synthetic-offline-challenge-id-000000000000';
const TEST_CREDENTIAL = 'synthetic-offline-credential';
const TEST_CHALLENGE_COOKIE = `diagnostic_challenge=${TEST_CHALLENGE_ID}; Path=${DIAGNOSTIC_PATH}; Max-Age=300; HttpOnly; Secure; SameSite=Strict`;
const TEST_CLIENT_ID_FINGERPRINT = crypto.createHash('sha256')
  .update(TEST_CLIENT_ID)
  .digest('hex');

function makeResponse({ ok = true, status = 200, body = {}, malformed = false, onJson } = {}) {
  return {
    ok,
    status,
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type' ? 'application/json; charset=utf-8' : null;
      }
    },
    async json() {
      if (malformed) throw new SyntaxError('Synthetic malformed response.');
      if (onJson) onJson();
      return body;
    }
  };
}

function makeGisScript() {
  return `
    (() => {
      const telemetry = window.__diagnosticTestTelemetry;
      telemetry.scriptExecuted = true;
      telemetry.events.push('gis-script');
      if (!telemetry.apiAvailable) return;

      window.google = {
        accounts: {
          id: {
            initialize(options) {
              telemetry.initializeCalls += 1;
              telemetry.options = options;
              telemetry.callback = async (...args) => {
                telemetry.callbackCalls += 1;
                return options.callback(...args);
              };
              telemetry.events.push('initialize');
              if (telemetry.initializeThrows) throw new Error('Synthetic initialize failure.');
            },
            renderButton(container, options) {
              telemetry.renderButtonCalls += 1;
              telemetry.clickListener = options.click_listener;
              telemetry.events.push('renderButton');
              if (telemetry.renderButtonThrows) throw new Error('Synthetic render failure.');
              const button = document.createElement('button');
              button.type = 'button';
              button.dataset.testid = 'mock-google-sign-in';
              button.textContent = 'Mock Google sign in';
              button.addEventListener('click', () => telemetry.clickListener?.());
              container.appendChild(button);
            },
            prompt() {
              telemetry.promptCalls += 1;
              telemetry.events.push('prompt');
            }
          }
        }
      };
    })();
  `;
}

function createHandler(state) {
  const env = {
    GOOGLE_CLIENT_ID: TEST_CLIENT_ID,
    DIAGNOSTIC_OPERATOR_EMAIL: 'operator@offline.test',
    UPSTASH_REDIS_REST_URL: 'https://redis.invalid',
    UPSTASH_REDIS_REST_TOKEN: 'synthetic-redis-token',
    NODE_ENV: 'test'
  };

  return createServerlessHandler({
    database() {
      state.databaseCalls += 1;
      throw new Error('Database access is blocked in this test.');
    },
    blobs: { handleUpload() { throw new Error('Unused test Blob handler.'); } },
    dummyPasswordHash: 'unused-offline-test-hash',
    diagnosticEnv: env,
    diagnosticExpectedOrigin: TEST_ORIGIN,
    googleClient: {
      async verifyIdToken() {
        state.tokenVerificationCalls += 1;
        throw new Error('Token verification is blocked in this test.');
      }
    },
    redisFactory() {
      state.redisFactoryCalls += 1;
      throw new Error('Redis access is blocked in this test.');
    },
    runDatabaseDiagnostic() {
      state.databaseProbeCalls += 1;
      throw new Error('The database probe is blocked in this test.');
    }
  });
}

function createFetchMock(window, state, options, cookieJar) {
  return async (input, init = {}) => {
    let target;
    try {
      target = new URL(typeof input === 'string' ? input : input.url, window.location.href);
    } catch {
      state.unexpectedFetchRequests += 1;
      throw new Error('Blocked malformed test fetch URL.');
    }

    const method = String(init.method || 'GET').toUpperCase();
    if (target.origin !== TEST_ORIGIN) {
      state.fetchRequests.push({ origin: target.origin, pathname: target.pathname, method });
      state.unexpectedFetchRequests += 1;
      throw new Error('Blocked external test fetch.');
    }

    let routePath = target.pathname;
    const route = target.searchParams.get('route');
    if (route) {
      try {
        routePath = new URL(route, target.origin).pathname;
      } catch {
        state.unexpectedFetchRequests += 1;
        throw new Error('Blocked malformed diagnostic route.');
      }
    }
    state.fetchRequests.push({ origin: target.origin, pathname: target.pathname, routePath, method });

    if (routePath === CHALLENGE_PATH) {
      state.challengeRequests += 1;
      state.events.push('challenge-request');
      if (method !== 'POST') {
        state.unexpectedFetchRequests += 1;
        throw new Error('Blocked challenge request with an unexpected method.');
      }
      const contentType = Object.entries(init.headers || {})
        .find(([name]) => name.toLowerCase() === 'content-type')?.[1];
      state.challengeRequestShapeValid = init.credentials === 'same-origin'
        && contentType === 'application/json'
        && init.body === '{}';
      if (options.challengeMode === 'http-failure') {
        return makeResponse({
          ok: false,
          status: 503,
          body: { authenticationSucceeded: false, errorCategory: 'authorization_unavailable' }
        });
      }
      if (options.challengeMode === 'malformed') {
        return makeResponse({ malformed: true });
      }
      if (options.challengeMode === 'missing-nonce') {
        return makeResponse({ body: {} });
      }
      // Model browser processing of the HttpOnly cookie without exposing Set-Cookie to page script.
      cookieJar.setCookieSync(TEST_CHALLENGE_COOKIE, TEST_PAGE_URL);
      state.syntheticChallengeCookieSet = cookieJar.getCookieStringSync(TEST_PAGE_URL, { http: true })
        .includes(TEST_CHALLENGE_ID)
        && TEST_CHALLENGE_ID.length === 43;
      state.challengeCookieHiddenFromScript = !cookieJar.getCookieStringSync(TEST_PAGE_URL, { http: false })
        .includes(TEST_CHALLENGE_ID);
      return makeResponse({
        body: { nonce: TEST_NONCE },
        onJson: () => state.events.push('challenge-response')
      });
    }

    if (routePath === DIAGNOSTIC_PATH && method === 'POST') {
      state.diagnosticPosts += 1;
      let payload;
      try {
        payload = JSON.parse(init.body);
      } catch {
        payload = null;
      }
      state.syntheticCredentialPosted = Boolean(payload && payload.credential === TEST_CREDENTIAL);
      const contentType = Object.entries(init.headers || {})
        .find(([name]) => name.toLowerCase() === 'content-type')?.[1];
      state.diagnosticRequestShapeValid = init.credentials === 'same-origin'
        && contentType === 'application/json'
        && cookieJar.getCookieStringSync(target.href, { http: true }).includes(TEST_CHALLENGE_ID);
      if (!options.allowDiagnosticPost) {
        state.blockedDiagnosticPosts += 1;
        throw new Error('Blocked diagnostic POST outside the explicit local callback test.');
      }
      return makeResponse({
        body: options.diagnosticResponse || { authenticationSucceeded: false, errorCategory: 'authorization_failed' }
      });
    }

    state.unexpectedFetchRequests += 1;
    throw new Error('Blocked unexpected local test fetch.');
  };
}

async function createDiagnosticPage(options = {}) {
  const pageOptions = {
    challengeMode: 'success',
    gisScriptFails: false,
    gisApiAvailable: true,
    initializeThrows: false,
    renderButtonThrows: false,
    allowDiagnosticPost: false,
    ...options
  };
  const state = {
    databaseCalls: 0,
    databaseProbeCalls: 0,
    tokenVerificationCalls: 0,
    redisFactoryCalls: 0,
    challengeRequests: 0,
    challengeRequestShapeValid: false,
    diagnosticPosts: 0,
    blockedDiagnosticPosts: 0,
    unexpectedFetchRequests: 0,
    unexpectedResourceRequests: 0,
    gisScriptRequests: 0,
    gisScriptServedFromMock: false,
    syntheticChallengeCookieSet: false,
    challengeCookieHiddenFromScript: false,
    diagnosticRequestShapeValid: false,
    syntheticCredentialPosted: false,
    fetchRequests: [],
    events: [],
    telemetry: {
      apiAvailable: pageOptions.gisApiAvailable,
      initializeThrows: pageOptions.initializeThrows,
      renderButtonThrows: pageOptions.renderButtonThrows,
      scriptExecuted: false,
      initializeCalls: 0,
      renderButtonCalls: 0,
      promptCalls: 0,
      callbackCalls: 0,
      options: null,
      callback: null,
      clickListener: null,
      events: []
    }
  };
  state.telemetry.events = state.events;

  const handler = createHandler(state);
  const pageResponse = await handler(new Request(TEST_PAGE_URL));
  assert.equal(pageResponse.status, 200, 'The in-memory diagnostic handler should return the real page.');
  const html = await pageResponse.text();
  const resourceInterceptor = requestInterceptor((request) => {
    let target;
    try {
      target = new URL(request.url);
    } catch {
      state.unexpectedResourceRequests += 1;
      return new Response('', { status: 403 });
    }

    if (target.href === GOOGLE_SCRIPT_URL) {
      state.gisScriptRequests += 1;
      if (pageOptions.gisScriptFails) return new Response('', { status: 503 });
      state.gisScriptServedFromMock = true;
      return new Response(makeGisScript(), {
        status: 200,
        headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
      });
    }

    state.unexpectedResourceRequests += 1;
    return new Response('', { status: 403 });
  });
  const virtualConsole = new VirtualConsole();
  const cookieJar = new CookieJar();
  virtualConsole.on('jsdomError', () => {
    state.jsdomErrors = (state.jsdomErrors || 0) + 1;
  });

  let resolveLoad;
  let rejectLoad;
  const loaded = new Promise((resolve, reject) => {
    resolveLoad = resolve;
    rejectLoad = reject;
  });

  const dom = new JSDOM(html, {
    url: TEST_PAGE_URL,
    cookieJar,
    runScripts: 'dangerously',
    resources: { interceptors: [resourceInterceptor] },
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.__diagnosticTestTelemetry = state.telemetry;
      window.fetch = createFetchMock(window, state, pageOptions, cookieJar);
      window.addEventListener('load', () => {
        state.loadEvents = (state.loadEvents || 0) + 1;
        state.events.push('window-load');
        resolveLoad();
      }, { once: true });
    }
  });

  try {
    const timeout = setTimeout(() => rejectLoad(new Error('Local diagnostic page did not finish loading.')), 5000);
    try {
      await loaded;
    } finally {
      clearTimeout(timeout);
    }
    await waitFor(() => state.challengeRequests === 1 && (
      state.telemetry.initializeCalls > 0
      || dom.window.document.getElementById('diagnostic-result').textContent.length > 0
    ));
  } catch (error) {
    dom.window.close();
    throw error;
  }

  return {
    dom,
    state,
    pageOptions,
    close() {
      dom.window.close();
    }
  };
}

async function waitFor(predicate) {
  const deadline = Date.now() + 2000;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(Boolean(predicate()), true, 'The local diagnostic flow should settle.');
}

function resultText(fixture) {
  return fixture.dom.window.document.getElementById('diagnostic-result').textContent;
}

function statusText(fixture) {
  return fixture.dom.window.document.getElementById('sign-in-status').textContent;
}

function hasMockButton(fixture) {
  return Boolean(fixture.dom.window.document.querySelector('[data-testid="mock-google-sign-in"]'));
}

async function withPage(options, callback) {
  const fixture = await createDiagnosticPage(options);
  try {
    return await callback(fixture);
  } finally {
    fixture.close();
  }
}

test('real generated HTML requests one local challenge, then initializes the GIS mock with its nonce', async () => {
  await withPage({}, (fixture) => {
    const telemetry = fixture.state.telemetry;
    const clientIdFingerprint = crypto.createHash('sha256').update(telemetry.options.client_id).digest('hex');
    assert.equal(fixture.dom.window.location.origin === TEST_ORIGIN, true);
    assert.equal(fixture.dom.window.location.hostname === 'diagnostic.test', true);
    assert.equal(fixture.dom.window.location.protocol === 'https:', true);
    assert.equal(fixture.dom.window.location.href === TEST_PAGE_URL, true);
    assert.equal(fixture.state.challengeRequests, 1);
    assert.equal(fixture.state.challengeRequestShapeValid, true);
    assert.equal(fixture.state.loadEvents, 1);
    assert.equal(fixture.state.events.indexOf('window-load') < fixture.state.events.indexOf('challenge-request'), true);
    assert.equal(fixture.state.events.indexOf('challenge-request') < fixture.state.events.indexOf('challenge-response'), true);
    assert.equal(fixture.state.events.indexOf('challenge-response') < fixture.state.events.indexOf('initialize'), true);
    assert.equal(fixture.state.syntheticChallengeCookieSet, true);
    assert.equal(fixture.state.challengeCookieHiddenFromScript, true);
    assert.equal(fixture.dom.window.document.cookie.includes(TEST_CHALLENGE_ID), false);
    assert.equal(TEST_NONCE.length, 43);
    assert.equal(fixture.state.gisScriptRequests, 1);
    assert.equal(fixture.state.gisScriptServedFromMock, true);
    assert.equal(telemetry.scriptExecuted, true);
    assert.equal(telemetry.initializeCalls, 1);
    assert.equal(telemetry.renderButtonCalls, 1);
    assert.equal(telemetry.promptCalls, 0);
    assert.equal(clientIdFingerprint === TEST_CLIENT_ID_FINGERPRINT, true);
    assert.equal(telemetry.options.nonce === TEST_NONCE, true);
    assert.equal(typeof telemetry.options.callback === 'function', true);
    assert.equal(hasMockButton(fixture), true);
    assert.equal(fixture.state.fetchRequests.length, 1);
    assert.equal(fixture.state.unexpectedFetchRequests, 0);
  });
});

test('GIS script load failure is distinct and prevents initialization and button rendering', async () => {
  await withPage({ gisScriptFails: true }, (fixture) => {
    assert.equal(fixture.state.gisScriptRequests, 1);
    assert.equal(fixture.state.gisScriptServedFromMock, false);
    assert.equal(fixture.state.challengeRequests, 1);
    assert.equal(fixture.state.telemetry.initializeCalls, 0);
    assert.equal(fixture.state.telemetry.renderButtonCalls, 0);
    assert.equal(hasMockButton(fixture), false);
    assert.match(resultText(fixture), /diagnostic_unavailable/);
  });
});

test('a loaded GIS script without google.accounts.id prevents initialization', async () => {
  await withPage({ gisApiAvailable: false }, (fixture) => {
    assert.equal(fixture.state.telemetry.scriptExecuted, true);
    assert.equal(Boolean(fixture.dom.window.google && fixture.dom.window.google.accounts), false);
    assert.equal(fixture.state.challengeRequests, 1);
    assert.equal(fixture.state.telemetry.initializeCalls, 0);
    assert.equal(fixture.state.telemetry.renderButtonCalls, 0);
    assert.equal(hasMockButton(fixture), false);
    assert.match(resultText(fixture), /diagnostic_unavailable/);
  });
});

test('challenge HTTP failure is surfaced without loading the sign-in flow', async () => {
  await withPage({ challengeMode: 'http-failure' }, (fixture) => {
    assert.equal(fixture.state.challengeRequests, 1);
    assert.match(resultText(fixture), /authorization_unavailable/);
    assert.equal(fixture.state.telemetry.initializeCalls, 0);
    assert.equal(fixture.state.telemetry.renderButtonCalls, 0);
    assert.equal(hasMockButton(fixture), false);
  });
});

test('malformed challenge JSON fails closed without GIS initialization', async () => {
  await withPage({ challengeMode: 'malformed' }, (fixture) => {
    assert.equal(fixture.state.challengeRequests, 1);
    assert.match(resultText(fixture), /diagnostic_unavailable/);
    assert.equal(fixture.state.telemetry.initializeCalls, 0);
    assert.equal(fixture.state.telemetry.renderButtonCalls, 0);
    assert.equal(hasMockButton(fixture), false);
  });
});

test('a challenge response missing its nonce does not initialize GIS', async () => {
  await withPage({ challengeMode: 'missing-nonce' }, (fixture) => {
    assert.equal(fixture.state.challengeRequests, 1);
    assert.equal(resultText(fixture), '{}');
    assert.equal(fixture.state.telemetry.initializeCalls, 0);
    assert.equal(fixture.state.telemetry.renderButtonCalls, 0);
    assert.equal(hasMockButton(fixture), false);
  });
});

test('GIS initialization failure is distinguished from challenge and script failures', async () => {
  await withPage({ initializeThrows: true }, (fixture) => {
    assert.equal(fixture.state.challengeRequests, 1);
    assert.equal(fixture.state.telemetry.initializeCalls, 1);
    assert.equal(fixture.state.telemetry.renderButtonCalls, 0);
    assert.equal(hasMockButton(fixture), false);
    assert.match(resultText(fixture), /diagnostic_unavailable/);
  });
});

test('button rendering failure is distinguished from GIS initialization failure', async () => {
  await withPage({ renderButtonThrows: true }, (fixture) => {
    assert.equal(fixture.state.challengeRequests, 1);
    assert.equal(fixture.state.telemetry.initializeCalls, 1);
    assert.equal(fixture.state.telemetry.renderButtonCalls, 1);
    assert.equal(hasMockButton(fixture), false);
    assert.match(resultText(fixture), /diagnostic_unavailable/);
  });
});

test('repeated load events do not initialize GIS twice', async () => {
  await withPage({}, async (fixture) => {
    fixture.dom.window.dispatchEvent(new fixture.dom.window.Event('load'));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(fixture.state.telemetry.initializeCalls, 1);
    assert.equal(fixture.state.telemetry.renderButtonCalls, 1);
    assert.equal(fixture.state.challengeRequests, 1);
    assert.equal(fixture.state.unexpectedFetchRequests, 0);
  });
});

test('repeated load events do not request a second challenge', async () => {
  await withPage({}, async (fixture) => {
    fixture.dom.window.dispatchEvent(new fixture.dom.window.Event('load'));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(fixture.state.challengeRequests, 1);
    assert.equal(fixture.state.fetchRequests.filter((request) => request.routePath === CHALLENGE_PATH).length, 1);
    assert.equal(fixture.state.fetchRequests.length, 1);
    assert.equal(fixture.state.unexpectedFetchRequests, 0);
  });
});

test('the sign-in button appears only when both challenge and GIS are available', async () => {
  await withPage({}, (fixture) => {
    assert.equal(hasMockButton(fixture), true);
  });
  await withPage({ challengeMode: 'http-failure' }, (fixture) => {
    assert.equal(hasMockButton(fixture), false);
  });
  await withPage({ gisApiAvailable: false }, (fixture) => {
    assert.equal(hasMockButton(fixture), false);
  });
});

test('successful initialization registers but does not automatically invoke a credential callback', async () => {
  await withPage({}, (fixture) => {
    assert.equal(typeof fixture.state.telemetry.callback, 'function');
    assert.equal(fixture.state.telemetry.callbackCalls, 0);
    assert.equal(fixture.state.diagnosticPosts, 0);
    assert.equal(fixture.state.tokenVerificationCalls, 0);
    assert.equal(fixture.state.databaseProbeCalls, 0);
  });
});

test('the supported GIS button click listener gives feedback without submitting a diagnostic request', async () => {
  await withPage({}, (fixture) => {
    fixture.dom.window.document.querySelector('[data-testid="mock-google-sign-in"]').click();
    assert.match(statusText(fixture), /Google sign-in was selected/);
    assert.equal(fixture.state.telemetry.callbackCalls, 0);
    assert.equal(fixture.state.diagnosticPosts, 0);
    assert.equal(fixture.state.tokenVerificationCalls, 0);
    assert.equal(fixture.state.databaseProbeCalls, 0);
  });
});

test('an incomplete GIS credential response is shown safely and never posted', async () => {
  await withPage({}, async (fixture) => {
    await fixture.state.telemetry.callback({});
    assert.equal(statusText(fixture), 'Google sign-in could not be completed. Please try again.');
    assert.equal(fixture.state.diagnosticPosts, 0);
    assert.equal(fixture.state.tokenVerificationCalls, 0);
    assert.equal(fixture.state.databaseProbeCalls, 0);
  });
});

test('a synthetic callback credential is confined to the isolated local POST stub', async () => {
  await withPage({
    allowDiagnosticPost: true,
    diagnosticResponse: { authenticationSucceeded: true, readOnlyQuerySucceeded: true }
  }, async (fixture) => {
    await fixture.state.telemetry.callback({ credential: TEST_CREDENTIAL });
    assert.equal(statusText(fixture), 'Google sign-in was verified. The diagnostic result is shown below.');
    const diagnosticRequests = fixture.state.fetchRequests.filter((request) => (
      request.pathname === DIAGNOSTIC_PATH && request.method === 'POST'
    ));
    assert.equal(fixture.state.diagnosticPosts, 1);
    assert.equal(fixture.state.telemetry.callbackCalls, 1);
    assert.equal(fixture.state.syntheticCredentialPosted, true);
    assert.equal(fixture.state.diagnosticRequestShapeValid, true);
    assert.equal(diagnosticRequests.length, 1);
    assert.equal(diagnosticRequests[0].origin === TEST_ORIGIN, true);
    assert.equal(fixture.state.unexpectedFetchRequests, 0);
    assert.equal(fixture.state.tokenVerificationCalls, 0);
    assert.equal(fixture.state.databaseProbeCalls, 0);
  });
});

test('a rejected diagnostic authorization response gets a sanitized visible message', async () => {
  await withPage({ allowDiagnosticPost: true }, async (fixture) => {
    await fixture.state.telemetry.callback({ credential: TEST_CREDENTIAL });
    assert.equal(statusText(fixture), 'Google sign-in could not be verified. Please try again.');
    assert.match(resultText(fixture), /authorization_failed/);
    assert.equal(fixture.state.diagnosticPosts, 1);
    assert.equal(fixture.state.databaseProbeCalls, 0);
  });
});

test('a diagnostic transport failure gets a sanitized visible message', async () => {
  await withPage({}, async (fixture) => {
    await fixture.state.telemetry.callback({ credential: TEST_CREDENTIAL });
    assert.equal(statusText(fixture), 'Google sign-in could not be verified. Please try again later.');
    assert.match(resultText(fixture), /diagnostic_unavailable/);
    assert.equal(fixture.state.blockedDiagnosticPosts, 1);
    assert.equal(fixture.state.databaseProbeCalls, 0);
  });
});

test('all external resources are blocked or mocked and no Production, Redis, or database service is reached', async () => {
  await withPage({}, (fixture) => {
    assert.equal(fixture.state.gisScriptRequests, 1);
    assert.equal(fixture.state.gisScriptServedFromMock, true);
    assert.equal(fixture.state.unexpectedResourceRequests, 0);
    assert.equal(fixture.state.unexpectedFetchRequests, 0);
    assert.equal(fixture.state.fetchRequests.every((request) => request.origin === TEST_ORIGIN), true);
    assert.equal(fixture.state.fetchRequests.some((request) => request.origin === PRODUCTION_ORIGIN), false);
    assert.equal(fixture.state.redisFactoryCalls, 0);
    assert.equal(fixture.state.databaseCalls, 0);
    assert.equal(fixture.state.databaseProbeCalls, 0);
    assert.equal(fixture.state.tokenVerificationCalls, 0);
  });
});
