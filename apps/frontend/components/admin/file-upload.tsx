'use client';

import { useCallback, useState, useImperativeHandle, forwardRef, type DragEvent, useMemo, useEffect } from 'react';
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';

import { uploadFile, deleteFile, UploadProgress, validateFile, getFileAcceptString, getSupportedFilesMessage, ProductType } from '@/lib/upload';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface CircularProgressProps {
  progress: number;
}

const CircularProgress = ({ progress }: CircularProgressProps) => {
  const radius = 18;
  const normalizedProgress = Math.max(0, Math.min(progress, 100));
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (normalizedProgress / 100) * circumference;

  return (
    <svg
      className="h-12 w-12 text-muted-foreground"
      viewBox="0 0 48 48"
      role="img"
      aria-hidden="true"
    >
      <circle
        className="text-muted-foreground/20"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
        cx="24"
        cy="24"
        r={radius}
      />
      <circle
        className="text-primary transition-[stroke-dashoffset] duration-200 ease-out"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        cx="24"
        cy="24"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
      />
    </svg>
  );
};

interface FileUploadProps {
  onUploadComplete: (url: string) => void;
  onUploadError?: (error: string) => void;
  onFileSelect?: (file: File | null) => void;
  onUploadStateChange?: (isUploading: boolean) => void;
  currentFileUrl?: string;
  disabled?: boolean;
  creatorId: string;
  deferUpload?: boolean;
  showCurrentFilePreview?: boolean; // Whether to show image preview for current file (default: true)
  productType?: ProductType; // Filter allowed file types based on product type
}

export interface FileUploadRef {
  uploadFile: () => Promise<string | null>;
  hasSelectedFile: () => boolean;
}

