import { getFirestore } from 'firebase-admin/firestore';
import {
  Product,
  ProductType,
  Collections,
} from '../types';

const db = getFirestore();

// Maximum number of active products allowed per creator
const MAX_ACTIVE_PRODUCTS = 5;

/**
 * Get products collection reference for a creator
 * Schema v2: creators/{creatorId}/products
 */
function getProductsCollection(creatorId: string) {
  return db.collection(Collections.CREATORS).doc(creatorId).collection(Collections.PRODUCTS);
}

/**
 * Count active products for a creator
 */
export async function countActiveProducts(creatorId: string): Promise<number> {
  const productsCollection = getProductsCollection(creatorId);
  const snapshot = await productsCollection.where('isActive', '==', true).count().get();
  return snapshot.data().count;
}

/**
 * Get product limits info for a creator
 */
export async function getProductLimits(creatorId: string): Promise<{
  activeCount: number;
  maxActive: number;
  canCreateActive: boolean;
}> {
  const activeCount = await countActiveProducts(creatorId);
  return {
    activeCount,
    maxActive: MAX_ACTIVE_PRODUCTS,
    canCreateActive: activeCount < MAX_ACTIVE_PRODUCTS,
  };
}

/**
 * Create a new product
 */
export async function createProduct(
  productData: Partial<Product>
): Promise<Product> {
  const creatorId = productData.creatorId!;
  const willBeActive = productData.isActive ?? true;

  // Check active product limit if creating an active product
  if (willBeActive) {
    const activeCount = await countActiveProducts(creatorId);
    if (activeCount >= MAX_ACTIVE_PRODUCTS) {
      throw new Error(`Limite de ${MAX_ACTIVE_PRODUCTS} produtos ativos atingido. Desative um produto existente ou crie este como inativo.`);
    }
  }

  const productsCollection = getProductsCollection(creatorId);
  const newProductRef = productsCollection.doc();

  const product: Product = {
    id: newProductRef.id,
    creatorId: productData.creatorId!,
    title: productData.title!,
    description: productData.description!,
    price: productData.price!,
    currency: productData.currency || 'BRL',
    type: productData.type || ProductType.EBOOK,
    isActive: productData.isActive ?? true,
    salesCount: 0,
    totalRevenue: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Only add optional fields if they have values (Firestore doesn't accept undefined)
  if (productData.fileUrl) product.fileUrl = productData.fileUrl;
  if (productData.thumbnailUrl) product.thumbnailUrl = productData.thumbnailUrl;
  // Delivery configuration for free products
  if (productData.delivery) product.delivery = productData.delivery;
  // AI Sales Agent fields
  if (productData.mainBenefit) product.mainBenefit = productData.mainBenefit;
  if (productData.targetAudience) product.targetAudience = productData.targetAudience;
  if (productData.tone) product.tone = productData.tone;
  if (productData.objections) product.objections = productData.objections;
  if (productData.objectionResponses) product.objectionResponses = productData.objectionResponses;
  // RAG context for AI conversations (stores document analysis data)
  if (productData.ragContext) product.ragContext = productData.ragContext;

  await newProductRef.set(product);
  return product;
}

/**
 * Get all products for a creator
 */
export async function getProducts(creatorId: string): Promise<Product[]> {
  const productsCollection = getProductsCollection(creatorId);
  const snapshot = await productsCollection.get();

  // Include the document ID in case it's not stored in the data
  return snapshot.docs.map((doc) => ({
    ...doc.data(),
    id: doc.id, // Ensure document ID is always included
  } as Product));
}

/**
 * Get a single product
 */
export async function getProduct(
  creatorId: string,
  productId: string
): Promise<Product | null> {
  const productRef = getProductsCollection(creatorId).doc(productId);
  const doc = await productRef.get();

  if (!doc.exists) {
    return null;
  }

  return {
    ...doc.data(),
    id: doc.id, // Ensure document ID is always included
  } as Product;
}

/**
 * Update a product
 */
export async function updateProduct(
  creatorId: string,
  productId: string,
  updates: Partial<Product>
): Promise<Product> {
  const existing = await getProduct(creatorId, productId);
  if (!existing) {
    throw new Error('Product not found or access denied');
  }

  // Check limit when activating an inactive product
  const isActivating = updates.isActive === true && existing.isActive === false;
  if (isActivating) {
    const activeCount = await countActiveProducts(creatorId);
    if (activeCount >= MAX_ACTIVE_PRODUCTS) {
      throw new Error(`Limite de ${MAX_ACTIVE_PRODUCTS} produtos ativos atingido. Desative um produto existente primeiro.`);
    }
  }

  const productRef = getProductsCollection(creatorId).doc(productId);

  const updateData = {
    ...updates,
    updatedAt: new Date(),
  };

  await productRef.set(updateData, { merge: true });

  const updated = await productRef.get();
  return updated.data() as Product;
}

/**
 * Delete a product
 */
export async function deleteProduct(
  creatorId: string,
  productId: string
): Promise<void> {
  const existing = await getProduct(creatorId, productId);
  if (!existing) {
    throw new Error('Product not found or access denied');
  }

  const productRef = getProductsCollection(creatorId).doc(productId);
  await productRef.delete();
}
