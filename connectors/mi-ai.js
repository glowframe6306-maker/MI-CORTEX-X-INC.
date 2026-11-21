import { ProjectConnector } from './base.js';

export class MiAiConnector extends ProjectConnector {
  constructor(options) {
    super({ ...options, projectId: options.projectId || 'mi-ai' });
    this.applicationUrl = options.applicationUrl.replace(/\/$/, '');
  }

  async pollConversations(firebaseIdToken, lastEventVersion = 0) {
    const response = await fetch(`${this.applicationUrl}/api/conversations`, {
      headers: { Authorization: `Bearer ${firebaseIdToken}` }
    });
    if (!response.ok) throw new Error(`MI-AI synchronization read failed (${response.status}).`);
    const body = await response.json();
    const conversations = Array.isArray(body.conversations) ? body.conversations : (Array.isArray(body) ? body : []);
    const eligible = conversations
      .filter((conversation) => conversation && conversation.id)
      .filter((conversation) => !conversation.private && !conversation.passwordProtected);

    for (const conversation of eligible) {
      await this.publish(conversation.id, 'mi-ai-conversation', {
        title: conversation.title || 'Untitled',
        updatedAt: conversation.updated_at || conversation.updatedAt || new Date().toISOString()
      }, {
        operation: 'upsert',
        version: Number(conversation.version || lastEventVersion + 1),
        idempotencyKey: `mi-ai:${conversation.id}:${conversation.updated_at || conversation.updatedAt || ''}`
      });
    }
    return eligible.length;
  }
}
