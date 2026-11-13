'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const scriptSource = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const stylesSource = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

async function createPage() {
  const errors = [];
  let resolveDomReady;
  const domReady = new Promise((resolve) => {
    resolveDomReady = resolve;
  });
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error.message));
  const dom = new JSDOM(`<!doctype html>
    <html><head><style>${stylesSource}</style></head>
    <body><header class="topbar"><nav class="nav-links"></nav></header>
    <main><div class="hero-visual">
      <img src="assets/REAL.jpeg" alt="Founder and CEO Mohomed Imran Muhammadh">
    </div><p>Home Page content</p></main><script>${scriptSource}</script></body></html>`, {
    pretendToBeVisual: true,
    runScripts: 'dangerously',
    url: 'https://mi-cortex-x-inc.vercel.app/',
    beforeParse(window) {
      window.scrollTo = () => {};
      window.document.addEventListener('DOMContentLoaded', resolveDomReady, { once: true });
    }
  });
  await domReady;
  return { dom, errors, document: dom.window.document, window: dom.window };
}

function getViewer(page) {
  return page.document.querySelector('.image-viewer');
}

function getScale(image) {
  return Number(image.style.transform.match(/scale\(([^)]+)\)/)[1]);
}

function pointerEvent(window, type, pointerId, clientX, clientY) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  for (const [key, value] of Object.entries({ pointerId, clientX, clientY })) {
    Object.defineProperty(event, key, { value });
  }
  return event;
}

async function openViewer(page) {
  page.document.querySelector('body > main .hero-visual img').click();
  await new Promise((resolve) => page.window.requestAnimationFrame(resolve));
  await new Promise((resolve) => page.window.setTimeout(resolve, 60));
  return getViewer(page);
}

test('opens the original CEO photo with accessible loading, error, and close behavior', async (t) => {
  const page = await createPage();
  t.after(() => page.dom.window.close());
  const photo = page.document.querySelector('body > main .hero-visual img');
  const viewer = await openViewer(page);
  const image = viewer.querySelector('.image-viewer__image');

  assert.equal(photo.getAttribute('role'), 'button');
  assert.equal(viewer.getAttribute('role'), 'dialog');
  assert.equal(viewer.getAttribute('aria-modal'), 'true');
  assert.equal(viewer.getAttribute('aria-hidden'), 'false');
  assert.equal(image.getAttribute('src'), photo.src);
  assert.equal(image.hidden, true);
  assert.match(viewer.querySelector('.image-viewer__status').textContent, /Loading/);
  assert.equal(page.document.documentElement.style.overflow, 'hidden');
  assert.equal(page.document.body.style.overflow, 'hidden');
  assert.equal(page.document.activeElement.getAttribute('aria-label'), 'Close image viewer');

  const download = viewer.querySelector('.image-viewer__download');
  const original = viewer.querySelector('.image-viewer__original');
  assert.equal(download.href, photo.src);
  assert.equal(download.download, 'REAL.jpeg');
  assert.equal(original.href, photo.src);
  assert.equal(original.target, '_blank');
  assert.equal(original.rel, 'noopener noreferrer');
  await new Promise((resolve) => page.window.setTimeout(resolve, 180));
  assert.equal(page.document.querySelectorAll('.topbar-lens .image-viewer').length, 0);

  image.dispatchEvent(new page.window.Event('error'));
  assert.equal(image.hidden, true);
  assert.match(viewer.querySelector('.image-viewer__status').textContent, /could not be loaded/i);
  assert.equal(viewer.getAttribute('aria-busy'), 'false');

  page.document.dispatchEvent(new page.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(viewer.getAttribute('aria-hidden'), 'true');
  assert.equal(page.document.documentElement.style.overflow, '');
  assert.equal(page.document.body.style.overflow, '');
  assert.equal(page.document.activeElement, photo);

  await openViewer(page);
  getViewer(page).querySelector('.image-viewer__close').click();
  assert.equal(getViewer(page).getAttribute('aria-hidden'), 'true');
  assert.equal(page.document.activeElement, photo);
  assert.equal(page.errors.length, 0);
});

test('supports zoom buttons, keyboard shortcuts, and reset without cropping the image', async (t) => {
  const page = await createPage();
  t.after(() => page.dom.window.close());
  const viewer = await openViewer(page);
  const image = viewer.querySelector('.image-viewer__image');
  image.dispatchEvent(new page.window.Event('load'));

  viewer.querySelector('.image-viewer__zoom-in').click();
  assert.equal(getScale(image), 1.25);
  viewer.querySelector('.image-viewer__zoom-out').click();
  assert.equal(getScale(image), 1);
  page.document.dispatchEvent(new page.window.KeyboardEvent('keydown', { key: '=', bubbles: true }));
  assert.equal(getScale(image), 1.25);
  page.document.dispatchEvent(new page.window.KeyboardEvent('keydown', { key: '-', bubbles: true }));
  assert.equal(getScale(image), 1);
  page.document.dispatchEvent(new page.window.KeyboardEvent('keydown', { key: '+', bubbles: true }));
  page.document.dispatchEvent(new page.window.KeyboardEvent('keydown', { key: '0', bubbles: true }));
  assert.equal(getScale(image), 1);
  viewer.querySelector('.image-viewer__zoom-in').click();
  viewer.querySelector('.image-viewer__reset').click();
  assert.equal(getScale(image), 1);
  assert.equal(page.window.getComputedStyle(image).objectFit, 'contain');
  assert.equal(page.errors.length, 0);
});

test('supports wheel zoom, pointer panning, and touch-style pinch zoom', async (t) => {
  const page = await createPage();
  t.after(() => page.dom.window.close());
  const viewer = await openViewer(page);
  const stage = viewer.querySelector('.image-viewer__stage');
  const image = viewer.querySelector('.image-viewer__image');
  image.dispatchEvent(new page.window.Event('load'));
  Object.defineProperties(stage, {
    clientWidth: { configurable: true, value: 100 },
    clientHeight: { configurable: true, value: 100 },
    getBoundingClientRect: {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 100, height: 100 })
    }
  });
  Object.defineProperties(image, {
    offsetWidth: { configurable: true, value: 200 },
    offsetHeight: { configurable: true, value: 200 }
  });
  stage.setPointerCapture = () => {};

  const wheel = new page.window.WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    clientX: 50,
    clientY: 50,
    deltaY: -1
  });
  stage.dispatchEvent(wheel);
  assert.equal(wheel.defaultPrevented, true);
  assert.ok(getScale(image) > 1);

  stage.dispatchEvent(pointerEvent(page.window, 'pointerdown', 1, 50, 50));
  stage.dispatchEvent(pointerEvent(page.window, 'pointermove', 1, 70, 60));
  assert.match(image.style.transform, /translate\(20px, 10px\)/);
  stage.dispatchEvent(pointerEvent(page.window, 'pointerup', 1, 70, 60));

  viewer.querySelector('.image-viewer__reset').click();
  stage.dispatchEvent(pointerEvent(page.window, 'pointerdown', 2, 30, 50));
  stage.dispatchEvent(pointerEvent(page.window, 'pointerdown', 3, 70, 50));
  stage.dispatchEvent(pointerEvent(page.window, 'pointermove', 3, 90, 50));
  assert.ok(getScale(image) > 1);
  stage.dispatchEvent(pointerEvent(page.window, 'pointerup', 3, 90, 50));
  stage.dispatchEvent(pointerEvent(page.window, 'pointermove', 2, 40, 50));
  assert.match(image.style.transform, /translate\(/);
  stage.dispatchEvent(pointerEvent(page.window, 'pointerup', 2, 40, 50));
  assert.equal(page.errors.length, 0);
});

