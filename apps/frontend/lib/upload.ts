import { getFirebaseStorage } from './firebase.client';

export interface UploadProgress {
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  error?: string;
  downloadURL?: string;
}

export interface UploadFileOptions {
  file: File;
  creatorId: string;
  productId?: string; // Optional productId for organized storage
  onProgress?: (progress: UploadProgress) => void;
}

export interface FileValidationRule {
  label: string;
  maxSizeMB: number;
  mimes: string[];
  extensions: string[];
}

export type ProductType = 'ebook' | 'course' | 'community' | 'consulting' | 'template' | 'software' | 'other';

/**
 * File validation rules for supported file types
 * Used for both upload validation and file picker configuration
 */
export const FILE_VALIDATION_RULES: FileValidationRule[] = [
  {
    label: 'PDF',
    maxSizeMB: 100,
    mimes: ['application/pdf'],
    extensions: ['.pdf'],
  },
  {
    label: 'DOC',
    maxSizeMB: 100,
    mimes: ['application/msword'],
    extensions: ['.doc'],
  },
  {
    label: 'DOCX',
    maxSizeMB: 100,
    mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    extensions: ['.docx'],
  },
  {
    label: 'XLS',
    maxSizeMB: 100,
    mimes: ['application/vnd.ms-excel'],
    extensions: ['.xls'],
  },
  {
    label: 'XLSX',
    maxSizeMB: 100,
    mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    extensions: ['.xlsx'],
  },
  {
    label: 'MP4',
    maxSizeMB: 16,
    mimes: ['video/mp4'],
    extensions: ['.mp4'],
  },
  {
    label: 'JPEG',
    maxSizeMB: 5,
    mimes: ['image/jpeg'],
    extensions: ['.jpeg', '.jpg'],
  },
  {
    label: 'PNG',
    maxSizeMB: 5,
    mimes: ['image/png'],
    extensions: ['.png'],
  },
];

/**
 * Get allowed file types based on product type
 */
const PRODUCT_TYPE_FILE_RULES: Record<ProductType, string[]> = {
  ebook: ['PDF'],
  course: ['PDF', 'DOC', 'DOCX', 'MP4', 'JPEG', 'PNG'],
  community: ['PDF'], // Community rules/terms
  consulting: ['PDF'], // Consulting contracts/guides
  template: ['PDF', 'DOC', 'DOCX', 'XLS', 'XLSX'],
  software: ['PDF', 'DOC', 'DOCX', 'XLS', 'XLSX', 'MP4', 'JPEG', 'PNG'],
  other: ['PDF', 'DOC', 'DOCX', 'XLS', 'XLSX', 'MP4', 'JPEG', 'PNG'],
};

/**
 * Get file validation rules filtered by product type
 */
export function getFileRulesForProductType(productType?: ProductType): FileValidationRule[] {
  if (!productType) {
    return FILE_VALIDATION_RULES;
  }
  const allowedLabels = PRODUCT_TYPE_FILE_RULES[productType] || PRODUCT_TYPE_FILE_RULES.other;
  return FILE_VALIDATION_RULES.filter((rule) => allowedLabels.includes(rule.label));
}

/**
 * Get the accept string for file input based on product type
 */
export function getFileAcceptString(productType?: ProductType): string {
  const rules = getFileRulesForProductType(productType);
  const mimes = rules.flatMap((r) => r.mimes);
  const extensions = rules.flatMap((r) => r.extensions);
  return [...mimes, ...extensions].join(',');
}

/**
 * Get a human-readable string of supported file types
 * @param productType - Product type to filter allowed files
 * @param locale - Locale for translation (defaults to 'pt-BR')
 */
export function getSupportedFilesMessage(productType?: ProductType, locale: string = 'pt-BR'): string {
  const rules = getFileRulesForProductType(productType);

  // Group by max size
  const bySize: Record<number, string[]> = {};
  for (const rule of rules) {
    if (!bySize[rule.maxSizeMB]) {
      bySize[rule.maxSizeMB] = [];
    }
    bySize[rule.maxSizeMB].push(rule.label);
  }

  // Translations
  const isPtBR = locale.startsWith('pt');
  const supported = isPtBR ? 'Suportado' : 'Supported';
  const upTo = isPtBR ? 'até' : 'up to';

  // Build message parts
  const parts: string[] = [];
  for (const [size, labels] of Object.entries(bySize)) {
    parts.push(`${labels.join('/')} ${upTo} ${size}MB`);
  }

  return `${supported}: ${parts.join(', ')}`;
}

