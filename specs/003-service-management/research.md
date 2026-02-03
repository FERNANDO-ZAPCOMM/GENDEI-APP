# Research: Service Management

**Feature**: 003-service-management
**Date**: 2026-02-04

---

## Technology Decisions

### 1. Data Storage Pattern

**Decision**: Firestore subcollection under clinic (same as professionals)

**Path**: `gendei_clinics/{clinicId}/services/{serviceId}`

**Why Subcollection**:
- Consistent with professional storage pattern
- Security rules cascade from clinic
- Efficient queries within clinic scope
- Natural data ownership model

```typescript
// Query services for a clinic
const servicesRef = db
  .collection('gendei_clinics')
  .doc(clinicId)
  .collection('services')
  .where('active', '==', true)
  .orderBy('name');
```

---

### 2. Price Storage Format

**Decision**: Integer cents (same as professional consultationPrice)

**Why Cents**:
- No floating-point precision issues
- Consistent with 002-professional-management
- Standard financial data practice
- Easy arithmetic operations

**Conversion Functions**:
```typescript
// Display: cents to BRL string
function formatPrice(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

// Input: BRL string to cents
function parsePriceToCents(value: string): number {
  const cleaned = value.replace(/[^\d,]/g, '');
  const [reais, centavos = '00'] = cleaned.split(',');
  return parseInt(reais || '0') * 100 + parseInt(centavos.slice(0, 2).padEnd(2, '0'));
}
```

---

### 3. Deposit Percentage Design

**Decision**: Store as integer 10-100, UI shows as slider

**Why Integer**:
- Simpler validation (min 10, max 100)
- No decimal complications
- Easy percentage calculations

**Deposit Calculation**:
```typescript
// Calculate deposit amount for an appointment
function calculateDeposit(servicePriceCents: number, signalPercentage: number): number {
  return Math.round((servicePriceCents * signalPercentage) / 100);
}

// Example: R$ 200,00 service with 30% deposit
// calculateDeposit(20000, 30) = 6000 cents = R$ 60,00
```

**Default Value**: 30% (configurable per service)

---

### 4. Duration Options

**Decision**: Predefined increments matching professional durations

**Options**:
```typescript
const DURATION_OPTIONS = [
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 45, label: '45 minutos' },
  { value: 60, label: '1 hora' },
  { value: 90, label: '1h 30min' },
  { value: 120, label: '2 horas' },
  { value: 150, label: '2h 30min' },
  { value: 180, label: '3 horas' },
  { value: 240, label: '4 horas' },
] as const;
```

**Why Fixed Options**:
- Aligns with calendar slot calculations
- Consistent with professional appointment durations
- Prevents odd duration values

---

### 5. Professional Assignment

**Decision**: Array of professional IDs with validation

**Why Array Reference**:
- Many-to-many relationship (service ↔ professionals)
- Efficient querying from both directions
- No join table needed in Firestore

**Validation**:
```typescript
// Server-side: Validate all professional IDs belong to clinic
async function validateProfessionalIds(clinicId: string, professionalIds: string[]): Promise<boolean> {
  const professionalsRef = db
    .collection('gendei_clinics')
    .doc(clinicId)
    .collection('professionals');

  const docs = await Promise.all(
    professionalIds.map(id => professionalsRef.doc(id).get())
  );

  return docs.every(doc => doc.exists && doc.data()?.active);
}
```

---

### 6. Multi-Select UI Component

**Decision**: Custom multi-select with professional photos

**Why Custom**:
- Shows professional photos
- Better UX than native multi-select
- Consistent with design system

