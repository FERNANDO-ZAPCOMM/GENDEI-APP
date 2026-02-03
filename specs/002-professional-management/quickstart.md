# Quickstart: Professional Management

**Feature**: 002-professional-management
**Date**: 2026-02-04

---

## Prerequisites

- Completed 001-clinic-onboarding setup
- Firebase Storage configured
- TanStack Query installed

---

## Installation

### 1. Install Additional Dependencies

```bash
cd apps/web
npm install @tanstack/react-query react-dropzone
```

### 2. Configure TanStack Query

```typescript
// apps/web/src/app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

---

## Code Implementation

### 1. Professional Types

```typescript
// apps/web/src/types/professional.ts
import { Timestamp } from 'firebase/firestore';

export const PROFESSIONAL_SPECIALTIES = [
  'general_practitioner',
  'dentist',
  'dermatologist',
  'cardiologist',
  'orthopedist',
  'gynecologist',
  'pediatrician',
  'ophthalmologist',
  'psychiatrist',
  'psychologist',
  'physiotherapist',
  'nutritionist',
  'endocrinologist',
  'urologist',
  'neurologist',
  'otolaryngologist',
  'veterinarian',
  'aesthetician',
  'nurse',
  'other',
] as const;

export type ProfessionalSpecialty = typeof PROFESSIONAL_SPECIALTIES[number];

export interface TimeRange {
  from: string;
  to: string;
}

export interface WorkingHours {
  [day: number]: {
    ranges: TimeRange[];
  };
}

export interface Professional {
  id: string;
  clinicId: string;
  name: string;
  email: string;
  phone: string;
  specialty: ProfessionalSpecialty;
  bio?: string;
  photoUrl?: string;
  photoPath?: string;
  appointmentDuration: number;
  consultationPrice: number;
  workingDays: number[];
  workingHours: WorkingHours;
  active: boolean;
  deactivatedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const SPECIALTY_LABELS: Record<ProfessionalSpecialty, string> = {
  general_practitioner: 'Clínico Geral',
  dentist: 'Dentista',
  dermatologist: 'Dermatologista',
  cardiologist: 'Cardiologista',
  orthopedist: 'Ortopedista',
  gynecologist: 'Ginecologista',
  pediatrician: 'Pediatra',
  ophthalmologist: 'Oftalmologista',
  psychiatrist: 'Psiquiatra',
  psychologist: 'Psicólogo(a)',
  physiotherapist: 'Fisioterapeuta',
  nutritionist: 'Nutricionista',
  endocrinologist: 'Endocrinologista',
  urologist: 'Urologista',
  neurologist: 'Neurologista',
  otolaryngologist: 'Otorrinolaringologista',
  veterinarian: 'Veterinário(a)',
  aesthetician: 'Esteticista',
  nurse: 'Enfermeiro(a)',
  other: 'Outro',
};

export const DURATION_OPTIONS = [
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 45, label: '45 minutos' },
  { value: 60, label: '1 hora' },
  { value: 90, label: '1h 30min' },
  { value: 120, label: '2 horas' },
];
```

### 2. API Client Functions

```typescript
// apps/web/src/lib/api/professionals.ts
import { auth } from '@/lib/firebase';
import { Professional } from '@/types/professional';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/gendei-dev/us-central1/api';

async function getAuthHeaders() {
  const token = await auth.currentUser?.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export interface ListProfessionalsParams {
  specialty?: string;
  active?: boolean;
  search?: string;
  limit?: number;
  cursor?: string;
}

export interface ListProfessionalsResponse {
  professionals: Professional[];
  nextCursor?: string;
  hasMore: boolean;
  total?: number;
}

export async function listProfessionals(params: ListProfessionalsParams = {}): Promise<ListProfessionalsResponse> {
  const searchParams = new URLSearchParams();
  if (params.specialty) searchParams.set('specialty', params.specialty);
  if (params.active !== undefined) searchParams.set('active', String(params.active));
  if (params.search) searchParams.set('search', params.search);
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.cursor) searchParams.set('cursor', params.cursor);

  const response = await fetch(`${API_URL}/professionals?${searchParams}`, {
    headers: await getAuthHeaders(),
  });

  if (!response.ok) throw new Error('Failed to fetch professionals');
  return response.json();
}

