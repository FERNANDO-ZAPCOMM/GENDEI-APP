/**
 * Meta Catalog Sync Service
 * Syncs products from Firestore to PER-CREATOR Meta Catalogs
 *
 * Architecture:
 * - Each creator has their own Meta Catalog (created during WABA signup)
 * - Products are synced to the creator's specific catalog
 * - Catalog ID is stored in the creator's channel document
 * - Enables interactive WhatsApp product messages for all creators
 */

import { getFirestore } from 'firebase-admin/firestore';
import { Collections, Product } from '../types';

const db = getFirestore();

// Configuration
const getMetaApiVersion = () => process.env.META_API_VERSION || 'v24.0';
const getMetaBisuToken = () => process.env.META_BISU_ACCESS_TOKEN || '';

/**
 * Get the catalog ID for a specific creator from their channel document
 */
async function getCreatorCatalogId(creatorId: string): Promise<string | null> {
  try {
    const channelsRef = db.collection('creators').doc(creatorId).collection('channels');
    const activeChannel = await channelsRef.where('isActive', '==', true).limit(1).get();

    if (activeChannel.empty) {
      console.log(`No active channel found for creator ${creatorId}`);
      return null;
    }

    const channelData = activeChannel.docs[0].data();
    return channelData.catalogId || null;
  } catch (error) {
    console.error(`Error getting catalog ID for creator ${creatorId}:`, error);
    return null;
  }
}

// ============================================
// TYPES
// ============================================

interface MetaCatalogProduct {
  id?: string; // Meta's product ID (after creation)
  retailer_id: string; // Our product ID (creatorId_productId)
  name: string;
  description: string;
  availability: 'in stock' | 'out of stock';
  condition: 'new' | 'refurbished' | 'used';
  price: number; // In cents
  currency: string;
  url: string;
  image_url?: string;
  brand?: string;
  category?: string;
  // Custom labels for filtering
  custom_label_0?: string; // creatorId
  custom_label_1?: string; // productType
}

interface SyncResult {
  success: boolean;
  metaProductId?: string;
  error?: string;
}

// ============================================
// HELPERS
// ============================================

/**
 * Generate a unique retailer_id for Meta Catalog
 * Format: creatorId_productId
 */
function generateRetailerId(creatorId: string, productId: string): string {
  return `${creatorId}_${productId}`;
}

/**
 * Convert Firestore product to Meta Catalog format
 */
function toMetaCatalogProduct(
  product: Product,
  creatorId: string,
  baseUrl: string
): MetaCatalogProduct {
  // Meta Commerce API expects price as the actual value, NOT cents
  // Format: "97 BRL" for R$97.00
  // NOTE: WhatsApp SPM templates require price > 0, so we use minimum 0.01 for free products
  const rawPrice = Math.round((product.price || 0) * 100) / 100;
  const price = rawPrice > 0 ? rawPrice : 0.01; // Minimum price for Meta catalog

  // Only use thumbnailUrl for image, NOT fileUrl (which could be a PDF)
  // Use a placeholder if no valid image is available
  const defaultImage = 'https://via.placeholder.com/500x500.png?text=Digital+Product';
  let imageUrl = defaultImage;

  if (product.thumbnailUrl && !product.thumbnailUrl.endsWith('.pdf')) {
    imageUrl = product.thumbnailUrl;
  }

  return {
    retailer_id: generateRetailerId(creatorId, product.id),
    name: product.title || 'Product',
    description: product.description || product.title || 'Digital product',
    availability: product.isActive ? 'in stock' : 'out of stock',
    condition: 'new',
    price: price,
    currency: product.currency || 'BRL',
    url: `${baseUrl}/products/${product.id}`,
    image_url: imageUrl,
    brand: creatorId, // Use creatorId as brand for filtering
    category: product.type || 'digital_product',
    custom_label_0: creatorId,
    custom_label_1: product.type || 'ebook',
  };
}

// ============================================
// META CATALOG API
// ============================================

/**
 * Create a product in Meta Catalog
 */
