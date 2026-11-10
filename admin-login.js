'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('[data-site-admin-login]');
  const username = form.querySelector('[name="username"]');
  const password = form.querySelector('[name="password"]');
  const toggle = document.querySelector('[data-password-toggle]');
  const submit = document.querySelector('[data-login-submit]');
  const submitLabel = document.querySelector('[data-submit-label]');
  const errorMessage = document.querySelector('[data-login-error]');
  const statusMessage = document.querySelector('[data-login-status]');

  const displayError = (message) => {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
    statusMessage.textContent = '';
  };

  const request = async (url, options) => {
    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'same-origin',
      ...options,
      headers: { Accept: 'application/json', ...options?.headers }
    });
    const contentType = response.headers.get('content-type') || '';
    const result = contentType.includes('application/json') ? await response.json() : null;
    if (!response.ok) throw new Error(result?.error || 'The secure sign-in request could not be completed.');
    return result;
  };

  toggle.addEventListener('click', () => {
    const shouldShow = password.type === 'password';
    password.type = shouldShow ? 'text' : 'password';
    toggle.textContent = shouldShow ? 'Hide' : 'Show';
    toggle.setAttribute('aria-label', shouldShow ? 'Hide password' : 'Show password');
    toggle.setAttribute('aria-pressed', String(shouldShow));
    password.focus();
  });

  form.addEventListener('input', () => {
    errorMessage.hidden = true;
    errorMessage.textContent = '';
    username.removeAttribute('aria-invalid');
    password.removeAttribute('aria-invalid');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorMessage.hidden = true;
    errorMessage.textContent = '';
    statusMessage.textContent = '';

    if (!username.value.trim() || !password.value) {
      displayError('Enter both your username and password.');
      if (!username.value.trim()) {
        username.setAttribute('aria-invalid', 'true');
        username.focus();
      } else {
        password.setAttribute('aria-invalid', 'true');
        password.focus();
      }
      return;
    }

    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    submitLabel.textContent = 'Signing in…';
    statusMessage.textContent = 'Verifying your credentials…';
    try {
      await request('/api/site-admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.value.trim(), password: password.value })
      });
      password.value = '';
      window.location.replace('/admin/dashboard');
    } catch (error) {
      password.value = '';
      password.focus();
      displayError(error.message === 'Username or password is incorrect.'
        ? 'Username or password is incorrect.'
        : error.message);
    } finally {
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
      submitLabel.textContent = 'Sign In';
    }
  });

  request('/api/site-admin/session').then(() => {
    window.location.replace('/admin/dashboard');
  }).catch((error) => {
    if (error.message !== 'Sign in to access the administrator dashboard.') {
      displayError('The secure sign-in service is unavailable. Start the local MI CORTEX service and try again.');
    }
  });
});
