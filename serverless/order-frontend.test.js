'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const script = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const testOrderId = 'c684e4a4-b1b7-4e27-91b8-a14e1e9d5736';
const testIdempotencyKey = '9c19dc0e-c21d-423c-b51c-c856f4e7339f';

async function createOrderForm(fetchImplementation) {
  const dom = new JSDOM('<!doctype html><html><body data-language="en"></body></html>', {
    runScripts: 'outside-only',
    url: 'https://mi-cortex-test.example/services.html'
  });
  const { window } = dom;
  window.fetch = fetchImplementation;
  Object.defineProperty(window.crypto, 'randomUUID', {
    configurable: true,
    value: () => testIdempotencyKey
  });
  window.eval(script);
  await new Promise((resolve) => {
    window.document.addEventListener('DOMContentLoaded', resolve, { once: true });
  });

  const modal = window.document.querySelector('#mi-cortex-order-modal');
  modal.dataset.itemName = 'Test Product';
  modal.dataset.itemType = 'product';
  modal.dataset.itemCategory = 'test';
  const form = modal.querySelector('[data-order-form]');
  form.elements.customerName.value = 'Test Customer';
  form.elements.customerEmail.value = 'customer@example.test';
  form.elements.customerPhone.value = '+1 555 123 4567';
  form.elements.companyName.value = 'Test Company';
  form.elements.quantity.value = '2';
  form.elements.urgency.value = 'priority';
  form.elements.preferredTimeline.value = 'Two weeks';
  form.elements.budget.value = '50000';
  form.elements.notes.value = 'Order details for integration test';
  return { dom, form, modal };
}

function submit(form, window) {
  const event = new window.Event('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(event);
  return event;
}

async function flushAsyncHandlers() {
  await new Promise((resolve) => setImmediate(resolve));
}

test('order form sends the complete payload once and reports only a confirmed save', async () => {
  const calls = [];
  let resolveResponse;
  const { dom, form, modal } = await createOrderForm((url, options) => {
    calls.push({ url, options });
    return new Promise((resolve) => { resolveResponse = resolve; });
  });

  try {
    const event = submit(form, dom.window);
    assert.equal(event.defaultPrevented, true);
    assert.equal(form.querySelector('[type="submit"]').disabled, true);
    assert.equal(form.querySelector('[type="submit"]').textContent, 'Submitting…');
    assert.equal(form.getAttribute('aria-busy'), 'true');

    submit(form, dom.window);
    assert.equal(calls.length, 1, 'submitting again while pending does not send another request');

    resolveResponse(new Response(JSON.stringify({
      id: testOrderId,
      status: 'new',
      received: true,
      message: 'Your order request was received.'
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
    await flushAsyncHandlers();

    assert.equal(calls[0].url, '/api/orders');
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.credentials, 'same-origin');
    assert.equal(calls[0].options.headers['Idempotency-Key'], testIdempotencyKey);
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      itemType: 'product',
      itemName: 'Test Product',
      itemCategory: 'test',
      customerName: 'Test Customer',
      customerEmail: 'customer@example.test',
      customerPhone: '+1 555 123 4567',
      companyName: 'Test Company',
      quantity: 2,
      urgency: 'priority',
      preferredTimeline: 'Two weeks',
      budget: '50000',
      notes: 'Order details for integration test'
    });
    assert.match(modal.querySelector('.order-modal__notice').textContent, new RegExp(testOrderId));
    assert.equal(form.querySelector('.form-message'), null, 'the generic demo handler ignores the real order form');
    assert.equal(form.getAttribute('aria-busy'), 'false');
  } finally {
    dom.window.close();
  }
});

test('order form gives a useful 404 error and reuses its key for retry', async () => {
  const keys = [];
  const { dom, form, modal } = await createOrderForm(async (_url, options) => {
    keys.push(options.headers['Idempotency-Key']);
    return new Response(JSON.stringify({ error: 'Not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  });

  try {
    submit(form, dom.window);
    await flushAsyncHandlers();
    const notice = modal.querySelector('.order-modal__notice');
    assert.match(notice.textContent, /submission is temporarily unavailable/i);
    assert.doesNotMatch(notice.textContent, /Not found/i);
    assert.equal(notice.classList.contains('order-modal__notice--error'), true);

    submit(form, dom.window);
    await flushAsyncHandlers();
    assert.deepEqual(keys, [testIdempotencyKey, testIdempotencyKey]);
  } finally {
    dom.window.close();
  }
});

test('order form reports server failures and rejects unconfirmed success responses', async () => {
  const replies = [
    new Response(JSON.stringify({ error: 'internal details' }), { status: 503 }),
    new Response(JSON.stringify({ id: testOrderId }), { status: 200 })
  ];
  const { dom, form, modal } = await createOrderForm(async () => replies.shift());

  try {
    submit(form, dom.window);
    await flushAsyncHandlers();
    const notice = modal.querySelector('.order-modal__notice');
    assert.equal(notice.textContent, 'We could not save your order right now. Please try again.');
    assert.equal(notice.classList.contains('order-modal__notice--error'), true);

    submit(form, dom.window);
    await flushAsyncHandlers();
    assert.match(notice.textContent, /did not confirm that your order was saved/i);
    assert.equal(notice.classList.contains('order-modal__notice--error'), true);
  } finally {
    dom.window.close();
  }
});

test('CEO order list renders customer-provided content as text', async () => {
  const dom = new JSDOM(
    '<!doctype html><html><body data-language="en"><div data-admin-orders-list></div></body></html>',
    { runScripts: 'outside-only', url: 'https://mi-cortex-test.example/admin/dashboard' }
  );
  dom.window.fetch = async () => new Response(JSON.stringify({
    orders: [{
      id: testOrderId,
      createdAt: '2026-11-14T00:00:00.000Z',
      customerName: '<img src=x onerror=alert(1)>',
      customerEmail: 'customer@example.test',
      itemName: '<svg onload=alert(1)>',
      itemType: 'product',
      quantity: 1,
      status: 'new'
    }]
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  try {
    dom.window.eval(script);
    await new Promise((resolve) => {
      dom.window.document.addEventListener('DOMContentLoaded', resolve, { once: true });
    });
    await flushAsyncHandlers();

    const ordersTable = dom.window.document.querySelector('[data-admin-orders-list]');
    assert.equal(ordersTable.querySelector('img, svg'), null);
    assert.match(ordersTable.textContent, /<img src=x onerror=alert\(1\)>/);
    assert.match(ordersTable.textContent, /<svg onload=alert\(1\)>/);
  } finally {
    dom.window.close();
  }
});
