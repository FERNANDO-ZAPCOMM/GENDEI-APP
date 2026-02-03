# Research: Professional Management

**Feature**: 002-professional-management
**Date**: 2026-02-04

---

## Technology Decisions

### 1. Data Storage Pattern

**Decision**: Firestore subcollection under clinic

**Alternatives Considered**:

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Subcollection | Scoped queries, security | More nesting | **Selected** |
| Top-level collection | Flat structure | Complex security rules | Rejected |
| Embedded array | Single read | Size limits, updates | Rejected |

**Why Subcollection**:
- Natural data ownership (professional belongs to clinic)
- Security rules cascade from parent
- Efficient queries within clinic scope
- Scales with number of professionals

**Path**: `gendei_clinics/{clinicId}/professionals/{professionalId}`

```typescript
// Query all professionals for a clinic
const professionalsRef = db
  .collection('gendei_clinics')
  .doc(clinicId)
  .collection('professionals');

const snapshot = await professionalsRef
  .where('active', '==', true)
  .orderBy('name')
  .get();
```

---

### 2. State Management

**Decision**: TanStack Query 5 for server state

**Alternatives Considered**:

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| TanStack Query | Caching, mutations, devtools | Learning curve | **Selected** |
| SWR | Simple, lightweight | Less features | Rejected |
| Zustand | Client state | Not for server state | Rejected |
| Redux | Full control | Overkill, boilerplate | Rejected |

**Why TanStack Query**:
- Built for server state (fetching, caching)
- Optimistic updates for instant UI
- Automatic background refetching
- Excellent devtools for debugging
- Handles loading/error states

**Implementation**:
```typescript
// apps/web/src/hooks/useProfessionals.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useProfessionals(clinicId: string) {
  return useQuery({
    queryKey: ['professionals', clinicId],
    queryFn: () => api.professionals.list(clinicId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateProfessional() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.professionals.create,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['professionals', variables.clinicId],
      });
    },
  });
}
```

---

### 3. Photo Upload Strategy

**Decision**: Direct upload to Firebase Storage with signed URLs

**Alternatives Considered**:

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Signed URL upload | Direct to storage, fast | Needs backend URL generation | **Selected** |
| Base64 in Firestore | Simple | Size limits, slow | Rejected |
| Cloud Function proxy | Control | Extra hop, slower | Rejected |
| Third-party (Cloudinary) | Features | Cost, dependency | Rejected |

**Why Signed URLs**:
- Client uploads directly to Storage (fast)
- Backend controls access via signed URLs
- No data through Functions (cost savings)
- Built-in to Firebase

**Implementation**:
```typescript
// Backend: Generate signed upload URL
import { getStorage } from 'firebase-admin/storage';

async function getUploadUrl(clinicId: string, professionalId: string) {
  const bucket = getStorage().bucket();
  const filePath = `clinics/${clinicId}/professionals/${professionalId}/photo.jpg`;
  const file = bucket.file(filePath);

  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    contentType: 'image/jpeg',
  });

  return { uploadUrl: url, filePath };
}

// Frontend: Upload photo
async function uploadPhoto(file: File, uploadUrl: string) {
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': 'image/jpeg',
    },
  });
}
```

---

### 4. Image Processing

**Decision**: Client-side resize with browser canvas

**Alternatives Considered**:

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Client-side canvas | Fast, no server cost | Browser-dependent | **Selected** |
| Cloud Function + sharp | Consistent | Latency, cost | Future option |
| Firebase Extension | Easy setup | Less control | Rejected |

**Why Client-Side**:
- Immediate feedback
- Reduces upload size
- No server processing cost
- Good enough for profile photos

**Implementation**:
```typescript
// apps/web/src/lib/image.ts
export async function resizeImage(file: File, maxWidth = 400): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Canvas error')),
        'image/jpeg',
        0.85
      );
    };

    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
```

---

### 5. Working Hours Data Structure

**Decision**: Day-indexed object matching clinic structure

**Why Same as Clinic**:
- Consistent data model across codebase
- Easy comparison with clinic hours
- Reusable UI components
- Familiar to developers

**Structure**:
```typescript
interface ProfessionalWorkingHours {
  [day: number]: {
    ranges: Array<{ from: string; to: string }>;
  };
}

// Only store days the professional works
const workingHours: ProfessionalWorkingHours = {
  1: { ranges: [{ from: '08:00', to: '12:00' }, { from: '14:00', to: '18:00' }] },
  2: { ranges: [{ from: '08:00', to: '12:00' }, { from: '14:00', to: '18:00' }] },
  3: { ranges: [{ from: '08:00', to: '12:00' }] },  // Half day Wednesday
  4: { ranges: [{ from: '08:00', to: '12:00' }, { from: '14:00', to: '18:00' }] },
  5: { ranges: [{ from: '08:00', to: '12:00' }, { from: '14:00', to: '17:00' }] },
};

// workingDays derived from keys: [1, 2, 3, 4, 5]
```

