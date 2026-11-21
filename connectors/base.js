export class ProjectConnector {
  constructor({ projectId, projectToken, coreUrl, scope = 'global' }) {
    if (!projectId || !projectToken || !coreUrl) throw new Error('Project connector configuration incomplete.');
    this.projectId = projectId;
    this.projectToken = projectToken;
    this.coreUrl = coreUrl.replace(/\/$/, '');
    this.scope = scope;
  }

  headers(extra = {}) {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${this.projectToken}`, ...extra };
  }

  async request(path, options = {}) {
    const response = await fetch(`${this.coreUrl}${path}`, { ...options, headers: this.headers(options.headers) });
    if (!response.ok) throw new Error(`Global Core request failed (${response.status}).`);
    return response.status === 204 ? null : response.json();
  }

  publish(entityId, entityType, payload, options = {}) {
    return this.request('/api/events', {
      method: 'POST',
      body: JSON.stringify({
        eventId: options.eventId || cryptoRandomId(),
        idempotencyKey: options.idempotencyKey || cryptoRandomId(),
        entityId,
        entityType,
        operation: options.operation || 'upsert',
        version: options.version || 1,
        timestamp: new Date().toISOString(),
        scope: this.scope,
        payload
      })
    });
  }

  getEvents(after = 0) {
    return this.request(`/api/events?after=${after}`);
  }

  checkpoint(value) {
    return this.request('/api/checkpoints', { method: 'POST', body: JSON.stringify({ checkpoint: value }) });
  }
}

export function cryptoRandomId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