/**
 * Validates a file against the validation rules
 * @param file File to validate
 * @param productType Optional product type to filter allowed file types
 * @returns Matched validation rule
 * @throws Error if file is invalid
 */
export function validateFile(file: File, productType?: ProductType): FileValidationRule {
  const lowerName = file.name.toLowerCase();
  const allowedRules = getFileRulesForProductType(productType);

  const match = allowedRules.find(
    (rule) =>
      rule.mimes.includes(file.type) ||
      rule.extensions.some((ext) => lowerName.endsWith(ext)),
  );

  if (!match) {
    const allowedTypes = allowedRules.map((r) => r.label).join(', ');
    throw new Error(`Unsupported file type. Allowed: ${allowedTypes}.`);
  }

  const maxBytes = match.maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`${match.label} files must not exceed ${match.maxSizeMB}MB`);
  }

  return match;
}

/**
 * Uploads a product file to Firebase Storage in creator-specific folder
 * @param options Upload options including file, creatorId, and progress callback
 * @returns Promise resolving to the download URL
 * @throws Error if file is invalid or upload fails
 */
export async function uploadFile(options: UploadFileOptions): Promise<string> {
  const { file, creatorId, productId, onProgress } = options;

  if (!creatorId) {
    throw new Error('Creator ID is required for file upload');
  }

  // Validate the file using shared validation logic
  validateFile(file);

  // Generate unique filename with timestamp in clinic-specific folder
  // If productId is provided, organize files by entity: gendei_files/{creatorId}/{productId}/{filename}
  // Otherwise, use flat structure: gendei_files/{creatorId}/{timestamp}_{filename}
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filename = productId
    ? `gendei_files/${creatorId}/${productId}/${timestamp}_${sanitizedName}`
    : `gendei_files/${creatorId}/${timestamp}_${sanitizedName}`;

  // Create storage reference - use dynamic import
  const storage = await getFirebaseStorage();
  const { ref, uploadBytesResumable, getDownloadURL } = await import('firebase/storage');
  const storageRef = ref(storage, filename);

  // Start upload with resumable upload, use actual file content type
  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
  });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        // Calculate progress percentage
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;

        onProgress?.({
          progress,
          status: 'uploading',
        });
      },
      (error) => {
        // Handle upload errors
        onProgress?.({
          progress: 0,
          status: 'error',
          error: error.message,
        });
        reject(error);
      },
      async () => {
        // Upload completed successfully, get download URL
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          onProgress?.({
            progress: 100,
            status: 'success',
            downloadURL,
          });

          resolve(downloadURL);
        } catch (error: any) {
          onProgress?.({
            progress: 0,
            status: 'error',
            error: error.message,
          });
          reject(error);
        }
      }
    );
  });
}

/**
 * Deletes a file from Firebase Storage
 * @param fileUrl The full download URL of the file to delete
 * @returns Promise that resolves when the file is deleted
 * @throws Error if deletion fails
 */
export async function deleteFile(fileUrl: string): Promise<void> {
  if (!fileUrl) {
    throw new Error('File URL is required for deletion');
  }

  try {
    // Extract the storage path from the download URL
    // Firebase Storage URLs have format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token={token}
    const url = new URL(fileUrl);
    const pathMatch = url.pathname.match(/\/o\/(.+?)(\?|$)/);

    if (!pathMatch || !pathMatch[1]) {
      throw new Error('Invalid Firebase Storage URL');
    }

    // Decode the path (it's URL encoded)
    const storagePath = decodeURIComponent(pathMatch[1]);

    // Create a reference to the file - use dynamic import
    const storage = await getFirebaseStorage();
    const { ref, deleteObject } = await import('firebase/storage');
    const fileRef = ref(storage, storagePath);

    // Delete the file
    await deleteObject(fileRef);
  } catch (error: any) {
    // If file doesn't exist, consider it successfully deleted
    if (error.code === 'storage/object-not-found') {
      return;
    }
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}
