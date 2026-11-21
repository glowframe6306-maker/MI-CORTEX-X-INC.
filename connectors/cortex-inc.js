import { ProjectConnector } from './base.js';

export class CortexIncConnector extends ProjectConnector {
  constructor(options) {
    super({ ...options, projectId: options.projectId || 'mi-cortex-x-inc' });
    this.applicationUrl = options.applicationUrl.replace(/\/$/, '');
  }

  async pollPublicOrders(adminCookie) {
    const response = await fetch(`${this.applicationUrl}/api/site-admin/orders`, {
      headers: adminCookie ? { Cookie: adminCookie } : {}
    });
    if (!response.ok) throw new Error(`MI CORTEX order synchronization read failed (${response.status}).`);
    const body = await response.json();
    const orders = Array.isArray(body.orders) ? body.orders : [];

    for (const order of orders) {
      await this.publish(order.id, 'cortex-inc-order-status', {
        itemName: order.itemName || null,
        status: order.status || null,
        updatedAt: order.updated_at || order.updatedAt || new Date().toISOString()
      }, {
        operation: 'upsert',
        version: Number(order.version || 1),
        idempotencyKey: `cortex-inc:${order.id}:${order.status}:${order.updated_at || ''}`
      });
    }
    return orders.length;
  }
}
