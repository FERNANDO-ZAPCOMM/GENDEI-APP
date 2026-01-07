/**
 * Thumbnail utilities for product images
 * - Extract first page from PDF
 * - Generate thumbnail from title
 */

// Use legacy build for better browser compatibility
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Configure PDF.js worker
// Using local worker for CSP compliance and reliability
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf/pdf.worker.min.mjs';
}

/**
 * Extract the first page of a PDF as an image
 * @param file PDF file or base64 string
 * @param options Rendering options
 * @returns Data URL of the extracted page image
 */
export async function extractPdfCover(
  file: File | string,
  options: { scale?: number; format?: 'png' | 'jpeg'; quality?: number } = {}
): Promise<string> {
  const { scale = 1.5, format = 'jpeg', quality = 0.85 } = options;

  let arrayBuffer: ArrayBuffer;

  if (typeof file === 'string') {
    // It's a base64 string
    const binaryString = atob(file);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    arrayBuffer = bytes.buffer;
  } else {
    // It's a File object
    arrayBuffer = await file.arrayBuffer();
  }

  // Load the PDF
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // Get the first page
  const page = await pdf.getPage(1);

  // Calculate dimensions
  const viewport = page.getViewport({ scale });

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not get canvas context');
  }

  // Render the page
  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  // Convert to data URL
  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
  return canvas.toDataURL(mimeType, quality);
}

/**
 * Generate a thumbnail image from product title
 * Creates a simple branded image with the title
 * @param title Product title
 * @param options Generation options
 * @returns Data URL of the generated thumbnail
 */
export function generateThumbnailFromTitle(
  title: string,
  options: {
    width?: number;
    height?: number;
    backgroundColor?: string;
    textColor?: string;
    accentColor?: string;
  } = {}
): string {
  const {
    width = 500,
    height = 500,
    backgroundColor = '#1a1a2e',
    textColor = '#ffffff',
    accentColor = '#4f46e5',
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, backgroundColor);
  gradient.addColorStop(1, '#16213e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Accent shapes
  ctx.fillStyle = accentColor;
  ctx.globalAlpha = 0.1;
  ctx.beginPath();
  ctx.arc(width * 0.8, height * 0.2, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(width * 0.2, height * 0.8, 100, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Top accent bar
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 0, width, 6);

  // Title text
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Calculate font size to fit
  const maxWidth = width * 0.8;
  const maxFontSize = 48;
  const minFontSize = 24;
  let fontSize = maxFontSize;

  // Wrap text into lines
  const words = title.split(' ');
  let lines: string[] = [];

  ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;

  // Try to fit text
  while (fontSize >= minFontSize) {
    ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
    lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    // Check if all lines fit
    const totalHeight = lines.length * fontSize * 1.3;
    if (totalHeight < height * 0.6 && lines.length <= 4) {
      break;
    }

    fontSize -= 2;
  }

  // Draw text lines
  const lineHeight = fontSize * 1.3;
  const startY = (height - (lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, index) => {
    ctx.fillText(line, width / 2, startY + index * lineHeight);
  });

  // Bottom branding
  ctx.fillStyle = textColor;
  ctx.globalAlpha = 0.5;
  ctx.font = '14px Inter, system-ui, sans-serif';
  ctx.fillText('Produto Digital', width / 2, height - 30);
  ctx.globalAlpha = 1;

  return canvas.toDataURL('image/jpeg', 0.9);
}

/**
 * Convert a data URL to a File object
 * @param dataUrl Data URL string
 * @param filename Desired filename
 * @returns File object
 */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], filename, { type: mime });
}

/**
 * Resize an image to a maximum dimension while maintaining aspect ratio
 * @param dataUrl Image data URL
 * @param maxSize Maximum width or height
 * @returns Resized image data URL
 */
export async function resizeImage(
  dataUrl: string,
  maxSize: number = 500
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions
      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }

      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

/**
 * Crop an image to a square from the center and resize to target size
 * This ensures all catalog images have consistent dimensions
 * @param dataUrl Image data URL
 * @param targetSize Target width and height (square)
 * @returns Cropped and resized image data URL
 */
export async function cropToSquare(
  dataUrl: string,
  targetSize: number = 500
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;

      // Calculate the crop area (center crop to square)
      const size = Math.min(width, height);
      const cropX = (width - size) / 2;
      const cropY = (height - size) / 2;

      // Create canvas with target size
      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Draw the cropped and resized image
      ctx.drawImage(
        img,
        cropX, cropY, size, size,  // Source: crop from center
        0, 0, targetSize, targetSize  // Destination: fill the canvas
      );

      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

/**
 * Process a thumbnail image: crop to square and resize
 * Use this for all product thumbnails to ensure consistent catalog display
 * @param dataUrl Image data URL (from upload, PDF extraction, or generation)
 * @param size Target size for the square thumbnail
 * @returns Processed thumbnail data URL
 */
export async function processThumbnail(
  dataUrl: string,
  size: number = 500
): Promise<string> {
  return cropToSquare(dataUrl, size);
}
