export class CortexConnector {
  constructor(options) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.projectId = options.projectId;
    this.token = options.token;
    this.queue = [];
  }

  headers(extra = {}) {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}`, ...extra };
  }

  async request(path, options = {}) {
    let lastError;
    for (let attempt = 0; attempt < (options.retries ?? 3); attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}${path}`, { ...options, headers: this.headers(options.headers) });
        if (!response.ok) throw new Error(`Core request failed (${response.status}).`);
        return response.status === 204 ? null : response.json();
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
      }
    }
    this.queue.push({ path, options, failedAt: new Date().toISOString() });
    throw lastError;
  }

  publish(event) {
    return this.request('/api/events', { method: 'POST', body: JSON.stringify({ projectId: this.projectId, ...event }) });
  }

  setData(scope, entityId, payload, options = {}) {
    return this.request('/api/data', { method: 'POST', body: JSON.stringify({ scope, entityId, payload, ...options }) });
  }

  getData(scope = 'global') {
    return this.request(`/api/data?scope=${encodeURIComponent(scope)}`);
  }

  getEvents(after = 0) {
    return this.request(`/api/events?after=${after}`);
  }

  async uploadFile(scope, fileName, bytes, metadata = {}) {
    const contentBase64 = Buffer.from(bytes).toString('base64');
    return this.request('/api/files', { method: 'POST', body: JSON.stringify({ scope, fileName, contentBase64, metadata }) });
  }

  async retryQueue() {
    const pending = [...this.queue];
    this.queue = [];
    for (const item of pending) {
      try { await this.request(item.path, item.options); } catch (_) { this.queue.push(item); }
    }
  }
}
