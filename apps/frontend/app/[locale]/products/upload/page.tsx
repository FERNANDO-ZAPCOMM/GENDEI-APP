'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useCreator } from '@/hooks/use-creator';
import { useAuth } from '@/hooks/use-auth';
import { Package, Loader2 } from 'lucide-react';
import { uploadFile, type UploadProgress } from '@/lib/upload';

const productSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.number().min(0, 'Price must be positive'),
  productFile: z.any().refine((file) => file !== undefined && file !== null, {
    message: 'Product file is required',
  }),
});

type ProductForm = z.infer<typeof productSchema>;

export default function UploadProductPage() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split('/')[1];
  const { currentCreator } = useCreator();
  const { getIdToken } = useAuth();

  const [loading, setLoading] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      price: 99.0,
    },
  });

  const title = watch('title');

  // Generate WhatsApp link
  const generateWhatsAppLink = () => {
    if (currentCreator && title) {
      const phone = currentCreator.phoneNumber || '5599xxx';
      const text = encodeURIComponent(`product`);
      return `wa.me/${phone}?text=${text}`;
    }
    return 'wa.me/5599xxx?text=product';
  };

  const handleProductFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setValue('productFile', file, { shouldValidate: true });
    }
  };

  const onSubmit = async (data: ProductForm) => {
    try {
      setLoading(true);

      // Upload product file to Firebase Storage
      let fileUrl = '';
      if (data.productFile) {
        if (!currentCreator?.id) {
          throw new Error('User not authenticated');
        }

        toast.info('Uploading file...');
        fileUrl = await uploadFile({
          file: data.productFile,
          creatorId: currentCreator.id,
          onProgress: (progress: UploadProgress) => {
            if (progress.status === 'uploading') {
              toast.info(`uploading... ${Math.round(progress.progress)}%`);
            }
          },
        });
        toast.success('File uploaded successfully!');
      } else {
        throw new Error('Please select a file to upload');
      }

      const link = generateWhatsAppLink();

      // Get auth token
      const token = await getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Save product to Firestore via backend API
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          creatorId: currentCreator?.id,
          title: data.title,
          description: data.description,
          price: data.price,
          currency: 'BRL',
          productType: 'ebook',
          deliveryMethod: 'download_link',
          fileUrl,
          whatsappLink: link,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to upload product');
      }

      setWhatsappLink(link);
      toast.success('Product uploaded successfully! 🎉');

      // Redirect to dashboard after successful upload
      setTimeout(() => {
        router.push(`/${locale}/dashboard`);
      }, 1500);
    } catch (error: any) {
      console.error('Product upload error:', error);
      toast.error(error.message || 'Failed to upload product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-6xl">
        {/* Left: Form */}
        <div className="bg-card rounded-lg border shadow-sm p-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Upload Your Product
          </h1>
          <p className="text-muted-foreground mb-6">
            Add your digital product and start selling on WhatsApp
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Product Title */}
            <div>
              <Label htmlFor="title">Product Title</Label>
              <Input
                id="title"
                placeholder="e.g., 30-Day Fitness Challenge"
                {...register('title')}
                className="mt-1"
              />
              {errors.title && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.title.message}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What's included in this product?"
                {...register('description')}
                className="mt-1 min-h-[100px]"
              />
              {errors.description && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.description.message}
                </p>
              )}
            </div>

            {/* Price */}
            <div>
              <Label htmlFor="price">Price</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  R$
                </span>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  placeholder="99.00"
                  {...register('price', { valueAsNumber: true })}
                  className="pl-10"
                />
              </div>
              {errors.price && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.price.message}
                </p>
              )}
            </div>

            {/* Product File */}
            <div>
              <Label htmlFor="productFile">Product File</Label>
              <input
                type="file"
                id="productFile"
                onChange={handleProductFileChange}
                className={`mt-1 block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 ${
                  errors.productFile ? 'border-red-500' : ''
                }`}
              />
              {selectedFile && (
                <p className="text-sm text-green-600 mt-1">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
              {errors.productFile && (
                <p className="text-red-500 text-sm mt-1 font-medium">
                  {errors.productFile.message as string}
                </p>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 py-3"
              >
                {loading && <Loader2 className="animate-spin" />}
                {loading ? 'Uploading...' : 'Save Product'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/${locale}/dashboard`)}
                className="px-8"
              >
                Go to Dashboard
              </Button>
            </div>
          </form>
        </div>

        {/* Right: Preview */}
        <div className="bg-card rounded-lg border shadow-sm p-8 flex flex-col items-center justify-center">
          <div className="bg-muted/50 rounded-xl p-8 w-full">
            <div className="flex justify-center mb-6">
              <Package className="w-24 h-24 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-center mb-4 text-foreground">Preview</h2>
            <p className="text-center text-muted-foreground mb-6">
              Your product will appear here
            </p>

            {whatsappLink ? (
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm font-medium mb-2 text-foreground">WhatsApp Link:</p>
                <code className="block text-xs bg-background rounded p-2 break-all text-foreground">
                  {whatsappLink}
                </code>
              </div>
            ) : (
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm font-medium mb-2 text-foreground">WhatsApp Link:</p>
                <code className="block text-xs bg-background rounded p-2 text-foreground">
                  {generateWhatsAppLink()}
                </code>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