test('supports fullscreen controls, focus trapping, and closing from the backdrop', async (t) => {
  const page = await createPage();
  t.after(() => page.dom.window.close());
  const viewer = await openViewer(page);
  const fullscreen = viewer.querySelector('.image-viewer__fullscreen');
  let fullscreenElement = null;
  Object.defineProperty(page.document, 'fullscreenElement', {
    configurable: true,
    get: () => fullscreenElement
  });
  viewer.requestFullscreen = async () => {
    fullscreenElement = viewer;
    page.document.dispatchEvent(new page.window.Event('fullscreenchange'));
  };
  page.document.exitFullscreen = async () => {
    fullscreenElement = null;
    page.document.dispatchEvent(new page.window.Event('fullscreenchange'));
  };

  await fullscreen.click();
  assert.equal(fullscreen.textContent, 'Exit Full Screen');
  await fullscreen.click();
  assert.equal(fullscreen.textContent, 'Full Screen');

  const stage = viewer.querySelector('.image-viewer__stage');
  stage.focus();
  page.document.dispatchEvent(new page.window.KeyboardEvent('keydown', {
    key: 'Tab',
    bubbles: true,
    cancelable: true
  }));
  const firstControl = viewer.querySelector('.image-viewer__zoom-out');
  assert.equal(page.document.activeElement, firstControl);
  page.document.dispatchEvent(new page.window.KeyboardEvent('keydown', {
    key: 'Tab',
    bubbles: true,
    shiftKey: true,
    cancelable: true
  }));
  assert.equal(page.document.activeElement, stage);

  stage.click();
  assert.equal(viewer.getAttribute('aria-hidden'), 'true');
  assert.equal(page.document.activeElement, page.document.querySelector('body > main .hero-visual img'));
  assert.equal(page.errors.length, 0);
});
