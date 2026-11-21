import { ProjectConnector } from './base.js';

export class ThreeAConnector extends ProjectConnector {
  constructor(options) {
    super({ ...options, projectId: options.projectId || '3a-mission' });
  }

  pollSync() {
    throw new Error('3A MISSION integration is blocked until trusted owner enrollment is implemented.');
  }

  publish() {
    throw new Error('3A MISSION integration is blocked until trusted owner enrollment is implemented.');
  }
}
