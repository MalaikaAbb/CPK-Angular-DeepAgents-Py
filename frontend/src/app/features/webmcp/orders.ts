/**
 * Harness-only. The WebMCP guide calls `searchOrders(status)` but never
 * defines it, so this fixed in-memory list stands in for it. Not doc code.
 * https://docs.copilotkit.ai/angular/deepagents/webmcp
 */
type OrderStatus = 'open' | 'shipped' | 'delivered';

const ORDERS: { id: string; status: OrderStatus }[] = [
  { id: 'ORD-1001', status: 'open' },
  { id: 'ORD-1002', status: 'shipped' },
  { id: 'ORD-1003', status: 'delivered' },
  { id: 'ORD-1004', status: 'open' },
];

export function searchOrders(status: OrderStatus) {
  return ORDERS.filter((order) => order.status === status);
}
