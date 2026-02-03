# Quickstart: Patient Management

**Feature**: 007-patient-management
**Date**: 2026-02-04

---

## Key Code Examples

### Patient Controller

```typescript
// apps/functions/src/controllers/patientController.ts
export async function createPatient(req: Request, res: Response) {
  const clinicId = req.clinicId!;
  const data = req.body;

  // Check for existing patient by phone
  const existing = await db.collection('gendei_patients')
    .where('phone', '==', normalizePhone(data.phone))
    .limit(1)
    .get();

  if (!existing.empty) {
    const existingPatient = existing.docs[0];
    const patientData = existingPatient.data();

    // Add clinic to existing patient if not already
    if (!patientData.clinicIds.includes(clinicId)) {
      await existingPatient.ref.update({
        clinicIds: FieldValue.arrayUnion(clinicId),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return res.json({ id: existingPatient.id, ...patientData, isExisting: true });
  }

  // Create new patient
  const patient = {
    clinicIds: [clinicId],
    name: data.name,
    nameLower: data.name.toLowerCase(),
    phone: normalizePhone(data.phone),
    email: data.email || null,
    dateOfBirth: data.dateOfBirth || null,
    cpf: data.cpf || null,
    address: data.address || null,
    city: data.city || null,
    state: data.state || null,
    zipCode: data.zipCode || null,
    whatsappPhone: normalizePhone(data.phone),
    notes: data.notes || null,
    tags: data.tags || [],
    totalAppointments: 0,
    completedAppointments: 0,
    cancelledAppointments: 0,
    noShowCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: req.user!.uid,
  };

  const docRef = await db.collection('gendei_patients').add(patient);

  return res.status(201).json({ id: docRef.id, ...patient });
}

export async function searchPatients(req: Request, res: Response) {
  const clinicId = req.clinicId!;
  const query = (req.query.q as string || '').trim();

  if (query.length < 2) {
    return res.json({ patients: [] });
  }

  const results: any[] = [];

  // Search by phone
  if (/^\d+$/.test(query)) {
    const byPhone = await db.collection('gendei_patients')
      .where('clinicIds', 'array-contains', clinicId)
      .where('phone', '>=', '+55' + query)
      .where('phone', '<=', '+55' + query + '\uf8ff')
      .limit(10)
      .get();

    results.push(...byPhone.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  // Search by name
  const byName = await db.collection('gendei_patients')
    .where('clinicIds', 'array-contains', clinicId)
    .where('nameLower', '>=', query.toLowerCase())
    .where('nameLower', '<=', query.toLowerCase() + '\uf8ff')
    .limit(10)
    .get();

  results.push(...byName.docs.map(d => ({ id: d.id, ...d.data() })));

  // Deduplicate
  const unique = [...new Map(results.map(p => [p.id, p])).values()];

  return res.json({ patients: unique.slice(0, 10) });
}

export async function getPatientAppointments(req: Request, res: Response) {
  const { id } = req.params;

  const appointments = await db.collection('gendei_appointments')
    .where('patientId', '==', id)
    .orderBy('date', 'desc')
    .orderBy('time', 'desc')
    .limit(50)
    .get();

  return res.json({
    appointments: appointments.docs.map(d => ({ id: d.id, ...d.data() })),
  });
}
```

### Patient List Component

```typescript
// apps/web/src/app/[locale]/dashboard/patients/page.tsx
'use client';

import { useState } from 'react';
import { usePatients, useSearchPatients } from '@/hooks/usePatients';
import { Input } from '@/components/ui/input';
import { PatientCard } from '@/components/patients/PatientCard';
import { useDebounce } from '@/hooks/useDebounce';

export default function PatientsPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const { data: allPatients, isLoading: loadingAll } = usePatients({ limit: 50 });
  const { data: searchResults, isLoading: loadingSearch } = useSearchPatients(debouncedSearch);

  const patients = debouncedSearch ? searchResults?.patients : allPatients?.patients;
  const isLoading = debouncedSearch ? loadingSearch : loadingAll;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Pacientes</h1>
        <Button asChild>
          <Link href="/dashboard/patients/new">Novo Paciente</Link>
        </Button>
      </div>

      <Input
        placeholder="Buscar por nome ou telefone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      {isLoading ? (
        <div>Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients?.map((patient) => (
            <PatientCard key={patient.id} patient={patient} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Query Hooks

```typescript
// apps/web/src/hooks/usePatients.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function usePatients(params: { limit?: number; cursor?: string; tag?: string } = {}) {
  return useQuery({
    queryKey: ['patients', params],
    queryFn: () => api.patients.list(params),
  });
}

export function useSearchPatients(query: string) {
  return useQuery({
    queryKey: ['patients', 'search', query],
    queryFn: () => api.patients.search(query),
    enabled: query.length >= 2,
  });
}

export function usePatient(id: string | undefined) {
  return useQuery({
    queryKey: ['patient', id],
    queryFn: () => api.patients.get(id!),
    enabled: !!id,
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.patients.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}
```

---

## Routes

```typescript
// apps/functions/src/routes/patients.ts
const router = Router();

router.get('/', listPatients);
router.get('/search', searchPatients);
router.get('/:id', getPatient);
router.post('/', createPatient);
router.patch('/:id', updatePatient);
router.delete('/:id', deletePatient);
router.get('/:id/appointments', getPatientAppointments);

export default router;
```
