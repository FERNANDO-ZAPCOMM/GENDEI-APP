# Quickstart: Service Management

**Feature**: 003-service-management
**Date**: 2026-02-04

---

## Prerequisites

- Completed 001-clinic-onboarding setup
- Completed 002-professional-management setup
- At least one professional created

---

## Code Implementation

### 1. Service Types

```typescript
// apps/web/src/types/service.ts
import { Timestamp } from 'firebase/firestore';

export interface Service {
  id: string;
  clinicId: string;
  name: string;
  description?: string;
  priceCents: number;
  signalPercentage: number;
  durationMinutes: number;
  professionalIds: string[];
  active: boolean;
  deactivatedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ServiceWithProfessionals extends Service {
  professionals: Array<{
    id: string;
    name: string;
    photoUrl?: string;
    specialty: string;
  }>;
}

export const SERVICE_DURATIONS = [
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

export const DEPOSIT_CONSTRAINTS = {
  min: 10,
  max: 100,
  default: 30,
  step: 5,
} as const;
```

### 2. Validation Schema

```typescript
// apps/web/src/schemas/service.schema.ts
import { z } from 'zod';

export const serviceSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome muito longo'),

  description: z.string()
    .max(500, 'Descrição muito longa')
    .optional()
    .or(z.literal('')),

  priceCents: z.number()
    .int('Preço deve ser um valor inteiro')
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

### 3. API Client

```typescript
// apps/web/src/lib/api/services.ts
import { auth } from '@/lib/firebase';
import { Service, ServiceWithProfessionals } from '@/types/service';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function getAuthHeaders() {
  const token = await auth.currentUser?.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export interface ListServicesParams {
  active?: boolean;
  professionalId?: string;
  search?: string;
}

export async function listServices(params: ListServicesParams = {}): Promise<ServiceWithProfessionals[]> {
  const searchParams = new URLSearchParams();
  if (params.active !== undefined) searchParams.set('active', String(params.active));
  if (params.professionalId) searchParams.set('professionalId', params.professionalId);
  if (params.search) searchParams.set('search', params.search);

  const response = await fetch(`${API_URL}/services?${searchParams}`, {
    headers: await getAuthHeaders(),
  });

  if (!response.ok) throw new Error('Failed to fetch services');
  const data = await response.json();
  return data.services;
}

export async function getService(id: string): Promise<ServiceWithProfessionals> {
  const response = await fetch(`${API_URL}/services/${id}`, {
    headers: await getAuthHeaders(),
  });

  if (!response.ok) throw new Error('Failed to fetch service');
  return response.json();
}

export async function createService(data: Omit<Service, 'id' | 'clinicId' | 'active' | 'createdAt' | 'updatedAt'>): Promise<Service> {
  const response = await fetch(`${API_URL}/services`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create service');
  }
  return response.json();
}

export async function updateService(id: string, data: Partial<Service>): Promise<Service> {
  const response = await fetch(`${API_URL}/services/${id}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) throw new Error('Failed to update service');
  return response.json();
}

export async function deleteService(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/services/${id}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });

  if (!response.ok) throw new Error('Failed to delete service');
}
```

### 4. Query Hooks

```typescript
// apps/web/src/hooks/useServices.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api/services';

export function useServices(params: api.ListServicesParams = {}) {
  return useQuery({
    queryKey: ['services', params],
    queryFn: () => api.listServices(params),
  });
}

export function useService(id: string | undefined) {
  return useQuery({
    queryKey: ['service', id],
    queryFn: () => api.getService(id!),
    enabled: !!id,
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<api.Service> }) =>
      api.updateService(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['service', id] });
    },
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}
```

### 5. Price Utilities

```typescript
// apps/web/src/lib/price.ts

/**
 * Format cents as BRL currency string.
 */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

/**
 * Parse BRL string to cents.
 */
export function parsePriceToCents(value: string): number {
  const cleaned = value.replace(/[^\d,]/g, '');
  const [reais, centavos = '00'] = cleaned.split(',');
  return parseInt(reais || '0') * 100 + parseInt(centavos.slice(0, 2).padEnd(2, '0'));
}

/**
 * Calculate deposit amount in cents.
 */
export function calculateDeposit(priceCents: number, signalPercentage: number): number {
  return Math.round((priceCents * signalPercentage) / 100);
}

/**
 * Format duration in minutes to readable string.
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}
```

### 6. Professional Multi-Select Component

```typescript
// apps/web/src/components/services/ProfessionalMultiSelect.tsx
'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Professional } from '@/types/professional';

interface Props {
  professionals: Professional[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function ProfessionalMultiSelect({ professionals, selected, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);

  const activeProfessionals = professionals.filter(p => p.active);
  const selectedProfessionals = activeProfessionals.filter(p => selected.includes(p.id));

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const remove = (id: string) => {
    onChange(selected.filter(s => s !== id));
  };

  return (
    <div className="space-y-2">
      {/* Selected badges */}
      {selectedProfessionals.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedProfessionals.map(prof => (
            <Badge key={prof.id} variant="secondary" className="gap-1 pr-1">
              <Avatar className="h-4 w-4">
                <AvatarImage src={prof.photoUrl} />
                <AvatarFallback className="text-xs">{prof.name[0]}</AvatarFallback>
              </Avatar>
              <span className="max-w-[100px] truncate">{prof.name}</span>
              <button
                type="button"
                onClick={() => remove(prof.id)}
                className="ml-1 rounded-full hover:bg-muted p-0.5"
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Dropdown */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            {selected.length === 0
              ? 'Selecionar profissionais...'
              : `${selected.length} selecionado(s)`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder="Buscar profissional..." />
            <CommandEmpty>Nenhum profissional encontrado.</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-y-auto">
              {activeProfessionals.map(prof => (
                <CommandItem
                  key={prof.id}
                  onSelect={() => toggle(prof.id)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={prof.photoUrl} />
                      <AvatarFallback>{prof.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm">{prof.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {prof.specialty}
                      </span>
                    </div>
                  </div>
                  <Check
                    className={cn(
                      'h-4 w-4',
                      selected.includes(prof.id) ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

### 7. Percentage Slider Component

```typescript
// apps/web/src/components/ui/percentage-slider.tsx
'use client';

import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

interface Props {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  disabled?: boolean;
}

export function PercentageSlider({
  value,
  onChange,
  min = 10,
  max = 100,
  step = 5,
  label = 'Sinal',
  disabled,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label>{label}</Label>
        <span className="text-sm font-medium">{value}%</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min}%</span>
        <span>{max}%</span>
      </div>
    </div>
  );
}
```

### 8. Service Form Component

```typescript
// apps/web/src/components/services/ServiceForm.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { serviceSchema, ServiceInput } from '@/schemas/service.schema';
import { SERVICE_DURATIONS, DEPOSIT_CONSTRAINTS } from '@/types/service';
import { useProfessionals } from '@/hooks/useProfessionals';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PriceInput } from '@/components/ui/price-input';
import { ProfessionalMultiSelect } from './ProfessionalMultiSelect';
import { PercentageSlider } from '@/components/ui/percentage-slider';

interface Props {
  onSubmit: (data: ServiceInput) => Promise<void>;
  defaultValues?: Partial<ServiceInput>;
  isLoading?: boolean;
}

export function ServiceForm({ onSubmit, defaultValues, isLoading }: Props) {
  const { data: professionalsData } = useProfessionals({ active: true });

  const form = useForm<ServiceInput>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      description: '',
      priceCents: 10000,
      signalPercentage: DEPOSIT_CONSTRAINTS.default,
      durationMinutes: 30,
      professionalIds: [],
      ...defaultValues,
    },
  });

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Serviço</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Limpeza Dental" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição (opcional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Descreva o serviço..."
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="priceCents"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preço</FormLabel>
                <FormControl>
                  <PriceInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="0,00"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="durationMinutes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duração</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(parseInt(v))}
                  value={String(field.value)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SERVICE_DURATIONS.map(({ value, label }) => (
                      <SelectItem key={value} value={String(value)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="signalPercentage"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <PercentageSlider
                  value={field.value}
                  onChange={field.onChange}
                  min={DEPOSIT_CONSTRAINTS.min}
                  max={DEPOSIT_CONSTRAINTS.max}
                  step={DEPOSIT_CONSTRAINTS.step}
                  label="Sinal (depósito)"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="professionalIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Profissionais</FormLabel>
              <FormControl>
                <ProfessionalMultiSelect
                  professionals={professionalsData?.professionals || []}
                  selected={field.value}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Salvando...' : 'Salvar Serviço'}
        </Button>
      </form>
    </Form>
  );
}
```

### 9. Backend Controller

```typescript
// apps/functions/src/controllers/serviceController.ts
import { Request, Response } from 'express';
import { db } from '../lib/firebase-admin';
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

export async function listServices(req: Request, res: Response) {
  try {
    const clinicId = await getClinicId(req.user!.uid);
    if (!clinicId) return res.status(404).json({ error: 'Clinic not found' });

    const { active = 'true', professionalId, search } = req.query;

    let query = db
      .collection('gendei_clinics')
      .doc(clinicId)
      .collection('services')
      .where('active', '==', active === 'true')
      .orderBy('name');

    if (professionalId) {
      query = query.where('professionalIds', 'array-contains', professionalId);
    }

    const [servicesSnapshot, professionalsSnapshot] = await Promise.all([
      query.get(),
      db.collection('gendei_clinics').doc(clinicId).collection('professionals').get(),
    ]);

    const profMap = new Map(
      professionalsSnapshot.docs.map(d => [d.id, { id: d.id, ...d.data() }])
    );

    let services = servicesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        professionals: (data.professionalIds || [])
          .map((id: string) => profMap.get(id))
          .filter(Boolean)
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            photoUrl: p.photoUrl,
            specialty: p.specialty,
          })),
      };
    });

    if (search) {
      const searchLower = (search as string).toLowerCase();
      services = services.filter(s => s.name.toLowerCase().includes(searchLower));
    }

    return res.json({ services });
  } catch (error) {
    console.error('Error listing services:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createService(req: Request, res: Response) {
  try {
    const clinicId = await getClinicId(req.user!.uid);
    if (!clinicId) return res.status(404).json({ error: 'Clinic not found' });

    const { name, description, priceCents, signalPercentage, durationMinutes, professionalIds } = req.body;

    // Validate professional IDs
    const profDocs = await Promise.all(
      professionalIds.map((id: string) =>
        db.collection('gendei_clinics').doc(clinicId).collection('professionals').doc(id).get()
      )
    );

    const invalidIds = profDocs.filter(doc => !doc.exists || !doc.data()?.active);
    if (invalidIds.length > 0) {
      return res.status(400).json({ error: 'Invalid professional IDs' });
    }

    const service = {
      clinicId,
      name,
      description: description || null,
      priceCents,
      signalPercentage,
      durationMinutes,
      professionalIds,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await db
      .collection('gendei_clinics')
      .doc(clinicId)
      .collection('services')
      .add(service);

    return res.status(201).json({ id: docRef.id, ...service });
  } catch (error) {
    console.error('Error creating service:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getService(req: Request, res: Response) {
  try {
    const clinicId = await getClinicId(req.user!.uid);
    if (!clinicId) return res.status(404).json({ error: 'Clinic not found' });

    const { serviceId } = req.params;

    const [serviceDoc, professionalsSnapshot] = await Promise.all([
      db.collection('gendei_clinics').doc(clinicId).collection('services').doc(serviceId).get(),
      db.collection('gendei_clinics').doc(clinicId).collection('professionals').get(),
    ]);

    if (!serviceDoc.exists) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const data = serviceDoc.data()!;
    const profMap = new Map(
      professionalsSnapshot.docs.map(d => [d.id, { id: d.id, ...d.data() }])
    );

    return res.json({
      id: serviceDoc.id,
      ...data,
      professionals: (data.professionalIds || [])
        .map((id: string) => profMap.get(id))
        .filter(Boolean)
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          photoUrl: p.photoUrl,
          specialty: p.specialty,
        })),
    });
  } catch (error) {
    console.error('Error getting service:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateService(req: Request, res: Response) {
  try {
    const clinicId = await getClinicId(req.user!.uid);
    if (!clinicId) return res.status(404).json({ error: 'Clinic not found' });

    const { serviceId } = req.params;
    const updates = req.body;

    // Validate professional IDs if provided
    if (updates.professionalIds) {
      const profDocs = await Promise.all(
        updates.professionalIds.map((id: string) =>
          db.collection('gendei_clinics').doc(clinicId).collection('professionals').doc(id).get()
        )
      );
      const invalidIds = profDocs.filter(doc => !doc.exists);
      if (invalidIds.length > 0) {
        return res.status(400).json({ error: 'Invalid professional IDs' });
      }
    }

    const docRef = db
      .collection('gendei_clinics')
      .doc(clinicId)
      .collection('services')
      .doc(serviceId);

    await docRef.update({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const updated = await docRef.get();
    return res.json({ id: updated.id, ...updated.data() });
  } catch (error) {
    console.error('Error updating service:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteService(req: Request, res: Response) {
  try {
    const clinicId = await getClinicId(req.user!.uid);
    if (!clinicId) return res.status(404).json({ error: 'Clinic not found' });

    const { serviceId } = req.params;

    await db
      .collection('gendei_clinics')
      .doc(clinicId)
      .collection('services')
      .doc(serviceId)
      .update({
        active: false,
        deactivatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    return res.json({ success: true, message: 'Service deactivated' });
  } catch (error) {
    console.error('Error deleting service:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

### 10. Routes

```typescript
// apps/functions/src/routes/services.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  listServices,
  createService,
  getService,
  updateService,
  deleteService,
} from '../controllers/serviceController';

const router = Router();

router.use(authMiddleware);

router.get('/', listServices);
router.post('/', createService);
router.get('/:serviceId', getService);
router.put('/:serviceId', updateService);
router.delete('/:serviceId', deleteService);

export default router;
```

---

## Testing

```bash
TOKEN="your_firebase_token"

# Create service
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Consulta Geral",
    "priceCents": 15000,
    "signalPercentage": 30,
    "durationMinutes": 30,
    "professionalIds": ["prof_001"]
  }' \
  http://localhost:5001/gendei-dev/us-central1/api/services

# List services
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5001/gendei-dev/us-central1/api/services
```