---

### 6. Price Handling

**Decision**: Store in cents (integer), display in BRL

**Why Cents**:
- Avoids floating-point precision issues
- Standard practice for financial data
- Easy calculations (no decimals)
- Database-friendly (integer type)

**Implementation**:
```typescript
// Convert cents to display
function formatPrice(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

// 15000 cents → "R$ 150,00"

// Parse input to cents
function parseToCents(value: string): number {
  const cleaned = value.replace(/[^\d,]/g, '');
  const [reais, centavos = '00'] = cleaned.split(',');
  return parseInt(reais || '0') * 100 + parseInt(centavos.padEnd(2, '0').slice(0, 2));
}

// "150,00" → 15000 cents
```

---

### 7. Soft Delete Pattern

**Decision**: Set `active: false` instead of deleting

**Why Soft Delete**:
- Professionals may have past appointments
- Easy to restore if deactivated by mistake
- Analytics data preserved
- Audit trail maintained

**Implementation**:
```typescript
// Backend: "Delete" endpoint actually deactivates
export async function deleteProfessional(req: Request, res: Response) {
  const { professionalId } = req.params;
  const clinicId = req.clinicId;

  const profRef = db
    .collection('gendei_clinics')
    .doc(clinicId)
    .collection('professionals')
    .doc(professionalId);

  // Soft delete
  await profRef.update({
    active: false,
    deactivatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return res.json({ success: true });
}
```

---

### 8. Appointment Duration Options

**Decision**: Predefined increments in minutes

**Options**:
```typescript
const DURATION_OPTIONS = [
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 45, label: '45 minutos' },
  { value: 60, label: '1 hora' },
  { value: 90, label: '1h 30min' },
  { value: 120, label: '2 horas' },
] as const;

// Default: 30 minutes
const DEFAULT_DURATION = 30;
```

**Why Fixed Options**:
- Aligns with calendar time slots
- Easier scheduling calculations
- Prevents odd durations (e.g., 17 minutes)
- Standard practice in healthcare

---

### 9. Photo Upload Component

**Decision**: react-dropzone with preview

**Why react-dropzone**:
- Drag-and-drop support
- File validation built-in
- Accessibility compliant
- Works with touch devices

**Implementation**:
```typescript
// apps/web/src/components/professionals/PhotoUpload.tsx
import { useDropzone } from 'react-dropzone';

export function PhotoUpload({ onUpload, currentUrl }: Props) {
  const [preview, setPreview] = useState<string | null>(currentUrl || null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': ['.jpeg', '.jpg', '.png'] },
    maxSize: 5 * 1024 * 1024, // 5MB
    onDrop: async ([file]) => {
      const resized = await resizeImage(file);
      setPreview(URL.createObjectURL(resized));
      onUpload(resized);
    },
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer',
        isDragActive && 'border-primary bg-primary/10'
      )}
    >
      <input {...getInputProps()} />
      {preview ? (
        <img src={preview} alt="Preview" className="w-32 h-32 rounded-full mx-auto object-cover" />
      ) : (
        <p>Arraste uma foto ou clique para selecionar</p>
      )}
    </div>
  );
}
```

---

### 10. List Filtering Strategy

**Decision**: URL-based filters with TanStack Query

**Why URL-Based**:
- Shareable/bookmarkable URLs
- Browser back/forward works
- SEO friendly
- Easy to implement with Next.js

**Implementation**:
```typescript
// apps/web/src/app/[locale]/dashboard/professionals/page.tsx
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useProfessionals } from '@/hooks/useProfessionals';

export default function ProfessionalsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const filters = {
    specialty: searchParams.get('specialty') || undefined,
    active: searchParams.get('active') !== 'false',
    search: searchParams.get('q') || undefined,
  };

  const { data, isLoading } = useProfessionals(clinicId, filters);

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  };

  // ...
}
```

---

## Performance Considerations

### Query Optimization
- Index on `(clinicId, active, specialty)`
- Limit list to 50 professionals per page
- Prefetch on hover for detail view

### Image Optimization
- Resize to 400x400 max before upload
- JPEG quality at 85%
- Use WebP where supported

### Bundle Size
- Lazy load photo upload component
- Tree-shake TanStack Query

---

## Security Considerations

1. **Authorization**: Verify clinic membership before any operation
2. **File Validation**: Check MIME type and size on upload
3. **Storage Rules**: Scope access to clinic members
4. **XSS Prevention**: Sanitize bio field
5. **Rate Limiting**: Prevent bulk photo uploads

---

## References

- [TanStack Query](https://tanstack.com/query/latest)
- [Firebase Storage](https://firebase.google.com/docs/storage)
- [react-dropzone](https://react-dropzone.js.org/)
- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