export async function getProfessional(id: string): Promise<Professional> {
  const response = await fetch(`${API_URL}/professionals/${id}`, {
    headers: await getAuthHeaders(),
  });

  if (!response.ok) throw new Error('Failed to fetch professional');
  return response.json();
}

export async function createProfessional(data: Omit<Professional, 'id' | 'clinicId' | 'createdAt' | 'updatedAt'>): Promise<Professional> {
  const response = await fetch(`${API_URL}/professionals`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create professional');
  }
  return response.json();
}

export async function updateProfessional(id: string, data: Partial<Professional>): Promise<Professional> {
  const response = await fetch(`${API_URL}/professionals/${id}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) throw new Error('Failed to update professional');
  return response.json();
}

export async function deleteProfessional(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/professionals/${id}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });

  if (!response.ok) throw new Error('Failed to delete professional');
}

export async function getPhotoUploadUrl(professionalId: string, contentType: string) {
  const response = await fetch(`${API_URL}/professionals/${professionalId}/photo-upload-url`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ contentType }),
  });

  if (!response.ok) throw new Error('Failed to get upload URL');
  return response.json();
}
```

### 3. TanStack Query Hooks

```typescript
// apps/web/src/hooks/useProfessionals.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api/professionals';

export function useProfessionals(params: api.ListProfessionalsParams = {}) {
  return useQuery({
    queryKey: ['professionals', params],
    queryFn: () => api.listProfessionals(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProfessional(id: string | undefined) {
  return useQuery({
    queryKey: ['professional', id],
    queryFn: () => api.getProfessional(id!),
    enabled: !!id,
  });
}

export function useCreateProfessional() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createProfessional,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
    },
  });
}

export function useUpdateProfessional() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<api.Professional> }) =>
      api.updateProfessional(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
      queryClient.invalidateQueries({ queryKey: ['professional', id] });
    },
  });
}

export function useDeleteProfessional() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteProfessional,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
    },
  });
}
```

### 4. Photo Upload Component

```typescript
// apps/web/src/components/professionals/PhotoUpload.tsx
'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, X } from 'lucide-react';
import { resizeImage } from '@/lib/image';
import { cn } from '@/lib/utils';

interface Props {
  currentUrl?: string;
  onUpload: (file: Blob) => Promise<void>;
  onRemove?: () => void;
  disabled?: boolean;
}

export function PhotoUpload({ currentUrl, onUpload, onRemove, disabled }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    try {
      setUploading(true);
      const resized = await resizeImage(file, 400);
      setPreview(URL.createObjectURL(resized));
      await onUpload(resized);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
    disabled: disabled || uploading,
  });

  const displayUrl = preview || currentUrl;
  const initials = 'AB'; // Replace with actual name initials

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        {...getRootProps()}
        className={cn(
          'relative cursor-pointer',
          isDragActive && 'opacity-70',
          (disabled || uploading) && 'cursor-not-allowed opacity-50'
        )}
      >
        <input {...getInputProps()} />
        <Avatar className="h-32 w-32">
          {displayUrl ? (
            <AvatarImage src={displayUrl} alt="Foto do profissional" />
          ) : (
            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
          )}
        </Avatar>

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}

        <div className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full">
          <Upload className="h-4 w-4" />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {isDragActive ? 'Solte a imagem aqui' : 'Clique ou arraste uma foto'}
      </p>

      {displayUrl && onRemove && (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setPreview(null);
            onRemove();
          }}
          disabled={disabled || uploading}
        >
          <X className="h-4 w-4 mr-1" />
          Remover foto
        </Button>
      )}
    </div>
  );
}
```

### 5. Image Resize Utility

```typescript
// apps/web/src/lib/image.ts
export async function resizeImage(file: File, maxSize = 400): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Canvas not supported'));
      return;
    }

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;

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

      canvas.width = width;
      canvas.height = height;

      // Draw and export
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/jpeg',
        0.85
      );

      // Cleanup
      URL.revokeObjectURL(img.src);
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
}
```

### 6. Price Input Component

```typescript
// apps/web/src/components/ui/price-input.tsx
'use client';

import { forwardRef, useState } from 'react';
import { Input } from '@/components/ui/input';

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: number; // cents
  onChange?: (cents: number) => void;
}

export const PriceInput = forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, ...props }, ref) => {
    // Convert cents to display value
    const formatDisplay = (cents: number | undefined) => {
      if (cents === undefined) return '';
      return (cents / 100).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    const [displayValue, setDisplayValue] = useState(formatDisplay(value));

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let input = e.target.value;

      // Remove non-numeric except comma
      input = input.replace(/[^\d,]/g, '');

      // Ensure only one comma
      const parts = input.split(',');
      if (parts.length > 2) {
        input = parts[0] + ',' + parts.slice(1).join('');
      }

      // Limit decimal places
      if (parts.length === 2 && parts[1].length > 2) {
        input = parts[0] + ',' + parts[1].slice(0, 2);
      }

      setDisplayValue(input);

      // Convert to cents
      if (onChange) {
        const [reais = '0', centavos = '00'] = input.split(',');
        const cents = parseInt(reais.replace(/\D/g, '') || '0') * 100 +
          parseInt(centavos.padEnd(2, '0').slice(0, 2) || '0');
        onChange(cents);
      }
    };

    const handleBlur = () => {
      // Format on blur
      if (value !== undefined) {
        setDisplayValue(formatDisplay(value));
      }
    };

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          R$
        </span>
        <Input
          ref={ref}
          {...props}
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          className="pl-10"
          inputMode="decimal"
        />
      </div>
    );
  }
);

PriceInput.displayName = 'PriceInput';
```

### 7. Backend Controller

```typescript
// apps/functions/src/controllers/professionalController.ts
import { Request, Response } from 'express';
import { db, storage } from '../lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const getClinicId = async (userId: string): Promise<string | null> => {
  const snapshot = await db.collection('gendei_clinics')
    .where('ownerId', '==', userId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    const adminSnapshot = await db.collection('gendei_clinics')
      .where('adminIds', 'array-contains', userId)
      .limit(1)
      .get();

    return adminSnapshot.empty ? null : adminSnapshot.docs[0].id;
  }

  return snapshot.docs[0].id;
};

export async function listProfessionals(req: Request, res: Response) {
  try {
    const clinicId = await getClinicId(req.user!.uid);
    if (!clinicId) return res.status(404).json({ error: 'Clinic not found' });

    const { specialty, active = 'true', search, limit = '50', cursor } = req.query;

    let query = db
      .collection('gendei_clinics')
      .doc(clinicId)
      .collection('professionals')
      .where('active', '==', active === 'true')
      .orderBy('name')
      .limit(parseInt(limit as string));

    if (specialty) {
      query = query.where('specialty', '==', specialty);
    }

    if (cursor) {
      const cursorDoc = await db
        .collection('gendei_clinics')
        .doc(clinicId)
        .collection('professionals')
        .doc(cursor as string)
        .get();

      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snapshot = await query.get();
    const professionals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Client-side search filtering (Firestore doesn't support text search)
    let filtered = professionals;
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = professionals.filter(p =>
        p.name.toLowerCase().includes(searchLower)
      );
    }

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];

    return res.json({
      professionals: filtered,
      nextCursor: lastDoc?.id,
      hasMore: snapshot.docs.length === parseInt(limit as string),
    });
  } catch (error) {
    console.error('Error listing professionals:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createProfessional(req: Request, res: Response) {
  try {
    const clinicId = await getClinicId(req.user!.uid);
    if (!clinicId) return res.status(404).json({ error: 'Clinic not found' });

    const data = req.body;

    const professional = {
      ...data,
      clinicId,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await db
      .collection('gendei_clinics')
      .doc(clinicId)
      .collection('professionals')
      .add(professional);

    return res.status(201).json({ id: docRef.id, ...professional });
  } catch (error) {
    console.error('Error creating professional:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getProfessional(req: Request, res: Response) {
  try {
    const clinicId = await getClinicId(req.user!.uid);
    if (!clinicId) return res.status(404).json({ error: 'Clinic not found' });

    const { professionalId } = req.params;

    const doc = await db
      .collection('gendei_clinics')
      .doc(clinicId)
      .collection('professionals')
      .doc(professionalId)
      .get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Professional not found' });
    }

    return res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Error getting professional:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateProfessional(req: Request, res: Response) {
  try {
    const clinicId = await getClinicId(req.user!.uid);
    if (!clinicId) return res.status(404).json({ error: 'Clinic not found' });

    const { professionalId } = req.params;
    const updates = req.body;

    const docRef = db
      .collection('gendei_clinics')
      .doc(clinicId)
      .collection('professionals')
      .doc(professionalId);

    await docRef.update({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const updated = await docRef.get();
    return res.json({ id: updated.id, ...updated.data() });
  } catch (error) {
    console.error('Error updating professional:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteProfessional(req: Request, res: Response) {
  try {
    const clinicId = await getClinicId(req.user!.uid);
    if (!clinicId) return res.status(404).json({ error: 'Clinic not found' });

    const { professionalId } = req.params;

    await db
      .collection('gendei_clinics')
      .doc(clinicId)
      .collection('professionals')
      .doc(professionalId)
      .update({
        active: false,
        deactivatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    return res.json({ success: true, message: 'Professional deactivated' });
  } catch (error) {
    console.error('Error deleting professional:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getPhotoUploadUrl(req: Request, res: Response) {
  try {
    const clinicId = await getClinicId(req.user!.uid);
    if (!clinicId) return res.status(404).json({ error: 'Clinic not found' });

    const { professionalId } = req.params;
    const { contentType } = req.body;

    const bucket = storage.bucket();
    const filePath = `clinics/${clinicId}/professionals/${professionalId}/photo.jpg`;
    const file = bucket.file(filePath);

    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000,
      contentType,
    });

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    return res.json({
      uploadUrl,
      publicUrl,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

### 8. Routes Setup

```typescript
// apps/functions/src/routes/professionals.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  listProfessionals,
  createProfessional,
  getProfessional,
  updateProfessional,
  deleteProfessional,
  getPhotoUploadUrl,
} from '../controllers/professionalController';

const router = Router();

router.use(authMiddleware);

router.get('/', listProfessionals);
router.post('/', createProfessional);
router.get('/:professionalId', getProfessional);
router.patch('/:professionalId', updateProfessional);
router.delete('/:professionalId', deleteProfessional);
router.post('/:professionalId/photo-upload-url', getPhotoUploadUrl);

export default router;
```

---

## Testing

### Run Tests

```bash
# Unit tests
npm test

# Integration tests with emulator
firebase emulators:exec "npm run test:integration"
```

### Manual Testing

```bash
TOKEN="your_firebase_token"

# List professionals
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5001/gendei-dev/us-central1/api/professionals

# Create professional
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dr. João Silva",
    "email": "joao@clinica.com",
    "phone": "11999887766",
    "specialty": "dentist",
    "appointmentDuration": 30,
    "consultationPrice": 15000,
    "workingDays": [1,2,3,4,5],
    "workingHours": {
      "1": {"ranges": [{"from": "08:00", "to": "18:00"}]}
    }
  }' \
  http://localhost:5001/gendei-dev/us-central1/api/professionals
```

---

## Storage Rules

```javascript
// storage.rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /clinics/{clinicId}/professionals/{professionalId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        request.resource.size < 5 * 1024 * 1024 &&
        request.resource.contentType.matches('image/.*');
    }
  }
}
```
