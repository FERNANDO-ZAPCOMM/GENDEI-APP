import { getFirestore, Query } from 'firebase-admin/firestore';
import {
  Order,
  OrderStatus,
  PaymentStatus,
  PaginationParams,
  PaginatedResponse,
  Collections,
} from '../types';

const db = getFirestore();

export interface OrderFilters {
  creatorId?: string;
  startDate?: Date;
  endDate?: Date;
  paymentStatus?: PaymentStatus;
  status?: OrderStatus;
  searchTerm?: string;
}

export interface OrderStats {
  totalRevenue: number;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  averageOrderValue: number;
}

/**
 * Get orders collection reference for a creator
 * Schema v2: creators/{creatorId}/orders
 */
function getOrdersCollection(creatorId: string) {
  return db.collection(Collections.CREATORS).doc(creatorId).collection(Collections.ORDERS);
}

/**
 * Get all orders with pagination support
 */
export async function getOrders(
  filters: OrderFilters,
  pagination: PaginationParams = {}
): Promise<PaginatedResponse<Order>> {
  const creatorId = filters.creatorId;
  if (!creatorId) {
    throw new Error('creatorId is required');
  }
  const ordersCollection = getOrdersCollection(creatorId);
  const limit = pagination.limit || 20;

  let query: Query = ordersCollection;

  // Filter by payment status
  if (filters.paymentStatus) {
    query = query.where('paymentStatus', '==', filters.paymentStatus);
  }

  // Filter by order status
  if (filters.status) {
    query = query.where('status', '==', filters.status);
  }

  // Filter by date range
  if (filters.startDate) {
    query = query.where('createdAt', '>=', filters.startDate);
  }
  if (filters.endDate) {
    query = query.where('createdAt', '<=', filters.endDate);
  }

  // Apply ordering
  query = query.orderBy('createdAt', 'desc').orderBy('__name__', 'desc');

  // Apply cursor if provided
  if (pagination.cursor) {
    const cursorDoc = await getOrdersCollection(creatorId).doc(pagination.cursor).get();
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  // Fetch one extra document to check if there are more results
  query = query.limit(limit + 1);

  const snapshot = await query.get();
  const docs = snapshot.docs;

  const hasMore = docs.length > limit;
  const orders = docs.slice(0, limit).map((doc) => {
    const data = doc.data();
    // Convert Firestore Timestamps to ISO strings
    const createdAt = data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : data.createdAt;
    const updatedAt = data.updatedAt?.toDate
      ? data.updatedAt.toDate().toISOString()
      : data.updatedAt;
    return {
      ...data,
      id: doc.id,  // Include document ID
      creatorId: creatorId,  // Include creatorId
      createdAt,
      updatedAt,
    } as Order;
  });
  const nextCursor = hasMore ? docs[limit - 1]?.id ?? null : null;

  // Apply search filter in memory (Firestore doesn't support text search)
  let filteredOrders = orders;
  if (filters.searchTerm) {
    const searchLower = filters.searchTerm.toLowerCase();
    filteredOrders = orders.filter(
      (order) =>
        order.customerName?.toLowerCase().includes(searchLower) ||
        order.customerEmail?.toLowerCase().includes(searchLower) ||
        order.customerPhone?.includes(searchLower) ||
        order.id.toLowerCase().includes(searchLower)
    );
  }

  return {
    data: filteredOrders,
    nextCursor,
    hasMore,
  };
}

/**
 * Get a single order
 */
export async function getOrder(
  creatorId: string,
  orderId: string
): Promise<Order | null> {
  const orderRef = getOrdersCollection(creatorId).doc(orderId);

  const doc = await orderRef.get();
  if (!doc.exists) {
    return null;
  }

  const data = doc.data();
  if (!data) {
    return null;
  }

  // Convert Firestore Timestamps
  const createdAt = data.createdAt?.toDate
    ? data.createdAt.toDate().toISOString()
    : data.createdAt;
  const updatedAt = data.updatedAt?.toDate
    ? data.updatedAt.toDate().toISOString()
    : data.updatedAt;

  return {
    ...data,
    id: orderId,
    creatorId,
    createdAt,
    updatedAt,
  } as Order;
}

/**
 * Update an order
 */
export async function updateOrder(
  creatorId: string,
  orderId: string,
  updateData: Partial<Order>
): Promise<Order> {
  const orderRef = getOrdersCollection(creatorId).doc(orderId);

  const doc = await orderRef.get();
  if (!doc.exists) {
    throw new Error('Order not found');
  }

  const existingOrder = doc.data();

  const updatedOrder = {
    ...existingOrder,
    ...updateData,
    id: orderId,
    creatorId,
    updatedAt: new Date(),
  };

  await orderRef.set(updatedOrder);
  return updatedOrder as Order;
}

/**
 * Get order statistics for a creator
 */
export async function getOrderStats(filters: OrderFilters): Promise<OrderStats> {
  // For stats, we need all orders
  const result = await getOrders(filters, { limit: 10000 });
  const orders = result.data;

  // Handle both 'paid' and 'completed' as successful payment statuses
  // (legacy orders may use 'completed' while new schema uses 'paid')
  const completedOrders = orders.filter(
    (o) => o.paymentStatus === PaymentStatus.PAID ||
           o.paymentStatus === 'completed' as PaymentStatus
  );
  const pendingOrders = orders.filter(
    (o) => o.paymentStatus === PaymentStatus.PENDING
  );

  const totalRevenue = completedOrders.reduce(
    (sum, order) => sum + (order.totalAmount || 0),
    0
  );

  const averageOrderValue =
    completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

  return {
    totalRevenue,
    totalOrders: orders.length,
    completedOrders: completedOrders.length,
    pendingOrders: pendingOrders.length,
    averageOrderValue,
  };
}
