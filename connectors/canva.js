import { ProjectConnector } from './base.js';

export class CanvaConnector extends ProjectConnector {
  constructor(options) {
    super({ ...options, projectId: options.projectId || 'canva-pro' });
    this.applicationUrl = options.applicationUrl.replace(/\/$/, '');
  }

  async pollOrders(adminToken) {
    const response = await fetch(`${this.applicationUrl}/api/admin/orders`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (!response.ok) throw new Error(`CANVA order synchronization read failed (${response.status}).`);
    const body = await response.json();
    const orders = Array.isArray(body.orders) ? body.orders : [];

    for (const order of orders) {
      await this.publish(order.orderId, 'canva-order-status', {
        planName: order.planName || order.selectedPlan || null,
        status: order.status,
        expiryDate: order.expiryDate || null,
        updatedAt: order.updatedAt || order.activationDate || new Date().toISOString()
      }, {
        operation: 'upsert',
        version: Number(order.version || 1),
        idempotencyKey: `canva:${order.orderId}:${order.status}:${order.updatedAt || order.expiryDate || ''}`
      });
    }
    return orders.length;
  }
}