**Implementation**:
```typescript
// apps/web/src/components/services/ProfessionalMultiSelect.tsx
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Check, X } from 'lucide-react';

interface Props {
  professionals: Professional[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function ProfessionalMultiSelect({ professionals, selected, onChange }: Props) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="space-y-2">
      {/* Selected badges */}
      <div className="flex flex-wrap gap-2">
        {selected.map(id => {
          const prof = professionals.find(p => p.id === id);
          return prof ? (
            <Badge key={id} variant="secondary" className="gap-1">
              <Avatar className="h-4 w-4">
                <AvatarImage src={prof.photoUrl} />
                <AvatarFallback>{prof.name[0]}</AvatarFallback>
              </Avatar>
              {prof.name}
              <X className="h-3 w-3 cursor-pointer" onClick={() => toggle(id)} />
            </Badge>
          ) : null;
        })}
      </div>

      {/* Dropdown list */}
      <div className="border rounded-md max-h-48 overflow-y-auto">
        {professionals.filter(p => p.active).map(prof => (
          <div
            key={prof.id}
            className="flex items-center gap-2 p-2 hover:bg-muted cursor-pointer"
            onClick={() => toggle(prof.id)}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={prof.photoUrl} />
              <AvatarFallback>{prof.name[0]}</AvatarFallback>
            </Avatar>
            <span className="flex-1">{prof.name}</span>
            {selected.includes(prof.id) && <Check className="h-4 w-4 text-primary" />}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### 7. Soft Delete Pattern

**Decision**: Set `active: false` (same as professionals)

**Why Soft Delete**:
- Services may have past appointments
- Allows reactivation if needed
- Analytics data preserved
- Audit trail maintained

**Hard Delete Check**:
```typescript
// Check if service has any non-completed appointments
async function canHardDelete(clinicId: string, serviceId: string): Promise<boolean> {
  const appointmentsRef = db.collection('gendei_appointments');
  const snapshot = await appointmentsRef
    .where('clinicId', '==', clinicId)
    .where('serviceId', '==', serviceId)
    .where('status', 'not-in', ['completed', 'cancelled', 'no_show'])
    .limit(1)
    .get();

  return snapshot.empty;
}
```

---

### 8. Query Patterns

**List Services with Professionals**:
```typescript
// Get services and resolve professional names
async function getServicesWithProfessionals(clinicId: string) {
  const [services, professionals] = await Promise.all([
    db.collection('gendei_clinics').doc(clinicId).collection('services')
      .where('active', '==', true).get(),
    db.collection('gendei_clinics').doc(clinicId).collection('professionals')
      .where('active', '==', true).get(),
  ]);

  const profMap = new Map(professionals.docs.map(d => [d.id, d.data()]));

  return services.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      professionals: data.professionalIds
        .map((id: string) => profMap.get(id))
        .filter(Boolean),
    };
  });
}
```

**Services by Professional**:
```typescript
// Get services offered by a specific professional
const snapshot = await db
  .collection('gendei_clinics')
  .doc(clinicId)
  .collection('services')
  .where('professionalIds', 'array-contains', professionalId)
  .where('active', '==', true)
  .get();
```

---

### 9. Service Availability Check

**Decision**: Service available if at least one assigned professional is available

**Implementation** (used in scheduling):
```typescript
async function isServiceAvailable(
  clinicId: string,
  serviceId: string,
  date: string,
  time: string
): Promise<{ available: boolean; professionals: Professional[] }> {
  // Get service
  const serviceDoc = await db
    .collection('gendei_clinics')
    .doc(clinicId)
    .collection('services')
    .doc(serviceId)
    .get();

  const service = serviceDoc.data();
  if (!service?.active) return { available: false, professionals: [] };

  // Check each assigned professional's availability
  const availableProfessionals = [];

  for (const profId of service.professionalIds) {
    const isAvailable = await checkProfessionalAvailability(clinicId, profId, date, time);
    if (isAvailable) {
      availableProfessionals.push(profId);
    }
  }

  return {
    available: availableProfessionals.length > 0,
    professionals: availableProfessionals,
  };
}
```

---

### 10. Form Validation

**Zod Schema**:
```typescript
import { z } from 'zod';

export const serviceSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome muito longo'),

  description: z.string()
    .max(500, 'Descrição muito longa')
    .optional(),

  priceCents: z.number()
    .int('Preço deve ser um número inteiro')
    .min(0, 'Preço não pode ser negativo'),

  signalPercentage: z.number()
    .int()
    .min(10, 'Sinal mínimo: 10%')
    .max(100, 'Sinal máximo: 100%'),

  durationMinutes: z.number()
    .int()
    .min(15, 'Duração mínima: 15 minutos')
    .max(240, 'Duração máxima: 4 horas'),

  professionalIds: z.array(z.string())
    .min(1, 'Selecione pelo menos um profissional'),
});

export type ServiceInput = z.infer<typeof serviceSchema>;
```

---

## Performance Considerations

### Query Optimization
- Index on `(clinicId, active, name)` for list queries
- Index on `(clinicId, professionalIds)` for professional filtering

### Caching
- TanStack Query with 5-minute stale time
- Invalidate on service mutations
- Prefetch on list hover

### Bundle
- Lazy load ProfessionalMultiSelect
- Keep main list lightweight

---

## Security Considerations

1. **Authorization**: Only clinic members can manage services
2. **Professional Validation**: Server validates professional IDs
3. **Price Validation**: Server ensures non-negative integer
4. **Referential Integrity**: Soft delete by default

---

## References

- [Firestore Arrays](https://firebase.google.com/docs/firestore/query-data/queries#array-contains)
- [TanStack Query Mutations](https://tanstack.com/query/latest/docs/react/guides/mutations)
- [shadcn/ui Slider](https://ui.shadcn.com/docs/components/slider)