export const FileUpload = forwardRef<FileUploadRef, FileUploadProps>(
  (
    {
      onUploadComplete,
      onUploadError,
      onFileSelect,
      onUploadStateChange,
      currentFileUrl,
      disabled = false,
      creatorId,
      deferUpload = false,
      showCurrentFilePreview = true,
      productType,
    },
    ref
  ) => {
    const t = useTranslations();
    const locale = useLocale();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
      progress: 0,
      status: 'idle',
    });
    const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = useCallback(
    (file: File | null) => {
      if (!file) {
        setSelectedFile(null);
        onFileSelect?.(null);
        return;
      }

      // Use shared validation logic with product type filtering
      try {
        const match = validateFile(file, productType);
        setSelectedFile(file);
        setUploadProgress({ progress: 0, status: 'idle' });
        onFileSelect?.(file);
      } catch (error) {
        if (error instanceof Error) {
          onUploadError?.(error.message);
        } else {
          onUploadError?.(t('products.uploadError'));
        }
      }
    },
    [onFileSelect, onUploadError, t, productType],
  );

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      // Delete the old file before uploading the new one (if updating)
      if (currentFileUrl) {
        try {
          await deleteFile(currentFileUrl);
        } catch (error) {
          console.warn('Failed to delete old file:', error);
          // Continue with upload even if delete fails
        }
      }

      const downloadURL = await uploadFile({
        file: selectedFile,
        creatorId,
        onProgress: setUploadProgress,
      });

      onUploadComplete(downloadURL);
    } catch (error: any) {
      onUploadError?.(error.message || 'Upload failed');
    }
  };

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  }, [handleFileSelect]);

  const handleClear = () => {
    setSelectedFile(null);
    setUploadProgress({ progress: 0, status: 'idle' });
  };

  // Expose upload methods to parent via ref
  useImperativeHandle(ref, () => ({
    uploadFile: async () => {
      if (!selectedFile) return null;

      try {
        // Delete the old file before uploading the new one (if updating)
        if (currentFileUrl) {
          try {
            await deleteFile(currentFileUrl);
          } catch (error) {
            console.warn('Failed to delete old file:', error);
          }
        }

        const downloadURL = await uploadFile({
          file: selectedFile,
          creatorId,
          onProgress: setUploadProgress,
        });

        onUploadComplete(downloadURL);
        return downloadURL;
      } catch (error: any) {
        const errorMessage = error.message || 'Upload failed';
        onUploadError?.(errorMessage);
        setUploadProgress({ progress: 0, status: 'error', error: errorMessage });
        throw error;
      }
    },
    hasSelectedFile: () => !!selectedFile,
  }));

  const isUploading = uploadProgress.status === 'uploading';
  const isSuccess = uploadProgress.status === 'success';
  const isError = uploadProgress.status === 'error';

  // Notify parent about upload state changes
  useEffect(() => {
    onUploadStateChange?.(isUploading);
  }, [isUploading, onUploadStateChange]);

  // Check if current file is an image
  // Support both direct URLs and Firebase/cloud storage URLs with token parameters
  const isCurrentFileImage = currentFileUrl && (
    currentFileUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i) ||
    currentFileUrl.includes('image') ||
    currentFileUrl.includes('%2Fimages%2F') || // Firebase encoded path
    currentFileUrl.match(/\/images\//i)
  );

  // Create preview URL for selected image (only for reasonably-sized images < 5MB)
  const MAX_PREVIEW_SIZE = 5 * 1024 * 1024; // 5MB
  const isSelectedImage = selectedFile?.type.startsWith('image/');
  const isSelectedFileTooLargeForPreview =
    !!selectedFile && isSelectedImage && selectedFile.size >= MAX_PREVIEW_SIZE;
  const selectedFilePreview = useMemo(() => {
    if (!selectedFile || !isSelectedImage || isSelectedFileTooLargeForPreview) {
      return null;
    }
    return URL.createObjectURL(selectedFile);
  }, [isSelectedFileTooLargeForPreview, isSelectedImage, selectedFile]);

  useEffect(() => {
    return () => {
      if (selectedFilePreview) {
        URL.revokeObjectURL(selectedFilePreview);
      }
    };
  }, [selectedFilePreview]);

  return (
    <div className="space-y-4">
      <Label>{t('products.pdfFileLabel')}</Label>

      {/* Current file display with optional image preview */}
      {currentFileUrl && !selectedFile && (
        <div className="space-y-3">
          {showCurrentFilePreview && isCurrentFileImage && (
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted border">
              <img
                src={currentFileUrl}
                alt="Current product"
                className="w-full h-full object-contain"
                loading="lazy"
                onError={(e) => {
                  // Hide image if it fails to load
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-700 flex-1 font-medium font-sans">
              {t('products.currentFileUploaded')}
            </span>
            <a
              href={currentFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              {t('products.view')}
            </a>
          </div>
        </div>
      )}

      {/* Drop zone */}
      {!selectedFile && !isSuccess && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50',
            disabled && 'opacity-50 pointer-events-none'
          )}
        >
          <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2 font-sans">
            {t('products.dragDropPdf')}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = getFileAcceptString(productType);
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                handleFileSelect(file || null);
              };
              input.click();
            }}
            disabled={disabled}
          >
            {t('products.browseFiles')}
          </Button>
          <p className="text-xs text-muted-foreground mt-2 font-sans">
            {getSupportedFilesMessage(productType, locale)}
          </p>
        </div>
      )}

      {/* Selected file preview */}
      {selectedFile && !isSuccess && (
        <div className="space-y-3">
          {/* Image preview for selected file (only if small enough) */}
          {selectedFilePreview && (
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted border">
              <img
                src={selectedFilePreview}
                alt="Selected product preview"
                className="w-full h-full object-contain"
              />
              <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-md shadow-sm">
                {deferUpload ? t('products.willUploadOnSave') : t('products.readyToUpload')}
              </div>
            </div>
          )}

          {/* Message for large images */}
          {isSelectedFileTooLargeForPreview && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md text-center">
              <p className="text-sm text-blue-700">
                {t('products.imageTooLargeForPreview')}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
            <File className="w-8 h-8 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate font-sans">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground font-sans">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            {!isUploading && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={disabled}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Progress indicators */}
          {isUploading && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-sans text-center" aria-live="polite">
                {t('products.uploadingProgress', {
                  progress: Math.round(uploadProgress.progress),
                })}
              </p>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error message */}
          {isError && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
              <AlertCircle className="w-4 h-4" />
              <p className="text-sm">{uploadProgress.error}</p>
            </div>
          )}

          {/* Upload button - only show if not deferring upload */}
          {!deferUpload && !isUploading && !isError && (
            <Button
              type="button"
              onClick={handleUpload}
              disabled={disabled}
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              {t('products.uploadFile')}
            </Button>
          )}

          {/* Retry button */}
          {!deferUpload && isError && (
            <Button
              type="button"
              onClick={handleUpload}
              disabled={disabled}
              variant="destructive"
              className="w-full"
            >
              {t('products.retryUpload')}
            </Button>
          )}
        </div>
      )}

      {/* Success state */}
      {isSuccess && (
        <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-md">
          <CheckCircle className="w-4 h-4" />
          <p className="text-sm">{t('products.fileUploadedSuccess')}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={disabled}
            className="ml-auto"
          >
            {t('products.uploadAnother')}
          </Button>
        </div>
      )}
    </div>
  );
});

FileUpload.displayName = 'FileUpload';
