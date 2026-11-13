'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const identity = document.querySelector('body > main [data-site-admin-identity]');
  const message = document.querySelector('body > main [data-site-admin-message]');
  const logout = document.querySelector('body > main [data-site-admin-logout]');

  const request = async (url, options) => {
    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'same-origin',
      ...options,
      headers: { Accept: 'application/json', ...options?.headers }
    });
    const contentType = response.headers.get('content-type') || '';
    const result = contentType.includes('application/json') ? await response.json() : null;
    if (!response.ok) throw new Error(result?.error || 'The administrator session request failed.');
    return result;
  };

  request('/api/site-admin/session').then((session) => {
    identity.textContent = `Signed in as ${session.username} · ${session.role}`;
  }).catch((error) => {
    if (error.message === 'Sign in to access the administrator dashboard.') {
      window.location.replace('/admin');
      return;
    }
    identity.textContent = '';
    message.textContent = 'The secure administrator service is unavailable.';
  });

  logout.addEventListener('click', async () => {
    logout.disabled = true;
    message.textContent = '';
    try {
      await request('/api/site-admin/logout', { method: 'POST' });
      window.location.replace('/admin');
    } catch {
      message.textContent = 'Sign out could not be completed. Please try again.';
      logout.disabled = false;
    }
  });
});
