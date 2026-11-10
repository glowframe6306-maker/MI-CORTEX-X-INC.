'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const loginPanel = document.querySelector('[data-admin-login-panel]');
  const loginForm = document.querySelector('[data-admin-login]');
  const applicationsPanel = document.querySelector('[data-admin-applications-panel]');
  const identity = document.querySelector('[data-admin-identity]');
  const list = document.querySelector('[data-admin-list]');
  const message = document.querySelector('[data-admin-message]');
  const metrics = document.querySelector('[data-admin-metrics]');
  const positionSummary = document.querySelector('[data-admin-position-summary]');
  const summaryCompany = document.querySelector('[data-summary-company]');
  const summarySearch = document.querySelector('[data-summary-search]');
  const includeEmpty = document.querySelector('[data-summary-empty]');
  const filterCompany = document.querySelector('[data-filter-company]');
  const filterPosition = document.querySelector('[data-filter-position]');
  const filterStatus = document.querySelector('[data-filter-status]');
  const filterSort = document.querySelector('[data-filter-sort]');
  const compareButton = document.querySelector('[data-admin-compare]');
  const compareHint = document.querySelector('[data-compare-hint]');
  const comparison = document.querySelector('[data-admin-comparison]');
  const statuses = ['new', 'reviewing', 'shortlisted', 'rejected', 'withdrawn'];
  const selectedIds = new Set();
  let applications = [];

  if (!window.CAREERS_CATALOGUE || !Array.isArray(window.CAREERS_CATALOGUE.companies)) {
    throw new Error('The Careers position catalogue failed to load in the admin panel.');
  }

  const request = async (url, options = {}) => {
    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'same-origin',
      ...options,
      headers: { Accept: 'application/json', ...options.headers }
    });
    const contentType = response.headers.get('content-type') || '';
    const result = contentType.includes('application/json') ? await response.json() : null;
    if (!response.ok) throw new Error(result?.error || 'The Careers administration request failed.');
    return result;
  };

  const showError = (error) => {
    message.textContent = error.message;
    message.dataset.state = 'error';
  };

  const createText = (tagName, text, className = '') => {
    const element = document.createElement(tagName);
    element.textContent = text;
    if (className) element.className = className;
    return element;
  };

  const populateOptions = (select, values) => {
    values.forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.append(option);
    });
  };

  const companyOptions = window.CAREERS_CATALOGUE.companies.map((company) => [company.id, company.name]);
  populateOptions(summaryCompany, companyOptions);
  populateOptions(filterCompany, companyOptions);
  populateOptions(filterStatus, statuses.map((status) => [status, status[0].toUpperCase() + status.slice(1)]));

  const renderMetrics = () => {
    const positions = window.CAREERS_CATALOGUE.companies.reduce((total, company) => total + company.positions.length, 0);
    const items = [
      [applications.length, 'Independent application records'],
      [positions, 'Selectable company-position combinations'],
      [new Set(applications.map((application) => application.companyId)).size, 'Companies with applicants']
    ];
    metrics.replaceChildren(...items.map(([value, label]) => {
      const card = document.createElement('div');
      card.className = 'careers-admin__metric';
      card.append(createText('strong', String(value)), createText('span', label));
      return card;
    }));
  };

  const renderPositionSummary = () => {
    const counts = new Map();
    applications.forEach((application) => {
      const key = `${application.companyId}\u0000${application.positionTitle}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const companyFilter = summaryCompany.value;
    const query = summarySearch.value.trim().toLocaleLowerCase();
    const rows = window.CAREERS_CATALOGUE.companies.flatMap((company) => company.positions
      .filter((position) => (!companyFilter || company.id === companyFilter)
        && position.title.toLocaleLowerCase().includes(query))
      .map((position) => ({
        company,
        position,
        count: counts.get(`${company.id}\u0000${position.title}`) || 0
      })))
      .filter((row) => includeEmpty.checked || row.count > 0)
      .sort((a, b) => b.count - a.count || a.company.name.localeCompare(b.company.name) || a.position.title.localeCompare(b.position.title));
    positionSummary.replaceChildren();
    if (!rows.length) {
      const row = document.createElement('tr');
      const cell = createText('td', 'No positions match these filters.');
      cell.colSpan = 3;
      row.append(cell);
      positionSummary.append(row);
      return;
    }
    rows.forEach(({ company, position, count }) => {
      const row = document.createElement('tr');
      row.append(
        createText('td', company.name),
        createText('td', position.title),
        createText('td', String(count))
      );
      positionSummary.append(row);
    });
  };

  const filteredApplications = () => {
    const company = filterCompany.value;
    const position = filterPosition.value.trim().toLocaleLowerCase();
    const status = filterStatus.value;
    const filtered = applications.filter((application) => (
      (!company || application.companyId === company)
      && (!position || application.positionTitle.toLocaleLowerCase().includes(position))
      && (!status || application.status === status)
    ));
    if (filterSort.value === 'oldest') filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    else if (filterSort.value === 'name') filtered.sort((a, b) => a.applicant.fullName.localeCompare(b.applicant.fullName));
    else filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return filtered;
  };

  const getSelectedApplications = () => applications.filter((application) => selectedIds.has(application.id));

  const updateCompareControls = () => {
    const selected = getSelectedApplications();
    compareButton.disabled = selected.length < 2;
    const samePosition = selected.length >= 2 && selected.every((application) => (
      application.companyId === selected[0].companyId
      && application.positionTitle === selected[0].positionTitle
    ));
    compareHint.textContent = samePosition
      ? `${selected.length} applicants selected for ${selected[0].companyName} · ${selected[0].positionTitle}.`
      : 'Select at least two applicants for the same company and position.';
    compareButton.disabled = !samePosition;
    if (!samePosition) comparison.hidden = true;
  };

  const renderComparison = () => {
    const selected = getSelectedApplications();
    if (selected.length < 2 || !selected.every((application) => (
      application.companyId === selected[0].companyId
      && application.positionTitle === selected[0].positionTitle
    ))) {
      comparison.hidden = true;
      return;
    }
    const fields = [
      ['Applicant', (application) => application.applicant.fullName],
      ['Email', (application) => application.applicant.email],
      ['Phone', (application) => application.applicant.phone || 'Not provided'],
      ['Status', (application) => application.status],
      ['Submitted', (application) => new Date(application.createdAt).toLocaleString()],
      ['Application statement', (application) => application.applicant.statement],
      ['Supporting documents', (application) => application.applicant.documents.map((document) => document.name).join(', ') || 'None']
    ];
    const table = document.createElement('table');
    const header = document.createElement('tr');
    header.append(createText('th', 'Comparison'));
    selected.forEach((application) => header.append(createText('th', application.applicant.fullName)));
    table.append(header);
    fields.forEach(([label, getter]) => {
      const row = document.createElement('tr');
      row.append(createText('th', label));
      selected.forEach((application) => row.append(createText('td', getter(application))));
      table.append(row);
    });
    comparison.replaceChildren(
      createText('h3', `${selected[0].companyName} · ${selected[0].positionTitle}`),
      table
    );
    comparison.hidden = false;
  };

  const renderApplications = () => {
    const visible = filteredApplications();
    list.replaceChildren();
    if (!visible.length) {
      list.append(createText('p', 'No application records match these filters.', 'careers-admin__empty'));
      updateCompareControls();
      return;
    }

    visible.forEach((application) => {
      const record = document.createElement('article');
      record.className = 'careers-admin__record';
      const selection = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selectedIds.has(application.id);
      checkbox.setAttribute('aria-label', `Select ${application.applicant.fullName} for comparison`);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selectedIds.add(application.id);
        else selectedIds.delete(application.id);
        updateCompareControls();
      });
      selection.append(checkbox, document.createTextNode(' Compare'));
      record.append(selection);
      record.append(createText('h3', `${application.applicant.fullName} · ${application.positionTitle}`));
      record.append(createText('p', `${application.companyName} · ${application.positionCategory}`));
      record.append(createText('p', application.applicant.email));
      if (application.applicant.phone) record.append(createText('p', application.applicant.phone));
      record.append(createText('p', `Reference: ${application.id}`));
      record.append(createText('p', `Received ${new Date(application.createdAt).toLocaleString()}`));
      record.append(createText('blockquote', application.applicant.statement));

      if (application.applicant.documents.length) {
        const documents = document.createElement('div');
        documents.className = 'careers-admin__record-documents';
        application.applicant.documents.forEach((document) => {
          const link = document.createElement('a');
          link.href = `/api/admin/applications/${encodeURIComponent(application.id)}/documents/${encodeURIComponent(document.id)}`;
          link.textContent = `${document.name} (${(document.size / (1024 * 1024)).toFixed(2)} MB) · Download PDF`;
          documents.append(link);
        });
        record.append(documents);
      } else {
        record.append(createText('p', 'No supporting documents attached.'));
      }

      const controls = document.createElement('div');
      controls.className = 'careers-admin__record-controls';
      const status = document.createElement('select');
      status.setAttribute('aria-label', `Status for ${application.applicant.fullName}`);
      statuses.forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value[0].toUpperCase() + value.slice(1);
        status.append(option);
      });
      status.value = application.status;
      status.addEventListener('change', async () => {
        try {
          await request(`/api/admin/applications/${encodeURIComponent(application.id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: status.value })
          });
          application.status = status.value;
          message.dataset.state = 'success';
          message.textContent = 'Application status updated.';
          renderPositionSummary();
          renderApplications();
        } catch (error) {
          showError(error);
          await loadApplications();
        }
      });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Delete application';
      remove.addEventListener('click', async () => {
        if (!window.confirm('Permanently delete this application and its PDF documents from the local database?')) return;
        try {
          await request(`/api/admin/applications/${encodeURIComponent(application.id)}`, { method: 'DELETE' });
          selectedIds.delete(application.id);
          message.dataset.state = 'success';
          message.textContent = 'Application and attached documents permanently deleted.';
          await loadApplications();
        } catch (error) {
          showError(error);
        }
      });

      controls.append(status, remove);
      record.append(controls);
      list.append(record);
    });
    updateCompareControls();
  };

  async function loadApplications() {
    const result = await request('/api/admin/applications');
    applications = result.applications;
    const activeIds = new Set(applications.map((application) => application.id));
    selectedIds.forEach((id) => {
      if (!activeIds.has(id)) selectedIds.delete(id);
    });
    renderMetrics();
    renderPositionSummary();
    renderApplications();
  }

  const showAdmin = async (email) => {
    loginPanel.hidden = true;
    applicationsPanel.hidden = false;
    identity.textContent = `Signed in as ${email}`;
    message.textContent = '';
    await loadApplications();
  };

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = '';
    const data = new FormData(loginForm);
    const submit = loginForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const result = await request('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.get('email'), password: data.get('password') })
      });
      loginForm.reset();
      await showAdmin(result.email);
    } catch (error) {
      showError(error);
    } finally {
      submit.disabled = false;
    }
  });

  document.querySelector('[data-admin-refresh]').addEventListener('click', () => {
    loadApplications().then(() => {
      message.dataset.state = 'success';
      message.textContent = 'Applications refreshed.';
    }).catch(showError);
  });

  document.querySelector('[data-admin-logout]').addEventListener('click', async () => {
    try {
      await request('/api/admin/logout', { method: 'POST' });
      applicationsPanel.hidden = true;
      loginPanel.hidden = false;
      selectedIds.clear();
      message.textContent = 'Signed out.';
    } catch (error) {
      showError(error);
    }
  });

  [summaryCompany, summarySearch, includeEmpty].forEach((control) => {
    control.addEventListener('input', renderPositionSummary);
    control.addEventListener('change', renderPositionSummary);
  });
  [filterCompany, filterPosition, filterStatus, filterSort].forEach((control) => {
    control.addEventListener('input', renderApplications);
    control.addEventListener('change', renderApplications);
  });
  compareButton.addEventListener('click', renderComparison);

  request('/api/admin/applications').then((result) => {
    loginPanel.hidden = true;
    applicationsPanel.hidden = false;
    identity.textContent = 'Signed in with the active local administrator session.';
    applications = result.applications;
    renderMetrics();
    renderPositionSummary();
    renderApplications();
  }).catch((error) => {
    if (error.message !== 'Sign in to manage applications.') showError(error);
  });
});