async function createMetaProduct(product: MetaCatalogProduct, catalogId: string): Promise<SyncResult> {
  const accessToken = getMetaBisuToken();
  const apiVersion = getMetaApiVersion();

  if (!catalogId || !accessToken) {
    console.error('Meta Catalog not configured: missing catalogId or BISU_TOKEN');
    return { success: false, error: 'Meta Catalog not configured' };
  }

  // Debug: Log what we're sending
  // Meta Catalog field mapping: https://developers.facebook.com/docs/commerce-platform/catalog/fields
  const requestBody = {
    item_type: 'PRODUCT_ITEM',
    requests: [{
      method: 'CREATE',
      retailer_id: product.retailer_id,
      data: {
        id: product.retailer_id,
        title: product.name, // Meta uses 'title', not 'name'
        description: product.description,
        availability: product.availability,
        condition: product.condition,
        price: `${product.price} ${product.currency}`, // Format: "19700 BRL"
        link: product.url,
        image_link: product.image_url,
        brand: product.brand,
        google_product_category: product.category,
      },
    }],
  };
  console.log('Creating Meta product, full request:', JSON.stringify(requestBody));

  const url = `https://graph.facebook.com/${apiVersion}/${catalogId}/items_batch`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('Failed to create Meta product:', error);
      return { success: false, error: error?.error?.message || 'Failed to create product' };
    }

    const result = await response.json();
    console.log('Created Meta product response:', JSON.stringify(result));

    // Check for validation errors
    if (result.validation_status) {
      for (const status of result.validation_status) {
        if (status.errors && status.errors.length > 0) {
          console.log('Meta product validation errors:', JSON.stringify(status.errors));
        }
      }
    }

    // Extract the Meta product ID from response
    const handles = result.handles || [];
    const metaProductId = handles[0]?.id;

    return { success: true, metaProductId };
  } catch (error: any) {
    console.error('Error creating Meta product:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update a product in Meta Catalog
 */
async function updateMetaProduct(product: MetaCatalogProduct, catalogId: string): Promise<SyncResult> {
  const accessToken = getMetaBisuToken();
  const apiVersion = getMetaApiVersion();

  if (!catalogId || !accessToken) {
    return { success: false, error: 'Meta Catalog not configured' };
  }

  const url = `https://graph.facebook.com/${apiVersion}/${catalogId}/items_batch`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        item_type: 'PRODUCT_ITEM',
        requests: [{
          method: 'UPDATE',
          retailer_id: product.retailer_id,
          data: {
            id: product.retailer_id,
            title: product.name, // Meta uses 'title', not 'name'
            description: product.description,
            availability: product.availability,
            condition: product.condition,
            price: `${product.price} ${product.currency}`, // Format: "19700 BRL"
            link: product.url,
            image_link: product.image_url,
            brand: product.brand,
            google_product_category: product.category,
          },
        }],
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('Failed to update Meta product:', error);
      return { success: false, error: error?.error?.message || 'Failed to update product' };
    }

    const result = await response.json();
    console.log('Updated Meta product:', result);

    return { success: true };
  } catch (error: any) {
    console.error('Error updating Meta product:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a product from Meta Catalog
 */
async function deleteMetaProduct(retailerId: string, catalogId: string): Promise<SyncResult> {
  const accessToken = getMetaBisuToken();
  const apiVersion = getMetaApiVersion();

  if (!catalogId || !accessToken) {
    return { success: false, error: 'Meta Catalog not configured' };
  }

  const url = `https://graph.facebook.com/${apiVersion}/${catalogId}/items_batch`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        item_type: 'PRODUCT_ITEM',
        requests: [{
          method: 'DELETE',
          retailer_id: retailerId,
        }],
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('Failed to delete Meta product:', error);
      return { success: false, error: error?.error?.message || 'Failed to delete product' };
    }

    console.log('Deleted Meta product:', retailerId);
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting Meta product:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get a product from Meta Catalog by retailer_id
 */
async function getMetaProduct(retailerId: string, catalogId: string): Promise<MetaCatalogProduct | null> {
  const accessToken = getMetaBisuToken();
  const apiVersion = getMetaApiVersion();

  if (!catalogId || !accessToken) {
    return null;
  }

  const url = `https://graph.facebook.com/${apiVersion}/${catalogId}/products?filter={"retailer_id":{"eq":"${retailerId}"}}&fields=id,retailer_id,name,description,price,currency,availability`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    const products = result.data || [];

    return products.length > 0 ? products[0] : null;
  } catch (error) {
    console.error('Error fetching Meta product:', error);
    return null;
  }
}

// ============================================
// SYNC FUNCTIONS
// ============================================

/**
 * Sync a single product to Meta Catalog
 * Called when a product is created or updated
 */
export async function syncProductToCatalog(
  creatorId: string,
  productId: string
): Promise<SyncResult> {
  // Get the creator's specific catalog ID
  const catalogId = await getCreatorCatalogId(creatorId);

  if (!catalogId) {
    console.log(`No catalog configured for creator ${creatorId}, skipping sync`);
    return { success: true }; // Don't fail if not configured
  }

  try {
    // Get the product from Firestore
    const productRef = db
      .collection(Collections.CREATORS)
      .doc(creatorId)
      .collection(Collections.PRODUCTS)
      .doc(productId);

    const productDoc = await productRef.get();

    if (!productDoc.exists) {
      console.log(`Product ${productId} not found for creator ${creatorId}`);
      return { success: false, error: 'Product not found' };
    }

    const product = { id: productDoc.id, ...productDoc.data() } as Product;
    const baseUrl = process.env.FRONTEND_URL || 'https://go.zapcomm.app';
    const metaProduct = toMetaCatalogProduct(product, creatorId, baseUrl);

    // Check if product already exists in Meta Catalog
    const existingProduct = await getMetaProduct(metaProduct.retailer_id, catalogId);

    let result: SyncResult;

    if (existingProduct) {
      // Update existing product
      console.log(`Updating product ${productId} in Meta Catalog ${catalogId}`);
      result = await updateMetaProduct(metaProduct, catalogId);
    } else {
      // Create new product
      console.log(`Creating product ${productId} in Meta Catalog ${catalogId}`);
      result = await createMetaProduct(metaProduct, catalogId);
    }

    // Store Meta Catalog info on the product
    if (result.success) {
      const updateData: Record<string, any> = {
        'metaCatalog.synced': true,
        'metaCatalog.syncedAt': new Date(),
        'metaCatalog.retailerId': metaProduct.retailer_id,
        'metaCatalog.catalogId': catalogId,
        updatedAt: new Date(),
      };
      // Only set productId if we have a value
      const productIdValue = result.metaProductId || existingProduct?.id;
      if (productIdValue) {
        updateData['metaCatalog.productId'] = productIdValue;
      }
      await productRef.update(updateData);
    } else {
      await productRef.update({
        'metaCatalog.synced': false,
        'metaCatalog.lastError': result.error,
        'metaCatalog.lastAttempt': new Date(),
        updatedAt: new Date(),
      });
    }

    return result;
  } catch (error: any) {
    console.error('Error syncing product to catalog:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Remove a product from Meta Catalog
 * Called when a product is deleted
 */
export async function removeProductFromCatalog(
  creatorId: string,
  productId: string
): Promise<SyncResult> {
  // Get the creator's specific catalog ID
  const catalogId = await getCreatorCatalogId(creatorId);

  if (!catalogId) {
    return { success: true }; // Don't fail if not configured
  }

  const retailerId = generateRetailerId(creatorId, productId);
  return deleteMetaProduct(retailerId, catalogId);
}

/**
 * Sync all products for a creator
 * Useful for initial sync or bulk updates
 */
export async function syncAllProductsForCreator(creatorId: string): Promise<{
  total: number;
  synced: number;
  failed: number;
  errors: string[];
}> {
  // Get the creator's specific catalog ID
  const catalogId = await getCreatorCatalogId(creatorId);

  if (!catalogId) {
    console.log(`No catalog configured for creator ${creatorId}, skipping sync`);
    return { total: 0, synced: 0, failed: 0, errors: ['No catalog configured for creator'] };
  }

  try {
    const productsRef = db
      .collection(Collections.CREATORS)
      .doc(creatorId)
      .collection(Collections.PRODUCTS);

    const snapshot = await productsRef.where('isActive', '==', true).get();

    const results = {
      total: snapshot.docs.length,
      synced: 0,
      failed: 0,
      errors: [] as string[],
    };

    console.log(`Syncing ${results.total} products for creator ${creatorId}`);

    for (const doc of snapshot.docs) {
      const result = await syncProductToCatalog(creatorId, doc.id);

      if (result.success) {
        results.synced++;
      } else {
        results.failed++;
        if (result.error) {
          results.errors.push(`${doc.id}: ${result.error}`);
        }
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`Sync complete for creator ${creatorId}:`, results);
    return results;
  } catch (error: any) {
    console.error('Error syncing all products:', error);
    return {
      total: 0,
      synced: 0,
      failed: 0,
      errors: [error.message],
    };
  }
}

/**
 * Sync all products for all creators
 * Called by the scheduled function
 * Note: With per-creator catalogs, this syncs each creator to their own catalog
 */
export async function syncAllProducts(): Promise<{
  creators: number;
  totalProducts: number;
  synced: number;
  failed: number;
}> {
  try {
    // Get all creators
    const creatorsSnapshot = await db.collection(Collections.CREATORS).get();

    const results = {
      creators: creatorsSnapshot.docs.length,
      totalProducts: 0,
      synced: 0,
      failed: 0,
    };

    for (const creatorDoc of creatorsSnapshot.docs) {
      const creatorId = creatorDoc.id;
      const creatorResult = await syncAllProductsForCreator(creatorId);

      results.totalProducts += creatorResult.total;
      results.synced += creatorResult.synced;
      results.failed += creatorResult.failed;
    }

    console.log('Full catalog sync complete:', results);
    return results;
  } catch (error: any) {
    console.error('Error in full catalog sync:', error);
    throw error;
  }
}

/**
 * Get catalog ID for a specific creator (for use in WhatsApp messages)
 */
export async function getCreatorCatalog(creatorId: string): Promise<string | null> {
  return getCreatorCatalogId(creatorId);
}

/**
 * Get retailer_id for a product (for WhatsApp SPM/MPM messages)
 */
export function getProductRetailerId(creatorId: string, productId: string): string {
  return generateRetailerId(creatorId, productId);
}
